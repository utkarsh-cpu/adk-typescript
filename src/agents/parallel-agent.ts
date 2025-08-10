import { Event } from '@/events';
import { BaseAgent } from './base-agent';
import { ParallelAgentConfig } from './configs';
import { InvocationContext } from './invocation-context';

function _createBranchCtxForSubAgent(
  agent: BaseAgent,
  subAgent: BaseAgent,
  invocationContext: InvocationContext
): InvocationContext {
  // Create isolated branch for every sub-agent
  const branchSuffix = `${agent.name}.${subAgent.name}`;
  const newBranch = invocationContext.branch
    ? `${invocationContext.branch}.${branchSuffix}`
    : branchSuffix;

  return new InvocationContext({
    artifactService: invocationContext.artifactService,
    sessionService: invocationContext.sessionService,
    memoryService: invocationContext.memoryService,
    credentialService: invocationContext.credentialService,
    invocationId: invocationContext.invocationId,
    branch: newBranch,
    agent: invocationContext.agent,
    userContent: invocationContext.userContent,
    session: invocationContext.session,
    endInvocation: invocationContext.endInvocation,
    liveRequestQueue: invocationContext.liveRequestQueue,
    activeStreamingTools: invocationContext.activeStreamingTools,
    transcriptionCache: invocationContext.transcriptionCache,
    runConfig: invocationContext.runConfig,
    pluginManager: invocationContext.pluginManager,
  });
}

/**
 * Merges the agent run event generators.
 *
 * This implementation guarantees for each agent, it won't move on until the
 * generated event is processed by upstream runner.
 *
 * @param agentRuns - A list of async generators that yield events from each agent.
 * @yields Event - The next event from the merged generator.
 */
async function* _mergeAgentRun(
  agentRuns: AsyncGenerator<Event>[]
): AsyncGenerator<Event> {
  // Create initial tasks for each agent run
  const tasks = agentRuns.map((agentRun, index) => ({
    promise: agentRun.next(),
    index,
    finished: false,
  }));

  while (tasks.some((task) => !task.finished)) {
    // Wait for the first task to complete
    const completedTaskIndex = await Promise.race(
      tasks
        .filter((task) => !task.finished)
        .map(async (task, arrayIndex) => {
          const result = await task.promise;
          return { result, originalIndex: task.index, arrayIndex };
        })
    );

    const { result, originalIndex } = completedTaskIndex;

    if (!result.done) {
      // Yield the event
      yield result.value;

      // Create a new task for this generator
      tasks[originalIndex].promise = agentRuns[originalIndex].next();
    } else {
      // Mark this generator as finished
      tasks[originalIndex].finished = true;
    }
  }
}

/**
 * A shell agent that runs its sub-agents in parallel in isolated manner.
 *
 * This approach is beneficial for scenarios requiring multiple perspectives or
 * attempts on a single task, such as:
 *
 * - Running different algorithms simultaneously.
 * - Generating multiple responses for review by a subsequent evaluation agent.
 */
export class ParallelAgent extends BaseAgent {
  public static override configType = ParallelAgentConfig;

  protected async *_runAsyncImpl(
    ctx: InvocationContext
  ): AsyncGenerator<Event> {
    const agentRuns = this.subAgents.map((subAgent) =>
      subAgent.runAsync(_createBranchCtxForSubAgent(this, subAgent, ctx))
    );

    yield* _mergeAgentRun(agentRuns);
  }

  protected async *_runLiveImpl(
    _ctx: InvocationContext
  ): AsyncGenerator<Event> {
    throw new Error('This is not supported yet for ParallelAgent.');
    // AsyncGenerator requires having at least one yield statement
    yield undefined as never;
  }
}
