/**
 * Base LLM Flow implementation
 * Ported from Python ADK BaseLlmFlow class
 */

import { InvocationContext } from '../../agents/invocation-context';
import { Event } from '../../events/event';

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