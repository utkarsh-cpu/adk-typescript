/**
 * Event system types
 * Based on Python ADK Event class
 */

import {v4 as uuidv4} from 'uuid';

import { LlmResponse } from '@/models';
import { EventActions } from './event-actions';
import { FunctionCall,FunctionResponse,Part,Content } from '@google/genai';


export class Event extends LlmResponse{
  /**
  * Required. The invocation ID of the event. Should be non-empty
   * before appending to a session.
   */
  invocationId: string = ""; // camelCase variant
  
  /**
   * Required. "user" or the name of the agent, indicating who appended
   * the event to the session.
   */
  author?: string;
  
  /**
   * The actions taken by the agent.
   */
  actions?: EventActions= new EventActions();
  
  /**
   * Set of ids of the long running function calls.
   * Agent client will know from this field about which function call is long running.
   * only valid for function call event
   */
  longRunningToolIds?: Set<string> | null; // camelCase variant
  
  branch?: string;
  id: string = '';
  timestamp: number = Date.now() / 1000;
  constructor(data: Partial<Event> & { author: string }) {
    super();
    
    // Assign provided values
    Object.assign(this, data);
    
    // Initialize defaults if not provided
    if (!this.actions) {
      this.actions = new EventActions();
    }
    
    if (!this.timestamp) {
      this.timestamp = Date.now() / 1000;
    }

    // Post initialization logic
    this.modelPostInit();
  }

  private modelPostInit(): void {
    // Generates a random ID for the event.
    if (!this.id) {
      this.id = Event.newId();
    }
  }

  isFinalResponse(): boolean {
    if (this.actions?.skipSummarization || this.longRunningToolIds) {
      return true;
    }
    return (
      this.getFunctionCalls().length === 0 &&
      this.getFunctionResponses().length === 0 &&
      !this.partial &&
      !this.hasTrailingCodeExecutionResult()
    );
  }
  getFunctionCalls(): FunctionCall[] {
    const funcCalls: FunctionCall[] = [];
    if (this.content && this.content.parts) {
      for (const part of this.content.parts) {
        if (part.functionCall) {
          funcCalls.push(part.functionCall);
        }
      }
    }
    return funcCalls;
  }
  getFunctionResponses(): FunctionResponse[] {
    const funcResponses: FunctionResponse[] = [];
    if (this.content && this.content.parts) {
      for (const part of this.content.parts) {
        if (part.functionResponse) {
          funcResponses.push(part.functionResponse);
        }
      }
    }
    return funcResponses;
  }
  hasTrailingCodeExecutionResult(): boolean {
    if (this.content && this.content.parts && this.content.parts.length > 0) {
      const lastPart = this.content.parts[this.content.parts.length - 1];
      return lastPart.codeExecutionResult != null;
    }
    return false;
  }
  static newId(): string {
    return uuidv4();
  }

}