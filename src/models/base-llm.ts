/**
 * Base LLM abstract class
 * Ported from Python ADK BaseLlm class
 */

import { LlmRequest } from './llm-request';
import { LlmResponse } from './llm-response';
import { BaseLlmConnection } from './base-llm-connection';

/**
 * The BaseLLM class.
 */
export abstract class BaseLlm {
  /**
   * The name of the LLM, e.g. gemini-1.5-flash or gemini-1.5-flash-001.
   */
  public abstract model: string;

  /**
   * Returns a list of supported models in regex for LlmRegistry.
   */
  public static supportedModels(): string[] {
    return [];
  }

  /**
   * Generates content from the given request.
   *
   * @param llmRequest - The request to send to the LLM
   * @param stream - Whether to do streaming call
   * @returns A generator of LlmResponse objects
   */
  public abstract generateContentAsync(
    llmRequest: LlmRequest,
    stream?: boolean
  ): AsyncGenerator<LlmResponse>;

  /**
   * Creates a live connection to the LLM.
   *
   * @param llmRequest - The request to send to the LLM
   * @returns The connection to the LLM
   */
  public connect(_llmRequest: LlmRequest): BaseLlmConnection {
    throw new Error(`Live connection is not supported for ${this.model}.`);
  }

  /**
   * Appends a user content, so that model can continue to output.
   */
  protected maybeAppendUserContent(llmRequest: LlmRequest): void {
    // If no content is provided, append a user content to hint model response
    // using system instruction.
    if (!llmRequest.contents || llmRequest.contents.length === 0) {
      llmRequest.contents = [
        {
          role: 'user',
          parts: [
            {
              text: 'Handle the requests as specified in the System Instruction.',
            },
          ],
        },
      ];
      return;
    }

    // Insert a user content to preserve user intent and to avoid empty
    // model response.
    const lastContent = llmRequest.contents[llmRequest.contents.length - 1];
    if (lastContent.role !== 'user') {
      llmRequest.contents.push({
        role: 'user',
        parts: [
          {
            text:
              'Continue processing previous requests as instructed. ' +
              'Exit or provide a summary if no more outputs are needed.',
          },
        ],
      });
    }
  }
}
