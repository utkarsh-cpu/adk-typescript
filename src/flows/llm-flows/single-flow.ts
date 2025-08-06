/**
 * Single Flow implementation
 * Ported from Python ADK SingleFlow class
 */

import { BaseLlmFlow } from './base-llm-flow';
import { InvocationContext } from '../../agents/invocation-context';
import { Event } from '../../events/event';

/**
 * SingleFlow is the LLM flow that handles tool calls.
 * A single flow only considers an agent itself and tools.
 * No sub-agents are allowed for single flow.
 */
export class SingleFlow extends BaseLlmFlow {
  /**
   * Runs the flow using async text-based conversation.
   */
  public async *runAsync(invocationContext: InvocationContext): AsyncGenerator<Event> {
    // TODO: Implement full single flow logic
    // This is a placeholder implementation
    yield new Event({
      invocationId: invocationContext.invocationId,
      author: invocationContext.agent.name,
      branch: invocationContext.branch,
    });
  }

  /**
   * Runs the flow using live video/audio-based conversation.
   */
  public async *runLive(invocationContext: InvocationContext): AsyncGenerator<Event> {
    // TODO: Implement full single flow live logic
    // This is a placeholder implementation
    yield new Event({
      invocationId: invocationContext.invocationId,
      author: invocationContext.agent.name,
      branch: invocationContext.branch,
    });
  }
}