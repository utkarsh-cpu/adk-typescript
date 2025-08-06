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

import { convertEventToA2aEvents } from '../converters/event-converter';
import { convertA2aRequestToAdkRunArgs } from '../converters/request-converter';
import { getAdkMetadataKey } from '../converters/utils';
import { TaskResultAggregator } from './task-result-aggregator';
import type { 
  TaskStatusUpdateEvent, 
  TaskArtifactUpdateEvent, 
  Message,
  Task
} from '@a2a-js/sdk';

// A2A server types - these would be imported from the A2A server library
interface RequestContext {
  taskId: string;
  contextId: string;
  message?: Message;
  currentTask?: Task;
}

interface EventQueue {
  enqueueEvent(event: TaskStatusUpdateEvent | TaskArtifactUpdateEvent): Promise<void>;
}

// Runner interface - would be imported from runners
interface Runner {
  appName: string;
  sessionService: any;
  runAsync(args: any): AsyncIterable<any>;
  newInvocationContext(options: any): any;
}

/**
 * Configuration for the A2aAgentExecutor.
 */
export interface A2aAgentExecutorConfig {
  // Configuration properties would be added here as needed
}

/**
 * An AgentExecutor that runs an ADK Agent against an A2A request and
 * publishes updates to an event queue.
 */
export class A2aAgentExecutor {
  private runner: Runner | (() => Runner | Promise<Runner>);
  private config?: A2aAgentExecutorConfig;
  private resolvedRunner?: Runner;

  constructor(options: {
    runner: Runner | (() => Runner | Promise<Runner>);
    config?: A2aAgentExecutorConfig;
  }) {
    this.runner = options.runner;
    this.config = options.config;
  }

  /**
   * Resolve the runner, handling cases where it's a callable that returns a Runner.
   */
  private async resolveRunner(): Promise<Runner> {
    // If already resolved and cached, return it
    if (this.resolvedRunner) {
      return this.resolvedRunner;
    }

    if (typeof this.runner === 'function') {
      // Call the function to get the runner
      const result = this.runner();

      // Handle async callables
      const resolvedRunner = result instanceof Promise ? await result : result;

      // Cache the resolved runner for future calls
      this.resolvedRunner = resolvedRunner;
      return resolvedRunner;
    } else if (this.runner && typeof this.runner === 'object') {
      // Already a Runner instance
      this.resolvedRunner = this.runner;
      return this.runner;
    }

    throw new Error(
      `Runner must be a Runner instance or a callable that returns a Runner, got ${typeof this.runner}`
    );
  }

  /**
   * Cancel the execution.
   */
  async cancel(_context: RequestContext, _eventQueue: EventQueue): Promise<void> {
    // TODO: Implement proper cancellation logic if needed
    throw new Error('Cancellation is not supported');
  }

  /**
   * Executes an A2A request and publishes updates to the event queue.
   * It runs as following:
   * * Takes the input from the A2A request
   * * Convert the input to ADK input content, and runs the ADK agent
   * * Collects output events of the underlying ADK Agent
   * * Converts the ADK output events into A2A task updates
   * * Publishes the updates back to A2A server via event queue
   */
  async execute(context: RequestContext, eventQueue: EventQueue): Promise<void> {
    if (!context.message) {
      throw new Error('A2A request must have a message');
    }

    // For new task, create a task submitted event
    if (!context.currentTask) {
      await eventQueue.enqueueEvent({
        kind: 'status-update',
        taskId: context.taskId,
        status: {
          state: 'submitted',
          message: context.message,
          timestamp: new Date().toISOString()
        },
        contextId: context.contextId,
        final: false
      } as TaskStatusUpdateEvent);
    }

    // Handle the request and publish updates to the event queue
    try {
      await this.handleRequest(context, eventQueue);
    } catch (error) {
      console.error('Error handling A2A request:', error);

      // Publish failure event
      try {
        await eventQueue.enqueueEvent({
          kind: 'status-update',
          taskId: context.taskId,
          status: {
            state: 'failed',
            timestamp: new Date().toISOString(),
            message: {
              kind: 'message',
              messageId: crypto.randomUUID(),
              role: 'agent',
              parts: [{ kind: 'text', text: String(error) }]
            }
          },
          contextId: context.contextId,
          final: true
        } as TaskStatusUpdateEvent);
      } catch (enqueueError) {
        console.error('Failed to publish failure event:', enqueueError);
      }
    }
  }

  private async handleRequest(context: RequestContext, eventQueue: EventQueue): Promise<void> {
    // Resolve the runner instance
    const runner = await this.resolveRunner();

    // Convert the a2a request to ADK run args
    const runArgs = convertA2aRequestToAdkRunArgs(context);

    // Ensure the session exists
    const session = await this.prepareSession(context, runArgs, runner);

    // Create invocation context
    const invocationContext = runner.newInvocationContext({
      session,
      newMessage: runArgs.newMessage,
      runConfig: runArgs.runConfig
    });

    // Publish the task working event
    await eventQueue.enqueueEvent({
      kind: 'status-update',
      taskId: context.taskId,
      status: {
        state: 'working',
        timestamp: new Date().toISOString()
      },
      contextId: context.contextId,
      final: false,
      metadata: {
        [getAdkMetadataKey('app_name')]: runner.appName,
        [getAdkMetadataKey('user_id')]: runArgs.userId,
        [getAdkMetadataKey('session_id')]: runArgs.sessionId
      }
    } as TaskStatusUpdateEvent);

    const taskResultAggregator = new TaskResultAggregator();

    for await (const adkEvent of runner.runAsync(runArgs)) {
      const a2aEvents = convertEventToA2aEvents(
        adkEvent,
        invocationContext,
        context.taskId,
        context.contextId
      );

      for (const a2aEvent of a2aEvents) {
        taskResultAggregator.processEvent(a2aEvent);
        await eventQueue.enqueueEvent(a2aEvent);
      }
    }

    // Publish the task result event - this is final
    if (
      taskResultAggregator.taskStateValue === 'working' &&
      taskResultAggregator.taskStatusMessageValue &&
      taskResultAggregator.taskStatusMessageValue.parts
    ) {
      // If task is still working properly, publish the artifact update event as
      // the final result according to a2a protocol.
      await eventQueue.enqueueEvent({
        kind: 'artifact-update',
        taskId: context.taskId,
        lastChunk: true,
        contextId: context.contextId,
        artifact: {
          artifactId: crypto.randomUUID(),
          parts: taskResultAggregator.taskStatusMessageValue.parts
        }
      } as TaskArtifactUpdateEvent);

      // Publish the final status update event
      await eventQueue.enqueueEvent({
        kind: 'status-update',
        taskId: context.taskId,
        status: {
          state: 'completed',
          timestamp: new Date().toISOString()
        },
        contextId: context.contextId,
        final: true
      } as TaskStatusUpdateEvent);
    } else {
      await eventQueue.enqueueEvent({
        kind: 'status-update',
        taskId: context.taskId,
        status: {
          state: taskResultAggregator.taskStateValue,
          timestamp: new Date().toISOString(),
          message: taskResultAggregator.taskStatusMessageValue || undefined
        },
        contextId: context.contextId,
        final: true
      } as TaskStatusUpdateEvent);
    }
  }

  private async prepareSession(_context: RequestContext, runArgs: any, runner: Runner): Promise<any> {
    const sessionId = runArgs.sessionId;
    const userId = runArgs.userId;

    // Create a new session if not exists
    let session = await runner.sessionService.getSession({
      appName: runner.appName,
      userId,
      sessionId
    });

    if (!session) {
      session = await runner.sessionService.createSession({
        appName: runner.appName,
        userId,
        state: {},
        sessionId
      });
      // Update run_args with the new session_id
      runArgs.sessionId = session.id;
    }

    return session;
  }
}