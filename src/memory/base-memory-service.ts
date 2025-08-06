/**
 * Base memory service interface
 * Ported from Python ADK BaseMemoryService
 */

import { Session } from '../sessions/session';

/**
 * Represents a memory entry
 */
export interface MemoryEntry {
  // TODO: Define proper MemoryEntry interface
  [key: string]: any;
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
