/**
 * Agent configuration with discriminated union support
 * Ported from Python ADK agent config with Pydantic discriminator
 */

import { workingInProgress } from '@/utils/feature-decorator';
import { 
  BaseAgentConfig, 
  LlmAgentConfig, 
  LoopAgentConfig, 
  ParallelAgentConfig, 
  SequentialAgentConfig 
} from '@/agents/configs';

/**
 * A discriminated union of all possible agent configurations.
 * This represents the same ConfigsUnion from the Python code.
 */
export type ConfigsUnion = 
  | LlmAgentConfig
  | LoopAgentConfig  
  | ParallelAgentConfig
  | SequentialAgentConfig
  | BaseAgentConfig;

/**
 * Discriminator function to determine which agent config type to use
 * based on the agent_class field. Equivalent to agent_config_discriminator in Python.
 * 
 * @param v The input value to discriminate
 * @returns The agent class type string
 * @throws {Error} If the input is invalid
 */
export function agentConfigDiscriminator(v: any): string {
  if (typeof v === 'object' && v !== null) {
    const agentClass = v.agent_class || v.agentClass || 'LlmAgent';
    
    if (['LlmAgent', 'LoopAgent', 'ParallelAgent', 'SequentialAgent'].includes(agentClass)) {
      return agentClass;
    } else {
      return 'BaseAgent';
    }
  }
  
  throw new Error(`Invalid agent config: ${JSON.stringify(v)}`);
}

/**
 * Factory function to create the appropriate agent config instance
 * based on the discriminator result.
 * 
 * @param data The raw configuration data
 * @returns The appropriate agent config instance
 */
export function createAgentConfig(data: any): ConfigsUnion {
  const agentType = agentConfigDiscriminator(data);
  
  switch (agentType) {
    case 'LlmAgent':
      return Object.assign(new LlmAgentConfig(), data);
    case 'LoopAgent':
      return Object.assign(new LoopAgentConfig(), data);
    case 'ParallelAgent':
      return Object.assign(new ParallelAgentConfig(), data);
    case 'SequentialAgent':
      // SequentialAgentConfig is an interface, so we create a BaseAgentConfig with the right type
      return Object.assign(new BaseAgentConfig(), { ...data, agentClass: 'SequentialAgent' });
    case 'BaseAgent':
    default:
      return Object.assign(new BaseAgentConfig(), data);
  }
}

/**
 * The config for the YAML schema to create an agent.
 * This is equivalent to the Python RootModel[ConfigsUnion] with discriminator.
 * 
 * In TypeScript, we implement this as a wrapper class that holds the root configuration
 * and provides validation and discrimination functionality.
 */
@workingInProgress('AgentConfig is not ready for use.')
export class AgentConfig {
  /**
   * The root configuration object, discriminated based on agent_class
   */
  public readonly root: ConfigsUnion;

  /**
   * Creates a new AgentConfig instance
   * @param data The raw configuration data
   */
  constructor(data: any) {
    this.root = createAgentConfig(data);
  }

  /**
   * Static factory method to create AgentConfig from raw data
   * @param data The raw configuration data
   * @returns A new AgentConfig instance
   */
  static fromData(data: any): AgentConfig {
    return new AgentConfig(data);
  }

  /**
   * Validates the configuration data structure
   * @param data The data to validate
   * @returns True if valid, throws error if invalid
   */
  static validate(data: any): boolean {
    try {
      agentConfigDiscriminator(data);
      return true;
    } catch (error) {
      throw new Error(`Invalid agent configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets the agent class type from the configuration
   * @returns The agent class string
   */
  get agentClass(): string {
    return this.root.agentClass || 'LlmAgent';
  }

  /**
   * Gets the agent name from the configuration
   * @returns The agent name
   */
  get name(): string | undefined {
    return this.root.name;
  }

  /**
   * Gets the agent description from the configuration
   * @returns The agent description
   */
  get description(): string | undefined {
    return this.root.description;
  }

  /**
   * Converts the configuration to a plain object
   * @returns Plain object representation
   */
  toObject(): any {
    return JSON.parse(JSON.stringify(this.root));
  }

  /**
   * Converts the configuration to JSON string
   * @returns JSON string representation
   */
  toJSON(): string {
    return JSON.stringify(this.root, null, 2);
  }
}

/**
 * Type guard to check if a value is a valid agent configuration
 * @param value The value to check
 * @returns True if the value is a valid agent config
 */
export function isValidAgentConfig(value: any): value is ConfigsUnion {
  try {
    AgentConfig.validate(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if a config is an LlmAgentConfig
 * @param config The config to check
 * @returns True if it's an LlmAgentConfig
 */
export function isLlmAgentConfig(config: ConfigsUnion): config is LlmAgentConfig {
  return config instanceof LlmAgentConfig || 
         (config.agentClass === 'LlmAgent' || config.agentClass === '');
}

/**
 * Type guard to check if a config is a LoopAgentConfig
 * @param config The config to check
 * @returns True if it's a LoopAgentConfig
 */
export function isLoopAgentConfig(config: ConfigsUnion): config is LoopAgentConfig {
  return config instanceof LoopAgentConfig || config.agentClass === 'LoopAgent';
}

/**
 * Type guard to check if a config is a ParallelAgentConfig
 * @param config The config to check
 * @returns True if it's a ParallelAgentConfig
 */
export function isParallelAgentConfig(config: ConfigsUnion): config is ParallelAgentConfig {
  return config instanceof ParallelAgentConfig || config.agentClass === 'ParallelAgent';
}

/**
 * Type guard to check if a config is a SequentialAgentConfig
 * @param config The config to check
 * @returns True if it's a SequentialAgentConfig
 */
export function isSequentialAgentConfig(config: ConfigsUnion): config is SequentialAgentConfig {
  return config.agentClass === 'SequentialAgent';
}

/**
 * Type guard to check if a config is a BaseAgentConfig
 * @param config The config to check
 * @returns True if it's a BaseAgentConfig
 */
export function isBaseAgentConfig(config: ConfigsUnion): config is BaseAgentConfig {
  return config instanceof BaseAgentConfig && 
         !isLlmAgentConfig(config) && 
         !isLoopAgentConfig(config) && 
         !isParallelAgentConfig(config) && 
         !isSequentialAgentConfig(config);
}