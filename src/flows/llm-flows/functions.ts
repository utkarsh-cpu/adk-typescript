import { ActiveStreamingTool } from "../../agents/active-streaming-tool";
import { InvocationContext } from "@/agents";
import { AuthToolArguments } from "@/auth";
import { Event, EventActions } from "@/events";
import { traceMergedToolCalls, traceToolCall } from "@/telemetry";
import { BaseTool, ToolContext } from "@/tools";
import { LlmAgent } from "@/agents";
import { v4 as uuidv4 } from 'uuid';
import { Content, FunctionCall, Part } from '@google/genai';

const AF_FUNCTION_CALL_ID_PREFIX = 'adk-';
export const REQUEST_EUC_FUNCTION_CALL_NAME = 'adk_request_credential';

// Logger placeholder - in a real implementation, use a proper logging library
const logger = {
    info: (...args: any[]) => console.info('[INFO]', ...args),
    warning: (...args: any[]) => console.warn('[WARNING]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
};

export function generateClientFunctionCallId(): string {
    return `${AF_FUNCTION_CALL_ID_PREFIX}${uuidv4()}`;
}

export function populateClientFunctionCallId(modelResponseEvent: Event): void {
    const functionCalls = modelResponseEvent.getFunctionCalls();
    if (!functionCalls || functionCalls.length === 0) {
        return;
    }

    for (const functionCall of functionCalls) {
        if (!functionCall.id) {
            functionCall.id = generateClientFunctionCallId();
        }
    }
}

export function removeClientFunctionCallId(content: Content): void {
    if (!content || !content.parts) {
        return;
    }

    for (const part of content.parts) {
        if (part.functionCall?.id?.startsWith(AF_FUNCTION_CALL_ID_PREFIX)) {
            part.functionCall.id = undefined;
        }
        if (part.functionResponse?.id?.startsWith(AF_FUNCTION_CALL_ID_PREFIX)) {
            part.functionResponse.id = undefined;
        }
    }
}

export function getLongRunningFunctionCalls(
    functionCalls: FunctionCall[],
    toolsDict: Record<string, BaseTool>
): Set<string> {
    const longRunningToolIds = new Set<string>();

    for (const functionCall of functionCalls) {
        if (functionCall.name &&
            functionCall.name in toolsDict &&
            toolsDict[functionCall.name].is_long_running &&
            functionCall.id) {
            longRunningToolIds.add(functionCall.id);
        }
    }

    return longRunningToolIds;
}

export function generateAuthEvent(
    invocationContext: InvocationContext,
    functionResponseEvent: Event
): Event | null {
    if (!functionResponseEvent.actions?.requestedAuthConfigs) {
        return null;
    }

    const parts: Part[] = [];
    const longRunningToolIds = new Set<string>();

    for (const [functionCallId, authConfig] of Object.entries(functionResponseEvent.actions.requestedAuthConfigs)) {
        const requestEucFunctionCall: FunctionCall = {
            name: REQUEST_EUC_FUNCTION_CALL_NAME,
            args: {
                functionCallId,
                authConfig
            }
        };

        requestEucFunctionCall.id = generateClientFunctionCallId();
        longRunningToolIds.add(requestEucFunctionCall.id);

        parts.push({
            functionCall: requestEucFunctionCall
        });
    }

    return new Event({
        invocationId: invocationContext.invocationId,
        author: invocationContext.agent.name,
        branch: invocationContext.branch,
        content: {
            parts,
            role: functionResponseEvent.content?.role || 'user'
        },
        longRunningToolIds
    });
}

export async function handleFunctionCallsAsync(
    invocationContext: InvocationContext,
    functionCallEvent: Event,
    toolsDict: Record<string, BaseTool>,
    filters?: Set<string>
): Promise<Event | null> {
    const { LlmAgent } = await import("@/agents/llm-agent");
    const agent = invocationContext.agent;

    if (!(agent instanceof LlmAgent)) {
        return null;
    }

    const functionCalls = functionCallEvent.getFunctionCalls();

    // Filter function calls
    const filteredCalls = functionCalls.filter(fc =>
        !filters || (fc.id && filters.has(fc.id))
    );

    if (filteredCalls.length === 0) {
        return null;
    }

    // Create tasks for parallel execution
    const tasks = filteredCalls.map(functionCall =>
        executeSingleFunctionCallAsync(invocationContext, functionCall, toolsDict, agent)
    );

    // Wait for all tasks to complete
    const functionResponseEvents = await Promise.all(tasks);

    // Filter out null results
    const validEvents = functionResponseEvents.filter(event => event !== null) as Event[];

    if (validEvents.length === 0) {
        return null;
    }

    const mergedEvent = mergeParallelFunctionResponseEvents(validEvents);

    if (validEvents.length > 1) {
        // This is needed for debug traces of parallel calls
        traceMergedToolCalls(mergedEvent.id, mergedEvent);
    }

    return mergedEvent;
}

async function executeSingleFunctionCallAsync(
    invocationContext: InvocationContext,
    functionCall: FunctionCall,
    toolsDict: Record<string, BaseTool>,
    agent: LlmAgent
): Promise<Event | null> {
    const { tool, toolContext } = getToolAndContext(invocationContext, functionCall, toolsDict);

    // Make a deep copy to avoid being modified
    const functionArgs = functionCall.args ? JSON.parse(JSON.stringify(functionCall.args)) : {};

    let functionResponse: any = null;

    // Step 1: Check if plugin before_tool_callback overrides the function response
    functionResponse = await invocationContext.pluginManager?.runBeforeToolCallback?.(
        tool, functionArgs, toolContext
    );

    // Step 2: If no overrides are provided from the plugins, run canonical callbacks
    if (functionResponse === null && agent.canonicalBeforeToolCallbacks) {
        for (const callback of agent.canonicalBeforeToolCallbacks) {
            functionResponse = callback(tool, functionArgs, toolContext);
            if (functionResponse && typeof functionResponse.then === 'function') {
                functionResponse = await functionResponse;
            }
            if (functionResponse) {
                break;
            }
        }
    }

    // Step 3: Otherwise, proceed calling the tool normally
    if (functionResponse === null) {
        try {
            functionResponse = await callToolAsync(tool, functionArgs, toolContext);
        } catch (toolError) {
            const error = toolError instanceof Error ? toolError : new Error(String(toolError));
            const errorResponse = await invocationContext.pluginManager?.runOnToolErrorCallback?.(
                tool, functionArgs, toolContext, error
            );
            if (errorResponse !== null && errorResponse !== undefined) {
                functionResponse = errorResponse;
            } else {
                throw error;
            }
        }
    }

    // Step 4: Check if plugin after_tool_callback overrides the function response
    let alteredFunctionResponse = await invocationContext.pluginManager?.runAfterToolCallback?.(
        tool, functionArgs, toolContext, functionResponse
    );

    // Step 5: If no overrides are provided from the plugins, run canonical after_tool_callbacks
    if (alteredFunctionResponse === null && agent.canonicalAfterToolCallbacks) {
        for (const callback of agent.canonicalAfterToolCallbacks) {
            let callbackResult = callback(
                tool,
                functionArgs,
                toolContext,
                functionResponse
            );
            if (callbackResult && typeof callbackResult.then === 'function') {
                callbackResult = await callbackResult;
            }
            if (callbackResult !== null && callbackResult !== undefined) {
                alteredFunctionResponse = callbackResult;
                break;
            }
        }
    }

    // Step 6: If alternative response exists from after_tool_callback, use it
    if (alteredFunctionResponse !== null && alteredFunctionResponse !== undefined) {
        functionResponse = alteredFunctionResponse;
    }

    if (tool.is_long_running) {
        // Allow long running function to return null to not provide function response
        if (!functionResponse) {
            return null;
        }
    }

    // Build the function response event
    const functionResponseEvent = buildResponseEvent(tool, functionResponse, toolContext, invocationContext);

    traceToolCall(tool, functionArgs, functionResponseEvent);

    return functionResponseEvent;
}

function getToolAndContext(
    invocationContext: InvocationContext,
    functionCall: FunctionCall,
    toolsDict: Record<string, BaseTool>
): { tool: BaseTool; toolContext: ToolContext } {
    if (!functionCall.name || !(functionCall.name in toolsDict)) {
        throw new Error(`Function ${functionCall.name} is not found in the tools_dict.`);
    }

    const toolContext = new ToolContext(invocationContext, {
        functionCallId: functionCall.id
    });

    const tool = toolsDict[functionCall.name];

    return { tool, toolContext };
}

async function callToolAsync(
    tool: BaseTool,
    args: Record<string, any>,
    toolContext: ToolContext
): Promise<any> {
    return await tool.runAsync({ args, tool_context: toolContext });
}

function buildResponseEvent(
    tool: BaseTool,
    functionResult: any,
    toolContext: ToolContext,
    invocationContext: InvocationContext
): Event {
    // Specs require the result to be a dict
    if (typeof functionResult !== 'object' || functionResult === null) {
        functionResult = { result: functionResult };
    }

    const partFunctionResponse: Part = {
        functionResponse: {
            name: tool.name,
            response: functionResult,
            id: toolContext.functionCallId
        }
    };

    const content: Content = {
        role: 'user',
        parts: [partFunctionResponse]
    };

    const functionResponseEvent = new Event({
        invocationId: invocationContext.invocationId,
        author: invocationContext.agent.name,
        content,
        actions: toolContext.actions,
        branch: invocationContext.branch
    });

    return functionResponseEvent;
}

function deepMergeDicts(d1: Record<string, any>, d2: Record<string, any>): Record<string, any> {
    const result = { ...d1 };

    for (const [key, value] of Object.entries(d2)) {
        if (key in result &&
            typeof result[key] === 'object' && result[key] !== null &&
            typeof value === 'object' && value !== null &&
            !Array.isArray(result[key]) && !Array.isArray(value)) {
            result[key] = deepMergeDicts(result[key], value);
        } else {
            result[key] = value;
        }
    }

    return result;
}

export function mergeParallelFunctionResponseEvents(functionResponseEvents: Event[]): Event {
    if (!functionResponseEvents || functionResponseEvents.length === 0) {
        throw new Error('No function response events provided.');
    }

    if (functionResponseEvents.length === 1) {
        return functionResponseEvents[0];
    }

    const mergedParts: Part[] = [];
    for (const event of functionResponseEvents) {
        if (event.content?.parts) {
            mergedParts.push(...event.content.parts);
        }
    }

    // Use the first event as the "base" for common attributes
    const baseEvent = functionResponseEvents[0];

    // Merge actions from all events
    let mergedActionsData: Record<string, any> = {};
    for (const event of functionResponseEvents) {
        if (event.actions) {
            // Convert actions to plain object for merging
            const actionsData = JSON.parse(JSON.stringify(event.actions));
            mergedActionsData = deepMergeDicts(mergedActionsData, actionsData);
        }
    }

    const mergedActions = mergedActionsData ? new EventActions(mergedActionsData) : undefined;

    // Create the new merged event
    const mergedEvent = new Event({
        invocationId: Event.newId(),
        author: baseEvent.author || 'system',
        branch: baseEvent.branch,
        content: {
            role: 'user',
            parts: mergedParts
        },
        actions: mergedActions
    });

    // Use the base_event timestamp
    mergedEvent.timestamp = baseEvent.timestamp;

    return mergedEvent;
}

export function findMatchingFunctionCall(events: Event[]): Event | null {
    if (!events || events.length === 0) {
        return null;
    }

    const lastEvent = events[events.length - 1];

    if (!lastEvent.content?.parts) {
        return null;
    }

    // Check if last event has function responses
    const functionResponsePart = lastEvent.content.parts.find(part => part.functionResponse);
    if (!functionResponsePart?.functionResponse?.id) {
        return null;
    }

    const functionCallId = functionResponsePart.functionResponse.id;

    // Look backwards through events to find matching function call
    for (let i = events.length - 2; i >= 0; i--) {
        const event = events[i];
        const functionCalls = event.getFunctionCalls();

        if (!functionCalls || functionCalls.length === 0) {
            continue;
        }

        for (const functionCall of functionCalls) {
            if (functionCall.id === functionCallId) {
                return event;
            }
        }
    }

    return null;
}