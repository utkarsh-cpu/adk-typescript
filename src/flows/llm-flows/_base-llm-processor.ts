import { LlmRequest, LlmResponse } from "@/models";
import { InvocationContext } from "@/agents/invocation-context";
import { Event } from "@/events/event";

/**
 * Base class for LLM request processor.
 */
export abstract class BaseLlmRequestProcessor {
    /**
     * Runs the processor.
     * @param context The invocation context
     * @param request The LLM request to process
     */
    abstract runAsync(
        context: InvocationContext,
        request: LlmRequest
    ): AsyncGenerator<Event, null, unknown>;
}

/**
 * Base class for LLM response processor.
 */
export abstract class BaseLlmResponseProcessor {
    /**
     * Processes the LLM response.
     * @param context The invocation context
     * @param response The LLM response to process
     */
    abstract runAsync(
        context: InvocationContext,
        response: LlmResponse
    ): AsyncGenerator<Event, null, unknown>;
}
