/**
 * Configuration for content generation - equivalent to Google GenAI GenerateContentConfig
 */
export interface GenerateContentConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  safetySettings?: any[];
  systemInstruction?: string;
  tools?: any[];
  responseSchema?: any;
  thinkingConfig?: any;
  // Add other fields as needed
}