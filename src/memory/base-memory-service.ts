/**
 * Base memory service interface
 * Ported from Python ADK BaseMemoryService
 */

import { Session } from '../sessions/session';
import { Content } from '@google/genai';

/**
 * Represents a memory entry
 */
export class MemoryEntry {
  // TODO: Define proper MemoryEntry interface
  content: Content;
  /**The main content of the memory.*/
  author: string | null = null;
  /**The author of the memory.*/

  timestamp: string | null = null;
  
  constructor(content: Content, author?: string, timestamp?: string) {
    this.content = content;
    if (author) {
      this.author = author;
    }
    if (timestamp) {
      this.timestamp = timestamp;
    }
}
}

/**
 * Represents the response from a memory search
 */
export interface SearchMemoryResponse {
  /** A list of memory entries that relate to the search query */
  memories: MemoryEntry[];
}

/**
 * Search memory request parameters
 */
export interface SearchMemoryRequest {
  appName: string;
  userId: string;
  query: string;
}

/**
 * Base class for memory services.
 * The service provides functionalities to ingest sessions into memory so that
 * the memory can be used for user queries.
 */
export abstract class BaseMemoryService {
  /**
   * Adds a session to the memory service.
   * A session may be added multiple times during its lifetime.
   */
  public abstract addSessionToMemory(session: Session): Promise<void>;

  /**
   * Searches for sessions that match the query.
   */
  public abstract searchMemory(request: SearchMemoryRequest): Promise<SearchMemoryResponse>;
}
