import * as fs from 'fs';
import * as path from 'path';

// Type definitions
type Constructor = new (...args: any[]) => any;
type AbstractConstructor = abstract new (...args: any[]) => any;
type AnyFunction = (...args: any[]) => any;
type DecoratedTarget = Constructor | AbstractConstructor | AnyFunction;

// Interface for decorator options
interface FeatureDecoratorOptions {
    label: string;
    defaultMessage: string;
    blockUsage?: boolean;
    bypassEnvVar?: string;
}

// Load .env file (simple implementation)
function loadDotenv(): void {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split('\n');

            for (const line of lines) {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const [, key, value] = match;
                    if (!process.env[key]) {
                        process.env[key] = value.replace(/^["']|["']$/g, '');
                    }
                }
            }
        }
    } catch (error) {
        // Silently ignore errors in loading .env
    }
}

// Decorator factory function
function makeFeatureDecorator(options: FeatureDecoratorOptions) {
    const { label, defaultMessage, blockUsage = false, bypassEnvVar } = options;

    // Overloaded decorator function
    function decoratorFactory(): MethodDecorator & ClassDecorator;
    function decoratorFactory(message: string): MethodDecorator & ClassDecorator;
    function decoratorFactory<T extends DecoratedTarget>(target: T, propertyKey?: string | symbol, descriptor?: PropertyDescriptor): T | PropertyDescriptor | void;
    function decoratorFactory<T extends DecoratedTarget>(
        messageOrTarget?: string | T,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor
    ): any {
        // Case 1: Used as @decorator without parentheses (direct decoration)
        // messageOrTarget is the decorated class/function/method
        if (
            messageOrTarget !== undefined &&
            (typeof messageOrTarget === 'function' || typeof messageOrTarget === 'object')
        ) {
            return createDecorator(defaultMessage, label, blockUsage, bypassEnvVar)(
                messageOrTarget as T, propertyKey, descriptor
            );
        }

        // Case 2: Used as @decorator() with or without message
        // messageOrTarget is either undefined or a string message
        const message = typeof messageOrTarget === 'string' ? messageOrTarget : defaultMessage;
        return createDecorator(message, label, blockUsage, bypassEnvVar);
    }

    return decoratorFactory;
}

// Create the actual decorator
function createDecorator(
    message: string,
    label: string,
    blockUsage: boolean,
    bypassEnvVar?: string
) {
    return function decorator<T extends DecoratedTarget>(
        target: T | any,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor
    ): T | PropertyDescriptor | void {
        // Method decorator case (3 arguments)
        if (arguments.length === 3 && descriptor && propertyKey) {
            const methodName = String(propertyKey);
            const className = target.constructor?.name || target.name || 'Unknown';
            const msg = `[${label.toUpperCase()}] ${className}.${methodName}: ${message}`;
            
            const originalMethod = descriptor.value;
            if (typeof originalMethod !== 'function') {
                throw new TypeError(
                    `@${label} can only be applied to methods, classes, or functions`
                );
            }

            descriptor.value = function (this: any, ...args: any[]): any {
                // Load .env file at call time
                loadDotenv();

                // Check if usage should be bypassed via environment variable at call time
                const shouldBypass =
                    bypassEnvVar !== undefined &&
                    process.env[bypassEnvVar]?.toLowerCase() === 'true';

                if (shouldBypass) {
                    // Bypass completely - no warning, no error
                } else if (blockUsage) {
                    throw new Error(msg);
                } else {
                    console.warn(msg);
                }

                return originalMethod.apply(this, args);
            };

            // For method decorators, we must return the descriptor or void
            return descriptor;
        }

        // Class or function decorator case (1 argument)
        const decoratedTarget = target as T;
        const objName = decoratedTarget.name || decoratedTarget.constructor.name;
        const msg = `[${label.toUpperCase()}] ${objName}: ${message}`;

        // Check if target is a class constructor
        if (decoratedTarget.prototype && typeof decoratedTarget === 'function') {
            // For classes, wrap the constructor
            const OriginalClass = decoratedTarget as Constructor;
            
            function WrappedClass(this: any, ...args: any[]) {
                // Load .env file at instantiation time
                loadDotenv();

                // Check if usage should be bypassed via environment variable at call time
                const shouldBypass =
                    bypassEnvVar !== undefined &&
                    process.env[bypassEnvVar]?.toLowerCase() === 'true';

                if (shouldBypass) {
                    // Bypass completely - no warning, no error
                } else if (blockUsage) {
                    throw new Error(msg);
                } else {
                    console.warn(msg);
                }

                // Call the original constructor
                return new OriginalClass(...args);
            }

            // Copy prototype and static properties
            WrappedClass.prototype = OriginalClass.prototype;
            Object.setPrototypeOf(WrappedClass, OriginalClass);
            Object.defineProperty(WrappedClass, 'name', { value: OriginalClass.name });

            return WrappedClass as T;
        }
        // Decorating a function
        else if (typeof decoratedTarget === 'function') {
            const originalFunction = decoratedTarget as AnyFunction;

            function wrapper(this: any, ...args: any[]): any {
                // Load .env file at call time
                loadDotenv();

                // Check if usage should be bypassed via environment variable at call time
                const shouldBypass =
                    bypassEnvVar !== undefined &&
                    process.env[bypassEnvVar]?.toLowerCase() === 'true';

                if (shouldBypass) {
                    // Bypass completely - no warning, no error
                } else if (blockUsage) {
                    throw new Error(msg);
                } else {
                    console.warn(msg);
                }

                return originalFunction.apply(this, args);
            }

            // Copy function properties
            Object.setPrototypeOf(wrapper, originalFunction);
            Object.defineProperty(wrapper, 'name', { value: originalFunction.name });
            Object.defineProperty(wrapper, 'length', { value: originalFunction.length });

            return wrapper as T;
        } else {
            throw new TypeError(
                `@${label} can only be applied to classes, methods, or callable objects`
            );
        }
    };
}

// Create the specific decorators
export const workingInProgress = makeFeatureDecorator({
    label: 'WIP',
    defaultMessage:
        'This feature is a work in progress and is not working completely. ADK ' +
        'users are not supposed to use it.',
    blockUsage: true,
    bypassEnvVar: 'ADK_ALLOW_WIP_FEATURES'
});

export const experimental = makeFeatureDecorator({
    label: 'EXPERIMENTAL',
    defaultMessage:
        'This feature is experimental and may change or be removed in future ' +
        'versions without notice. It may introduce breaking changes at any time.'
});
