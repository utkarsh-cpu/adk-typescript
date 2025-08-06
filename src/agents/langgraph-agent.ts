// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Event } from "@/events";
import { BaseAgent } from "./base-agent";
import { InvocationContext } from "./invocation-context";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { CompiledGraph } from "@langchain/langgraph";

/**
 * Extracts last human messages from given list of events.
 * @param events the list of events
 * @returns list of last human messages
 */
function _getLastHumanMessages(events: Event[]): HumanMessage[] {
    const messages: HumanMessage[] = [];
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (messages.length > 0 && event.author !== 'user') {
            break;
        }
        if (event.author === 'user' && event.content?.parts?.[0]?.text) {
            messages.push(new HumanMessage({
                content: event.content.parts[0].text
            }));
        }
    }
    return messages.reverse();
}

/**
 * Currently a concept implementation, supports single and multi-turn.
 */
export class LangGraphAgent extends BaseAgent {
    graph: CompiledGraph<any, any, any, any, any, any>;
    instruction: string = '';

    constructor(fields: {
        name: string;
        graph: CompiledGraph<any, any, any, any, any, any>;
        instruction?: string;
        description?: string;
    }) {
        super({
            name: fields.name,
            description: fields.description
        });
        this.graph = fields.graph;
        this.instruction = fields.instruction ?? '';
    }

    protected async *_runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event> {
        // Needed for langgraph checkpointer (for subsequent invocations; multi-turn)
        const config: RunnableConfig = {
            configurable: { thread_id: ctx.session.id }
        };

        // Add instruction as SystemMessage if graph state is empty
        const currentGraphState = this.graph.getState(config);
        const graphMessages = (await currentGraphState).values?.messages || [];

        let messages: (SystemMessage | HumanMessage | AIMessage)[] = [];
        if (this.instruction && graphMessages.length === 0) {
            messages.push(new SystemMessage({ content: this.instruction }));
        }

        // Add events to messages (evaluating the memory used; parent agent vs checkpointer)
        messages = messages.concat(this._getMessages(ctx.session.events));

        // Use the Runnable
        const finalState = await this.graph.invoke({ messages }, config);
        const result = finalState.messages[finalState.messages.length - 1].content;

        const resultEvent = new Event({
            invocationId: ctx.invocationId,
            author: this.name,
            branch: ctx.branch,
            content: {
                role: 'model',
                parts: [{ text: result }]
            }
        });

        yield resultEvent;
    }

    protected async *_runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event> {
        // For now, delegate to the async implementation
        // In a full implementation, this would handle live/streaming scenarios
        yield* this._runAsyncImpl(ctx);
    }

    /**
     * Extracts messages from given list of events.
     * 
     * If the developer provides their own memory within langgraph, we return the
     * last user messages only. Otherwise, we return all messages between the user
     * and the agent.
     * 
     * @param events the list of events
     * @returns list of messages
     */
    private _getMessages(events: Event[]): (HumanMessage | AIMessage)[] {
        if (this.graph.checkpointer) {
            return _getLastHumanMessages(events);
        } else {
            return this._getConversationWithAgent(events);
        }
    }

    /**
     * Extracts messages from given list of events.
     * @param events the list of events
     * @returns list of messages
     */
    private _getConversationWithAgent(events: Event[]): (HumanMessage | AIMessage)[] {
        const messages: (HumanMessage | AIMessage)[] = [];

        for (const event of events) {
            if (!event.content?.parts?.[0]?.text) {
                continue;
            }

            if (event.author === 'user') {
                messages.push(new HumanMessage({
                    content: event.content.parts[0].text
                }));
            } else if (event.author === this.name) {
                messages.push(new AIMessage({
                    content: event.content.parts[0].text
                }));
            }
        }

        return messages;
    }
}
