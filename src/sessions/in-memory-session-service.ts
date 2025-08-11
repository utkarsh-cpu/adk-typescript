import { BaseSessionService, GetSessionConfig, ListSessionsResponse } from "./base-session-service";
import { Session } from "../sessions/session";
import { State } from "../sessions/state";
import { Event } from "../events/event";
import { v4 as uuidv4 } from 'uuid';

/**
 * An in-memory implementation of the session service.
 * It is not suitable for multi-threaded production environments. Use it for
 * testing and development only.
 */
export class InMemorySessionService extends BaseSessionService {
    private sessions: Record<string, Record<string, Record<string, Session>>>;
    private userState: Record<string, Record<string, Record<string, any>>>;
    private appState: Record<string, Record<string, any>>;

    constructor(
        sessions: Record<string, Record<string, Record<string, Session>>> = {},
        userState: Record<string, Record<string, Record<string, any>>> = {},
        appState: Record<string, Record<string, any>> = {}
    ) {
        super();
        this.sessions = sessions;
        this.userState = userState;
        this.appState = appState;
    }

    private _createSessionImpl(
        appName: string,
        userId: string,
        state?: Record<string, any>,
        sessionId?: string
    ): Session {
        sessionId = sessionId?.trim() || uuidv4();
        const session = new Session({
            appName,
            userId,
            id: sessionId,
            state: state || {},
            lastUpdateTime: Date.now() / 1000
        });

        if (!this.sessions[appName]) {
            this.sessions[appName] = {};
        }
        if (!this.sessions[appName][userId]) {
            this.sessions[appName][userId] = {};
        }
        this.sessions[appName][userId][sessionId] = session;

        const copiedSession = JSON.parse(JSON.stringify(session));
        return this._mergeState(appName, userId, copiedSession);
    }

    async createSession(params: {
        appName: string;
        userId: string;
        state?: Record<string, any> | null;
        sessionId?: string | null;
    }): Promise<Session> {
        return this._createSessionImpl(
            params.appName,
            params.userId,
            params.state || undefined,
            params.sessionId || undefined
        );
    }

    private _getSessionImpl(
        appName: string,
        userId: string,
        sessionId: string,
        config?: GetSessionConfig | null
    ): Session | null {
        if (!this.sessions[appName]) return null;
        if (!this.sessions[appName][userId]) return null;
        if (!this.sessions[appName][userId][sessionId]) return null;

        const session = this.sessions[appName][userId][sessionId];
        const copiedSession = JSON.parse(JSON.stringify(session));

        if (config) {
            if (config.numRecentEvents) {
                copiedSession.events = copiedSession.events.slice(-config.numRecentEvents);
            }
            if (config.afterTimestamp) {
                let i = copiedSession.events.length - 1;
                while (i >= 0) {
                    if (copiedSession.events[i].timestamp < config.afterTimestamp) {
                        break;
                    }
                    i--;
                }
                if (i >= 0) {
                    copiedSession.events = copiedSession.events.slice(i + 1);
                }
            }
        }

        return this._mergeState(appName, userId, copiedSession);
    }

    async getSession(params: {
        appName: string;
        userId: string;
        sessionId: string;
        config?: GetSessionConfig | null;
    }): Promise<Session | null> {
        return this._getSessionImpl(
            params.appName,
            params.userId,
            params.sessionId,
            params.config
        );
    }

    private _mergeState(
        appName: string,
        userId: string,
        copiedSession: Session
    ): Session {
        // Merge app state
        if (this.appState[appName]) {
            for (const key of Object.keys(this.appState[appName])) {
                copiedSession.state[State.APP_PREFIX + key] = this.appState[appName][key];
            }
        }

        if (!this.userState[appName] || !this.userState[appName][userId]) {
            return copiedSession;
        }

        // Merge session state with user state
        for (const key of Object.keys(this.userState[appName][userId])) {
            copiedSession.state[State.USER_PREFIX + key] = this.userState[appName][userId][key];
        }
        return copiedSession;
    }

    private _listSessionsImpl(appName: string, userId: string): ListSessionsResponse {
        const emptyResponse: ListSessionsResponse = { sessions: [] };
        if (!this.sessions[appName]) return emptyResponse;
        if (!this.sessions[appName][userId]) return emptyResponse;

        const sessionsWithoutEvents = Object.values(this.sessions[appName][userId]).map(session => {
            const copiedSession = JSON.parse(JSON.stringify(session));
            copiedSession.events = [];
            return this._mergeState(appName, userId, copiedSession);
        });

        return { sessions: sessionsWithoutEvents };
    }

    async listSessions(params: {
        appName: string;
        userId: string;
    }): Promise<ListSessionsResponse> {
        return this._listSessionsImpl(params.appName, params.userId);
    }

    private _deleteSessionImpl(appName: string, userId: string, sessionId: string): void {
        if (this._getSessionImpl(appName, userId, sessionId) === null) {
            return;
        }
        delete this.sessions[appName][userId][sessionId];
    }

    async deleteSession(params: {
        appName: string;
        userId: string;
        sessionId: string;
    }): Promise<void> {
        this._deleteSessionImpl(params.appName, params.userId, params.sessionId);
    }

    async appendEvent(session: Session, event: Event): Promise<Event> {
        // Update the in-memory session
        await super.appendEvent(session, event);
        session.lastUpdateTime = event.timestamp;

        // Update the storage session
        const { appName, userId, id: sessionId } = session;

        const warning = (message: string) => {
            console.warn(`Failed to append event to session ${sessionId}: ${message}`);
        };

        if (!this.sessions[appName]) {
            warning(`appName ${appName} not in sessions`);
            return event;
        }
        if (!this.sessions[appName][userId]) {
            warning(`userId ${userId} not in sessions[appName]`);
            return event;
        }
        if (!this.sessions[appName][userId][sessionId]) {
            warning(`sessionId ${sessionId} not in sessions[appName][userId]`);
            return event;
        }

        if (event.actions?.stateDelta) {
            for (const [key, value] of Object.entries(event.actions.stateDelta)) {
                if (key.startsWith(State.APP_PREFIX)) {
                    if (!this.appState[appName]) {
                        this.appState[appName] = {};
                    }
                    this.appState[appName][key.slice(State.APP_PREFIX.length)] = value;
                }

                if (key.startsWith(State.USER_PREFIX)) {
                    if (!this.userState[appName]) {
                        this.userState[appName] = {};
                    }
                    if (!this.userState[appName][userId]) {
                        this.userState[appName][userId] = {};
                    }
                    this.userState[appName][userId][key.slice(State.USER_PREFIX.length)] = value;
                }
            }
        }

        const storageSession = this.sessions[appName][userId][sessionId];
        await super.appendEvent(storageSession, event);
        storageSession.lastUpdateTime = event.timestamp;

        return event;
    }
}
