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
// You may need to adjust paths or define these types/interfaces based on your project structure.
// For example, these could come from a package like '@google/genai' or similar.

import { Content } from '@google/genai';  // Placeholder for types.Content
import { BaseAgent } from '@/agents';
import { CallbackContext } from '@/agents';
import { Event } from '../events/event';
import { LlmRequest } from '@/models';
import { LlmResponse } from '@/models';
import { BaseTool } from '@/tools';

// If TYPE_CHECKING equivalent is needed, TypeScript handles types statically, so no direct equivalent.

// Conditional imports aren't directly supported; use regular imports.

// Placeholder interfaces (define these based on actual types)
interface InvocationContext {
  // Define properties as needed, e.g., session, rootAgent, etc.
}

interface ToolContext {
  // Define properties as needed
}

// Type alias: The value may or may not be awaitable, and value is optional.
type T = any;  // Broad type; refine as needed for awaitable/optional

/**
 * Base class for creating plugins.
 *
 * Plugins provide a structured way to intercept and modify agent, tool, and
 * LLM behaviors at critical execution points in a callback manner. While agent
 * callbacks apply to a particular agent, plugins apply globally to all
 * agents added in the runner. Plugins are best used for adding custom behaviors
 * like logging, monitoring, caching, or modifying requests and responses at key
 * stages.
 *
 * A plugin can implement one or more methods of callbacks, but should not
 * implement the same method of callback multiple times.
 *
 * Relation with [Agent callbacks](https://google.github.io/adk-docs/callbacks/):
 *
 * **Execution Order**
 * Similar to Agent callbacks, Plugins are executed in the order they are
 * registered. However, Plugin and Agent Callbacks are executed sequentially,
 * with Plugins taking precedence over agent callbacks. When the callback in a
 * plugin returns a value, it will short circuit all remaining plugins and
 * agent callbacks, causing all remaining plugins and agent callbacks
 * to be skipped.
 *
 * **Change Propagation**
 * Plugins and agent callbacks can both modify the value of the input parameters,
 * including agent input, tool input, and LLM request/response, etc. They work in
 * exactly the same way. The modifications will be visible and passed to the next
 * callback in the chain. For example, if a plugin modifies the tool input with
 * before_tool_callback, the modified tool input will be passed to the
 * before_tool_callback of the next plugin, and further passed to the agent
 * callbacks if not short circuited.
 *
 * To use a plugin, implement the desired callback methods and pass an instance
 * of your custom plugin class to the ADK Runner.
 *
 * Examples:
 *     A simple plugin that logs every tool call.
 *
 *     class ToolLoggerPlugin extends BasePlugin {
 *       constructor() {
 *         super("tool_logger");
 *       }
 *
 *       async before_tool_callback(
 *         { tool, tool_args, tool_context }: { tool: BaseTool; tool_args: { [key: string]: any }; tool_context: ToolContext }
 *       ) {
 *         console.log(`[${this.name}] Calling tool '${tool.name}' with args: ${JSON.stringify(tool_args)}`);
 *       }
 *
 *       async after_tool_callback(
 *         { tool, tool_args, tool_context, result }: { tool: BaseTool; tool_args: { [key: string]: any }; tool_context: ToolContext; result: { [key: string]: any } }
 *       ) {
 *         console.log(`[${this.name}] Tool '${tool.name}' finished with result: ${JSON.stringify(result)}`);
 *       }
 *     }
 *
 *     // Add the plugin to ADK Runner
 *     // const runner = new Runner({
 *     //   ...
 *     //   plugins: [new ToolLoggerPlugin(), new AgentPolicyPlugin()],
 *     // });
 */
export abstract class BasePlugin {
  public name: string;

  /**
   * Initializes the plugin.
   *
   * @param name A unique identifier for this plugin instance.
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Callback executed when a user message is received before an invocation starts.
   *
   * This callback helps logging and modifying the user message before the
   * runner starts the invocation.
   *
   * @param param0 Object containing invocation_context and user_message.
   * @returns An optional Content to be returned to the ADK. Returning a
   * value to replace the user message. Returning null/undefined to proceed
   * normally.
   */
  async on_user_message_callback({
    invocation_context,
    user_message,
  }: {
    invocation_context: InvocationContext;
    user_message: Content;
  }): Promise<Content | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed before the ADK runner runs.
   *
   * This is the first callback to be called in the lifecycle, ideal for global
   * setup or initialization tasks.
   *
   * @param param0 Object containing invocation_context.
   * @returns An optional Event to be returned to the ADK. Returning a value to
   * halt execution of the runner and ends the runner with that event. Return
   * null/undefined to proceed normally.
   */
  async before_run_callback({
    invocation_context,
  }: {
    invocation_context: InvocationContext;
  }): Promise<Event | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed after an event is yielded from runner.
   *
   * This is the ideal place to make modification to the event before the event
   * is handled by the underlying agent app.
   *
   * @param param0 Object containing invocation_context and event.
   * @returns An optional value. A non-null/undefined return may be used by the framework to
   * modify or replace the response. Returning null/undefined allows the original
   * response to be used.
   */
  async on_event_callback({
    invocation_context,
    event,
  }: {
    invocation_context: InvocationContext;
    event: Event;
  }): Promise<Event | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed after an ADK runner run has completed.
   *
   * This is the final callback in the ADK lifecycle, suitable for cleanup, final
   * logging, or reporting tasks.
   *
   * @param param0 Object containing invocation_context.
   * @returns None (void or undefined)
   */
  async after_run_callback({
    invocation_context,
  }: {
    invocation_context: InvocationContext;
  }): Promise<void> {
    // pass (override in subclass if needed)
  }

  /**
   * Callback executed before an agent's primary logic is invoked.
   *
   * This callback can be used for logging, setup, or to short-circuit the
   * agent's execution by returning a value.
   *
   * @param param0 Object containing agent and callback_context.
   * @returns An optional Content object. If a value is returned, it will bypass
   * the agent's callbacks and its execution, and return this value directly.
   * Returning null/undefined allows the agent to proceed normally.
   */
  async before_agent_callback({
    agent,
    callback_context,
  }: {
    agent: BaseAgent;
    callback_context: CallbackContext;
  }): Promise<Content | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed after an agent's primary logic has completed.
   *
   * This callback can be used to inspect, log, or modify the agent's final
   * result before it is returned.
   *
   * @param param0 Object containing agent and callback_context.
   * @returns An optional Content object. If a value is returned, it will
   * replace the agent's original result. Returning null/undefined uses the original,
   * unmodified result.
   */
  async after_agent_callback({
    agent,
    callback_context,
  }: {
    agent: BaseAgent;
    callback_context: CallbackContext;
  }): Promise<Content | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed before a request is sent to the model.
   *
   * This provides an opportunity to inspect, log, or modify the LlmRequest
   * object. It can also be used to implement caching by returning a cached
   * LlmResponse, which would skip the actual model call.
   *
   * @param param0 Object containing callback_context and llm_request.
   * @returns An optional value. A non-null/undefined return triggers an early
   * exit and returns the response immediately. Returning null/undefined allows the LLM
   * request to proceed normally.
   */
  async before_model_callback({
    callback_context,
    llm_request,
  }: {
    callback_context: CallbackContext;
    llm_request: LlmRequest;
  }): Promise<LlmResponse | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed after a response is received from the model.
   *
   * This is the ideal place to log model responses, collect metrics on token
   * usage, or perform post-processing on the raw LlmResponse.
   *
   * @param param0 Object containing callback_context and llm_response.
   * @returns An optional value. A non-null/undefined return may be used by the framework to
   * modify or replace the response. Returning null/undefined allows the original
   * response to be used.
   */
  async after_model_callback({
    callback_context,
    llm_response,
  }: {
    callback_context: CallbackContext;
    llm_response: LlmResponse;
  }): Promise<LlmResponse | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed when a model call encounters an error.
   *
   * This callback provides an opportunity to handle model errors gracefully,
   * potentially providing alternative responses or recovery mechanisms.
   *
   * @param param0 Object containing callback_context, llm_request, and error.
   * @returns An optional LlmResponse. If an LlmResponse is returned, it will be used
   * instead of propagating the error. Returning null/undefined allows the original
   * error to be raised.
   */
  async on_model_error_callback({
    callback_context,
    llm_request,
    error,
  }: {
    callback_context: CallbackContext;
    llm_request: LlmRequest;
    error: Error;  // Use Error instead of Exception
  }): Promise<LlmResponse | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed before a tool is called.
   *
   * This callback is useful for logging tool usage, input validation, or
   * modifying the arguments before they are passed to the tool.
   *
   * @param param0 Object containing tool, tool_args, and tool_context.
   * @returns An optional dictionary (object). If an object is returned, it will stop the tool
   * execution and return this response immediately. Returning null/undefined uses the
   * original, unmodified arguments.
   */
  async before_tool_callback({
    tool,
    tool_args,
    tool_context,
  }: {
    tool: BaseTool;
    tool_args: { [key: string]: any };
    tool_context: ToolContext;
  }): Promise<{ [key: string]: any } | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed after a tool has been called.
   *
   * This callback allows for inspecting, logging, or modifying the result
   * returned by a tool.
   *
   * @param param0 Object containing tool, tool_args, tool_context, and result.
   * @returns An optional dictionary (object). If an object is returned, it will **replace**
   * the original result from the tool. This allows for post-processing or
   * altering tool outputs. Returning null/undefined uses the original, unmodified
   * result.
   */
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
    // pass (override in subclass if needed)
    return undefined;
  }

  /**
   * Callback executed when a tool call encounters an error.
   *
   * This callback provides an opportunity to handle tool errors gracefully,
   * potentially providing alternative responses or recovery mechanisms.
   *
   * @param param0 Object containing tool, tool_args, tool_context, and error.
   * @returns An optional dictionary (object). If an object is returned, it will be used as
   * the tool response instead of propagating the error. Returning null/undefined
   * allows the original error to be raised.
   */
  async on_tool_error_callback({
    tool,
    tool_args,
    tool_context,
    error,
  }: {
    tool: BaseTool;
    tool_args: { [key: string]: any };
    tool_context: ToolContext;
    error: Error;  // Use Error instead of Exception
  }): Promise<{ [key: string]: any } | null | undefined> {
    // pass (override in subclass if needed)
    return undefined;
  }
}
