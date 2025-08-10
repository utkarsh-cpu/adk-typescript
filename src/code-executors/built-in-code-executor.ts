import { BaseCodeExecutor } from './base-code-executor';
import { InvocationContext } from '../agents/invocation-context';
import {
  CodeExecutionInput,
  CodeExecutionResult,
} from './code-execution-utils';
import { LlmRequest } from '../models';
import { isGemini2Model } from '../utils/model-name-utils';
import { GenerateContentConfig, Tool, ToolCodeExecution } from '@google/genai';

/**
 * A code executor that uses the Model's built-in code executor.
 * Currently only supports Gemini 2.0+ models, but will be expanded to
 * other models.
 */
export class BuiltInCodeExecutor extends BaseCodeExecutor {
  override async executeCode(
    _invocationContext: InvocationContext,
    _codeExecutionInput: CodeExecutionInput
  ): Promise<CodeExecutionResult> {
    // TODO: Implement
    throw new Error('Not implemented');
  }

  /**
   * Pre-process the LLM request for Gemini 2.0+ models to use the code execution tool.
   */
  processLlmRequest(llmRequest: LlmRequest): void {
    if (isGemini2Model(llmRequest.model || null)) {
      llmRequest.config = llmRequest.config || ({} as GenerateContentConfig);
      llmRequest.config.tools = llmRequest.config.tools || [];
      llmRequest.config.tools.push({
        codeExecution: {} as ToolCodeExecution,
      } as Tool);
      return;
    }

    throw new Error(
      `Gemini code execution tool is not supported for model ${llmRequest.model}`
    );
  }
}
