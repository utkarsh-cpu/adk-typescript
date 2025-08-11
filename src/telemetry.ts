/**
 * Telemetry and tracing utilities for agent operations
 */

import { Content } from '@google/genai';
import { InvocationContext } from './agents/invocation-context';
import { Event } from './events/event';
import { LlmRequest } from './models/llm-request';
import { LlmResponse } from './models/llm-response';
import { BaseTool } from './tools/base-tool';

// OpenTelemetry types (simplified for this implementation)
interface Span {
  setAttribute(key: string, value: string | number): void;
}

// Mock tracer for now - in a real implementation, this would use @opentelemetry/api
export const tracer = {
  getCurrentSpan(): Span {
    return {
      setAttribute(key: string, value: string | number): void {
        // In a real implementation, this would use OpenTelemetry
        console.log(`[Trace] ${key}: ${value}`);
      }
    };
  }
};

/**
 * Convert any object to a JSON-serializable string.
 * @param obj The object to serialize
 * @returns The JSON-serialized object string or '<not serializable>' if the object cannot be serialized
 */
function safeJsonSerialize(obj: any): string {
  try {
    // Try direct JSON serialization first
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'function' || typeof value === 'symbol') {
        return '<not serializable>';
      }
      return value;
    });
  } catch (error) {
    return '<not serializable>';
  }
}

/**
 * Traces tool call execution.
 * @param tool The tool that was called
 * @param args The arguments to the tool call
 * @param functionResponseEvent The event with the function response details
 */
export function traceToolCall(
  tool: BaseTool,
  args: Record<string, any>,
  functionResponseEvent: Event
): void {
  const span = tracer.getCurrentSpan();
  
  span.setAttribute('gen_ai.system', 'gcp.vertex.agent');
  span.setAttribute('gen_ai.operation.name', 'execute_tool');
  span.setAttribute('gen_ai.tool.name', tool.name);
  span.setAttribute('gen_ai.tool.description', tool.description);

  let toolCallId = '<not specified>';
  let toolResponse: any = '<not specified>';

  if (functionResponseEvent.content?.parts && functionResponseEvent.content.parts.length > 0) {
    const functionResponse = functionResponseEvent.content.parts[0].functionResponse;
    if (functionResponse) {
      toolCallId = functionResponse.id || '<not specified>';
      toolResponse = functionResponse.response;
    }
  }

  span.setAttribute('gen_ai.tool.call.id', toolCallId);

  if (typeof toolResponse !== 'object' || toolResponse === null) {
    toolResponse = { result: toolResponse };
  }

  span.setAttribute('gcp.vertex.agent.tool_call_args', safeJsonSerialize(args));
  span.setAttribute('gcp.vertex.agent.event_id', functionResponseEvent.id);
  span.setAttribute('gcp.vertex.agent.tool_response', safeJsonSerialize(toolResponse));

  // Setting empty llm request and response (as UI expects these) while not
  // applicable for tool_response
  span.setAttribute('gcp.vertex.agent.llm_request', '{}');
  span.setAttribute('gcp.vertex.agent.llm_response', '{}');
}

/**
 * Traces merged tool call events.
 * Calling this function is not needed for telemetry purposes. This is provided
 * for preventing /debug/trace requests (typically sent by web UI).
 * @param responseEventId The ID of the response event
 * @param functionResponseEvent The merged response event
 */
export function traceMergedToolCalls(
  responseEventId: string,
  functionResponseEvent: Event
): void {
  const span = tracer.getCurrentSpan();
  
  span.setAttribute('gen_ai.system', 'gcp.vertex.agent');
  span.setAttribute('gen_ai.operation.name', 'execute_tool');
  span.setAttribute('gen_ai.tool.name', '(merged tools)');
  span.setAttribute('gen_ai.tool.description', '(merged tools)');
  span.setAttribute('gen_ai.tool.call.id', responseEventId);
  span.setAttribute('gcp.vertex.agent.tool_call_args', 'N/A');
  span.setAttribute('gcp.vertex.agent.event_id', responseEventId);

  let functionResponseEventJson: string;
  try {
    // In TypeScript, we'll use JSON.stringify instead of model_dumps_json
    functionResponseEventJson = JSON.stringify(functionResponseEvent, null, 2);
  } catch (error) {
    functionResponseEventJson = '<not serializable>';
  }

  span.setAttribute('gcp.vertex.agent.tool_response', functionResponseEventJson);

  // Setting empty llm request and response (as UI expects these) while not
  // applicable for tool_response
  span.setAttribute('gcp.vertex.agent.llm_request', '{}');
  span.setAttribute('gcp.vertex.agent.llm_response', '{}');
}

/**
 * Traces a call to the LLM.
 * This function records details about the LLM request and response as
 * attributes on the current OpenTelemetry span.
 * @param invocationContext The invocation context for the current agent run
 * @param eventId The ID of the event
 * @param llmRequest The LLM request object
 * @param llmResponse The LLM response object
 */
export function traceCallLlm(
  invocationContext: InvocationContext,
  eventId: string,
  llmRequest: LlmRequest,
  llmResponse: LlmResponse
): void {
  const span = tracer.getCurrentSpan();

  // Special standard Open Telemetry GenAI attributes that indicate
  // that this is a span related to a Generative AI system
  span.setAttribute('gen_ai.system', 'gcp.vertex.agent');
  span.setAttribute('gen_ai.request.model', llmRequest.model || '');
  span.setAttribute('gcp.vertex.agent.invocation_id', invocationContext.invocationId);
  span.setAttribute('gcp.vertex.agent.session_id', invocationContext.session.id);
  span.setAttribute('gcp.vertex.agent.event_id', eventId);

  // Consider removing once GenAI SDK provides a way to record this info
  span.setAttribute(
    'gcp.vertex.agent.llm_request',
    safeJsonSerialize(buildLlmRequestForTrace(llmRequest))
  );

  // Consider removing once GenAI SDK provides a way to record this info
  let llmResponseJson: string;
  try {
    llmResponseJson = JSON.stringify(llmResponse, null, 2);
  } catch (error) {
    llmResponseJson = '<not serializable>';
  }
  span.setAttribute('gcp.vertex.agent.llm_response', llmResponseJson);

  if (llmResponse.usageMetadata) {
    span.setAttribute(
      'gen_ai.usage.input_tokens',
      llmResponse.usageMetadata.promptTokenCount || 0
    );
    span.setAttribute(
      'gen_ai.usage.output_tokens',
      llmResponse.usageMetadata.candidatesTokenCount || 0
    );
  }
}

/**
 * Traces the sending of data to the agent.
 * This function records details about the data sent to the agent as
 * attributes on the current OpenTelemetry span.
 * @param invocationContext The invocation context for the current agent run
 * @param eventId The ID of the event
 * @param data A list of content objects
 */
export function traceSendData(
  invocationContext: InvocationContext,
  eventId: string,
  data: Content[]
): void {
  const span = tracer.getCurrentSpan();
  
  span.setAttribute('gcp.vertex.agent.invocation_id', invocationContext.invocationId);
  span.setAttribute('gcp.vertex.agent.event_id', eventId);

  // Once instrumentation is added to the GenAI SDK, consider whether this
  // information still needs to be recorded by the Agent Development Kit
  const serializedData = data.map(content => ({
    role: content.role,
    parts: content.parts
  }));

  span.setAttribute('gcp.vertex.agent.data', safeJsonSerialize(serializedData));
}

/**
 * Builds a dictionary representation of the LLM request for tracing.
 * This function prepares a dictionary representation of the LlmRequest
 * object, suitable for inclusion in a trace. It excludes fields that cannot
 * be serialized (e.g., function pointers) and avoids sending bytes data.
 * @param llmRequest The LlmRequest object
 * @returns A dictionary representation of the LLM request
 */
function buildLlmRequestForTrace(llmRequest: LlmRequest): Record<string, any> {
  // Some fields in LlmRequest are function pointers and cannot be serialized
  const result: Record<string, any> = {
    model: llmRequest.model,
    config: {
      ...llmRequest.config,
      // Exclude response_schema as it might contain function references
      responseSchema: undefined
    },
    contents: []
  };

  // We do not want to send bytes data to the trace
  for (const content of llmRequest.contents) {
    const parts = content.parts?.filter(part => !part.inlineData) || [];
    result.contents.push({
      role: content.role,
      parts: parts
    });
  }

  return result;
}

// Legacy interface for backward compatibility
export interface TelemetryData {
  timestamp: Date;
  event: string;
  data: Record<string, any>;
}

export interface TelemetryService {
  track(event: string, data?: Record<string, any>): void;
  flush(): Promise<void>;
}

export class ConsoleTelemetryService implements TelemetryService {
  track(event: string, data?: Record<string, any>): void {
    console.log(`[Telemetry] ${event}`, data);
  }

  async flush(): Promise<void> {
    // No-op for console telemetry
  }
}