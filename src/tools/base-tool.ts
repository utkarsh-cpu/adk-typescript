/**
 * Base tool abstract class
 * TODO: Implement in task 5.1
 */
import { FunctionDeclaration, Tool, GenerateContentConfig } from "@google/genai";
import { getGoogleLlmVariant, GoogleLLMVariant } from '@/utils';
import { ToolContext } from './tool-context';
import { LlmRequest } from '../models/llm-request';
type SelfTool<T extends BaseTool> = T;
export abstract class BaseTool {
  name: string;
  description: string;
  is_long_running: boolean = false;

  constructor(name: string, description: string, is_long_running: boolean = false) {
    this.name = name;
    this.description = description;
    this.is_long_running = is_long_running;
  }
  protected _getDeclaration(): FunctionDeclaration | null {
    /**Gets the OpenAPI specification of this tool in the form of a FunctionDeclaration.

    NOTE:
      - Required if subclass uses the default implementation of
        `process_llm_request` to add function declaration to LLM request.
      - Otherwise, can be skipped, e.g. for a built-in GoogleSearch tool for
        Gemini.

    Returns:
      The FunctionDeclaration of this tool, or None if it doesn't need to be
      added to LlmRequest.config.
    */
    return null

  }

  async runAsync(options: { args: Record<string, any>; tool_context: ToolContext }): Promise<any> {
    /**Runs the tool with the given arguments and context.

    NOTE:
      - Required if this tool needs to run at the client side.
      - Otherwise, can be skipped, e.g. for a built-in GoogleSearch tool for
        Gemini.

    Args:
      args: The LLM-filled arguments.
      tool_context: The context of the tool.

    Returns:
      The result of running the tool. */
    throw new Error(`${this.constructor.name} is not implemented`);
  }

  async processLlmRequest(options: { tool_context: ToolContext; llmrequest: LlmRequest }): Promise<void> {
    let function_declaration: FunctionDeclaration | null
    function_declaration = this._getDeclaration()
    if (function_declaration === null) {
      return;
    }
    options.llmrequest.getToolsDict()[this.name] = this
    const toolWithFunctionDeclarations = this.findToolWithFunctionDeclarations(options.llmrequest);
    if (toolWithFunctionDeclarations) {
      if (!toolWithFunctionDeclarations.functionDeclarations) {
        toolWithFunctionDeclarations.functionDeclarations = [];
      }
      toolWithFunctionDeclarations.functionDeclarations.push(function_declaration);
    } else {
      if (!options.llmrequest.config) {
        options.llmrequest.config = {} as GenerateContentConfig;
      }

      if (!options.llmrequest.config.tools) {
        options.llmrequest.config.tools = [];
      }

      options.llmrequest.config.tools.push({
        functionDeclarations: [function_declaration]
      } as Tool);
    }

  }
  get apiVariant(): GoogleLLMVariant {
    return getGoogleLlmVariant();
  }

  static fromConfig<T extends BaseTool>(this: new (...args: any[]) => T, config: ToolArgsConfig, configAbsPath: string): T {
    throw new Error(`fromConfig for ${this.name} not implemented.`);
  }

  findToolWithFunctionDeclarations(llmRequest: LlmRequest): Tool | null {
    if (!llmRequest.config || !llmRequest.config.tools) {
      return null;
    }

    for (const tool of llmRequest.config.tools) {
      if (tool && 'functionDeclarations' in tool && Array.isArray(tool.functionDeclarations)) {
        return tool as Tool;
      }
    }
    return null;
  }
  // TODO: Implement full BaseTool interface
}

export interface ToolArgsConfig {
  // Arbitrary key-value pairs
  [key: string]: any;
}

export interface ToolConfig {
  /** The name of the tool. */
  name: string;

  /** The args for the tool. */
  args?: ToolArgsConfig | null;
}
export interface BaseToolConfig {
  // No extra fields allowed; extend if needed
}