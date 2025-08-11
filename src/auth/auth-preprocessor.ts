import { LlmRequest } from "@/models";
import { InvocationContext } from "../agents/invocation-context";
import { Event } from "../events/event";
import { AuthHandler } from "./auth-handler";
import { AuthConfig, AuthToolArguments } from "./auth-tool";
import { BaseLlmRequestProcessor, REQUEST_EUC_FUNCTION_CALL_NAME, handleFunctionCallsAsync } from "@/flows/llm-flows";
// Constants
/**
 * Base class for LLM request processors
 */

/**
 * Handles auth information to build the LLM request.
 */
class AuthLlmRequestProcessor extends BaseLlmRequestProcessor {
    async *runAsync(invocationContext: InvocationContext, llmRequest: LlmRequest): AsyncGenerator<Event, null, unknown> {
        // Dynamic import to avoid circular dependency
        const { LlmAgent } = await import("../agents/llm-agent");

        const agent = invocationContext.agent;
        if (!(agent instanceof LlmAgent)) {
            return null;
        }

        const events = invocationContext.session.events;
        if (!events || events.length === 0) {
            return null;
        }

        const requestEucFunctionCallIds = new Set<string>();

        // Look for function call responses from the end backwards
        for (let k = events.length - 1; k >= 0; k--) {
            const event = events[k];

            // Look for first event authored by user
            if (!event.author || event.author !== 'user') {
                continue;
            }

            const responses = event.getFunctionResponses();
            if (!responses || responses.length === 0) {
                return null;
            }

            for (const functionCallResponse of responses) {
                if (functionCallResponse.name !== REQUEST_EUC_FUNCTION_CALL_NAME) {
                    continue;
                }

                // Found the function call response for the system long running request euc function call
                if (functionCallResponse.id) {
                    requestEucFunctionCallIds.add(functionCallResponse.id);
                }

                try {
                    const authConfig = new AuthConfig(functionCallResponse.response as any);
                    // Create a State instance from the session's state record
                    const { State } = await import("../sessions/state");
                    const state = new State(invocationContext.session.state, {});
                    await new AuthHandler(authConfig).parseAndStoreAuthResponse(state);
                    // Update the session state with any changes
                    invocationContext.session.state = state.toDict();
                } catch (error) {
                    console.error("Failed to parse auth config:", error);
                }
                break;
            }
            break;
        }

        if (requestEucFunctionCallIds.size === 0) {
            return null;
        }

        // Look for the system long running request euc function call
        for (let i = events.length - 2; i >= 0; i--) {
            const event = events[i];

            const functionCalls = event.getFunctionCalls();
            if (!functionCalls || functionCalls.length === 0) {
                continue;
            }

            const toolsToResume = new Set<string>();

            for (const functionCall of functionCalls) {
                if (!functionCall.id || !requestEucFunctionCallIds.has(functionCall.id)) {
                    continue;
                }

                try {
                    const args = new AuthToolArguments(functionCall.args as any);
                    toolsToResume.add(args.functionCallId);
                } catch (error) {
                    console.error("Failed to parse auth tool arguments:", error);
                }
            }

            if (toolsToResume.size === 0) {
                continue;
            }

            // Found the system long running request euc function call
            // Looking for original function call that requests euc
            for (let j = i - 1; j >= 0; j--) {
                const originalEvent = events[j];
                const originalFunctionCalls = originalEvent.getFunctionCalls();

                if (!originalFunctionCalls || originalFunctionCalls.length === 0) {
                    continue;
                }

                const hasMatchingFunctionCall = originalFunctionCalls.some(
                    functionCall => functionCall.id && toolsToResume.has(functionCall.id)
                );

                if (hasMatchingFunctionCall) {
                    // Handle function calls async - this would need to be implemented
                    // based on the actual functions module structure
                    const functionResponseEvent = await handleFunctionCallsAsync(
                        invocationContext,
                        originalEvent,
                        await this.getCanonicalTools(agent, invocationContext),
                        toolsToResume
                    );

                    if (functionResponseEvent) {
                        yield functionResponseEvent;
                    }
                    return null;
                }
            }
            return null;
        }

        return null;
    }


    private async getCanonicalTools(agent: any, invocationContext: InvocationContext): Promise<Record<string, any>> {
        // This would get the canonical tools from the agent
        // For now, return empty record as placeholder
        if (typeof agent.canonicalTools === 'function') {
            const tools = await agent.canonicalTools(invocationContext);
            const toolRecord: Record<string, any> = {};
            if (Array.isArray(tools)) {
                for (const tool of tools) {
                    if (tool.name) {
                        toolRecord[tool.name] = tool;
                    }
                }
            }
            return toolRecord;
        }
        return {};
    }
}

// Export the request processor instance
export const requestProcessor = new AuthLlmRequestProcessor();
