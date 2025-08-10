/**
 * LLM request types
 * Based on Python ADK LlmRequest class
 */

import {
  Content,
  GenerateContentConfig,
  LiveConnectConfig,
} from '@google/genai';
import { BaseTool } from '@/tools/base-tool';

interface LlmRequestConfig {
  model?: string | null;
  contents?: Content[];
  config?: GenerateContentConfig;
  liveConnectConfig?: LiveConnectConfig;
  toolsDict?: Record<string, BaseTool>;
}

/**
 * LLM request class that allows passing in tools, output schema and system
 * instructions to the model.
 */
export class LlmRequest {
  /**
   * The model name.
   */
  model?: string | null;

  /**
   * The contents to send to the model.
   */
  contents: Content[];

  /**
   * Additional config for the generate content request.
   * tools in generate_content_config should not be set.
   */
  config: GenerateContentConfig;

  /**
   * Live connect configuration.
   */
  liveConnectConfig: LiveConnectConfig;

  /**
   * The tools dictionary.
   * Note: This is excluded from serialization (similar to Pydantic's exclude=True)
   */
  private toolsDict: Record<string, BaseTool>;

  constructor(config: LlmRequestConfig = {}) {
    this.model = config.model || null;
    this.contents = config.contents || [];
    this.config = config.config || {};
    this.liveConnectConfig = config.liveConnectConfig || {};
    this.toolsDict = config.toolsDict || {};
  }

  /**
   * Appends instructions to the system instruction.
   *
   * @param instructions - The instructions to append.
   */
  appendInstructions(instructions: string[]): void {
    if (this.config.systemInstruction) {
      this.config.systemInstruction += `\n\n${instructions.join('\n\n')}`;
    } else {
      this.config.systemInstruction = instructions.join('\n\n');
    }
  }

  /**
   * Appends tools to the request.
   *
   * @param tools - The tools to append.
   */
  appendTools(tools: BaseTool[]): void {
    if (!tools || tools.length === 0) {
      return;
    }

    const declarations: any[] = [];

    for (const tool of tools) {
      let declaration: any;

      if (tool instanceof BaseTool) {
        // Assuming BaseTool has a protected _getDeclaration method
        declaration = (tool as any)._getDeclaration();
      } else {
        // Assuming tool has a getDeclaration method
        declaration = (tool as any).getDeclaration();
      }

      if (declaration) {
        declarations.push(declaration);
        this.toolsDict[tool.name] = tool;
      }
    }

    if (declarations.length > 0) {
      // Initialize tools array if it doesn't exist
      if (!this.config.tools) {
        this.config.tools = [];
      }

      this.config.tools.push({
        functionDeclarations: declarations,
      });
    }
  }

  /**
   * Sets the output schema for the request.
   *
   * @param baseModel - The schema/interface to set the output schema to.
   */
  setOutputSchema<T>(baseModel: new () => T): void {
    // In TypeScript, we'll need to handle schema differently
    // This assumes the GenerateContentConfig accepts a schema object
    this.config.responseSchema = baseModel as any;
    this.config.responseMimeType = 'application/json';
  }

  /**
   * Gets the tools dictionary (getter for the private property).
   */
  getToolsDict(): Record<string, BaseTool> {
    return { ...this.toolsDict };
  }

  /**
   * Sets a tool in the tools dictionary.
   */
  setTool(name: string, tool: BaseTool): void {
    this.toolsDict[name] = tool;
  }

  /**
   * Gets a tool from the tools dictionary.
   */
  getTool(name: string): BaseTool | undefined {
    return this.toolsDict[name];
  }
}
