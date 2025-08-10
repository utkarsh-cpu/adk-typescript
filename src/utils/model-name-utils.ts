// TODO: Implement
export function extractModelName(modelString: string): string {
    const pathPattern = /^projects\/[^\/]+\/locations\/[^\/]+\/publishers\/[^\/]+\/models\/(.+)$/;
    const match = modelString.match(pathPattern);
    if (match) {
        return match[1];
    }
    // If it's not a path-based model, return as-is (simple model name)
    return modelString;
}

export function isGeminiModel(modelString: string | null): boolean {
    if (!modelString) {
        return false
    }
    const modelName: string = extractModelName(modelString);
    return modelName.match(/^gemini-/) !== null
}
export function isGemini1Model(modelString: string | null): boolean {
    if (!modelString) {
        return false
    }
    const modelName: string = extractModelName(modelString);
    return modelName.match(/^gemini-1\.\d+/) !== null
}
export function isGemini2Model(modelString: string | null): boolean {
    if (!modelString) {
        return false
    }
    const modelName: string = extractModelName(modelString);
    return modelName.match(/^gemini-2\.\d+/) !== null
}
