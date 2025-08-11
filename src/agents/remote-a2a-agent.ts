import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

import {
    AgentCard,
    Message as A2AMessage,
    MessageSendParams as A2AMessageSendParams,
    Part as A2APart,
    SendMessageRequest,
    SendMessageSuccessResponse,
    Task as A2ATask
} from "@a2a-js/sdk";

import { AgentCardBuilder } from "../a2a"; // adjust path if needed
import { A2AClient } from "@a2a-js/sdk/dist/client";
import { Content as GenAIContent } from "@google/genai";

export enum Role {
    USER = "user",
    AGENT = "agent",

}
import {
    convertA2aMessageToEvent,
    convertA2aTaskToEvent,
    convertEventToA2aMessage,
} from "../a2a/converters/event-converter";
import { convertGenaiPartToA2aPart } from "../a2a/converters/part-converter";
import { buildA2aRequestLog, buildA2aResponseLog } from "../a2a/logs/log-utils";
import { InvocationContext } from "../agents/invocation-context";
import { Event } from "../events/event";
import { convertForeignEvent, isOtherAgentReply } from "../flows/llm-flows/contents";
import { findMatchingFunctionCall } from "../flows/llm-flows/functions";
import { experimental } from "../utils/feature-decorator";
import { BaseAgent } from "./base-agent";

export const AGENT_CARD_WELL_KNOWN_PATH = "/.well-known/agent.json";
const A2A_METADATA_PREFIX = "a2a:";
const DEFAULT_TIMEOUT = 600_000;

// Simple logger
const logger = {
    info: (...args: any[]) => console.info("[INFO]", ...args),
    debug: (...args: any[]) => console.debug("[DEBUG]", ...args),
    warning: (...args: any[]) => console.warn("[WARNING]", ...args),
    error: (...args: any[]) => console.error("[ERROR]", ...args),
};

@experimental()
export class AgentCardResolutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AgentCardResolutionError";
    }
}

@experimental()
export class A2AClientError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "A2AClientError";
    }
}

@experimental()
export class RemoteA2AAgent extends BaseAgent {
    private agentCard?: AgentCard;
    private agentCardSource?: string;
    private rpcUrl?: string;
    private a2aClient?: A2AClient;
    private timeout: number;
    private isResolved = false;

    /**
     * Initialize RemoteA2aAgent.
     */
    constructor(
        name: string,
        agentCard: AgentCard | string,
        description = "",
        timeout: number = DEFAULT_TIMEOUT,
        ...kwargs: any[]
    ) {
        super({ name, description, ...kwargs });

        if (!agentCard) throw new Error("agentCard cannot be null or undefined");
        this.timeout = timeout;

        // Validate and store agent card reference
        if (typeof agentCard === "string") {
            if (!agentCard.trim()) throw new Error("agentCard string cannot be empty");
            this.agentCardSource = agentCard.trim();
        } else if (typeof agentCard === "object" && agentCard !== null) {
            // Assume it's an AgentCard object if it's an object
            this.agentCard = agentCard as AgentCard;
        } else {
            throw new TypeError(
                `agentCard must be AgentCard object, URL string, or file path string, got ${typeof agentCard}`
            );
        }
    }

    /**
     * Resolves agent card from URL or file using AgentCardBuilder.
     */
    private async resolveAgentCard(): Promise<AgentCard> {
        if (!this.agentCardSource) throw new Error("No agent card source available");

        try {
            const cardBuilder = new AgentCardBuilder({
                agent: undefined as any, // not needed for remote agent, just for builder's interface
                rpcUrl: "",
            });

            if (this.agentCardSource.startsWith("http://") || this.agentCardSource.startsWith("https://")) {
                // Fetch card from remote agent
                const resp = await fetch(this.agentCardSource);
                if (!resp.ok) throw new AgentCardResolutionError(
                    `Failed to fetch agent card from URL ${this.agentCardSource}: ${resp.statusText}`
                );
                const cardJson = await resp.json();
                return cardJson as AgentCard;
            } else {
                // Load card from a file
                const resolvedPath = path.resolve(this.agentCardSource);
                await fs.access(resolvedPath);
                const fileContent = await fs.readFile(resolvedPath, "utf-8");
                const data = JSON.parse(fileContent);
                return data as AgentCard;
            }
        } catch (err: any) {
            throw new AgentCardResolutionError(
                `Failed to resolve AgentCard from source ${this.agentCardSource}: ${err}`
            );
        }
    }

    private async validateAgentCard(agentCard: AgentCard): Promise<void> {
        if (!agentCard.url) {
            throw new AgentCardResolutionError(
                "Agent card must have a valid URL for RPC communication"
            );
        }
        try {
            new URL(agentCard.url);
        } catch (err) {
            throw new AgentCardResolutionError(
                `Invalid RPC URL in agent card: ${agentCard.url}, error: ${err}`
            );
        }
    }

    private async ensureResolved(): Promise<void> {
        if (this.isResolved) return;

        try {
            if (!this.agentCard) this.agentCard = await this.resolveAgentCard();
            await this.validateAgentCard(this.agentCard);

            this.rpcUrl = this.agentCard.url;
            if (!this.description && this.agentCard.description) {
                this.description = this.agentCard.description;
            }

            if (!this.a2aClient) {
                this.a2aClient = new A2AClient(this.rpcUrl);
            }
            this.isResolved = true;
            logger.info("Successfully resolved remote A2A agent:", this.name);
        } catch (error) {
            logger.error("Failed to resolve remote A2A agent", this.name, ":", error);
            throw new AgentCardResolutionError(
                `Failed to initialize remote A2A agent ${this.name}: ${error}`
            );
        }
    }

    private createA2ARequestForUserFunctionResponse(ctx: InvocationContext): SendMessageRequest | null {
        if (
            !ctx.session.events ||
            ctx.session.events[ctx.session.events.length - 1]?.author !== "user"
        ) {
            return null;
        }

        const functionCallEvent = findMatchingFunctionCall(ctx.session.events);
        if (!functionCallEvent) return null;

        const a2aMessage = convertEventToA2aMessage(
            ctx.session.events[ctx.session.events.length - 1],
            ctx,
            Role.USER
        );

        if (!a2aMessage) {
            return null;
        }

        if (functionCallEvent.customMetadata) {
            a2aMessage.taskId = functionCallEvent.customMetadata[A2A_METADATA_PREFIX + "task_id"] || null;
            a2aMessage.contextId = functionCallEvent.customMetadata[A2A_METADATA_PREFIX + "context_id"] || null;
        }

        return {
            id: uuidv4(),
            params: {
                message: a2aMessage,
            },
        } as SendMessageRequest;
    }

    private constructMessagePartsFromSession(
        ctx: InvocationContext
    ): [A2APart[], string | null] {
        const messageParts: A2APart[] = [];
        let contextId: string | null = null;

        for (let i = ctx.session.events.length - 1; i >= 0; i--) {
            let event = ctx.session.events[i];

            if (isOtherAgentReply(this.name, event)) {
                event = convertForeignEvent(event);
            } else if (event.author === this.name) {
                if (event.customMetadata) {
                    contextId = event.customMetadata[A2A_METADATA_PREFIX + "context_id"] || null;
                }
                break;
            }

            if (!event.content || !event.content.parts) continue;

            for (const part of event.content.parts) {
                const convertedPart = convertGenaiPartToA2aPart(part);
                if (convertedPart) {
                    messageParts.push(convertedPart);
                } else {
                    logger.warning("Failed to convert part to A2A format:", part);
                }
            }
        }
        return [messageParts.reverse(), contextId];
    }

    private async handleA2AResponse(a2aResponse: any, ctx: InvocationContext): Promise<Event> {
        try {
            // Check if this is an error response
            if (this.a2aClient!.isErrorResponse(a2aResponse)) {
                logger.error(
                    "A2A request failed with error:",
                    a2aResponse.error?.message,
                    "data:",
                    a2aResponse.error?.data
                );
                return new Event({
                    author: this.name,
                    errorMessage: a2aResponse.error.message,
                    errorCode: String(a2aResponse.error.code),
                    invocationId: ctx.invocationId,
                    branch: ctx.branch,
                });
            }

            // Handle success response
            let event: Event;
            if (a2aResponse.result) {
                if (a2aResponse.result.id && a2aResponse.result.status) {
                    // Assume it's a Task if it has id and status properties
                    event = convertA2aTaskToEvent(a2aResponse.result, this.name, ctx);
                    event.customMetadata = event.customMetadata || {};
                    event.customMetadata[A2A_METADATA_PREFIX + "task_id"] = a2aResponse.result.id;
                } else {
                    // Assume it's a Message
                    event = convertA2aMessageToEvent(a2aResponse.result, this.name, ctx);
                    event.customMetadata = event.customMetadata || {};
                    if (a2aResponse.result.taskId) {
                        event.customMetadata[A2A_METADATA_PREFIX + "task_id"] = a2aResponse.result.taskId;
                    }
                }
                if (a2aResponse.result.contextId) {
                    event.customMetadata[A2A_METADATA_PREFIX + "context_id"] = a2aResponse.result.contextId;
                }
            } else {
                logger.warning("A2A response has no result:", a2aResponse);
                event = new Event({
                    author: this.name,
                    invocationId: ctx.invocationId,
                    branch: ctx.branch,
                });
            }

            return event;
        } catch (error) {
            logger.error("Failed to handle A2A response:", error);
            return new Event({
                author: this.name,
                errorMessage: `Failed to process A2A response: ${error}`,
                invocationId: ctx.invocationId,
                branch: ctx.branch,
            });
        }
    }

    protected async *_runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event, void, unknown> {
        try {
            await this.ensureResolved();
        } catch (error) {
            yield new Event({
                author: this.name,
                errorMessage: `Failed to initialize remote A2A agent: ${error}`,
                invocationId: ctx.invocationId,
                branch: ctx.branch,
            });
            return;
        }

        let a2aRequest = this.createA2ARequestForUserFunctionResponse(ctx);

        if (!a2aRequest) {
            const [messageParts, contextId] = this.constructMessagePartsFromSession(ctx);

            if (messageParts.length === 0) {
                logger.warning("No parts to send to remote A2A agent. Emitting empty event.");
                yield new Event({
                    author: this.name,
                    content: { role: 'model', parts: [] },
                    invocationId: ctx.invocationId,
                    branch: ctx.branch,
                });
                return;
            }

            a2aRequest = {
                id: uuidv4(),
                params: {
                    message: {
                        messageId: uuidv4(),
                        parts: messageParts,
                        role: "user",
                        contextId,
                    },
                },
            } as SendMessageRequest;
        }

        logger.debug(buildA2aRequestLog(a2aRequest));

        try {
            const a2aResponse = await this.a2aClient!.sendMessage(a2aRequest.params);
            logger.debug(buildA2aResponseLog(a2aResponse));

            const event = await this.handleA2AResponse(a2aResponse, ctx);

            event.customMetadata = event.customMetadata || {};
            event.customMetadata[A2A_METADATA_PREFIX + "request"] = JSON.stringify(a2aRequest);
            event.customMetadata[A2A_METADATA_PREFIX + "response"] = JSON.stringify(a2aResponse);

            yield event;
        } catch (error) {
            const errorMessage = `A2A request failed: ${error}`;
            logger.error(errorMessage);

            yield new Event({
                author: this.name,
                errorMessage,
                invocationId: ctx.invocationId,
                branch: ctx.branch,
                customMetadata: {
                    [A2A_METADATA_PREFIX + "request"]: JSON.stringify(a2aRequest),
                    [A2A_METADATA_PREFIX + "error"]: errorMessage,
                },
            });
        }
    }

    protected async *_runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event, void, unknown> {
        throw new Error(`runLiveImpl for ${this.constructor.name} via A2A is not implemented.`);
    }

    async cleanup(): Promise<void> {
        // No http client to cleanup if using fetch
    }
}