// ─────────────────────────────────────────────────────────────────────────────
// BaseAgent.ts
// Ported from the original Python implementation.
//
// External runtime dependencies (to be implemented or wired in
// your project as appropriate):
//   • trace              → OpenTelemetry API for JS
//   • Event              → domain event object
//   • BaseAgentConfig    → configuration interface / class
//   • CallbackContext    → wrapper that exposes state & event-actions
//   • InvocationContext  → per-invocation mutable context
//   • PluginManager      → on InvocationContext provides plugin callbacks
//   • workingInProgress  → decorator (no direct TS equivalent, left as fn)
//
// NOTE: Annotations such as `@final` or Pydantic validators are expressed
//       through TypeScript's type-system and runtime checks inside ctors.
// ─────────────────────────────────────────────────────────────────────────────

import { trace } from '@opentelemetry/api';
import { Event } from '@/events/event';
import { BaseAgentConfig } from "@/agents/configs";
import { CallbackContext } from '@/agents';
import { InvocationContext } from '@/agents';
import { Content } from '@google/genai';
import { workingInProgress } from '@/utils';

const tracer = trace.getTracer('gcp.vertex.agent');

/** Heterogeneous callback signatures we must support. */
type _SingleAgentCallback =
  | ((callbackContext: CallbackContext) => Promise<Content | undefined>)
  | ((callbackContext: CallbackContext) => Content | undefined);

export type BeforeAgentCallback = _SingleAgentCallback | _SingleAgentCallback[];
export type AfterAgentCallback = _SingleAgentCallback | _SingleAgentCallback[];

/** Constructor parameters for BaseAgent. */
export abstract class BaseAgent {
  /**
   * The config type for this agent.
   * Sub-classes should override this to specify their own config type.
   * @example
   * ```typescript
   * class MyAgentConfig extends BaseAgentConfig {
   *   myField: string = '';
   * }
   *
   * class MyAgent extends BaseAgent {
   *   static override configType = MyAgentConfig;
   * }
   * ```
   */
  public static configType: typeof BaseAgentConfig = BaseAgentConfig;

  /** 
   * The agent's name. 
   * Agent name must be a valid identifier and unique within the agent tree.
   * Agent name cannot be "user", since it's reserved for end-user's input.
   */
  public name: string;

  /** 
   * Description about the agent's capability.
   * The model uses this to determine whether to delegate control to the agent.
   * One-line description is enough and preferred.
   */
  public description: string;

  /** 
   * The parent agent of this agent.
   * Note that an agent can ONLY be added as sub-agent once.
   * If you want to add one agent twice as sub-agent, consider to create two agent
   * instances with identical config, but with different name and add them to the
   * agent tree.
   */
  public parentAgent: BaseAgent | null = null;

  /** The sub-agents of this agent. */
  public subAgents: BaseAgent[];

  /** 
   * Callback or list of callbacks to be invoked before the agent run.
   * When a list of callbacks is provided, the callbacks will be called in the
   * order they are listed until a callback does not return undefined.
   * 
   * Args:
   *   callbackContext: MUST be named 'callbackContext' (enforced).
   * 
   * Returns:
   *   Optional<Content>: The content to return to the user.
   *   When the content is present, the agent run will be skipped and the
   *   provided content will be returned to user.
   */
  public beforeAgentCallback: BeforeAgentCallback | null;

  /** 
   * Callback or list of callbacks to be invoked after the agent run.
   * When a list of callbacks is provided, the callbacks will be called in the
   * order they are listed until a callback does not return undefined.
   * 
   * Args:
   *   callbackContext: MUST be named 'callbackContext' (enforced).
   * 
   * Returns:
   *   Optional<Content>: The content to return to the user.
   *   When the content is present, the provided content will be used as agent
   *   response and appended to event history as agent response.
   */
  public afterAgentCallback: AfterAgentCallback | null;

  constructor(options: {
    name: string;
    description?: string;
    subAgents?: BaseAgent[];
    beforeAgentCallback?: BeforeAgentCallback | null;
    afterAgentCallback?: AfterAgentCallback | null;
  }) {
    BaseAgent.__validateName(options.name);
    this.name = options.name;
    this.description = options.description ?? '';
    this.subAgents = options.subAgents ?? [];
    this.beforeAgentCallback = options.beforeAgentCallback ?? null;
    this.afterAgentCallback = options.afterAgentCallback ?? null;

    // This logic comes from Pydantic's `model_post_init`
    this.__setParentAgentForSubAgents();
  }

  /**
   * Creates a copy of this agent instance.
   * @param update Optional mapping of new values for the fields of the cloned agent.
   *               The keys of the mapping are the names of the fields to be updated, and
   *               the values are the new values for those fields.
   *               For example: {"name": "cloned_agent"}
   * @returns A new agent instance with identical configuration as the original
   *          agent except for the fields specified in the update.
   */
  public clone(update?: Partial<Omit<this, 'parentAgent'>>): this {
    if (update && 'parentAgent' in update) {
      throw new Error(
        'Cannot update `parentAgent` field in clone. Parent agent is set ' +
        'only when the parent agent is instantiated with the sub-agents.'
      );
    }

    const constructor = this.constructor as new (options: any) => this;

    // Create a new agent with merged properties
    const clonedAgent = new constructor({
      name: this.name,
      description: this.description,
      subAgents: this.subAgents,
      beforeAgentCallback: this.beforeAgentCallback,
      afterAgentCallback: this.afterAgentCallback,
      ...update,
    });

    // If subAgents were not part of the update, they need to be cloned recursively.
    if (!update || !('subAgents' in update)) {
      clonedAgent.subAgents = [];
      for (const subAgent of this.subAgents) {
        const clonedSubAgent = subAgent.clone();
        clonedSubAgent.parentAgent = clonedAgent;
        clonedAgent.subAgents.push(clonedSubAgent);
      }
    } else {
      // If subAgents *were* provided, just ensure their parent is set correctly.
      for (const subAgent of clonedAgent.subAgents) {
        subAgent.parentAgent = clonedAgent;
      }
    }

    // Remove the parent agent from the cloned agent to avoid sharing the parent
    // agent with the cloned agent.
    clonedAgent.parentAgent = null;
    return clonedAgent;
  }

  /**
   * Entry method to run an agent via text-based conversation.
   * This method should not be overridden by subclasses.
   * @param parentContext The invocation context of the parent agent.
   * @yields {Event} The events generated by the agent.
   */
  public async *runAsync(parentContext: InvocationContext): AsyncGenerator<Event> {
    const span = tracer.startSpan(`agent_run [${this.name}]`);
    try {
      const ctx = this._createInvocationContext(parentContext);

      const beforeEvent = await this.__handleBeforeAgentCallback(ctx);
      if (beforeEvent) {
        yield beforeEvent;
      }
      if (ctx.endInvocation) {
        return;
      }

      for await (const event of this._runAsyncImpl(ctx)) {
        yield event;
      }

      if (ctx.endInvocation) {
        return;
      }

      const afterEvent = await this.__handleAfterAgentCallback(ctx);
      if (afterEvent) {
        yield afterEvent;
      }
    } finally {
      span.end();
    }
  }

  /**
   * Entry method to run an agent via video/audio-based conversation.
   * This method should not be overridden by subclasses.
   * @param parentContext The invocation context of the parent agent.
   * @yields {Event} The events generated by the agent.
   */
  public async *runLive(parentContext: InvocationContext): AsyncGenerator<Event> {
    const span = tracer.startSpan(`agent_run [${this.name}]`);
    try {
      const ctx = this._createInvocationContext(parentContext);

      const beforeEvent = await this.__handleBeforeAgentCallback(ctx);
      if (beforeEvent) {
        yield beforeEvent;
      }
      if (ctx.endInvocation) {
        return;
      }

      for await (const event of this._runLiveImpl(ctx)) {
        yield event;
      }

      const afterEvent = await this.__handleAfterAgentCallback(ctx);
      if (afterEvent) {
        yield afterEvent;
      }
    } finally {
      span.end();
    }
  }

  /**
   * Core logic to run this agent via text-based conversation.
   * Subclasses MUST implement this method.
   * @param ctx The invocation context for this agent.
   * @yields {Event} The events generated by the agent.
   */
  protected abstract _runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event>;

  /**
   * Core logic to run this agent via video/audio-based conversation.
   * Subclasses MUST implement this method.
   * @param ctx The invocation context for this agent.
   * @yields {Event} The events generated by the agent.
   */
  protected abstract _runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event>;

  /** Gets the root agent of this agent. */
  public get rootAgent(): BaseAgent {
    let rootAgent: BaseAgent = this;
    while (rootAgent.parentAgent !== null) {
      rootAgent = rootAgent.parentAgent;
    }
    return rootAgent;
  }

  /**
   * Finds the agent with the given name in this agent and its descendants.
   * @param name The name of the agent to find.
   * @returns The agent with the matching name, or null if no such agent is found.
   */
  public findAgent(name: string): BaseAgent | null {
    if (this.name === name) {
      return this;
    }
    return this.findSubAgent(name);
  }

  /**
   * Finds the agent with the given name in this agent's descendants.
   * @param name The name of the agent to find.
   * @returns The agent with the matching name, or null if no such agent is found.
   */
  public findSubAgent(name: string): BaseAgent | null {
    for (const subAgent of this.subAgents) {
      const result = subAgent.findAgent(name);
      if (result) {
        return result;
      }
    }
    return null;
  }

  /** Creates a new invocation context for this agent. */
  protected _createInvocationContext(parentContext: InvocationContext): InvocationContext {
    // Create a copy with updated agent reference
    return new InvocationContext({
      ...parentContext,
      agent: this,
    });
  }

  /** The resolved beforeAgentCallback field as a list of _SingleAgentCallback. */
  public get canonicalBeforeAgentCallbacks(): _SingleAgentCallback[] {
    if (!this.beforeAgentCallback) {
      return [];
    }
    return Array.isArray(this.beforeAgentCallback)
      ? this.beforeAgentCallback
      : [this.beforeAgentCallback];
  }

  /** The resolved afterAgentCallback field as a list of _SingleAgentCallback. */
  public get canonicalAfterAgentCallbacks(): _SingleAgentCallback[] {
    if (!this.afterAgentCallback) {
      return [];
    }
    return Array.isArray(this.afterAgentCallback)
      ? this.afterAgentCallback
      : [this.afterAgentCallback];
  }

  private static isPromise<T>(p: any): p is Promise<T> {
    return p !== null && typeof p === 'object' && typeof p.then === 'function';
  }

  /**
   * Runs the beforeAgentCallback if it exists.
   * @param ctx The invocation context for this agent.
   * @returns An event if callback provides content or changed state.
   */
  private async __handleBeforeAgentCallback(ctx: InvocationContext): Promise<Event | null> {
    const callbackContext = new CallbackContext(ctx);

    // Run callbacks from the plugins.
    let beforeAgentCallbackContent = await ctx.pluginManager.runBeforeAgentCallback(
      this,
      callbackContext
    );

    // If no overrides are provided from the plugins, further run the canonical
    // callbacks.
    if (!beforeAgentCallbackContent && this.canonicalBeforeAgentCallbacks.length > 0) {
      for (const callback of this.canonicalBeforeAgentCallbacks) {
        let callbackResult = callback(callbackContext);
        if (BaseAgent.isPromise(callbackResult)) {
          callbackResult = await callbackResult;
        }
        beforeAgentCallbackContent = callbackResult;
        if (beforeAgentCallbackContent) {
          break;
        }
      }
    }

    // Process the override content if exists, and further process the state
    // change if exists.
    if (beforeAgentCallbackContent) {
      const retEvent = new Event({
        invocationId: ctx.invocationId,
        author: this.name,
        branch: ctx.branch,
        content: beforeAgentCallbackContent,
        actions: callbackContext._event_actions,
      });
      ctx.endInvocation = true;
      return retEvent;
    }

    if (callbackContext.state.has_delta()) {
      return new Event({
        invocationId: ctx.invocationId,
        author: this.name,
        branch: ctx.branch,
        actions: callbackContext._event_actions,
      });
    }

    return null;
  }

  /**
   * Runs the afterAgentCallback if it exists.
   * @param invocationContext The invocation context for this agent.
   * @returns An event if callback provides content or changed state.
   */
  private async __handleAfterAgentCallback(invocationContext: InvocationContext): Promise<Event | null> {
    const callbackContext = new CallbackContext(invocationContext);

    // Run callbacks from the plugins.
    let afterAgentCallbackContent = await invocationContext.pluginManager.runAfterAgentCallback(
      this,
      callbackContext
    );

    // If no overrides are provided from the plugins, further run the canonical
    // callbacks.
    if (!afterAgentCallbackContent && this.canonicalAfterAgentCallbacks.length > 0) {
      for (const callback of this.canonicalAfterAgentCallbacks) {
        let callbackResult = callback(callbackContext);
        if (BaseAgent.isPromise(callbackResult)) {
          callbackResult = await callbackResult;
        }
        afterAgentCallbackContent = callbackResult;
        if (afterAgentCallbackContent) {
          break;
        }
      }
    }

    // Process the override content if exists, and further process the state
    // change if exists.
    if (afterAgentCallbackContent) {
      const retEvent = new Event({
        invocationId: invocationContext.invocationId,
        author: this.name,
        branch: invocationContext.branch,
        content: afterAgentCallbackContent,
        actions: callbackContext._event_actions,
      });
      return retEvent;
    }

    if (callbackContext.state.has_delta()) {
      return new Event({
        invocationId: invocationContext.invocationId,
        author: this.name,
        branch: invocationContext.branch,
        content: afterAgentCallbackContent,
        actions: callbackContext._event_actions,
      });
    }

    return null;
  }

  private static __validateName(value: string): void {
    // Check if it's a valid identifier (similar to Python's isidentifier())
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
      throw new Error(
        `Found invalid agent name: \`${value}\`. ` +
        'Agent name must be a valid identifier. It should start with a ' +
        'letter (a-z, A-Z) or an underscore (_), and can only contain ' +
        'letters, digits (0-9), and underscores.'
      );
    }
    if (value === 'user') {
      throw new Error(
        "Agent name cannot be `user`. `user` is reserved for end-user's input."
      );
    }
  }

  private __setParentAgentForSubAgents(): void {
    for (const subAgent of this.subAgents) {
      if (subAgent.parentAgent !== null) {
        throw new Error(
          `Agent \`${subAgent.name}\` already has a parent agent, current ` +
          `parent: \`${subAgent.parentAgent.name}\`, trying to add: \`${this.name}\``
        );
      }
      subAgent.parentAgent = this;
    }
  }

  /**
   * Creates an agent from a config.
   * If sub-classes uses a custom agent config, override `_parseConfig`
   * method to return an updated kwargs for agent constructor.
   * @param config The config to create the agent from.
   * @param configAbsPath The absolute path to the config file that contains the agent config.
   * @returns The created agent.
   */
  public static fromConfig<T extends BaseAgent>(
    this: (new (options: any) => T) & typeof BaseAgent,
    config: BaseAgentConfig,
    configAbsPath: string
  ): T {
    const kwargs = this.__createKwargs(config, configAbsPath);
    const updatedKwargs = this._parseConfig(config, configAbsPath, kwargs);
    return new (this as any)(updatedKwargs);
  }

  /**
   * Parses the config and returns updated kwargs to construct the agent.
   * Sub-classes should override this method to use a custom agent config class.
   * @param config The config to parse.
   * @param configAbsPath The absolute path to the config file that contains the agent config.
   * @param kwargs The keyword arguments used for agent constructor.
   * @returns The updated keyword arguments used for agent constructor.
   */
  protected static _parseConfig(
    config: BaseAgentConfig,
    configAbsPath: string,
    kwargs: { [key: string]: any }
  ): { [key: string]: any } {
    return kwargs;
  }

  /** Creates kwargs for the fields of BaseAgent. */
  private static __createKwargs(
    config: BaseAgentConfig,
    configAbsPath: string
  ): { [key: string]: any } {
    // Import utilities - these would need to be implemented
    // const { resolveAgentReference } = require('./config-agent-utils');
    // const { resolveCallbacks } = require('./config-agent-utils');

    const kwargs: { [key: string]: any } = {
      name: config.name,
      description: config.description,
    };

    if (config.subAgents) {
      const subAgents: BaseAgent[] = [];
      for (const subAgentConfig of config.subAgents) {
        // const subAgent = resolveAgentReference(subAgentConfig, configAbsPath);
        // subAgents.push(subAgent);
        // Placeholder implementation
        throw new Error('resolveAgentReference not implemented');
      }
      kwargs.subAgents = subAgents;
    }

    if (config.beforeAgentCallbacks) {
      // kwargs.beforeAgentCallback = resolveCallbacks(config.beforeAgentCallbacks);
      // Placeholder implementation
      throw new Error('resolveCallbacks not implemented');
    }

    if (config.afterAgentCallbacks) {
      // kwargs.afterAgentCallback = resolveCallbacks(config.afterAgentCallbacks);
      // Placeholder implementation
      throw new Error('resolveCallbacks not implemented');
    }

    return kwargs;
  }
}