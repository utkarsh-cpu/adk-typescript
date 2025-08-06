import { BasePlugin } from "./base-plugin";
import { Content } from "@google/genai";
import { BaseAgent } from "@/agents";
import { CallbackContext } from "@/agents";
import { InvocationContext } from "@/agents";
import { Event } from "@/events"
import { LlmRequest } from "@/models";
import { LlmResponse } from "@/models";
import { BaseTool } from "@/tools";
import { ToolContext } from "@/tools/tool-context";

// Logger for the plugin manager
const logger = {
  info: (message: string, ...args: any[]) => console.info(`[PluginManager] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[PluginManager] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[PluginManager] ${message}`, ...args),
};
export type PluginCallbackName =
  | 'onUserMessageCallback'
  | 'beforeRunCallback'
  | 'afterRunCallback'
  | 'onEventCallback'
  | 'beforeAgentCallback'
  | 'afterAgentCallback'
  | 'beforeToolCallback'
  | 'afterToolCallback'
  | 'beforeModelCallback'
  | 'afterModelCallback'
  | 'onToolErrorCallback'
  | 'onModelErrorCallback';

export class PluginManager {
  private plugins: BasePlugin[] = [];

  /**
   * Initializes the plugin service.
   *
   * @param plugins - An optional list of plugins to register upon initialization.
   */
  constructor(plugins?: BasePlugin[]) {
    if (plugins) {
      for (const plugin of plugins) {
        this.registerPlugin(plugin);
      }
    }
  }

  /**
   * Registers a new plugin.
   *
   * @param plugin - The plugin instance to register.
   * @throws Error if a plugin with the same name is already registered.
   */
  registerPlugin(plugin: BasePlugin): void {
    if (this.plugins.some(p => p.name === plugin.name)) {
      throw new Error(`Plugin with name '${plugin.name}' already registered.`);
    }
    this.plugins.push(plugin);
    logger.info(`Plugin '${plugin.name}' registered.`);
  }

  /**
   * Retrieves a registered plugin by its name.
   *
   * @param pluginName - The name of the plugin to retrieve.
   * @returns The plugin instance if found, otherwise undefined.
   */
  getPlugin(pluginName: string): BasePlugin | undefined {
    return this.plugins.find(p => p.name === pluginName);
  }

  /**
   * Runs the onUserMessageCallback for all plugins.
   */
  async runOnUserMessageCallback(
    userMessage: Content,
    invocationContext: InvocationContext
  ): Promise<Content | undefined> {
    return this.runCallbacks('onUserMessageCallback', {
      userMessage,
      invocationContext,
    });
  }

  /**
   * Runs the beforeRunCallback for all plugins.
   */
  async runBeforeRunCallback(
    invocationContext: InvocationContext
  ): Promise<Content | undefined> {
    return this.runCallbacks('beforeRunCallback', { invocationContext });
  }

  /**
   * Runs the afterRunCallback for all plugins.
   */
  async runAfterRunCallback(
    invocationContext: InvocationContext
  ): Promise<void> {
    return this.runCallbacks('afterRunCallback', { invocationContext });
  }

  /**
   * Runs the onEventCallback for all plugins.
   */
  async runOnEventCallback(
    invocationContext: InvocationContext,
    event: Event
  ): Promise<Event | undefined> {
    return this.runCallbacks('onEventCallback', {
      invocationContext,
      event,
    });
  }

  /**
   * Runs the beforeAgentCallback for all plugins.
   */
  async runBeforeAgentCallback(
    agent: BaseAgent,
    callbackContext: CallbackContext
  ): Promise<Content | undefined> {
    return this.runCallbacks('beforeAgentCallback', {
      agent,
      callbackContext,
    });
  }

  /**
   * Runs the afterAgentCallback for all plugins.
   */
  async runAfterAgentCallback(
    agent: BaseAgent,
    callbackContext: CallbackContext
  ): Promise<Content | undefined> {
    return this.runCallbacks('afterAgentCallback', {
      agent,
      callbackContext,
    });
  }

  /**
   * Runs the beforeToolCallback for all plugins.
   */
  async runBeforeToolCallback(
    tool: BaseTool,
    toolArgs: Record<string, any>,
    toolContext: ToolContext
  ): Promise<Record<string, any> | undefined> {
    return this.runCallbacks('beforeToolCallback', {
      tool,
      toolArgs,
      toolContext,
    });
  }

  /**
   * Runs the afterToolCallback for all plugins.
   */
  async runAfterToolCallback(
    tool: BaseTool,
    toolArgs: Record<string, any>,
    toolContext: ToolContext,
    result: Record<string, any>
  ): Promise<Record<string, any> | undefined> {
    return this.runCallbacks('afterToolCallback', {
      tool,
      toolArgs,
      toolContext,
      result,
    });
  }

  /**
   * Runs the onModelErrorCallback for all plugins.
   */
  async runOnModelErrorCallback(
    callbackContext: CallbackContext,
    llmRequest: LlmRequest,
    error: Error
  ): Promise<LlmResponse | undefined> {
    return this.runCallbacks('onModelErrorCallback', {
      callbackContext,
      llmRequest,
      error,
    });
  }

  /**
   * Runs the beforeModelCallback for all plugins.
   */
  async runBeforeModelCallback(
    callbackContext: CallbackContext,
    llmRequest: LlmRequest
  ): Promise<LlmResponse | undefined> {
    return this.runCallbacks('beforeModelCallback', {
      callbackContext,
      llmRequest,
    });
  }

  /**
   * Runs the afterModelCallback for all plugins.
   */
  async runAfterModelCallback(
    callbackContext: CallbackContext,
    llmResponse: LlmResponse
  ): Promise<LlmResponse | undefined> {
    return this.runCallbacks('afterModelCallback', {
      callbackContext,
      llmResponse,
    });
  }

  /**
   * Runs the onToolErrorCallback for all plugins.
   */
  async runOnToolErrorCallback(
    tool: BaseTool,
    toolArgs: Record<string, any>,
    toolContext: ToolContext,
    error: Error
  ): Promise<Record<string, any> | undefined> {
    return this.runCallbacks('onToolErrorCallback', {
      tool,
      toolArgs,
      toolContext,
      error,
    });
  }

  /**
   * Executes a specific callback for all registered plugins.
   *
   * This private method iterates through the plugins and calls the specified
   * callback method on each one, passing the provided arguments.
   *
   * The execution stops as soon as a plugin's callback returns a non-undefined
   * value. This "early exit" value is then returned by this method. If all
   * plugins are executed and all return undefined, this method also returns undefined.
   *
   * @param callbackName - The name of the callback method to execute.
   * @param args - Arguments to be passed to the callback method.
   * @returns The first non-undefined value returned by a plugin callback, or undefined if
   *   all callbacks return undefined.
   * @throws Error if a plugin encounters an unhandled exception during execution.
   */
  private async runCallbacks(
    callbackName: PluginCallbackName,
    args: Record<string, any>
  ): Promise<any> {
    for (const plugin of this.plugins) {
      // Each plugin might not implement all callbacks. The base class provides
      // default no-op implementations, so accessing the method will always succeed.
      const callbackMethod = (plugin as any)[callbackName] as Function | undefined;

      if (typeof callbackMethod === 'function') {
        try {
          const result = await callbackMethod.call(plugin, args);
          if (result !== undefined && result !== null) {
            // Early exit: A plugin has returned a value. We stop
            // processing further plugins and return this value immediately.
            logger.debug(
              `Plugin '${plugin.name}' returned a value for callback '${callbackName}', exiting early.`
            );
            return result;
          }
        } catch (e) {
          const errorMessage = `Error in plugin '${plugin.name}' during '${callbackName}' callback: ${e instanceof Error ? e.message : String(e)}`;
          logger.error(errorMessage, e);
          throw new Error(errorMessage);
        }
      }
    }

    return undefined;
  }
}


