/**
 * Agent configuration utilities
 * Ported from Python ADK agent config utilities
 */

import * as fs from 'fs';
import * as path from 'path';
// Note: js-yaml needs to be added as a dependency
// import * as yaml from 'js-yaml';
import { workingInProgress } from '@/utils/feature-decorator';
import { BaseAgent } from '@/agents/base-agent';
import { BaseAgentConfig, AgentConfig, AgentRefConfig, CodeConfig } from '@/agents/configs';

/**
 * Load an agent's configuration from a YAML file.
 * @param configPath Path to the YAML config file.
 * @returns The loaded and validated AgentConfig object.
 * @throws {Error} If config file doesn't exist or has invalid YAML.
 */
const loadConfigFromPath = workingInProgress('loadConfigFromPath is not ready for use.')(function loadConfigFromPath(configPath: string): AgentConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  try {
    const fileContent = fs.readFileSync(configPath, 'utf8');
    // TODO: Add js-yaml dependency and uncomment the line below
    // const configData = yaml.load(fileContent) as any;
    const configData = JSON.parse(fileContent); // Temporary fallback to JSON

    // Basic validation - in a real implementation, you'd use a proper validator
    if (!configData || typeof configData !== 'object') {
      throw new Error('Invalid config format');
    }

    return configData as AgentConfig;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
    throw error;
  }
}) as (configPath: string) => AgentConfig;



// Agent class registry - this would be populated by importing the actual agent classes
const AGENT_CLASS_REGISTRY: { [key: string]: (new (options: any) => BaseAgent) & typeof BaseAgent } = {};

/**
 * Register an agent class in the registry.
 * This should be called when importing agent classes.
 * @param className The class name (e.g., 'LlmAgent')
 * @param agentClass The actual agent class constructor
 */
export function registerAgentClass(
  className: string, 
  agentClass: (new (options: any) => BaseAgent) & typeof BaseAgent
): void {
  AGENT_CLASS_REGISTRY[className] = agentClass;
}

/**
 * Resolve the agent class from its fully qualified name.
 * @param agentClassName The fully qualified class name or short name.
 * @returns The resolved agent class.
 * @throws {Error} If the agent class is invalid or not a subclass of BaseAgent.
 */
function resolveAgentClass(agentClassName?: string): (new (options: any) => BaseAgent) & typeof BaseAgent {
  const className = agentClassName || 'LlmAgent';

  // First try the registry for built-in agent classes
  if (AGENT_CLASS_REGISTRY[className]) {
    return AGENT_CLASS_REGISTRY[className];
  }

  // For fully qualified names, try the module resolution
  if (className.includes('.')) {
    const agentClass = resolveFullyQualifiedName(className);
    
    if (typeof agentClass === 'function' &&
        agentClass.prototype instanceof BaseAgent) {
      return agentClass as (new (options: any) => BaseAgent) & typeof BaseAgent;
    }
  }

  throw new Error(
    `Invalid agent class \`${className}\`. It must be a subclass of BaseAgent or registered in the agent registry.`
  );
}

/**
 * Build agent from a config file path.
 * @param configPath The path to a YAML config file.
 * @returns The created agent instance.
 * @throws {Error} If config file doesn't exist, has invalid YAML, or agent type is unsupported.
 */
export const fromConfig = workingInProgress('fromConfig is not ready for use.')(function fromConfig(configPath: string): BaseAgent {
  const absPath = path.resolve(configPath);
  const config = loadConfigFromPath(absPath);
  const agentConfig = config;

  // Check if this is a base agent config that needs resolution
  if (agentConfig.constructor === BaseAgentConfig) {
    // Resolve the concrete agent config for user-defined agent classes
    const agentClass = resolveAgentClass(agentConfig.agentClass);
    const validatedConfig = new (agentClass.configType as any)(agentConfig);
    return agentClass.fromConfig(validatedConfig, absPath);
  } else {
    // For built-in agent classes, no need to re-validate
    const agentClass = resolveAgentClass(agentConfig.agentClass);
    return agentClass.fromConfig(agentConfig, absPath);
  }
}) as (configPath: string) => BaseAgent;



/**
 * Resolve a fully qualified name to an actual object/class.
 * @param name The fully qualified name (e.g., 'module.path.ClassName').
 * @returns The resolved object/class.
 * @throws {Error} If the name cannot be resolved.
 */
const resolveFullyQualifiedName = workingInProgress('resolveFullyQualifiedName is not ready for use.')(function resolveFullyQualifiedName(name: string): any {
  try {
    // In TypeScript/JavaScript, we need to handle module resolution differently
    // This is a simplified implementation - in practice, you'd need a proper
    // module resolution system or registry

    const parts = name.split('.');
    if (parts.length < 2) {
      throw new Error(`Invalid fully qualified name: ${name}`);
    }

    // This would need to be implemented based on your module system
    // For now, throwing an error to indicate it needs implementation
    throw new Error(`Module resolution not implemented for: ${name}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid fully qualified name: ${name} - ${error.message}`);
    }
    throw new Error(`Invalid fully qualified name: ${name}`);
  }
}) as (name: string) => any;

/**
 * Build an agent from a reference.
 * @param refConfig The agent reference configuration.
 * @param referencingAgentConfigAbsPath The absolute path to the agent config that contains the reference.
 * @returns The created agent instance.
 * @throws {Error} If the reference cannot be resolved.
 */
export const resolveAgentReference = workingInProgress('resolveAgentReference is not ready for use.')(function resolveAgentReference(
  refConfig: AgentRefConfig,
  referencingAgentConfigAbsPath: string
): BaseAgent {
  if (refConfig.path) {
    let configPath: string;

    if (path.isAbsolute(refConfig.path)) {
      configPath = refConfig.path;
    } else {
      const baseDir = path.dirname(referencingAgentConfigAbsPath);
      configPath = path.join(baseDir, refConfig.path);
    }

    return fromConfig(configPath);
  } else if (refConfig.config) {
    // Handle inline config - this would need proper implementation
    throw new Error('Inline agent config resolution not implemented');
  } else {
    throw new Error("AgentRefConfig must have either 'path' or 'config'");
  }
}) as (refConfig: AgentRefConfig, referencingAgentConfigAbsPath: string) => BaseAgent;

/**
 * Resolve a code reference to an actual agent instance.
 * @param code The fully-qualified path to an agent instance.
 * @returns The resolved agent instance.
 * @throws {Error} If the agent reference cannot be resolved.
 */
const resolveAgentCodeReference = workingInProgress('resolveAgentCodeReference is not ready for use.')(function resolveAgentCodeReference(code: string): BaseAgent {
  if (!code.includes('.')) {
    throw new Error(`Invalid code reference: ${code}`);
  }

  const parts = code.split('.');
  const modulePath = parts.slice(0, -1).join('.');
  const objName = parts[parts.length - 1];

  try {
    // This would need proper module resolution
    const obj = resolveFullyQualifiedName(code);

    if (typeof obj === 'function') {
      throw new Error(`Invalid agent reference to a callable: ${code}`);
    }

    if (!(obj instanceof BaseAgent)) {
      throw new Error(`Invalid agent reference to a non-agent instance: ${code}`);
    }

    return obj;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to resolve agent code reference: ${code} - ${error.message}`);
    }
    throw error;
  }
}) as (code: string) => BaseAgent;

/**
 * Resolve a code reference to actual Python object.
 * @param codeConfig The code configuration.
 * @returns The resolved object.
 * @throws {Error} If the code reference cannot be resolved.
 */
export const resolveCodeReference = workingInProgress('resolveCodeReference is not ready for use.')(function resolveCodeReference(codeConfig: CodeConfig): any {
  if (!codeConfig || !codeConfig.name) {
    throw new Error('Invalid CodeConfig.');
  }

  const parts = codeConfig.name.split('.');
  const modulePath = parts.slice(0, -1).join('.');
  const objName = parts[parts.length - 1];

  try {
    const obj = resolveFullyQualifiedName(codeConfig.name);

    if (codeConfig.args && typeof obj === 'function') {
      // Separate named and positional arguments
      const namedArgs: { [key: string]: any } = {};
      const positionalArgs: any[] = [];

      for (const arg of codeConfig.args) {
        if (arg.name) {
          namedArgs[arg.name] = arg.value;
        } else {
          positionalArgs.push(arg.value);
        }
      }

      // Call the function with arguments
      return obj(...positionalArgs, namedArgs);
    } else {
      return obj;
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to resolve code reference: ${codeConfig.name} - ${error.message}`);
    }
    throw error;
  }
}) as (codeConfig: CodeConfig) => any;

/**
 * Resolve callbacks from configuration.
 * @param callbacksConfig List of callback configurations.
 * @returns List of resolved callback objects.
 */
export const resolveCallbacks = workingInProgress('resolveCallbacks is not ready for use.')(function resolveCallbacks(callbacksConfig: CodeConfig[]): any[] {
  return callbacksConfig.map(config => resolveCodeReference(config));
}) as (callbacksConfig: CodeConfig[]) => any[];

// TODO: Initialize the agent registry with available agent classes
// This should be done when the module is loaded, for example:
//
// import { LlmAgent } from './llm-agent';
// import { LoopAgent } from './loop-agent';
// import { ParallelAgent } from './parallel-agent';
//
// registerAgentClass('LlmAgent', LlmAgent);
// registerAgentClass('LoopAgent', LoopAgent);
// registerAgentClass('ParallelAgent', ParallelAgent);