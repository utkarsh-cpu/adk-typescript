/**
 * LLM-based Agent implementation
 * Ported from Python ADK LlmAgent class
 */

import { BaseAgent, BeforeAgentCallback, AfterAgentCallback } from './base-agent';
import { BaseAgentConfig } from './configs';
import { LlmAgentConfig } from './configs';
import { ReadonlyContext } from './read-only-context';
import { InvocationContext } from './invocation-context';
import { CallbackContext } from './callback-context';
import { BaseTool } from '../tools/base-tool';
import { BaseToolset } from '../tools/base-toolset';
import { FunctionTool } from '../tools/function-tool';
import { ToolContext } from '../tools/tool-context';
import { BaseLlm } from '../models/base-llm';
import { LlmRequest } from '../models/llm-request';
import { LlmResponse } from '../models/llm-response';
import { Event } from '../events/event';
import { BasePlanner } from '../planners/base-planner';
import { BaseCodeExecutor } from '../code-executors/base-code-executor';
import { BaseLlmFlow } from '../flows/llm-flows/base-llm-flow';
import { AutoFlow } from '../flows/llm-flows/auto-flow';
import { SingleFlow } from '../flows/llm-flows/single-flow';

// Type aliases for callbacks
export type SingleBeforeModelCallback = (
  callbackContext: CallbackContext,
  llmRequest: LlmRequest
) => Promise<LlmResponse | null> | LlmResponse | null;

export type BeforeModelCallback =
  | SingleBeforeModelCallback
  | SingleBeforeModelCallback[];

export type SingleAfterModelCallback = (
  callbackContext: CallbackContext,
  llmResponse: LlmResponse
) => Promise<LlmResponse | null> | LlmResponse | null;

export type AfterModelCallback =
  | SingleAfterModelCallback
  | SingleAfterModelCallback[];

export type SingleBeforeToolCallback = (
  tool: BaseTool,
  args: Record<string, any>,
  toolContext: ToolContext
) => Promise<Record<string, any> | null> | Record<string, any> | null;

export type BeforeToolCallback =
  | SingleBeforeToolCallback
  | SingleBeforeToolCallback[];

export type SingleAfterToolCallback = (
  tool: BaseTool,
  args: Record<string, any>,
  toolContext: ToolContext,
  toolResponse: Record<string, any>
) => Promise<Record<string, any> | null> | Record<string, any> | null;

export type AfterToolCallback =
  | SingleAfterToolCallback
  | SingleAfterToolCallback[];

export type InstructionProvider = (
  context: ReadonlyContext
) => Promise<string> | string;

export type ToolUnion = Function | BaseTool | BaseToolset;

export type IncludeContents = 'default' | 'none';

import { BaseModel } from '../models/base-model';
import { GenerateContentConfig } from '../models/generate-content-config';

/**
 * Convert ToolUnion to BaseTool array
 */
async function convertToolUnionToTools(
  toolUnion: ToolUnion,
  ctx: ReadonlyContext
): Promise<BaseTool[]> {
  if (toolUnion instanceof BaseTool) {
    return [toolUnion];
  }

  if (typeof toolUnion === 'function') {
    return [new FunctionTool({ func: toolUnion })];
  }

  if (toolUnion instanceof BaseToolset) {
    return await toolUnion.getTools(ctx);
  }

  throw new Error(`Invalid tool union type: ${typeof toolUnion}`);
}

/**
 * LLM-based Agent
 */
export class LlmAgent extends BaseAgent {
  /**
   * The model to use for the agent.
   * When not set, the agent will inherit the model from its ancestor.
   */
  model: string | BaseLlm = '';

  /**
   * The config type for this agent.
   */
  static configType: typeof BaseAgentConfig = LlmAgentConfig;

  /**
   * Instructions for the LLM model, guiding the agent's behavior.
   */
  instruction: string | InstructionProvider = '';

  /**
   * Instructions for all the agents in the entire agent tree.
   * ONLY the global_instruction in root agent will take effect.
   * For example: use global_instruction to make all agents have a stable identity
   * or personality.
   */
  globalInstruction: string | InstructionProvider = '';

  /**
   * Tools available to this agent.
   */
  tools: ToolUnion[] = [];

  /**
   * The additional content generation configurations.
   * NOTE: not all fields are usable, e.g. tools must be configured via `tools`,
   * thinking_config must be configured via `planner` in LlmAgent.
   * For example: use this config to adjust model temperature, configure safety
   * settings, etc.
   */
  generateContentConfig?: GenerateContentConfig;

  // LLM-based agent transfer configs - Start
  /**
   * Disallows LLM-controlled transferring to the parent agent.
   * NOTE: Setting this as True also prevents this agent to continue reply to the
   * end-user. This behavior prevents one-way transfer, in which end-user may be
   * stuck with one agent that cannot transfer to other agents in the agent tree.
   */
  disallowTransferToParent: boolean = false;

  /**
   * Disallows LLM-controlled transferring to the peer agents.
   */
  disallowTransferToPeers: boolean = false;
  // LLM-based agent transfer configs - End

  /**
   * Controls content inclusion in model requests.
   * Options:
   * default: Model receives relevant conversation history
   * none: Model receives no prior history, operates solely on current
   * instruction and input
   */
  includeContents: IncludeContents = 'default';

  // Controlled input/output configurations - Start
  /**
   * The input schema when agent is used as a tool.
   */
  inputSchema?: new (...args: any[]) => BaseModel;

  /**
   * The output schema when agent replies.
   * NOTE:
   * When this is set, agent can ONLY reply and CANNOT use any tools, such as
   * function tools, RAGs, agent transfer, etc.
   */
  outputSchema?: new (...args: any[]) => BaseModel;

  /**
   * The key in session state to store the output of the agent.
   * Typically use cases:
   * - Extracts agent reply for later use, such as in tools, callbacks, etc.
   * - Connects agents to coordinate with each other.
   */
  outputKey?: string;
  // Controlled input/output configurations - End

  // Advance features - Start
  /**
   * Instructs the agent to make a plan and execute it step by step.
   * NOTE:
   * To use model's built-in thinking features, set the `thinking_config`
   * field in `google.adk.planners.built_in_planner`.
   */
  planner?: BasePlanner;

  /**
   * Allow agent to execute code blocks from model responses using the provided
   * CodeExecutor.
   * Check out available code executions in `google.adk.code_executor` package.
   * NOTE:
   * To use model's built-in code executor, use the `BuiltInCodeExecutor`.
   */
  codeExecutor?: BaseCodeExecutor;
  // Advance features - End

  // Callbacks - Start
  /**
   * Callback or list of callbacks to be called before calling the LLM.
   * When a list of callbacks is provided, the callbacks will be called in the
   * order they are listed until a callback does not return null.
   */
  beforeModelCallback?: BeforeModelCallback;

  /**
   * Callback or list of callbacks to be called after calling the LLM.
   * When a list of callbacks is provided, the callbacks will be called in the
   * order they are listed until a callback does not return null.
   */
  afterModelCallback?: AfterModelCallback;

  /**
   * Callback or list of callbacks to be called before calling the tool.
   * When a list of callbacks is provided, the callbacks will be called in the
   * order they are listed until a callback does not return null.
   */
  beforeToolCallback?: BeforeToolCallback;

  /**
   * Callback or list of callbacks to be called after calling the tool.
   * When a list of callbacks is provided, the callbacks will be called in the
   * order they are listed until a callback does not return null.
   */
  afterToolCallback?: AfterToolCallback;
  // Callbacks - End

  constructor(options: {
    name: string;
    description?: string;
    subAgents?: BaseAgent[];
    beforeAgentCallback?: BeforeAgentCallback | null;
    afterAgentCallback?: AfterAgentCallback | null;
  } & Partial<Pick<LlmAgent,
    | 'model'
    | 'instruction'
    | 'globalInstruction'
    | 'tools'
    | 'generateContentConfig'
    | 'disallowTransferToParent'
    | 'disallowTransferToPeers'
    | 'includeContents'
    | 'inputSchema'
    | 'outputSchema'
    | 'outputKey'
    | 'planner'
    | 'codeExecutor'
    | 'beforeModelCallback'
    | 'afterModelCallback'
    | 'beforeToolCallback'
    | 'afterToolCallback'
  >>) {
    super({
      name: options.name,
      description: options.description,
      subAgents: options.subAgents,
      beforeAgentCallback: options.beforeAgentCallback,
      afterAgentCallback: options.afterAgentCallback,
    });

    // Set LlmAgent-specific properties with defaults
    this.model = options.model ?? '';
    this.instruction = options.instruction ?? '';
    this.globalInstruction = options.globalInstruction ?? '';
    this.tools = options.tools ?? [];
    this.generateContentConfig = options.generateContentConfig;
    this.disallowTransferToParent = options.disallowTransferToParent ?? false;
    this.disallowTransferToPeers = options.disallowTransferToPeers ?? false;
    this.includeContents = options.includeContents ?? 'default';
    this.inputSchema = options.inputSchema;
    this.outputSchema = options.outputSchema;
    this.outputKey = options.outputKey;
    this.planner = options.planner;
    this.codeExecutor = options.codeExecutor;
    this.beforeModelCallback = options.beforeModelCallback;
    this.afterModelCallback = options.afterModelCallback;
    this.beforeToolCallback = options.beforeToolCallback;
    this.afterToolCallback = options.afterToolCallback;

    this.validateOutputSchema();
  }

  protected async *_runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event, void, unknown> {
    const generator = this.llmFlow.runAsync(ctx);

    for await (const event of generator) {
      this.maybeSaveOutputToState(event);
      yield event;
    }
  }

  protected async *_runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event, void, unknown> {
    const generator = this.llmFlow.runLive(ctx);

    for await (const event of generator) {
      this.maybeSaveOutputToState(event);
      yield event;

      if (ctx.endInvocation) {
        return;
      }
    }
  }

  /**
   * The resolved self.model field as BaseLlm.
   * This method is only for use by Agent Development Kit.
   */
  get canonicalModel(): BaseLlm {
    if (this.model instanceof BaseLlm) {
      return this.model;
    } else if (this.model) { // model is non-empty string
      // Assuming LLMRegistry exists - you'll need to implement this
      throw new Error('LLMRegistry not implemented yet');
      // return LLMRegistry.newLlm(this.model);
    } else { // find model from ancestors
      let ancestorAgent = this.parentAgent;
      while (ancestorAgent !== null) {
        if (ancestorAgent instanceof LlmAgent) {
          return ancestorAgent.canonicalModel;
        }
        ancestorAgent = ancestorAgent.parentAgent;
      }
      throw new Error(`No model found for ${this.name}.`);
    }
  }

  /**
   * The resolved self.instruction field to construct instruction for this agent.
   * This method is only for use by Agent Development Kit.
   */
  async canonicalInstruction(ctx: ReadonlyContext): Promise<[string, boolean]> {
    if (typeof this.instruction === 'string') {
      return [this.instruction, false];
    } else {
      const instruction = await this.instruction(ctx);
      return [instruction, true];
    }
  }

  /**
   * The resolved self.globalInstruction field to construct global instruction.
   * This method is only for use by Agent Development Kit.
   */
  async canonicalGlobalInstruction(ctx: ReadonlyContext): Promise<[string, boolean]> {
    if (typeof this.globalInstruction === 'string') {
      return [this.globalInstruction, false];
    } else {
      const globalInstruction = await this.globalInstruction(ctx);
      return [globalInstruction, true];
    }
  }

  /**
   * The resolved self.tools field as a list of BaseTool based on the context.
   * This method is only for use by Agent Development Kit.
   */
  async canonicalTools(ctx?: ReadonlyContext): Promise<BaseTool[]> {
    const resolvedTools: BaseTool[] = [];
    for (const toolUnion of this.tools) {
      const tools = await convertToolUnionToTools(toolUnion, ctx!);
      resolvedTools.push(...tools);
    }
    return resolvedTools;
  }

  /**
   * The resolved self.beforeModelCallback field as a list of SingleBeforeModelCallback.
   * This method is only for use by Agent Development Kit.
   */
  get canonicalBeforeModelCallbacks(): SingleBeforeModelCallback[] {
    if (!this.beforeModelCallback) {
      return [];
    }
    if (Array.isArray(this.beforeModelCallback)) {
      return this.beforeModelCallback;
    }
    return [this.beforeModelCallback];
  }

  /**
   * The resolved self.afterModelCallback field as a list of SingleAfterModelCallback.
   * This method is only for use by Agent Development Kit.
   */
  get canonicalAfterModelCallbacks(): SingleAfterModelCallback[] {
    if (!this.afterModelCallback) {
      return [];
    }
    if (Array.isArray(this.afterModelCallback)) {
      return this.afterModelCallback;
    }
    return [this.afterModelCallback];
  }

  /**
   * The resolved self.beforeToolCallback field as a list of BeforeToolCallback.
   * This method is only for use by Agent Development Kit.
   */
  get canonicalBeforeToolCallbacks(): SingleBeforeToolCallback[] {
    if (!this.beforeToolCallback) {
      return [];
    }
    if (Array.isArray(this.beforeToolCallback)) {
      return this.beforeToolCallback;
    }
    return [this.beforeToolCallback];
  }

  /**
   * The resolved self.afterToolCallback field as a list of AfterToolCallback.
   * This method is only for use by Agent Development Kit.
   */
  get canonicalAfterToolCallbacks(): SingleAfterToolCallback[] {
    if (!this.afterToolCallback) {
      return [];
    }
    if (Array.isArray(this.afterToolCallback)) {
      return this.afterToolCallback;
    }
    return [this.afterToolCallback];
  }

  private get llmFlow(): BaseLlmFlow {
    if (this.disallowTransferToParent &&
      this.disallowTransferToPeers &&
      !this.subAgents?.length) {
      return new SingleFlow();
    } else {
      return new AutoFlow();
    }
  }

  /**
   * Saves the model output to state if needed.
   */
  private maybeSaveOutputToState(event: Event): void {
    // Skip if the event was authored by some other agent (e.g. current agent
    // transferred to another agent)
    if (event.author !== this.name) {
      console.debug(`Skipping output save for agent ${this.name}: event authored by ${event.author}`);
      return;
    }

    if (this.outputKey &&
      event.isFinalResponse() &&
      event.content &&
      event.content.parts) {

      let result = event.content.parts
        .map(part => part.text || '')
        .join('');

      if (this.outputSchema) {
        // If the result from the final chunk is just whitespace or empty,
        // it means this is an empty final chunk of a stream.
        // Do not attempt to parse it as JSON.
        if (!result.trim()) {
          return;
        }

        try {
          const parsed = JSON.parse(result);
          result = parsed;
        } catch (error) {
          console.error('Failed to parse output schema JSON:', error);
          return;
        }
      }

      // Assuming event.actions.stateDelta exists
      if (event.actions?.stateDelta) {
        event.actions.stateDelta[this.outputKey] = result;
      }
    }
  }

  /**
   * Validate output schema configuration
   */
  private validateOutputSchema(): void {
    if (!this.outputSchema) {
      return;
    }

    if (!this.disallowTransferToParent || !this.disallowTransferToPeers) {
      console.warn(
        `Invalid config for agent ${this.name}: output_schema cannot co-exist with ` +
        'agent transfer configurations. Setting ' +
        'disallow_transfer_to_parent=true, disallow_transfer_to_peers=true'
      );
      this.disallowTransferToParent = true;
      this.disallowTransferToPeers = true;
    }

    if (this.subAgents?.length) {
      throw new Error(
        `Invalid config for agent ${this.name}: if output_schema is set, ` +
        'sub_agents must be empty to disable agent transfer.'
      );
    }

    if (this.tools.length) {
      throw new Error(
        `Invalid config for agent ${this.name}: if output_schema is set, ` +
        'tools must be empty'
      );
    }
  }

  /**
   * Validate generate content config
   */
  private validateGenerateContentConfig(config?: GenerateContentConfig): GenerateContentConfig {
    if (!config) {
      return {};
    }

    // Add validation logic similar to Python version
    // This would need to be adapted based on your actual GenerateContentConfig interface

    return config;
  }
}

// Type alias for backward compatibility
export type Agent = LlmAgent;