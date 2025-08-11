// TODO: Implement
import {formatTimestamp} from "./_utils"
import {BaseMemoryService, MemoryEntry} from "./base-memory-service";
import {Event} from "../events/event";
import {Session} from "../sessions/session";
import {Content} from "@google/genai";
function _userKey(appName: string, userId: string): string {
    return `${appName}/${userId}`;
}
function _extractWordLower(text:string): Set<string>{
    const matches = text.match(/[A-Za-z]+/g) || [];
    return new Set(matches.map(word => word.toLowerCase()));
}
type SessionEvents = Map<string, Event[]>;

export class InMemoryMemoryService extends BaseMemoryService {
    private _sessionEvents: Map<string, SessionEvents> = new Map();

    override async addSessionToMemory(session: Session): Promise<void> {
        const userKey = _userKey(session.appName, session.userId);
        if (!this._sessionEvents.has(userKey)) {
            this._sessionEvents.set(userKey, new Map());
        }
        const sessionEvents = this._sessionEvents.get(userKey)!;
        sessionEvents.set(
            session.id,
            session.events.filter(
                (event: Event) => event.content && event.content.parts
            )
        );
    }

    override async searchMemory(params:{
        appName: string;
        userId: string;
        query: string;
    }): Promise<{ memories: MemoryEntry[] }> {
        const userKey = _userKey(params.appName, params.userId);
        const sessionEventLists = this._sessionEvents.get(userKey) || new Map();
        const wordsInQuery = _extractWordLower(params.query);
        const memories: MemoryEntry[] = [];

        for (const sessionEvents of sessionEventLists.values()) {
            for (const event of sessionEvents) {
                if (!event.content || !event.content.parts) continue;
                const wordsInEvent = _extractWordLower(
                    event.content.parts
                        .filter((part: any) => part.text)
                        .map((part: any) => part.text)
                        .join(" ")
                );
                if (!wordsInEvent.size) continue;

                if (
                    Array.from(wordsInQuery).some((queryWord) =>
                        wordsInEvent.has(queryWord)
                    )
                ) {
                    memories.push(
                        new MemoryEntry(
                            event.content,
                            event.author,
                            formatTimestamp(event.timestamp)
                        )
                    );
                }
            }
        }
        return { memories };
    }
}
