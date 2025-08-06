/**
 * Agent configuration types
 * Based on Python ADK agent config classes
 */
import { workingInProgress } from "@/utils";
/**
 * Code reference config for a variable, a function, or a class
 */
export interface CodeConfig {
  /** The fully qualified name of the code reference */
  name: string;

  /** Arguments to pass to the code reference */
  args?: ArgumentConfig[];
}

/**
 * An argument passed to a function or a class's constructor
 */
export interface ArgumentConfig {
  /** Name of the argument */
  name: string;

  /** Value of the argument */
  value: any;
}

/**
 * The config for the reference to another agent
 */
export interface AgentRefConfig {
  /** Path to the agent configuration file */
  path?: string;

  /** Inline agent configuration */
  config?: BaseAgentConfig;
}

/**
 * Tool configuration
 */
export interface ToolConfig {
  /** The name of the tool */
  name: string;

  /** Arguments for the tool */
  args?: ToolArgsConfig;
}

/**
 * Tool arguments configuration
 */
export interface ToolArgsConfig {
  [key: string]: any;
}

/**
 * Base configuration for all tools
 */
export interface BaseToolConfig {
  [key: string]: any;
}

/**
 * The base config for all agents
 */
export class BaseAgentConfig {
  /** The class of the agent */
  agentClass?: string;

  /** Required. The name of the agent */
  name?: string;

  /** Optional. The description of the agent */
  description?: string;

  /** Optional. The sub-agents of the agent */
  subAgents?: AgentRefConfig[];

  /** Optional. The before_agent_callbacks of the agent */
  beforeAgentCallbacks?: CodeConfig[];

  /** Optional. The after_agent_callbacks of the agent */
  afterAgentCallbacks?: CodeConfig[];
}

/**
 * Configuration for LlmAgent
 */
export class LlmAgentConfig extends BaseAgentConfig {
  /** The class identifier for LlmAgent */
  agentClass: string | '' = 'LlmAgent';

  /** Optional. LlmAgent.model */
  model?: string;

  /** Required. LlmAgent.instruction */
  instruction: string = '';

  /** Optional. LlmAgent.disallowTransferToParent */
  disallowTransferToParent?: boolean;

  /** Optional. LlmAgent.disallowTransferToPeers */
  disallowTransferToPeers?: boolean;

  /** Optional. LlmAgent.inputSchema */
  inputSchema?: CodeConfig;

  /** Optional. LlmAgent.outputSchema */
  outputSchema?: CodeConfig;

  /** Optional. LlmAgent.outputKey */
  outputKey?: string;

  /** Optional. LlmAgent.includeContents */
  includeContents?: 'default' | 'none';

  /** Optional. LlmAgent.tools */
  tools?: ToolConfig[];

  /** Optional. LlmAgent.beforeModelCallbacks */
  beforeModelCallbacks?: CodeConfig[];

  /** Optional. LlmAgent.afterModelCallbacks */
  afterModelCallbacks?: CodeConfig[];

  /** Optional. LlmAgent.beforeToolCallbacks */
  beforeToolCallbacks?: CodeConfig[];

  /** Optional. LlmAgent.afterToolCallbacks */
  afterToolCallbacks?: CodeConfig[];

  /** Optional. LlmAgent.generateContentConfig */
  generateContentConfig?: any; // TODO: Define proper GenerateContentConfig type
}

/**
 * Configuration for SequentialAgent
 */
export interface SequentialAgentConfig extends BaseAgentConfig {
  agentClass: 'SequentialAgent';
}

/**
 * Configuration for ParallelAgent
 */

@workingInProgress('ParallelAgentConfig is not ready for use.')
export class ParallelAgentConfig extends BaseAgentConfig {
  agentClass: string = 'ParallelAgent';
}

/**
 * Configuration for LoopAgent
 */
@workingInProgress('LoopAgentConfig is not ready for use.')
export class LoopAgentConfig extends BaseAgentConfig {
  agentClass : string = 'LoopAgent';
  maxIteration: number | null = null; 
}

/**
 * Union type for all agent configurations
 */
export type AgentConfig =
  | BaseAgentConfig
  | LlmAgentConfig
  | SequentialAgentConfig
  | ParallelAgentConfig
  | LoopAgentConfig;