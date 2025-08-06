/**
 * Auto Flow implementation
 * Ported from Python ADK AutoFlow class
 */

import { SingleFlow } from './single-flow';
import { InvocationContext } from '../../agents/invocation-context';
import { Event } from '../../events/event';

/**
 * AutoFlow is SingleFlow with agent transfer capability.
 * 
 * Agent transfer is allowed in the following directions:
 * 1. from parent to sub-agent
 * 2. from sub-agent to parent
 * 3. from sub-agent to its peer agents
 */
export class AutoFlow extends SingleFlow {
  /**
   * Runs the flow using async text-based conversation.
   */
  public async *runAsync(invocationContext: InvocationContext): AsyncGenerator<Event> {
    // TODO: Implement full auto flow logic with agent transfer
    // For now, delegate to parent SingleFlow implementation
    yield* super.runAsync(invocationContext);
  }

  /**
   * Runs the flow using live video/audio-based conversation.
   */
  public async *runLive(invocationContext: InvocationContext): AsyncGenerator<Event> {
    // TODO: Implement full auto flow live logic with agent transfer
    // For now, delegate to parent SingleFlow implementation
    yield* super.runLive(invocationContext);
  }
}