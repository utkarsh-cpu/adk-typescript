// TODO: Implement in task 3.3
import { Event } from '@/events';
import { BaseAgent } from './base-agent';
import { InvocationContext } from './invocation-context';
import { LlmAgent } from './llm-agent';
import { SequentialAgentConfig } from './configs';

export class SequentialAgent extends BaseAgent {
  public static override configType = SequentialAgentConfig;

  protected override async *_runAsyncImpl(
    ctx: InvocationContext
  ): AsyncGenerator<Event, void, unknown> {
    for (const subAgent of this.subAgents) {
      for await (const event of subAgent.runAsync(ctx)) {
        yield event;
      }
    }
  }

  protected override async *_runLiveImpl(
    ctx: InvocationContext
  ): AsyncGenerator<Event, void, unknown> {
    for (const subAgent of this.subAgents) {
      const taskCompleted = (): string => {
        return 'Task Completion Signaled';
      };
      if (subAgent instanceof LlmAgent) {
        // Use function name to dedupe
        const functionName = taskCompleted.name;
        if (
          !subAgent.tools.some(
            (tool) => typeof tool === 'function' && tool.name === functionName
          )
        ) {
          subAgent.tools.push(taskCompleted);
          subAgent.instruction +=
            `If you finished the user's request ` +
            `according to its description, call the ${functionName} function ` +
            `to exit so the next agents can take over. When calling this function, ` +
            `do not generate any text other than the function call.`;
        }
      }
    }

    for (const subAgent of this.subAgents) {
      for await (const event of subAgent.runLive(ctx)) {
        yield event;
      }
    }
  }
}
