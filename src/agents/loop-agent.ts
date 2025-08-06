// TODO: Implement in task 3.
import { InvocationContext } from "./invocation-context";
import { Event } from "@/events";
import { workingInProgress } from "@/utils";
import { BaseAgent } from "./base-agent";
import { BaseAgentConfig, LoopAgentConfig } from "./configs";
export class LoopAgent extends BaseAgent {
    public static override configType = LoopAgentConfig;
    maxIterations: number | null = null;
    protected override async *_runAsyncImpl(
        ctx: InvocationContext
    ): AsyncGenerator<Event, void, unknown> {
        let timesLooped = 0;
        while (this.maxIterations === null || timesLooped < this.maxIterations) {
            for (const subAgent of this.subAgents) {
                let shouldExit = false;
                // Use 'for await...of' for async generators
                for await (const event of subAgent.runAsync(ctx)) {
                    yield event;
                    if (event.actions?.escalate) {
                        shouldExit = true;
                    }
                }

                if (shouldExit) {
                    return; // Exit the entire generator function
                }
            }
            timesLooped += 1;
        }
        return;
    }

    /**
     * Live connection implementation.
     */
    protected override async *_runLiveImpl(
        ctx: InvocationContext
    ): AsyncGenerator<Event, void, unknown> {
        // Throw an error for not-implemented features.
        throw new Error('This is not supported yet for LoopAgent.');
        // `yield` is not required here if the function is declared as `async *`
    }

    /**
     * Creates a LoopAgent from its configuration.
     * @deprecated LoopAgent.fromConfig is not ready for use.
     * @param config The configuration object for the agent.
     * @param configAbsPath The absolute path to the configuration file.
     * @returns An instance of LoopAgent.
     */

}
