import { ReadonlyContext } from "@/agents/read-only-context";
import { CallbackContext } from "@/agents";
import { LlmRequest } from "@/models";
import { Part, ThinkingConfig, GenerateContentConfig } from "@google/genai";
import { BasePlanner } from "./base-planner";

export class BuiltInPlanner extends BasePlanner {
    thinkingConfig: ThinkingConfig;
    
    constructor(thinkingConfig: ThinkingConfig) {
        super();
        this.thinkingConfig = thinkingConfig;
    }

    /**
     * Applies the thinking config to the LLM request.
     * 
     * @param llmRequest The LLM request to apply the thinking config to.
     */
    applyThinkingConfig(llmRequest: LlmRequest): void {
        if (this.thinkingConfig) {
            llmRequest.config = llmRequest.config || ({} as GenerateContentConfig);
            llmRequest.config.thinkingConfig = this.thinkingConfig;
        }
    }

    buildPlanningInstruction(
        readonlyContext: ReadonlyContext,
        llmRequest: LlmRequest
    ): string | null {
        return null;
    }

    processPlanningResponse(
        callbackContext: CallbackContext,
        responseParts: Part[]
    ): Part[] | null {
        return null;
    }
}