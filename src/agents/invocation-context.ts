import { BaseArtifactService } from '../artifacts/base-artifact-service';
import  {BaseCredentialService} from "@/auth/credential_service/base-credential-service";
import  { BaseMemoryService } from '../memory/base-memory-service';
import  { PluginManager } from '../plugins/plugin-manager';
import  { BaseSessionService, Session } from '@/sessions';
import  { BaseAgent } from './base-agent';
import  { ActiveStreamingTool } from './active-streaming-tool';
import  { LiveRequestQueue } from './live-request-queue';
import  { RunConfig } from '@/agents';
import  { TranscriptionEntry } from '@/agents/transcription-entry';
import  { Content } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';

/**
 * Error thrown when the number of LLM calls exceed the limit.
 */
export class LlmCallsLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmCallsLimitExceededError';
  }
}

/**
 * A container to keep track of the cost of invocation.
 *
 * While we don't expect the metrics captured here to be a direct
 * representative of monetary cost incurred in executing the current
 * invocation, they in some ways have an indirect effect.
 */
class InvocationCostManager {
  private _numberOfLlmCalls: number = 0;

  /**
   * Increments _numberOfLlmCalls and enforces the limit.
   */
  incrementAndEnforceLlmCallsLimit(runConfig?: RunConfig): void {
    // We first increment the counter and then check the conditions.
    this._numberOfLlmCalls += 1;

    if (
      runConfig &&
      runConfig.maxLlmCalls > 0 &&
      this._numberOfLlmCalls > runConfig.maxLlmCalls
    ) {
      // We only enforce the limit if the limit is a positive number.
      throw new LlmCallsLimitExceededError(
        `Max number of llm calls limit of ${runConfig.maxLlmCalls} exceeded`
      );
    }
  }
}

/**
 * An invocation context represents the data of a single invocation of an agent.
 *
 * An invocation:
 *   1. Starts with a user message and ends with a final response.
 *   2. Can contain one or multiple agent calls.
 *   3. Is handled by runner.runAsync().
 *
 * An invocation runs an agent until it does not request to transfer to another
 * agent.
 *
 * An agent call:
 *   1. Is handled by agent.run().
 *   2. Ends when agent.run() ends.
 *
 * An LLM agent call is an agent with a BaseLLMFlow.
 * An LLM agent call can contain one or multiple steps.
 *
 * An LLM agent runs steps in a loop until:
 *   1. A final response is generated.
 *   2. The agent transfers to another agent.
 *   3. The endInvocation is set to true by any callbacks or tools.
 *
 * A step:
 *   1. Calls the LLM only once and yields its response.
 *   2. Calls the tools and yields their responses if requested.
 *
 * The summarization of the function response is considered another step, since
 * it is another llm call.
 * A step ends when it's done calling llm and tools, or if the endInvocation
 * is set to true at any time.
 *
 * ```
 *    ┌─────────────────────── invocation ──────────────────────────┐
 *    ┌──────────── llm_agent_call_1 ────────────┐ ┌─ agent_call_2 ─┐
 *    ┌──── step_1 ────────┐ ┌───── step_2 ──────┐
 *    [call_llm] [call_tool] [call_llm] [transfer]
 * ```
 */
export class InvocationContext {
  artifactService?: BaseArtifactService;
  sessionService: BaseSessionService;
  memoryService?: BaseMemoryService;
  credentialService?: BaseCredentialService;

  readonly invocationId: string;
  branch?: string;
  readonly agent: BaseAgent;
  readonly userContent?: Content;
  readonly session: Session;

  endInvocation: boolean = false;

  liveRequestQueue?: LiveRequestQueue;

  activeStreamingTools?: Map<string, ActiveStreamingTool>;

  transcriptionCache?: TranscriptionEntry[];

  runConfig?: RunConfig;

  pluginManager: PluginManager = new PluginManager();

  private _invocationCostManager: InvocationCostManager = new InvocationCostManager();

  constructor(options: {
    artifactService?: BaseArtifactService;
    sessionService: BaseSessionService;
    memoryService?: BaseMemoryService;
    credentialService?: BaseCredentialService;
    invocationId: string;
    branch?: string;
    agent: BaseAgent;
    userContent?: Content;
    session: Session;
    endInvocation?: boolean;
    liveRequestQueue?: LiveRequestQueue;
    activeStreamingTools?: Map<string, ActiveStreamingTool>;
    transcriptionCache?: TranscriptionEntry[];
    runConfig?: RunConfig;
    pluginManager?: PluginManager;
  }) {
    this.artifactService = options.artifactService;
    this.sessionService = options.sessionService;
    this.memoryService = options.memoryService;
    this.credentialService = options.credentialService;
    this.invocationId = options.invocationId;
    this.branch = options.branch;
    this.agent = options.agent;
    this.userContent = options.userContent;
    this.session = options.session;
    this.endInvocation = options.endInvocation ?? false;
    this.liveRequestQueue = options.liveRequestQueue;
    this.activeStreamingTools = options.activeStreamingTools;
    this.transcriptionCache = options.transcriptionCache;
    this.runConfig = options.runConfig;
    if (options.pluginManager) {
      this.pluginManager = options.pluginManager;
    }
  }

  /**
   * Tracks number of llm calls made.
   *
   * @throws {LlmCallsLimitExceededError} If number of llm calls made exceed the set threshold.
   */
  incrementLlmCallCount(): void {
    this._invocationCostManager.incrementAndEnforceLlmCallsLimit(this.runConfig);
  }

  get appName(): string {
    return this.session.appName;
  }

  get userId(): string {
    return this.session.userId;
  }
}

/**
 * Generates a new invocation context ID.
 */
export function newInvocationContextId(): string {
  return 'e-' + uuidv4();
}
