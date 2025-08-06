const GOOGLE_LLM_VARIANT_VERTEX_AI = 'VERTEX_AI';
const GOOGLE_LLM_VARIANT_GEMINI_API = 'GEMINI_API';

/**
 * The Google LLM variant to use.
 * See https://google.github.io/adk-docs/get-started/quickstart/#set-up-the-model
 */
export enum GoogleLLMVariant {
  /** For using credentials from Google Vertex AI */
  VERTEX_AI = GOOGLE_LLM_VARIANT_VERTEX_AI,
  /** For using API Key from Google AI Studio */
  GEMINI_API = GOOGLE_LLM_VARIANT_GEMINI_API
}

/**
 * Gets the Google LLM variant based on environment configuration.
 * 
 * @returns The Google LLM variant to use - either VERTEX_AI or GEMINI_API
 */
export function getGoogleLlmVariant(): GoogleLLMVariant {
  const envValue = process.env.GOOGLE_GENAI_USE_VERTEXAI || '0';
  const useVertexAI = ['true', '1'].includes(envValue.toLowerCase());
  
  return useVertexAI 
    ? GoogleLLMVariant.VERTEX_AI 
    : GoogleLLMVariant.GEMINI_API;
}
