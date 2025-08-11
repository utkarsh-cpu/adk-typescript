/**
 * Base LLM Flow implementation
 * Ported from Python ADK BaseLlmFlow class
 */

import {InvocationContext,
        BaseAgent,
        CallbackContext,
        LiveRequestQueue,
        ReadonlyContext,
        StreamingMode,
        TranscriptionEntry,
        LlmAgent } from '@/agents';
import { Event } from '../../events/event';
import { BaseLlmConnection, LlmRequest, LlmResponse, BaseLlm } from '@/models';
import { traceCallLlm,traceSendData,tracer } from '@/telemetry';
import { BaseToolset,ToolContext } from '@/tools';
import {BaseLlmRequestProcessor,
        BaseLlmResponseProcessor } from './_base-llm-processor';  


const _ADK_AGENT_NAME_LABEL_KEY : string  = 'adk_agent_name';
/**
 * A basic flow that calls the LLM in a loop until a final response is generated.
 * This flow ends when it transfers to another agent.
 */
export abstract class BaseLlmFlow {
  /**
   * Runs the flow using async text-based conversation.
   */
  public abstract runAsync(invocationContext: InvocationContext): AsyncGenerator<Event>;

  /**
   * Runs the flow using live video/audio-based conversation.
   */
  public abstract runLive(invocationContext: InvocationContext): AsyncGenerator<Event>;
}