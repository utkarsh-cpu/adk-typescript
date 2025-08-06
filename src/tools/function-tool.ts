import { BaseTool } from './base-tool';
import { ToolContext } from './tool-context';
import { FunctionDeclaration } from '@google/genai';

/**
 * A tool that wraps a user-defined function.
 */
export class FunctionTool extends BaseTool {
    private func: Function;
    private ignoreParams: string[] = ['toolContext', 'inputStream'];

    constructor(options: { func: Function }) {
        // Extract metadata from the function
        let name = '';
        let description = '';

        // Handle different types of callables
        if (options.func.name) {
            name = options.func.name;
        } else if (options.func.constructor?.name) {
            name = options.func.constructor.name;
        } else {
            name = 'anonymous_function';
        }

        // Get documentation
        if (options.func.toString) {
            const funcStr = options.func.toString();
            // Try to extract JSDoc comment
            const jsdocMatch = funcStr.match(/\/\*\*([\s\S]*?)\*\//);
            if (jsdocMatch) {
                description = jsdocMatch[1]
                    .split('\n')
                    .map(line => line.replace(/^\s*\*\s?/, '').trim())
                    .filter(line => line.length > 0)
                    .join(' ');
            }
        }

        super(
            name,
            description || `Function tool: ${name}`,
            false // is_long_running
        );

        this.func = options.func;
    }

    protected _getDeclaration(): FunctionDeclaration | null {
        // TODO: Implement function declaration building
        // This would analyze the function signature and create a declaration
        // Similar to build_function_declaration in Python
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: 'OBJECT' as const,
                properties: {},
                required: []
            }
        } as unknown as FunctionDeclaration;
    }

    async runAsync(options: {
        args: Record<string, any>;
        tool_context: ToolContext;
    }): Promise<any> {
        const { args, tool_context } = options;
        const argsToCall = { ...args };

        // Check if function accepts toolContext parameter
        const funcStr = this.func.toString();
        if (funcStr.includes('toolContext') || funcStr.includes('tool_context')) {
            argsToCall.toolContext = tool_context;
            argsToCall.tool_context = tool_context;
        }

        // Filter args to only include valid parameters
        // This is a simplified version - in a real implementation you'd
        // analyze the function signature more thoroughly

        try {
            // Check if it's an async function
            if (this.func.constructor.name === 'AsyncFunction') {
                return await this.func(argsToCall);
            } else {
                return this.func(argsToCall);
            }
        } catch (error) {
            return {
                error: `Error executing function ${this.name}: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private getMandatoryArgs(): string[] {
        // TODO: Implement parameter analysis
        // This would analyze the function signature to determine required parameters
        return [];
    }
}
