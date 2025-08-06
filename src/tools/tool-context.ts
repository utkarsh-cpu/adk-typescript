import { CallbackContext } from "@/agents/callback-context";
import { AuthCredential } from "@/auth";
import { AuthHandler } from "@/auth/auth-handler";
import { AuthConfig } from "@/auth/auth-tool";
import { InvocationContext } from "@/agents/invocation-context";
import { EventActions } from "@/events/event-actions";
import {SearchMemoryResponse} from "@/memory/base-memory-service"


export class ToolContext extends CallbackContext {
    /**
     * The function call id of the current tool call. This id was
     * returned in the function call event from LLM to identify a function call.
     * If LLM didn't return this id, ADK will assign one to it. This id is used
     * to map function call response to the original function call.
     */
    public readonly functionCallId?: string;
  
    /**
     * The event actions of the current tool call.
     */
    public readonly eventActions?: EventActions;
  
    constructor(
      invocationContext: InvocationContext,
      options: {
        functionCallId?: string;
        eventActions?: EventActions;
      } = {}
    ) {
      super(invocationContext, options.eventActions);
      this.functionCallId = options.functionCallId;
      this.eventActions = options.eventActions;
    }
  
    /**
     * Gets the event actions for the current tool call.
     */
    get actions(): EventActions {
      if (!this.eventActions) {
        throw new Error('Event actions are not available.');
      }
      return this.eventActions;
    }
  
    /**
     * Requests credentials for authentication.
     * @param authConfig The authentication configuration
     */
    requestCredential(authConfig: AuthConfig): void {
      if (!this.functionCallId) {
        throw new Error('functionCallId is not set.');
      }
  
      if (!this.eventActions) {
        throw new Error('Event actions are not available.');
      }
  
      const authHandler = new AuthHandler(authConfig);
      this.eventActions.requestedAuthConfigs = this.eventActions.requestedAuthConfigs || {};
      this.eventActions.requestedAuthConfigs[this.functionCallId] = 
        authHandler.generateAuthRequest();
    }
  
    /**
     * Retrieves the authentication response.
     * @param authConfig The authentication configuration
     * @returns The authentication credential
     */
    getAuthResponse(authConfig: AuthConfig): AuthCredential {
      const authHandler = new AuthHandler(authConfig);
      return authHandler.getAuthResponse(this._invocationContext.state);
    }
  
    /**
     * Searches the memory of the current user.
     * @param query The search query
     * @returns Promise resolving to search results
     */
    async searchMemory(query: string): Promise<SearchMemoryResponse> {
      const memoryService = this._invocationContext.memoryService;
      
      if (!memoryService) {
        throw new Error('Memory service is not available.');
      }
  
      return await memoryService.searchMemory({
        appName: this._invocationContext.appName,
        userId: this._invocationContext.userId,
        query: query,
      });
    }
  }
  