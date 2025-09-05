import { LlmResponse } from '@/models';
import {
  GenerateContentResponseUsageMetadata,
  GenerateContentResponse,
  Part,
  FinishReason,
} from '@google/genai';

export class StreamingResponseAggregator {
  _text: string;
  _thoughtText: string;
  _usageMetadata: GenerateContentResponseUsageMetadata | undefined;
  _response: GenerateContentResponse | undefined;

  constructor() {
    this._text = '';
    this._thoughtText = '';
    this._usageMetadata = undefined;
    this._response = undefined;
  }

  async *processResponse(
    response: GenerateContentResponse
  ): AsyncGenerator<LlmResponse, void> {
    this._response = response;
    const llmresponse = LlmResponse.create(response);
    this._usageMetadata = llmresponse.usageMetadata;
    if (
      llmresponse.content &&
      llmresponse.content.parts &&
      llmresponse.content.parts[0].text
    ) {
      const part0 = llmresponse.content.parts[0];
      if (part0.thought) {
        if (part0.text) {
          this._thoughtText.concat(part0.text);
        }
      } else {
        if (part0.text) {
          this._text.concat(part0.text);
        }
      }
      llmresponse.partial = true;
    } else if (
      (this._thoughtText || this._text) &&
      (!llmresponse.content ||
        !llmresponse.content.parts ||
        !llmresponse.content.parts[0].inlineData)
    ) {
      const parts: Part[] = [];
      if (this._thoughtText) {
        parts.push({
          text: this._thoughtText,
          thought: true,
        });
      }
      if (this._text) {
        parts.push({
          text: this._text,
        });
      }
      yield new LlmResponse({
        content: {
          parts,
        },
        usageMetadata: llmresponse.usageMetadata,
      });
      this._thoughtText = '';
      this._text = '';
    }
    yield llmresponse;
  }
  close(): LlmResponse | undefined {
    if (
      (this._text || this._thoughtText) &&
      this._response &&
      this._response.candidates
    ) {
      const parts: Part[] = [];
      if (this._thoughtText) {
        parts.push({
          text: this._thoughtText,
          thought: true,
        });
      }
      if (this._text) {
        parts.push({
          text: this._text,
        });
      }
      const responseCandidate = this._response.candidates[0];
      return new LlmResponse({
        content: {
          parts,
        },
        errorCode:
          responseCandidate.finishReason === FinishReason.STOP
            ? undefined
            : responseCandidate.finishReason,
        errorMessage:
          responseCandidate.finishReason === FinishReason.STOP
            ? undefined
            : responseCandidate.finishMessage,
        usageMetadata: this._usageMetadata,
      });
    }
  }
}
