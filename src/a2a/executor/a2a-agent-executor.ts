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

import {
  
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
} from "@a2a-js/sdk";
import {AgentExecutor,
  RequestContext,
  ExecutionEventBus} from "@a2a-js/sdk/dist/server"
import { convertEventToA2aEvents } from "../converters/event-converter";
import { convertA2aRequestToAdkRunArgs } from "../converters/request-converter";
import { getAdkMetadataKey } from "../converters/utils";
import { TaskResultAggregator } from "./task-result-aggregator";

// If not on Node 18+, import from 'uuid' instead
const uuid = typeof crypto !== "undefined" && crypto.randomUUID
  ? () => crypto.randomUUID()
  : () => require("uuid").v4();

export interface A2aAgentExecutorConfig {
  // Add config options as needed
}

export class A2aAgentExecutor implements AgentExecutor {
  private runner: any | (() => any | Promise<any>);
  private config?: A2aAgentExecutorConfig;
  private resolvedRunner?: any;

  constructor(options: {
    runner: any | (() => any | Promise<any>);
    config?: A2aAgentExecutorConfig;
  }) {
    this.runner = options.runner;
    this.config = options.config;
  }

  private async resolveRunner(): Promise<any> {
    if (this.resolvedRunner) return this.resolvedRunner;
    if (typeof this.runner === "function") {
      const result = this.runner();
      this.resolvedRunner = result instanceof Promise ? await result : result;
      return this.resolvedRunner;
    } else if (typeof this.runner === "object") {
      this.resolvedRunner = this.runner;
      return this.runner;
    }
    throw new Error("Runner must be an object or function");
  }

  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    // Not implemented (to match Python version)
    throw new Error("Cancellation is not supported");
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    if (!requestContext.userMessage) throw new Error("A2A request must have a message");

    try {
      // If this is a new task, publish initial submitted event
      if (!requestContext.task) {
        eventBus.publish({
          kind: "status-update",
          taskId: requestContext.taskId,
          status: {
            state: "submitted",
            message: requestContext.userMessage,
            timestamp: new Date().toISOString(),
          },
          contextId: requestContext.contextId,
          final: false,
        } as TaskStatusUpdateEvent);
      }

      await this.handleRequest(requestContext, eventBus);
    } catch (error) {
      console.error("Error handling A2A request:", error);
      eventBus.publish({
        kind: "status-update",
        taskId: requestContext.taskId,
        status: {
          state: "failed",
          timestamp: new Date().toISOString(),
          message: {
            kind: "message",
            messageId: uuid(),
            role: "agent",
            parts: [{ kind: "text", text: String(error instanceof Error ? error.message : error) }],
          },
        },
        contextId: requestContext.contextId,
        final: true,
      } as TaskStatusUpdateEvent);
    } finally {
      eventBus.finished();
    }
  }

  private async handleRequest(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const runner = await this.resolveRunner();
    const runArgs = convertA2aRequestToAdkRunArgs(requestContext);
    const session = await this.prepareSession(requestContext, runArgs, runner);

    const invocationContext = runner.newInvocationContext({
      session,
      newMessage: runArgs.newMessage,
      runConfig: runArgs.runConfig,
    });

    eventBus.publish({
      kind: "status-update",
      taskId: requestContext.taskId,
      status: {
        state: "working",
        timestamp: new Date().toISOString(),
      },
      contextId: requestContext.contextId,
      final: false,
      metadata: {
        [getAdkMetadataKey("app_name")]: runner.appName,
        [getAdkMetadataKey("user_id")]: runArgs.userId,
        [getAdkMetadataKey("session_id")]: runArgs.sessionId,
      },
    } as TaskStatusUpdateEvent);

    const taskResultAggregator = new TaskResultAggregator();

    for await (const adkEvent of runner.runAsync(runArgs)) {
      const a2aEvents = convertEventToA2aEvents(
        adkEvent,
        invocationContext,
        requestContext.taskId,
        requestContext.contextId
      );
      for (const a2aEvent of a2aEvents) {
        taskResultAggregator.processEvent(a2aEvent);
        eventBus.publish(a2aEvent);
      }
    }

    // Publish the final event as per protocol
    if (
      taskResultAggregator.taskStateValue === "working" &&
      taskResultAggregator.taskStatusMessageValue?.parts
    ) {
      eventBus.publish({
        kind: "artifact-update",
        taskId: requestContext.taskId,
        lastChunk: true,
        contextId: requestContext.contextId,
        artifact: {
          artifactId: uuid(),
          parts: taskResultAggregator.taskStatusMessageValue.parts,
        },
      } as TaskArtifactUpdateEvent);

      eventBus.publish({
        kind: "status-update",
        taskId: requestContext.taskId,
        status: {
          state: "completed",
          timestamp: new Date().toISOString(),
        },
        contextId: requestContext.contextId,
        final: true,
      } as TaskStatusUpdateEvent);
    } else {
      eventBus.publish({
        kind: "status-update",
        taskId: requestContext.taskId,
        status: {
          state: taskResultAggregator.taskStateValue,
          timestamp: new Date().toISOString(),
          message: taskResultAggregator.taskStatusMessageValue || undefined,
        },
        contextId: requestContext.contextId,
        final: true,
      } as TaskStatusUpdateEvent);
    }
  }

  private async prepareSession(
    _context: RequestContext,
    runArgs: any,
    runner: any
  ): Promise<any> {
    const sessionId = runArgs.sessionId;
    const userId = runArgs.userId;

    let session = await runner.sessionService.getSession({
      appName: runner.appName,
      userId,
      sessionId,
    });
    if (!session) {
      session = await runner.sessionService.createSession({
        appName: runner.appName,
        userId,
        state: {},
        sessionId,
      });
      runArgs.sessionId = session.id;
    }
    return session;
  }
}