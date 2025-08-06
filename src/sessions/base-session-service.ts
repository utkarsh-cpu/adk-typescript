import { Event } from '../events/event';
import { Session } from './session';
import { State } from './state';

/**
 * The configuration of getting a session.
 */
export interface GetSessionConfig {
  numRecentEvents?: number | null;
  afterTimestamp?: number | null;
}

/**
 * The response of listing sessions.
 * The events and states are not set within each Session object.
 */
export interface ListSessionsResponse {
  sessions: Session[];
}

/**
 * Base class for session services.
 * The service provides a set of methods for managing sessions and events.
 */
export abstract class BaseSessionService {
  /**
   * Creates a new session.
   * 
   * @param params - The parameters for creating a session
   * @param params.appName - the name of the app
   * @param params.userId - the id of the user
   * @param params.state - the initial state of the session
   * @param params.sessionId - the client-provided id of the session. If not provided, a generated ID will be used
   * @returns session - The newly created session instance
   */
  abstract createSession(params: {
    appName: string;
    userId: string;
    state?: Record<string, any> | null;
    sessionId?: string | null;
  }): Promise<Session>;

  /**
   * Gets a session.
   */
  abstract getSession(params: {
    appName: string;
    userId: string;
    sessionId: string;
    config?: GetSessionConfig | null;
  }): Promise<Session | null>;

  /**
   * Lists all the sessions.
   */
  abstract listSessions(params: {
    appName: string;
    userId: string;
  }): Promise<ListSessionsResponse>;

  /**
   * Deletes a session.
   */
  abstract deleteSession(params: {
    appName: string;
    userId: string;
    sessionId: string;
  }): Promise<void>;

  /**
   * Appends an event to a session object.
   */
  async appendEvent(session: Session, event: Event): Promise<Event> {
    if (event.partial) {
      return event;
    }
    this.updateSessionState(session, event);
    session.events.push(event);
    return event;
  }

  /**
   * Updates the session state based on the event.
   */
  private updateSessionState(session: Session, event: Event): void {
    if (!event.actions || !event.actions.stateDelta) {
      return;
    }
    
    for (const [key, value] of Object.entries(event.actions.stateDelta)) {
      if (key.startsWith(State.TEMP_PREFIX)) {
        continue;
      }
      session.state[key] = value;
    }
  }
}
