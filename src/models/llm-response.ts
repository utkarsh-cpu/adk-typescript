/**
 * LLM response types
 * Based on Python ADK LlmResponse class
 */

import {
  GroundingMetadata,
  GenerateContentResponseUsageMetadata,
  GenerateContentResponse,
  Content,
} from '@google/genai';

export class LlmResponse {
  /** LLM response class that provides the first candidate response from the

  model if available. Otherwise, returns error code and message.

  Attributes:
    content: The content of the response.
    groundingMetadata: The grounding metadata of the response.
    partial: Indicates whether the text content is part of a unfinished text
      stream. Only used for streaming mode and when the content is plain text.
    turnComplete: Indicates whether the response from the model is complete.
      Only used for streaming mode.
    errorCode: Error code if the response is an error. Code varies by model.
    errorMessage: Error message if the response is an error.
    interrupted: Flag indicating that LLM was interrupted when generating the
      content. Usually it's due to user interruption during a bidi streaming.
    custom_metadata: The custom metadata of the LlmResponse.
  """
  **/

  content?: Content;

  groundingMetadata?: GroundingMetadata;

  partial?: boolean;

  turnComplete?: boolean;

  errorCode?: string;

  errorMessage?: string;
  interrupted?: boolean;

  customMetadata?: Record<string, any>;

  usageMetadata?: GenerateContentResponseUsageMetadata;
  constructor(data?: Partial<LlmResponse>) {
    if (data) {
      // Handle alias mapping for backward compatibility
      const mappedData = this.mapAliases(data);
      this.validateNoExtraFields(mappedData);
      Object.assign(this, mappedData);
    }
  }
  private mapAliases(data: any): any {
    const aliasMap: Record<string, string> = {
      grounding_metadata: 'groundingMetadata',
      turn_complete: 'turnComplete',
      error_code: 'errorCode',
      error_message: 'errorMessage',
      custom_metadata: 'customMetadata',
      usage_metadata: 'usageMetadata',
    };

    const mapped: any = {};
    for (const [key, value] of Object.entries(data)) {
      const mappedKey = aliasMap[key] || key;
      mapped[mappedKey] = value;
    }
    return mapped;
  }

  private validateNoExtraFields(data: any): void {
    const allowedFields = [
      'content',
      'groundingMetadata',
      'partial',
      'turnComplete',
      'errorCode',
      'errorMessage',
      'interrupted',
      'customMetadata',
      'usageMetadata',
    ];

    const extraFields = Object.keys(data).filter(
      (key) => !allowedFields.includes(key)
    );
    if (extraFields.length > 0) {
      throw new Error(`Extra fields not allowed: ${extraFields.join(', ')}`);
    }
  }

  static create(generateContentResponse: GenerateContentResponse): LlmResponse {
    const usageMetadata = generateContentResponse.usageMetadata;
    if (
      generateContentResponse.candidates &&
      generateContentResponse.candidates.length > 0
    ) {
      const candidate = generateContentResponse.candidates[0];
      if (candidate.content && candidate.content.parts) {
        return new LlmResponse({
          content: candidate.content,
          groundingMetadata: candidate.groundingMetadata,
          usageMetadata,
        });
      } else {
        return new LlmResponse({
          errorCode: candidate.finishReason,
          errorMessage: candidate.finishMessage,
          usageMetadata,
        });
      }
    } else {
      if (generateContentResponse.promptFeedback) {
        const promptFeedback = generateContentResponse.promptFeedback;
        return new LlmResponse({
          errorCode: promptFeedback.blockReason,
          errorMessage: promptFeedback.blockReasonMessage,
          usageMetadata,
        });
      } else {
        return new LlmResponse({
          errorCode: 'UNKNOWN_ERROR',
          errorMessage: 'Unknown error.',
          usageMetadata,
        });
      }
    }
  }
}
