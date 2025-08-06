import * as fs from 'fs/promises';
import * as path from 'path';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';

import {
    A2AClient,
    A2ACardResolver,
    AgentCard,
    Message as A2AMessage,
    MessageSendParams as A2AMessageSendParams,
    Part as A2APart,
    Role,
    SendMessageRequest,
    SendMessageSuccessResponse,
    Task as A2ATask,
    AGENT_CARD_WELL_KNOWN_PATH
} from '@a2a-js/sdk';

import { Content as GenAIContent } from '@google/genai';

import {
    convertA2AMessageToEvent,
    convertA2ATaskToEvent,
    convertEventToA2AMessage
} from '../a2a/converters/eventConverter';
import { convertGenAIPartToA2APart } from '../a2a/converters/partConverter';
import { buildA2ARequestLog, buildA2AResponseLog } from '../a2a/logs/logUtils';
import { InvocationContext } from '../agents/invocationContext';
import { Event } from '../events/event';
import { convertForeignEvent, isOtherAgentReply } from '../flows/llmFlows/contents';
import { findMatchingFunctionCall } from '../flows/llmFlows/functions';
import { experimental } from '../utils/featureDecorator';
import { BaseAgent } from './baseAgent';

export {
    A2AClientError,
    AGENT_CARD_WELL_KNOWN_PATH,
    AgentCardResolutionError,
    RemoteA2aAgent,
};

// Constants
const A2A_METADATA_PREFIX = 'a2a:';
const DEFAULT_TIMEOUT = 600000; // 600 seconds in milliseconds

// Logger (using console for now, can be replaced with a proper logging library)
const logger = {
    info: console.info.bind(console, '[INFO]'),
    debug: console.debug.bind(console, '[DEBUG]'),
    warning: console.warn.bind(console, '[WARNING]'),
    error: console.error.bind(console, '[ERROR]'),
};

@experimental
export class AgentCardResolutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AgentCardResolutionError';
    }
}

@experimental
export class A2AClientError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'A2AClientError';
    }
}

@experimental
export class RemoteA2aAgent extends BaseAgent {
    private agentCard?: AgentCard;
    private agentCardSource?: string;
    private rpcUrl?: string;
    private a2aClient?: A2AClient;
    private httpClient?: any; // Replace with appropriate HTTP client type
    private httpClientNeedsCleanup: boolean;
    private timeout: number;
    private isResolved: boolean = false;

    /**
     * Initialize RemoteA2aAgent.
     *
     * @param name - Agent name (must be unique identifier)
     * @param agentCard - AgentCard object, URL string, or file path string
     * @param description - Agent description (auto-populated from card if empty)
     * @param httpClient - Optional shared HTTP client (will create own if not provided)
     * @param timeout - HTTP timeout in milliseconds
     * @param kwargs - Additional arguments passed to BaseAgent
     */
    constructor(
        name: string,
        agentCard: AgentCard | string,
        description: string = '',
        httpClient?: any,
        timeout: number = DEFAULT_TIMEOUT,
        ...kwargs: any[]
    ) {
        super({ name, description, ...kwargs });

        if (!agentCard) {
            throw new Error('agentCard cannot be null or undefined');
        }

        this.httpClient = httpClient;
        this.httpClientNeedsCleanup = !httpClient;
        this.timeout = timeout;

        // Validate and store agent card reference
        if (typeof agentCard === 'object' && agentCard.constructor.name === 'AgentCard') {
            this.agentCard = agentCard;
        } else if (typeof agentCard === 'string') {
            if (!agentCard.trim()) {
                throw new Error('agentCard string cannot be empty');
            }
            this.agentCardSource = agentCard.trim();
        } else {
            throw new TypeError(
                `agentCard must be AgentCard, URL string, or file path string, got ${typeof agentCard}`
            );
        }
    }

    private async ensureHttpClient(): Promise<any> {
        if (!this.httpClient) {
            // Replace with appropriate HTTP client initialization
            // For example, using fetch API or axios
            this.httpClient = {
                timeout: this.timeout,
                // Add other HTTP client configuration
            };
            this.httpClientNeedsCleanup = true;
        }
        return this.httpClient;
    }

    private async resolveAgentCardFromUrl(url: string): Promise<AgentCard> {
        try {
            const parsedUrl = new URL(url);
            if (!parsedUrl.protocol || !parsedUrl.hostname) {
                throw new Error(`Invalid URL format: ${url}`);
            }

            const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}`;
            const relativeCardPath = parsedUrl.pathname;

            const httpClient = await this.ensureHttpClient();
            const resolver = new A2ACardResolver({
                httpClient,
                baseUrl,
            });

            return await resolver.getAgentCard({
                relativeCardPath,
            });
        } catch (error) {
            throw new AgentCardResolutionError(
                `Failed to resolve AgentCard from URL ${url}: ${error}`
            );
        }
    }

    private async resolveAgentCardFromFile(filePath: string): Promise<AgentCard> {
        try {
            const resolvedPath = path.resolve(filePath);

            try {
                await fs.access(resolvedPath);
            } catch {
                throw new Error(`Agent card file not found: ${filePath}`);
            }

            const stats = await fs.stat(resolvedPath);
            if (!stats.isFile()) {
                throw new Error(`Path is not a file: ${filePath}`);
            }

            const fileContent = await fs.readFile(resolvedPath, 'utf-8');
            const agentJsonData = JSON.parse(fileContent);
            return new AgentCard(agentJsonData);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new AgentCardResolutionError(
                    `Invalid JSON in agent card file ${filePath}: ${error}`
                );
            }
            throw new AgentCardResolutionError(
                `Failed to resolve AgentCard from file ${filePath}: ${error}`
            );
        }
    }

    private async resolveAgentCard(): Promise<AgentCard> {
        if (!this.agentCardSource) {
            throw new Error('No agent card source available');
        }

        // Determine if source is URL or file path
        if (this.agentCardSource.startsWith('http://') || this.agentCardSource.startsWith('https://')) {
            return await this.resolveAgentCardFromUrl(this.agentCardSource);
        } else {
            return await this.resolveAgentCardFromFile(this.agentCardSource);
        }
    }

    private async validateAgentCard(agentCard: AgentCard): Promise<void> {
        if (!agentCard.url) {
            throw new AgentCardResolutionError(
                'Agent card must have a valid URL for RPC communication'
            );
        }

        try {
            const parsedUrl = new URL(agentCard.url);
            if (!parsedUrl.protocol || !parsedUrl.hostname) {
                throw new Error('Invalid RPC URL format');
            }
        } catch (error) {
            throw new AgentCardResolutionError(
                `Invalid RPC URL in agent card: ${agentCard.url}, error: ${error}`
            );
        }
    }

    private async ensureResolved(): Promise<void> {
        if (this.isResolved) {
            return;
        }

        try {
            // Resolve agent card if needed
            if (!this.agentCard) {
                this.agentCard = await this.resolveAgentCard();
            }

            // Validate agent card
            await this.validateAgentCard(this.agentCard);

            // Set RPC URL
            this.rpcUrl = this.agentCard.url;

            // Update description if empty
            if (!this.description && this.agentCard.description) {
                this.description = this.agentCard.description;
            }

            // Initialize A2A client
            if (!this.a2aClient) {
                const httpClient = await this.ensureHttpClient();
                this.a2aClient = new A2AClient({
                    httpClient,
                    agentCard: this.agentCard,
                    url: this.rpcUrl,
                });
            }

            this.isResolved = true;
            logger.info('Successfully resolved remote A2A agent:', this.name);
        } catch (error) {
            logger.error('Failed to resolve remote A2A agent', this.name, ':', error);
            throw new AgentCardResolutionError(
                `Failed to initialize remote A2A agent ${this.name}: ${error}`
            );
        }
    }

    private createA2ARequestForUserFunctionResponse(
        ctx: InvocationContext
    ): SendMessageRequest | null {
        if (!ctx.session.events || ctx.session.events[ctx.session.events.length - 1].author !== 'user') {
            return null;
        }

        const functionCallEvent = findMatchingFunctionCall(ctx.session.events);
        if (!functionCallEvent) {
            return null;
        }

        const a2aMessage = convertEventToA2AMessage(
            ctx.session.events[ctx.session.events.length - 1],
            ctx,
            Role.USER
        );

        if (functionCallEvent.customMetadata) {
            a2aMessage.taskId = functionCallEvent.customMetadata[A2A_METADATA_PREFIX + 'task_id'] || null;
            a2aMessage.contextId = functionCallEvent.customMetadata[A2A_METADATA_PREFIX + 'context_id'] || null;
        }

        return new SendMessageRequest({
            id: uuidv4(),
            params: new A2AMessageSendParams({
                message: a2aMessage,
            }),
        });
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
                // Stop on content generated by current a2a agent
                if (event.customMetadata) {
                    contextId = event.customMetadata[A2A_METADATA_PREFIX + 'context_id'] || null;
                }
                break;
            }

            if (!event.content || !event.content.parts) {
                continue;
            }

            for (const part of event.content.parts) {
                const convertedPart = convertGenAIPartToA2APart(part);
                if (convertedPart) {
                    messageParts.push(convertedPart);
                } else {
                    logger.warning('Failed to convert part to A2A format:', part);
                }
            }
        }

        return [messageParts.reverse(), contextId];
    }

    private async handleA2AResponse(a2aResponse: any, ctx: InvocationContext): Promise<Event> {
        try {
            if (a2aResponse.root instanceof SendMessageSuccessResponse) {
                let event: Event;

                if (a2aResponse.root.result) {
                    if (a2aResponse.root.result instanceof A2ATask) {
                        event = convertA2ATaskToEvent(a2aResponse.root.result, this.name, ctx);
                        event.customMetadata = event.customMetadata || {};
                        event.customMetadata[A2A_METADATA_PREFIX + 'task_id'] = a2aResponse.root.result.id;
                    } else {
                        event = convertA2AMessageToEvent(a2aResponse.root.result, this.name, ctx);
                        event.customMetadata = event.customMetadata || {};
                        if (a2aResponse.root.result.taskId) {
                            event.customMetadata[A2A_METADATA_PREFIX + 'task_id'] = a2aResponse.root.result.taskId;
                        }
                    }

                    if (a2aResponse.root.result.contextId) {
                        event.customMetadata[A2A_METADATA_PREFIX + 'context_id'] = a2aResponse.root.result.contextId;
                    }
                } else {
                    logger.warning('A2A response has no result:', a2aResponse.root);
                    event = new Event({
                        author: this.name,
                        invocationId: ctx.invocationId,
                        branch: ctx.branch,
                    });
                }

                return event;
            } else {
                // Handle error response
                const errorResponse = a2aResponse.root;
                logger.error(
                    'A2A request failed with error:',
                    errorResponse.error.message,
                    'data:',
                    errorResponse.error.data
                );
                return new Event({
                    author: this.name,
                    errorMessage: errorResponse.error.message,
                    errorCode: String(errorResponse.error.code),
                    invocationId: ctx.invocationId,
                    branch: ctx.branch,
                });
            }
        } catch (error) {
            logger.error('Failed to handle A2A response:', error);
            return new Event({
                author: this.name,
                errorMessage: `Failed to process A2A response: ${error}`,
                invocationId: ctx.invocationId,
                branch: ctx.branch,
            });
        }
    }

    protected async *runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event, void, unknown> {
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

        // Create A2A request for function response or regular message
        let a2aRequest = this.createA2ARequestForUserFunctionResponse(ctx);

        if (!a2aRequest) {
            const [messageParts, contextId] = this.constructMessagePartsFromSession(ctx);

            if (messageParts.length === 0) {
                logger.warning('No parts to send to remote A2A agent. Emitting empty event.');
                yield new Event({
                    author: this.name,
                    content: new GenAIContent(),
                    invocationId: ctx.invocationId,
                    branch: ctx.branch,
                });
                return;
            }

            a2aRequest = new SendMessageRequest({
                id: uuidv4(),
                params: new A2AMessageSendParams({
                    message: new A2AMessage({
                        messageId: uuidv4(),
                        parts: messageParts,
                        role: 'user',
                        contextId,
                    }),
                }),
            });
        }

        logger.debug(buildA2ARequestLog(a2aRequest));

        try {
            const a2aResponse = await this.a2aClient!.sendMessage({ request: a2aRequest });
            logger.debug(buildA2AResponseLog(a2aResponse));

            const event = await this.handleA2AResponse(a2aResponse, ctx);

            // Add metadata about the request and response
            event.customMetadata = event.customMetadata || {};
            event.customMetadata[A2A_METADATA_PREFIX + 'request'] = a2aRequest.toJSON();
            event.customMetadata[A2A_METADATA_PREFIX + 'response'] = a2aResponse.root.toJSON();

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
                    [A2A_METADATA_PREFIX + 'request']: a2aRequest.toJSON(),
                    [A2A_METADATA_PREFIX + 'error']: errorMessage,
                },
            });
        }
    }

    protected async *runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event, void, unknown> {
        throw new Error(`runLiveImpl for ${this.constructor.name} via A2A is not implemented.`);
    }

    async cleanup(): Promise<void> {
        if (this.httpClientNeedsCleanup && this.httpClient) {
            try {
                // Replace with appropriate cleanup for your HTTP client
                if (this.httpClient.close) {
                    await this.httpClient.close();
                }
                logger.debug('Closed HTTP client for agent', this.name);
            } catch (error) {
                logger.warning('Failed to close HTTP client for agent', this.name, ':', error);
            } finally {
                this.httpClient = undefined;
            }
        }
    }
}
