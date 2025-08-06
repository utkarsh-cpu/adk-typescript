import type { Event } from '../events/event';

/**
 * Represents a series of interactions between a user and agents.
 *
 * Attributes:
 *   id: The unique identifier of the session.
 *   appName: The name of the app.
 *   userId: The id of the user.
 *   state: The state of the session.
 *   events: The events of the session, e.g. user input, model response, function
 *     call/response, etc.
 *   lastUpdateTime: The last update time of the session.
 */
export class Session {
  /**
   * The unique identifier of the session.
   */
  id: string;

  /**
   * The name of the app.
   */
  appName: string;

  /**
   * The id of the user.
   */
  userId: string;

  /**
   * The state of the session.
   */
  state: Record<string, any> = {};

  /**
   * The events of the session, e.g. user input, model response, function
   * call/response, etc.
   */
  events: Event[] = [];

  /**
   * The last update time of the session.
   */
  lastUpdateTime: number = 0.0;

  constructor(options: {
    id: string;
    appName: string;
    userId: string;
    state?: Record<string, any>;
    events?: Event[];
    lastUpdateTime?: number;
  }) {
    this.id = options.id;
    this.appName = options.appName;
    this.userId = options.userId;
    this.state = options.state ?? {};
    this.events = options.events ?? [];
    this.lastUpdateTime = options.lastUpdateTime ?? 0.0;
  }
}
