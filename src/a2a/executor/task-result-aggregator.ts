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

import {AgentExecutionEvent as Event } from '@a2a-js/sdk/dist/server';
import type { TaskState, Message, TaskStatusUpdateEvent } from '@a2a-js/sdk';

/**
 * Aggregates the task status updates and provides the final task state.
 */
export class TaskResultAggregator {
  private taskState: TaskState = 'working';
  private taskStatusMessage: Message | null = null;

  /**
   * Process an event from the agent run and detect signals about the task status.
   * Priority of task state:
   * - failed
   * - auth-required
   * - input-required
   * - working
   */
  processEvent(event: Event | TaskStatusUpdateEvent): void {
    if (this.isTaskStatusUpdateEvent(event)) {
      const statusEvent = event as TaskStatusUpdateEvent;
      
      if (statusEvent.status.state === 'failed') {
        this.taskState = 'failed';
        this.taskStatusMessage = statusEvent.status.message || null;
      } else if (
        statusEvent.status.state === 'auth-required' &&
        this.taskState !== 'failed'
      ) {
        this.taskState = 'auth-required';
        this.taskStatusMessage = statusEvent.status.message || null;
      } else if (
        statusEvent.status.state === 'input-required' &&
        this.taskState !== 'failed' &&
        this.taskState !== 'auth-required'
      ) {
        this.taskState = 'input-required';
        this.taskStatusMessage = statusEvent.status.message || null;
      } else if (this.taskState === 'working') {
        // Final state is already recorded and make sure the intermediate state is
        // always working because other state may terminate the event aggregation
        // in a2a request handler
        this.taskStatusMessage = statusEvent.status.message || null;
      }
      
      // Set the event status to working to prevent early termination
      statusEvent.status.state = 'working';
    }
  }

  /**
   * Get the current task state.
   */
  get taskStateValue(): TaskState {
    return this.taskState;
  }

  /**
   * Get the current task status message.
   */
  get taskStatusMessageValue(): Message | null {
    return this.taskStatusMessage;
  }

  /**
   * Type guard to check if an event is a TaskStatusUpdateEvent.
   */
  private isTaskStatusUpdateEvent(event: Event | TaskStatusUpdateEvent): event is TaskStatusUpdateEvent {
    return 'kind' in event && event.kind === 'status-update';
  }
}