import { GenerateContentConfig, Modality } from "@google/genai";
import { InvocationContext } from "@/agents";
import { Event } from "@/events";
import { LlmRequest } from "@/models";
import { BaseLlmRequestProcessor } from "./_base-llm-processor";

class BasicLlmRequestProcessor extends BaseLlmRequestProcessor {
    async *runAsync(invocationContext: InvocationContext, llmRequest: LlmRequest): AsyncGenerator<Event, null, unknown> {
        const { LlmAgent } = await import("@/agents/llm-agent");
        const agent = invocationContext.agent;

        if (!(agent instanceof LlmAgent)) {
            return null;
        }

        // Set the model
        llmRequest.model = typeof agent.canonicalModel === 'string'
            ? agent.canonicalModel
            : agent.canonicalModel?.model || null;

        // Set the config with deep copy
        llmRequest.config = agent.generateContentConfig
            ? JSON.parse(JSON.stringify(agent.generateContentConfig)) // Deep copy
            : {} as GenerateContentConfig;

        // Set output schema if available
        if (agent.outputSchema) {
            llmRequest.setOutputSchema(agent.outputSchema);
        }

        // Set live connect config properties from run config
        if (invocationContext.runConfig) {
            const runConfig = invocationContext.runConfig;

            if (!llmRequest.liveConnectConfig) {
                llmRequest.liveConnectConfig = {};
            }

            llmRequest.liveConnectConfig.responseModalities = runConfig.responseModalities as Modality[];
            llmRequest.liveConnectConfig.speechConfig = runConfig.speechConfig;
            llmRequest.liveConnectConfig.outputAudioTranscription = runConfig.outputAudioTranscription;
            llmRequest.liveConnectConfig.inputAudioTranscription = runConfig.inputAudioTranscription;
            llmRequest.liveConnectConfig.realtimeInputConfig = runConfig.realtimeInputConfig;
            llmRequest.liveConnectConfig.enableAffectiveDialog = runConfig.enableAffectiveDialog;
            llmRequest.liveConnectConfig.proactivity = runConfig.proactivity;
            llmRequest.liveConnectConfig.sessionResumption = runConfig.sessionResumption;
        }

        // TODO: handle tool append here, instead of in BaseTool.processLlmRequest.

        return null;
    }
}

export const requestProcessor = new BasicLlmRequestProcessor();