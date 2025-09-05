/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Assuming the following imports are available in your TypeScript environment.
// Adjust paths or define these types/interfaces based on your project structure.

import { Content, Part } from '@google/genai'; // Placeholder for types.Content
import { BaseAgent } from '@/agents';
import { CallbackContext } from '@/agents';
import { InvocationContext } from '@/agents';
import { Event } from '@/events/event';
import { LlmRequest } from '@/models';
import { LlmResponse } from '@/models';
import { BaseTool } from '@/tools';
import { ToolContext } from '@/tools';
import { BasePlugin } from './base-plugin'; // Assuming from previous conversion

// Placeholder for Part type (based on assumed structure of Content.parts)

/**
 * A plugin that logs important information at each callback point.
 *
 * This plugin helps printing all critical events in the console. It is not a
 * replacement of existing logging in ADK. It rather helps terminal based
 * debugging by showing all logs in the console, and serves as a simple demo for
 * everyone to leverage when developing new plugins.
 *
 * This plugin helps users track the invocation status by logging:
 * - User messages and invocation context
 * - Agent execution flow
 * - LLM requests and responses
 * - Tool calls with arguments and results
 * - Events and final responses
 * - Errors during model and tool execution
 *
 * Example:
 *     const logging_plugin = new LoggingPlugin();
 *     const runner = new Runner({
 *       agents: [my_agent],
 *       // ...
 *       plugins: [logging_plugin],
 *     });
 */
export class LoggingPlugin extends BasePlugin {
  /**
   * Initialize the logging plugin.
   *
   * @param name The name of the plugin instance.
   */
  constructor(name: string = 'logging_plugin') {
    super(name);
  }

  private _log(message: string): void {
    // ANSI color codes: \x1b[90m for grey, \x1b[0m to reset
    const formatted_message: string = `\x1b[90m[${this.name}] ${message}\x1b[0m`;
    console.log(formatted_message);
  }

  private _format_content(
    content: Content | null | undefined,
    max_length: number = 200
  ): string {
    if (!content || !content.parts) {
      return 'None';
    }

    const parts: string[] = [];
    for (const part of content.parts as Part[]) {
      if (part.text) {
        let text = part.text.trim();
        if (text.length > max_length) {
          text = `${text.substring(0, max_length)}...`;
        }
        parts.push(`text: '${text}'`);
      } else if (part.functionCall) {
        parts.push(`function_call: ${part.functionCall.name}`);
      } else if (part.functionResponse) {
        parts.push(`function_response: ${part.functionResponse.name}`);
      } else if (part.codeExecutionResult) {
        parts.push('code_execution_result');
      } else {
        parts.push('other_part');
      }
    }

    return parts.join(' | ');
  }

  private _format_args(
    args: { [key: string]: any },
    max_length: number = 300
  ): string {
    if (!args) {
      return '{}';
    }

    let formatted = JSON.stringify(args);
    if (formatted.length > max_length) {
      formatted = `${formatted.substring(0, max_length)} ...}`;
    }
    return formatted;
  }

  async on_user_message_callback({
    invocation_context,
    user_message,
  }: {
    invocation_context: InvocationContext;
    user_message: Content;
  }): Promise<Content | null | undefined> {
    /** Log user message and invocation start. */
    this._log(`🚀 USER MESSAGE RECEIVED`);
    this._log(`   Invocation ID: ${invocation_context.invocationId}`);
    this._log(`   Session ID: ${invocation_context.session.id}`);
    this._log(`   User ID: ${invocation_context.userId}`);
    this._log(`   App Name: ${invocation_context.appName}`);
    this._log(
      `   Root Agent: ${
        invocation_context.agent && 'name' in invocation_context.agent
          ? invocation_context.agent.name
          : 'Unknown'
      }`
    );
    this._log(`   User Content: ${this._format_content(user_message)}`);
    if (invocation_context.branch) {
      this._log(`   Branch: ${invocation_context.branch}`);
    }
    return undefined;
  }

  async before_run_callback({
    invocation_context,
  }: {
    invocation_context: InvocationContext;
  }): Promise<Event | null | undefined> {
    /** Log invocation start. */
    this._log(`🏃 INVOCATION STARTING`);
    this._log(`   Invocation ID: ${invocation_context.invocationId}`);
    this._log(
      `   Starting Agent: ${
        invocation_context.agent && 'name' in invocation_context.agent
          ? invocation_context.agent.name
          : 'Unknown'
      }`
    );
    return undefined;
  }

  async on_event_callback({
    invocation_context,
    event,
  }: {
    invocation_context: InvocationContext;
    event: Event;
  }): Promise<Event | null | undefined> {
    /** Log events yielded from the runner. */
    this._log(`📢 EVENT YIELDED`);
    this._log(`   Event ID: ${event.id}`);
    this._log(`   Author: ${event.author}`);
    this._log(`   Content: ${this._format_content(event.content)}`);
    this._log(`   Final Response: ${event.isFinalResponse()}`);

    const func_calls = event.getFunctionCalls?.() ?? [];
    if (func_calls.length > 0) {
      const func_call_names = func_calls.map((fc) => fc.name);
      this._log(`   Function Calls: ${func_call_names}`);
    }

    const func_responses = event.getFunctionResponses?.() ?? [];
    if (func_responses.length > 0) {
      const func_response_names = func_responses.map((fr) => fr.name);
      this._log(`   Function Responses: ${func_response_names}`);
    }
    if (event.longRunningToolIds && event.longRunningToolIds.size > 0) {
      this._log(
        `   Long Running Tools: ${Array.from(event.longRunningToolIds)}`
      );
    }

    return undefined;
  }

  async after_run_callback({
    invocation_context,
  }: {
    invocation_context: InvocationContext;
  }): Promise<void> {
    /** Log invocation completion. */
    this._log(`✅ INVOCATION COMPLETED`);
    this._log(`   Invocation ID: ${invocation_context.invocationId}`);
    this._log(
      `   Final Agent: ${
        invocation_context.agent && 'name' in invocation_context.agent
          ? invocation_context.agent.name
          : 'Unknown'
      }`
    );
  }

  async before_agent_callback({
    agent,
    callback_context,
  }: {
    agent: BaseAgent;
    callback_context: CallbackContext;
  }): Promise<Content | null | undefined> {
    /** Log agent execution start. */
    this._log(`🤖 AGENT STARTING`);
    this._log(`   Agent Name: ${callback_context.agentName}`);
    this._log(`   Invocation ID: ${callback_context.invocationId}`);
    if (callback_context._invocationContext?.branch) {
      // Assuming access; adjust if private
      this._log(`   Branch: ${callback_context._invocationContext.branch}`);
    }
    return undefined;
  }

  async after_agent_callback({
    agent,
    callback_context,
  }: {
    agent: BaseAgent;
    callback_context: CallbackContext;
  }): Promise<Content | null | undefined> {
    /** Log agent execution completion. */
    this._log(`🤖 AGENT COMPLETED`);
    this._log(`   Agent Name: ${callback_context.agentName}`);
    this._log(`   Invocation ID: ${callback_context.invocationId}`);
    return undefined;
  }

  async before_model_callback({
    callback_context,
    llm_request,
  }: {
    callback_context: CallbackContext;
    llm_request: LlmRequest;
  }): Promise<LlmResponse | null | undefined> {
    /** Log LLM request before sending to model. */
    this._log(`🧠 LLM REQUEST`);
    this._log(`   Model: ${llm_request.model ?? 'default'}`);
    this._log(`   Agent: ${callback_context.agentName}`);

    // Log system instruction if present
    if (llm_request.config && llm_request.config.systemInstruction) {
      let sys_instruction: string;
      if (typeof llm_request.config.systemInstruction === 'string') {
        sys_instruction = llm_request.config.systemInstruction.substring(
          0,
          200
        );
        if (llm_request.config.systemInstruction.length > 200) {
          sys_instruction += '...';
        }
      } else if (Array.isArray(llm_request.config.systemInstruction)) {
        // Handle PartUnion[] case
        sys_instruction = `[${llm_request.config.systemInstruction.length} parts]`;
      } else if ('parts' in llm_request.config.systemInstruction) {
        // Handle Content object case
        sys_instruction = this._format_content(
          llm_request.config.systemInstruction,
          200
        );
      } else {
        // Handle single Part case
        const part = llm_request.config.systemInstruction as Part;
        if (part.text) {
          sys_instruction = part.text.substring(0, 200);
          if (part.text.length > 200) {
            sys_instruction += '...';
          }
        } else {
          sys_instruction = '[non-text part]';
        }
      }
      this._log(`   System Instruction: '${sys_instruction}'`);
    }

    // Log available tools
    if (llm_request.getToolsDict) {
      const tool_names = Object.keys(llm_request.getToolsDict);
      this._log(`   Available Tools: ${tool_names}`);
    }

    return undefined;
  }

  async after_model_callback({
    callback_context,
    llm_response,
  }: {
    callback_context: CallbackContext;
    llm_response: LlmResponse;
  }): Promise<LlmResponse | null | undefined> {
    /** Log LLM response after receiving from model. */
    this._log(`🧠 LLM RESPONSE`);
    this._log(`   Agent: ${callback_context.agentName}`);

    if (llm_response.errorCode) {
      this._log(`   ❌ ERROR - Code: ${llm_response.errorCode}`);
      this._log(`   Error Message: ${llm_response.errorMessage}`);
    } else {
      this._log(`   Content: ${this._format_content(llm_response.content)}`);
      if (llm_response.partial) {
        this._log(`   Partial: ${llm_response.partial}`);
      }
      if (
        llm_response.turnComplete !== undefined &&
        llm_response.turnComplete !== null
      ) {
        this._log(`   Turn Complete: ${llm_response.turnComplete}`);
      }
    }

    // Log usage metadata if available
    if (llm_response.usageMetadata) {
      this._log(
        `   Token Usage - Input: ${llm_response.usageMetadata.promptTokenCount}, Output: ${llm_response.usageMetadata.candidatesTokenCount}`
      );
    }

    return undefined;
  }

  async on_model_error_callback({
    callback_context,
    llm_request,
    error,
  }: {
    callback_context: CallbackContext;
    llm_request: LlmRequest;
    error: Error;
  }): Promise<LlmResponse | null | undefined> {
    /** Log LLM error. */
    this._log(`🧠 LLM ERROR`);
    this._log(`   Agent: ${callback_context.agentName}`);
    this._log(`   Error: ${error}`);

    return undefined;
  }

  async before_tool_callback({
    tool,
    tool_args,
    tool_context,
  }: {
    tool: BaseTool;
    tool_args: { [key: string]: any };
    tool_context: ToolContext;
  }): Promise<{ [key: string]: any } | null | undefined> {
    /** Log tool execution start. */
    this._log(`🔧 TOOL STARTING`);
    this._log(`   Tool Name: ${tool.name}`);
    this._log(`   Agent: ${tool_context.agentName}`);
    this._log(`   Function Call ID: ${tool_context.functionCallId}`);
    this._log(`   Arguments: ${this._format_args(tool_args)}`);
    return undefined;
  }

  async after_tool_callback({
    tool,
    tool_args,
    tool_context,
    result,
  }: {
    tool: BaseTool;
    tool_args: { [key: string]: any };
    tool_context: ToolContext;
    result: { [key: string]: any };
  }): Promise<{ [key: string]: any } | null | undefined> {
    /** Log tool execution completion. */
    this._log(`🔧 TOOL COMPLETED`);
    this._log(`   Tool Name: ${tool.name}`);
    this._log(`   Agent: ${tool_context.agentName}`);
    this._log(`   Function Call ID: ${tool_context.functionCallId}`);
    this._log(`   Result: ${this._format_args(result)}`);
    return undefined;
  }

  async on_tool_error_callback({
    tool,
    tool_args,
    tool_context,
    error,
  }: {
    tool: BaseTool;
    tool_args: { [key: string]: any };
    tool_context: ToolContext;
    error: Error;
  }): Promise<{ [key: string]: any } | null | undefined> {
    /** Log tool error. */
    this._log(`🔧 TOOL ERROR`);
    this._log(`   Tool Name: ${tool.name}`);
    this._log(`   Agent: ${tool_context.agentName}`);
    this._log(`   Function Call ID: ${tool_context.functionCallId}`);
    this._log(`   Arguments: ${this._format_args(tool_args)}`);
    this._log(`   Error: ${error}`);
    return undefined;
  }
}
