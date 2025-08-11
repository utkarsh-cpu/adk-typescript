import { InvocationContext } from "@/agents";
import { Event } from "@/events";
import { LlmRequest } from "@/models";
import { BaseLlmRequestProcessor } from "./_base-llm-processor";
import { removeClientFunctionCallId, REQUEST_EUC_FUNCTION_CALL_NAME } from "./functions";
import { Content, Part } from '@google/genai';

/**
 * Builds the contents for the LLM request.
 */
class ContentLlmRequestProcessor extends BaseLlmRequestProcessor {
    async *runAsync(invocationContext: InvocationContext, llmRequest: LlmRequest): AsyncGenerator<Event, null, unknown> {
        const { LlmAgent } = await import("@/agents/llm-agent");
        const agent = invocationContext.agent;

        if (!(agent instanceof LlmAgent)) {
            return null;
        }

        if (agent.includeContents === 'default') {
            // Include full conversation history
            llmRequest.contents = getContents(
                invocationContext.branch,
                invocationContext.session.events,
                agent.name
            );
        } else {
            // Include current turn context only (no conversation history)
            llmRequest.contents = getCurrentTurnContents(
                invocationContext.branch,
                invocationContext.session.events,
                agent.name
            );
        }

        // Maintain async generator behavior
        return null;
    }
}

export const requestProcessor = new ContentLlmRequestProcessor();

/**
 * Rearrange the async function_response events in the history.
 */
function rearrangeEventsForAsyncFunctionResponsesInHistory(events: Event[]): Event[] {
    const functionCallIdToResponseEventsIndex: Record<string, number> = {};

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const functionResponses = event.getFunctionResponses();

        if (functionResponses && functionResponses.length > 0) {
            for (const functionResponse of functionResponses) {
                if (functionResponse.id) {
                    functionCallIdToResponseEventsIndex[functionResponse.id] = i;
                }
            }
        }
    }

    const resultEvents: Event[] = [];

    for (const event of events) {
        if (event.getFunctionResponses().length > 0) {
            // function_response should be handled together with function_call below.
            continue;
        } else if (event.getFunctionCalls().length > 0) {
            const functionResponseEventsIndices = new Set<number>();

            for (const functionCall of event.getFunctionCalls()) {
                if (functionCall.id && functionCall.id in functionCallIdToResponseEventsIndex) {
                    functionResponseEventsIndices.add(functionCallIdToResponseEventsIndex[functionCall.id]);
                }
            }

            resultEvents.push(event);

            if (functionResponseEventsIndices.size === 0) {
                continue;
            }

            if (functionResponseEventsIndices.size === 1) {
                const index = Array.from(functionResponseEventsIndices)[0];
                resultEvents.push(events[index]);
            } else {
                // Merge all async function_response as one response event
                const indices = Array.from(functionResponseEventsIndices).sort((a, b) => a - b);
                const eventsToMerge = indices.map(i => events[i]);
                resultEvents.push(mergeFunctionResponseEvents(eventsToMerge));
            }
        } else {
            resultEvents.push(event);
        }
    }

    return resultEvents;
}

/**
 * Rearrange the events for the latest function_response.
 * If the latest function_response is for an async function_call, all events
 * between the initial function_call and the latest function_response will be
 * removed.
 */
function rearrangeEventsForLatestFunctionResponse(events: Event[]): Event[] {
    if (!events || events.length === 0) {
        return events;
    }

    const functionResponses = events[events.length - 1].getFunctionResponses();
    if (!functionResponses || functionResponses.length === 0) {
        // No need to process, since the latest event is not function_response.
        return events;
    }

    const functionResponsesIds = new Set<string>();
    for (const functionResponse of functionResponses) {
        if (functionResponse.id) {
            functionResponsesIds.add(functionResponse.id);
        }
    }

    if (events.length >= 2) {
        const functionCalls = events[events.length - 2].getFunctionCalls();
        if (functionCalls && functionCalls.length > 0) {
            for (const functionCall of functionCalls) {
                // The latest function_response is already matched
                if (functionCall.id && functionResponsesIds.has(functionCall.id)) {
                    return events;
                }
            }
        }
    }

    let functionCallEventIdx = -1;

    // Look for corresponding function call event reversely
    for (let idx = events.length - 2; idx >= 0; idx--) {
        const event = events[idx];
        const functionCalls = event.getFunctionCalls();

        if (functionCalls && functionCalls.length > 0) {
            for (const functionCall of functionCalls) {
                if (functionCall.id && functionResponsesIds.has(functionCall.id)) {
                    functionCallEventIdx = idx;
                    const functionCallIds = new Set(
                        functionCalls.map(fc => fc.id).filter(id => id !== undefined) as string[]
                    );

                    // Last response event should only contain the responses for the
                    // function calls in the same function call event
                    if (!isSubset(functionResponsesIds, functionCallIds)) {
                        throw new Error(
                            `Last response event should only contain the responses for the function calls in the same function call event. Function call ids found: ${Array.from(functionCallIds)}, function response ids provided: ${Array.from(functionResponsesIds)}`
                        );
                    }

                    // Collect all function responses from the function call event to
                    // the last response event
                    functionResponsesIds.clear();
                    functionCallIds.forEach(id => functionResponsesIds.add(id));
                    break;
                }
            }
            if (functionCallEventIdx !== -1) {
                break;
            }
        }
    }

    if (functionCallEventIdx === -1) {
        throw new Error(
            `No function call event found for function responses ids: ${Array.from(functionResponsesIds)}`
        );
    }

    // Collect all function response between last function response event
    // and function call event
    const functionResponseEvents: Event[] = [];
    for (let idx = functionCallEventIdx + 1; idx < events.length - 1; idx++) {
        const event = events[idx];
        const functionResponses = event.getFunctionResponses();

        if (functionResponses && functionResponses.length > 0) {
            const hasMatchingResponse = functionResponses.some(
                fr => fr.id && functionResponsesIds.has(fr.id)
            );
            if (hasMatchingResponse) {
                functionResponseEvents.push(event);
            }
        }
    }

    functionResponseEvents.push(events[events.length - 1]);

    const resultEvents = events.slice(0, functionCallEventIdx + 1);
    resultEvents.push(mergeFunctionResponseEvents(functionResponseEvents));

    return resultEvents;
}

/**
 * Get the contents for the LLM request.
 * Applies filtering, rearrangement, and content processing to events.
 */
export function getContents(
    currentBranch: string | undefined,
    events: Event[],
    agentName: string = ''
): Content[] {
    const filteredEvents: Event[] = [];

    // Parse the events, leaving the contents and the function calls and
    // responses from the current agent.
    for (const event of events) {
        if (!event.content ||
            !event.content.role ||
            !event.content.parts ||
            (event.content.parts.length > 0 && event.content.parts[0].text === '')) {
            // Skip events without content, or generated neither by user nor by model
            // or has empty text.
            // E.g. events purely for mutating session states.
            continue;
        }

        if (!isEventBelongsToBranch(currentBranch, event)) {
            // Skip events not belong to current branch.
            continue;
        }

        if (isAuthEvent(event)) {
            // Skip auth events.
            continue;
        }

        filteredEvents.push(
            isOtherAgentReply(agentName, event)
                ? convertForeignEvent(event)
                : event
        );
    }

    // Rearrange events for proper function call/response pairing
    let resultEvents = rearrangeEventsForLatestFunctionResponse(filteredEvents);
    resultEvents = rearrangeEventsForAsyncFunctionResponsesInHistory(resultEvents);

    // Convert events to contents
    const contents: Content[] = [];
    for (const event of resultEvents) {
        const content = JSON.parse(JSON.stringify(event.content)); // Deep copy
        removeClientFunctionCallId(content);
        contents.push(content);
    }

    return contents;
}

/**
 * Get contents for the current turn only (no conversation history).
 * When include_contents='none', we want to include:
 * - The current user input
 * - Tool calls and responses from the current turn
 * But exclude conversation history from previous turns.
 */
export function getCurrentTurnContents(
    currentBranch: string | undefined,
    events: Event[],
    agentName: string = ''
): Content[] {
    // Find the latest event that starts the current turn and process from there
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (event.author === 'user' || isOtherAgentReply(agentName, event)) {
            return getContents(currentBranch, events.slice(i), agentName);
        }
    }
    return [];
}

/**
 * Whether the event is a reply from another agent.
 */
export function isOtherAgentReply(currentAgentName: string, event: Event): boolean {
    return !!(currentAgentName &&
        event.author !== currentAgentName &&
        event.author !== 'user');
}

/**
 * Converts an event authored by another agent as a user-content event.
 * This is to provide another agent's output as context to the current agent, so
 * that current agent can continue to respond, such as summarizing previous
 * agent's reply, etc.
 */
export function convertForeignEvent(event: Event): Event {
    if (!event.content || !event.content.parts) {
        return event;
    }

    const content: Content = {
        role: 'user',
        parts: [{ text: 'For context:' }]
    };

    // Ensure parts array exists
    if (!content.parts) {
        content.parts = [];
    }

    for (const part of event.content.parts) {
        // Exclude thoughts from the context.
        if (part.text && !part.thought) {
            content.parts!.push({
                text: `[${event.author}] said: ${part.text}`
            });
        } else if (part.functionCall) {
            content.parts!.push({
                text: `[${event.author}] called tool \`${part.functionCall.name}\` with parameters: ${JSON.stringify(part.functionCall.args)}`
            });
        } else if (part.functionResponse) {
            content.parts!.push({
                text: `[${event.author}] \`${part.functionResponse.name}\` tool returned result: ${JSON.stringify(part.functionResponse.response)}`
            });
        } else {
            // Fallback to the original part for non-text and non-functionCall parts.
            content.parts!.push(part);
        }
    }

    return new Event({
        timestamp: event.timestamp,
        author: 'user',
        content,
        branch: event.branch,
        invocationId: event.invocationId
    });
}

/**
 * Merges a list of function_response events into one event.
 * The key goal is to ensure:
 * 1. function_call and function_response are always of the same number.
 * 2. The function_call and function_response are consecutively in the content.
 */
function mergeFunctionResponseEvents(functionResponseEvents: Event[]): Event {
    if (!functionResponseEvents || functionResponseEvents.length === 0) {
        throw new Error('At least one function_response event is required.');
    }

    const mergedEvent = JSON.parse(JSON.stringify(functionResponseEvents[0])); // Deep copy
    const partsInMergedEvent: Part[] = mergedEvent.content?.parts || [];

    if (partsInMergedEvent.length === 0) {
        throw new Error('There should be at least one function_response part.');
    }

    const partIndicesInMergedEvent: Record<string, number> = {};
    for (let idx = 0; idx < partsInMergedEvent.length; idx++) {
        const part = partsInMergedEvent[idx];
        if (part.functionResponse?.id) {
            partIndicesInMergedEvent[part.functionResponse.id] = idx;
        }
    }

    for (let i = 1; i < functionResponseEvents.length; i++) {
        const event = functionResponseEvents[i];
        if (!event.content?.parts || event.content.parts.length === 0) {
            throw new Error('There should be at least one function_response part.');
        }

        for (const part of event.content.parts) {
            if (part.functionResponse?.id) {
                const functionCallId = part.functionResponse.id;
                if (functionCallId in partIndicesInMergedEvent) {
                    partsInMergedEvent[partIndicesInMergedEvent[functionCallId]] = part;
                } else {
                    partsInMergedEvent.push(part);
                    partIndicesInMergedEvent[functionCallId] = partsInMergedEvent.length - 1;
                }
            } else {
                partsInMergedEvent.push(part);
            }
        }
    }

    return new Event(mergedEvent);
}

/**
 * Event belongs to a branch, when event.branch is prefix of the invocation branch.
 */
function isEventBelongsToBranch(invocationBranch: string | undefined, event: Event): boolean {
    if (!invocationBranch || !event.branch) {
        return true;
    }
    return invocationBranch.startsWith(event.branch);
}

/**
 * Check if an event is an auth event.
 */
function isAuthEvent(event: Event): boolean {
    if (!event.content?.parts) {
        return false;
    }

    for (const part of event.content.parts) {
        if (part.functionCall?.name === REQUEST_EUC_FUNCTION_CALL_NAME) {
            return true;
        }
        if (part.functionResponse?.name === REQUEST_EUC_FUNCTION_CALL_NAME) {
            return true;
        }
    }

    return false;
}

/**
 * Utility function to check if set1 is a subset of set2.
 */
function isSubset<T>(set1: Set<T>, set2: Set<T>): boolean {
    for (const item of set1) {
        if (!set2.has(item)) {
            return false;
        }
    }
    return true;
}