import { LRUCache } from 'typescript-lru-cache';
import { BaseLlm } from './base-llm';

// --- NEW: Define a type for a CONSTRUCTABLE LLM class ---
// This interface describes a class that can be constructed with `new`
// and has the required static `supportedModels` method.
export interface LlmClassType {
  new (config: { model: string }): BaseLlm;
  supportedModels(): string[];
}

// CORRECTED: The registry now stores the more specific LlmClassType.
const _llmRegistryMap: Map<string, LlmClassType> = new Map();

/**
 * Registry for LLMs.
 */
export class LLMRegistry {
  // CORRECTED: The cache also stores the specific LlmClassType.
  private static readonly _resolveCache = new LRUCache<string, LlmClassType>({
    maxSize: 32,
  });

  /**
   * Creates a new LLM instance based on the model name.
   * @param model The model name (e.g., "gemini-1.5-pro-latest").
   * @returns The initialized LLM instance.
   */
  public static newLlm(model: string): BaseLlm {
    const LlmClass = LLMRegistry.resolve(model);
    // This now works without error because LlmClass is known to be constructable.
    return new LlmClass({ model });
  }

  /**
   * Registers a new LLM class with a specific regex pattern.
   * @param modelNameRegex The regex that matches the model name.
   * @param llmClass The class that implements the model.
   */
  // CORRECTED: The parameter type is now LlmClassType.
  private static _register(modelNameRegex: string, llmClass: LlmClassType) {
    if (_llmRegistryMap.has(modelNameRegex)) {
      console.info(
        'Updating LLM class for %s from %s to %s',
        modelNameRegex,
        _llmRegistryMap.get(modelNameRegex)?.name,
        llmClass.name
      );
    }
    _llmRegistryMap.set(modelNameRegex, llmClass);
  }

  /**
   * Registers a new LLM class by reading its supported model patterns.
   * @param llmClass The class that implements the model.
   */
  // CORRECTED: The parameter type is now LlmClassType.
  public static register(llmClass: LlmClassType): void {
    // The call to llmClass.supportedModels() is still valid.
    for (const regex of llmClass.supportedModels()) {
      LLMRegistry._register(regex, llmClass);
    }
  }

  /**
   * Resolves a model name to a BaseLlm subclass. Results are cached.
   * @param model The model name.
   * @returns The BaseLlm subclass (the constructor, not an instance).
   * @throws {Error} If no matching model implementation is found.
   */
  // CORRECTED: The return type is now LlmClassType.
  public static resolve(model: string): LlmClassType {
    const cachedClass = this._resolveCache.get(model);
    if (cachedClass) {
      return cachedClass;
    }

    for (const [regex, llmClass] of _llmRegistryMap.entries()) {
      const pattern = new RegExp(`^${regex}$`);
      if (pattern.test(model)) {
        this._resolveCache.set(model, llmClass);
        return llmClass;
      }
    }

    throw new Error(`Model ${model} not found.`);
  }
}