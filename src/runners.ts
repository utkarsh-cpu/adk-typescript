// Google GenAI types - you'll need to import from the appropriate TypeScript SDK
import { Content } from '@google/genai';

// Local imports - adjust paths as needed
import { ActiveStreamingTool } from './agents/active-streaming-tool';
import { BaseAgent } from './agents/base-agent';
import {
  InvocationContext,
  newInvocationContextId,
} from './agents/invocation-context';
import { LiveRequestQueue } from './agents/live-request-queue';
import { LlmAgent } from './agents/llm-agent';
import { RunConfig } from './agents/run-config';
import { BaseArtifactService } from './artifacts/base-artifact-service';
import { InMemoryArtifactService } from './artifacts/in-memory-artifact-service';
import { BaseCredentialService } from './auth/credential_service/base-credential-service';
import { BuiltInCodeExecutor } from './code-executors/built-in-code-executor';
import { Event, EventActions } from './events';
import { findMatchingFunctionCall } from './flows/llm-flows/functions';
import { BaseMemoryService } from './memory/base-memory-service';
import { InMemoryMemoryService } from './memory/in-memory-memory-service';
import { BasePlugin } from './plugins/base-plugin';
import { PluginManager } from './plugins/plugin-manager';
import { BaseSessionService } from './sessions/base-session-service';
import { InMemorySessionService } from './sessions/in-memory-session-service';
import { Session } from './sessions/session';
import { BaseToolset } from './tools/base-toolset';

const logger = console; // Replace with your preferred logging solution

function isContent(x: any): x is Content {
  return !!x && typeof x === 'object' && 'parts' in x;
}

/**
 * Simple async queue implementation for event handling
 */
class AsyncQueue<T> {
  private queue: T[] = [];
  private waitingResolvers: Array<(value: T | null) => void> = [];
  private closed = false;

  async put(item: T): Promise<void> {
    if (this.closed) {
      throw new Error('Queue is closed');
    }

    if (this.waitingResolvers.length > 0) {
      const resolve = this.waitingResolvers.shift()!;
      resolve(item);
    } else {
      this.queue.push(item);
    }
  }

  async get(): Promise<T | null> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }

    if (this.closed) {
      return null;
    }

    return new Promise<T | null>((resolve) => {
      this.waitingResolvers.push(resolve);
    });
  }

  close(): void {
    this.closed = true;
    // Resolve all waiting promises with null
    while (this.waitingResolvers.length > 0) {
      const resolve = this.waitingResolvers.shift()!;
      resolve(null);
    }
  }
}

/**
 * Utility function to add timeout to promises
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
}

/**
 * Simple thread simulation using Promise
 */
class SimpleThread {
  private promise: Promise<void>;

  constructor(target: () => Promise<void>) {
    this.promise = target();
  }

  start(): void {
    // Promise is already started in constructor
  }

  async join(): Promise<void> {
    await this.promise;
  }
}

/**
 * The Runner class is used to run agents.
 *
 * It manages the execution of an agent within a session, handling message
 * processing, event generation, and interaction with various services like
 * artifact storage, session management, and memory.
 */
export class Runner {
  /** The app name of the runner. */
  public readonly appName: string;

  /** The root agent to run. */
  public readonly agent: BaseAgent;

  /** The artifact service for the runner. */
  public readonly artifactService: BaseArtifactService | null;

  /** The plugin manager for the runner. */
  public readonly pluginManager: PluginManager;

  /** The session service for the runner. */
  public readonly sessionService: BaseSessionService;

  /** The memory service for the runner. */
  public readonly memoryService: BaseMemoryService | null;

  /** The credential service for the runner. */
  public readonly credentialService: BaseCredentialService | null;

  constructor(options: {
    appName: string;
    agent: BaseAgent;
    plugins?: BasePlugin[] | null;
    artifactService?: BaseArtifactService | null;
    sessionService: BaseSessionService;
    memoryService?: BaseMemoryService | null;
    credentialService?: BaseCredentialService | null;
  }) {
    this.appName = options.appName;
    this.agent = options.agent;
    this.artifactService = options.artifactService || null;
    this.sessionService = options.sessionService;
    this.memoryService = options.memoryService || null;
    this.credentialService = options.credentialService || null;
    this.pluginManager = new PluginManager(options.plugins ?? undefined);
  }

  /**
   * Runs the agent.
   *
   * NOTE: This sync interface is only for local testing and convenience purpose.
   * Consider using `runAsync` for production usage.
   */
  public *run(options: {
    userId: string;
    sessionId: string;
    newMessage: Content;
    runConfig?: RunConfig;
  }): Generator<Event, void, unknown> {
    const {
      userId,
      sessionId,
      newMessage,
      runConfig = new RunConfig(),
    } = options;
    const eventQueue = new AsyncQueue<Event>();

    const invokeRunAsync = async (): Promise<void> => {
      try {
        for await (const event of this.runAsync({
          userId,
          sessionId,
          newMessage,
          runConfig,
        })) {
          await eventQueue.put(event);
        }
      } finally {
        eventQueue.close();
      }
    };

    const asyncioThreadMain = async (): Promise<void> => {
      try {
        await invokeRunAsync();
      } finally {
        eventQueue.close();
      }
    };

    const thread = new SimpleThread(asyncioThreadMain);
    thread.start();

    // Consume and re-yield the events from background thread
    let event: Event | null;
    while ((event = this.getNextEventSync(eventQueue)) !== null) {
      yield event;
    }

    // Wait for thread completion
    this.joinThreadSync(thread);
  }

  /**
   * Synchronously get next event from queue (simplified implementation)
   */
  private getNextEventSync(queue: AsyncQueue<Event>): Event | null {
    // This is a simplified sync wrapper - in a real implementation,
    // you might want to use a different approach or make this truly async
    let result: Event | null = null;
    let resolved = false;

    queue.get().then((event) => {
      result = event;
      resolved = true;
    });

    // Simple busy wait (not recommended for production)
    while (!resolved) {
      // This would need a proper sync mechanism in real code
    }

    return result;
  }

  /**
   * Synchronously join thread (simplified implementation)
   */
  private joinThreadSync(thread: SimpleThread): void {
    let completed = false;
    thread.join().then(() => {
      completed = true;
    });

    // Simple busy wait (not recommended for production)
    while (!completed) {
      // This would need a proper sync mechanism in real code
    }
  }

  /**
   * Main entry method to run the agent in this runner.
   */
  public async *runAsync(options: {
    userId: string;
    sessionId: string;
    newMessage: Content;
    stateDelta?: Record<string, any> | null;
    runConfig?: RunConfig;
  }): AsyncGenerator<Event, void, unknown> {
    const {
      userId,
      sessionId,
      newMessage,
      stateDelta = null,
      runConfig = new RunConfig(),
    } = options;

    const session = await this.sessionService.getSession({
      appName: this.appName,
      userId,
      sessionId,
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const invocationContext = this.newInvocationContext({
      session,
      newMessage,
      runConfig,
    });

    const rootAgent = this.agent;

    // Modify user message before execution
    const modifiedUserMessage =
      await invocationContext.pluginManager.runOnUserMessageCallback(
        newMessage,
        invocationContext
      );

    const finalMessage = modifiedUserMessage ?? newMessage;

    if (finalMessage) {
      await this.appendNewMessageToSession({
        session,
        newMessage: finalMessage,
        invocationContext,
        saveInputBlobsAsArtifacts: runConfig.saveInputBlobsAsArtifacts,
        stateDelta,
      });
    }

    invocationContext.agent = this.findAgentToRun(session, rootAgent);

    const execute = async function* (
      ctx: InvocationContext
    ): AsyncGenerator<Event, void, unknown> {
      yield* ctx.agent.runAsync(ctx);
    };

    yield* this.execWithPlugin(invocationContext, session, execute);
  }

  /**
   * Wraps execution with plugin callbacks.
   */
  private async *execWithPlugin(
    invocationContext: InvocationContext,
    session: Session,
    executeFn: (ctx: InvocationContext) => AsyncGenerator<Event, void, unknown>
  ): AsyncGenerator<Event, void, unknown> {
    const pluginManager = invocationContext.pluginManager;

    // Step 1: Run the before_run callbacks to see if we should early exit
    const earlyExitResult =
      await pluginManager.runBeforeRunCallback(invocationContext);

    if (isContent(earlyExitResult)) {
      const earlyExitEvent = new Event({
        invocationId: invocationContext.invocationId,
        author: 'model',
        content: earlyExitResult,
      });
      await this.sessionService.appendEvent(session, earlyExitEvent);
      yield earlyExitEvent;
    } else {
      // Step 2: Otherwise continue with normal execution
      for await (const event of executeFn(invocationContext)) {
        if (!event.partial) {
          await this.sessionService.appendEvent(session, event);
        }
        // Step 3: Run the on_event callbacks to optionally modify the event
        const modifiedEvent = await pluginManager.runOnEventCallback(
          invocationContext,
          event
        );
        yield modifiedEvent || event;
      }
    }

    // Step 4: Run the after_run callbacks to optionally modify the context
    await pluginManager.runAfterRunCallback(invocationContext);
  }

  /**
   * Appends a new message to the session.
   */
  private async appendNewMessageToSession(options: {
    session: Session;
    newMessage: Content;
    invocationContext: InvocationContext;
    saveInputBlobsAsArtifacts?: boolean;
    stateDelta?: Record<string, any> | null;
  }): Promise<void> {
    const {
      session,
      newMessage,
      invocationContext,
      saveInputBlobsAsArtifacts = false,
      stateDelta = null,
    } = options;

    if (!newMessage.parts) {
      throw new Error('No parts in the new_message.');
    }

    if (this.artifactService && saveInputBlobsAsArtifacts) {
      // Save artifacts and replace with placeholders
      for (let i = 0; i < newMessage.parts.length; i++) {
        const part = newMessage.parts[i];
        if (!part.inlineData) {
          continue;
        }
        const fileName = `artifact_${invocationContext.invocationId}_${i}`;
        await this.artifactService.saveArtifact({
          appName: this.appName,
          userId: session.userId,
          sessionId: session.id,
          filename: fileName,
          artifact: part,
        });
        newMessage.parts[i] = {
          text: `Uploaded file: ${fileName}. It is saved into artifacts`,
        };
      }
    }

    // Create and append event
    const event = stateDelta
      ? new Event({
          invocationId: invocationContext.invocationId,
          author: 'user',
          actions: new EventActions({ stateDelta }),
          content: newMessage,
        })
      : new Event({
          invocationId: invocationContext.invocationId,
          author: 'user',
          content: newMessage,
        });

    await this.sessionService.appendEvent(session, event);
  }

  /**
   * Runs the agent in live mode (experimental feature).
   */
  public async *runLive(options: {
    userId?: string | null;
    sessionId?: string | null;
    liveRequestQueue: LiveRequestQueue;
    runConfig?: RunConfig;
    session?: Session | null;
  }): AsyncGenerator<Event, void, unknown> {
    const {
      userId = null,
      sessionId = null,
      liveRequestQueue,
      runConfig = new RunConfig(),
      session: providedSession = null,
    } = options;

    if (providedSession === null && (userId === null || sessionId === null)) {
      throw new Error(
        'Either session or user_id and session_id must be provided.'
      );
    }

    if (providedSession !== null) {
      console.warn(
        'The `session` parameter is deprecated. Please use `userId` and `sessionId` instead.'
      );
    }

    let session = providedSession;
    if (!session) {
      session = await this.sessionService.getSession({
        appName: this.appName,
        userId: userId!,
        sessionId: sessionId!,
      });
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
    }

    const invocationContext = this.newInvocationContextForLive({
      session,
      liveRequestQueue,
      runConfig,
    });

    const rootAgent = this.agent;
    invocationContext.agent = this.findAgentToRun(session, rootAgent);

    // Pre-processing for live streaming tools
    invocationContext.activeStreamingTools = new Map();

    if ('tools' in invocationContext.agent) {
      const agent = invocationContext.agent as any;
      for (const tool of agent.tools || []) {
        const callableToInspect = tool.func || tool;
        if (typeof callableToInspect !== 'function') {
          continue;
        }

        // TypeScript doesn't have Python's inspect module, so this is a simplified check
        if (this.toolUsesLiveRequestQueue(tool)) {
          if (!invocationContext.activeStreamingTools) {
            invocationContext.activeStreamingTools = new Map();
          }
          const activeStreamingTool = new ActiveStreamingTool({
            stream: new LiveRequestQueue(),
          });
          invocationContext.activeStreamingTools.set(
            tool.name,
            activeStreamingTool
          );
        }
      }
    }

    const execute = async function* (
      ctx: InvocationContext
    ): AsyncGenerator<Event, void, unknown> {
      yield* ctx.agent.runLive(ctx);
    };

    yield* this.execWithPlugin(invocationContext, session, execute);
  }

  /**
   * Helper method to check if a tool uses LiveRequestQueue
   */
  private toolUsesLiveRequestQueue(_tool: any): boolean {
    // Implement based on your tool system's parameter inspection
    return false;
  }

  /**
   * Finds the agent to run to continue the session.
   */
  private findAgentToRun(session: Session, rootAgent: BaseAgent): BaseAgent {
    // If the last event is a function response, send to corresponding agent
    const event = findMatchingFunctionCall(session.events);
    if (event && event.author) {
      const eventAgent = rootAgent.findAgent(event.author);
      if (eventAgent) {
        return eventAgent;
      }
    }

    for (const event of session.events.slice().reverse()) {
      if (event.author === 'user') continue;

      if (event.author === rootAgent.name) {
        return rootAgent;
      }
      const eventAuthor = event.author;
      if (eventAuthor) {
        const agent = rootAgent.findSubAgent(eventAuthor);
        if (!agent) {
          logger.warn(
            `Event from an unknown agent: ${event.author}, event id: ${event.id}`
          );
          continue;
        }

        if (this.isTransferableAcrossAgentTree(agent)) {
          return agent;
        }
      }
    }

    return rootAgent;
  }

  /**
   * Whether the agent to run can transfer to any other agent in the agent tree.
   */
  private isTransferableAcrossAgentTree(agentToRun: BaseAgent): boolean {
    let agent: BaseAgent | null = agentToRun;
    while (agent) {
      if (!(agent instanceof LlmAgent)) {
        return false;
      }
      if (agent.disallowTransferToParent) {
        return false;
      }
      agent = agent.parentAgent;
    }
    return true;
  }

  /**
   * Creates a new invocation context.
   */
  private newInvocationContext(options: {
    session: Session;
    newMessage?: Content | null;
    liveRequestQueue?: LiveRequestQueue | null;
    runConfig?: RunConfig;
  }): InvocationContext {
    const {
      session,
      newMessage = null,
      liveRequestQueue = null,
      runConfig = new RunConfig(),
    } = options;

    const invocationId = newInvocationContextId();

    if (runConfig.supportCfc && this.agent instanceof LlmAgent) {
      const modelName = this.agent.canonicalModel.model;
      if (!modelName.startsWith('gemini-2')) {
        throw new Error(
          `CFC is not supported for model: ${modelName} in agent: ${this.agent.name}`
        );
      }
      if (!(this.agent.codeExecutor instanceof BuiltInCodeExecutor)) {
        this.agent.codeExecutor = new BuiltInCodeExecutor();
      }
    }

    return new InvocationContext({
      artifactService: this.artifactService ?? undefined,
      sessionService: this.sessionService,
      memoryService: this.memoryService ?? undefined,
      credentialService: this.credentialService ?? undefined,
      pluginManager: this.pluginManager,
      invocationId,
      agent: this.agent,
      session,
      userContent: newMessage ?? undefined,
      liveRequestQueue: liveRequestQueue ?? undefined,
      runConfig,
    });
  }

  /**
   * Creates a new invocation context for live multi-agent.
   */
  private newInvocationContextForLive(options: {
    session: Session;
    liveRequestQueue?: LiveRequestQueue | null;
    runConfig?: RunConfig;
  }): InvocationContext {
    const {
      session,
      liveRequestQueue = null,
      runConfig = new RunConfig(),
    } = options;

    // For live multi-agent, we need model's text transcription as context
    if (this.agent.subAgents && liveRequestQueue) {
      if (!runConfig.responseModalities) {
        runConfig.responseModalities = ['AUDIO'];
        if (!runConfig.outputAudioTranscription) {
          runConfig.outputAudioTranscription = {};
        }
      } else if (!runConfig.responseModalities.includes('TEXT')) {
        if (!runConfig.outputAudioTranscription) {
          runConfig.outputAudioTranscription = {};
        }
      }
      if (!runConfig.inputAudioTranscription) {
        runConfig.inputAudioTranscription = {};
      }
    }

    return this.newInvocationContext({
      session,
      liveRequestQueue,
      runConfig,
    });
  }

  /**
   * Collects all toolsets from the agent tree.
   */
  private collectToolset(agent: BaseAgent): Set<BaseToolset> {
    const toolsets = new Set<BaseToolset>();

    if (agent instanceof LlmAgent) {
      for (const toolUnion of agent.tools) {
        if (toolUnion instanceof BaseToolset) {
          toolsets.add(toolUnion);
        }
      }
    }

    for (const subAgent of agent.subAgents) {
      const subToolsets = this.collectToolset(subAgent);
      subToolsets.forEach((toolset) => toolsets.add(toolset));
    }

    return toolsets;
  }

  /**
   * Clean up toolsets with proper task context management.
   */
  private async cleanupToolsets(
    toolsetsToClose: Set<BaseToolset>
  ): Promise<void> {
    if (toolsetsToClose.size === 0) {
      return;
    }

    for (const toolset of toolsetsToClose) {
      try {
        logger.info(`Closing toolset: ${toolset.constructor.name}`);

        // Add timeout protection using native Promise.race
        await withTimeout(toolset.close(), 10000);

        logger.info(`Successfully closed toolset: ${toolset.constructor.name}`);
      } catch (error) {
        if (error instanceof Error && error.message === 'Operation timed out') {
          logger.warn(`Toolset ${toolset.constructor.name} cleanup timed out`);
        } else {
          logger.error(
            `Error closing toolset ${toolset.constructor.name}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Closes the runner.
   */
  public async close(): Promise<void> {
    await this.cleanupToolsets(this.collectToolset(this.agent));
  }
}

/**
 * An in-memory Runner for testing and development.
 */
export class InMemoryRunner extends Runner {
  private readonly inMemorySessionService: InMemorySessionService;

  constructor(
    agent: BaseAgent,
    options: {
      appName?: string;
      plugins?: BasePlugin[] | null;
    } = {}
  ) {
    const { appName = 'InMemoryRunner', plugins = null } = options;

    const inMemorySessionService = new InMemorySessionService();

    super({
      appName,
      agent,
      artifactService: new InMemoryArtifactService(),
      plugins,
      sessionService: inMemorySessionService,
      memoryService: new InMemoryMemoryService(),
    });

    this.inMemorySessionService = inMemorySessionService;
  }
}
