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

import { Event } from '../../events/event';
import { InvocationContext } from '../../agents/invocation-context';
import { convertA2aPartToGenaiPart, convertGenaiPartToA2aPart } from './part-converter';
import { getAdkMetadataKey } from './utils';
import type {
  Part,
  Message,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent
} from '@a2a-js/sdk';

// A2A Event union type matching Python SDK definition
export type A2AEvent = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

// Constants
const ARTIFACT_ID_SEPARATOR = '-';
const DEFAULT_ERROR_MESSAGE = 'An error occurred during processing';
const REQUEST_EUC_FUNCTION_CALL_NAME = 'request_euc'; // This would be imported from flows
const A2A_DATA_PART_METADATA_TYPE_KEY = 'type';
const A2A_DATA_PART_METADATA_IS_LONG_RUNNING_KEY = 'is_long_running';
const A2A_DATA_PART_METADATA_TYPE_FUNCTION_CALL = 'function_call';

/**
 * Safely serializes metadata values to string format.
 */
function serializeMetadataValue(value: any): string {
  if (value && typeof value === 'object' && 'modelDump' in value) {
    try {
      return value.modelDump({ excludeNone: true, byAlias: true });
    } catch (error) {
      console.warn('Failed to serialize metadata value:', error);
      return String(value);
    }
  }
  return String(value);
}

/**
 * Gets the context metadata for the event.
 */
function getContextMetadata(event: Event, invocationContext: InvocationContext): Record<string, string> {
  if (!event) {
    throw new Error('Event cannot be null');
  }
  if (!invocationContext) {
    throw new Error('Invocation context cannot be null');
  }

  try {
    const metadata: Record<string, string> = {
      [getAdkMetadataKey('app_name')]: invocationContext.appName || '',
      [getAdkMetadataKey('user_id')]: invocationContext.userId || '',
      [getAdkMetadataKey('session_id')]: invocationContext.session?.id || '',
      [getAdkMetadataKey('invocation_id')]: event.invocationId || '',
      [getAdkMetadataKey('author')]: event.author || ''
    };

    // Add optional metadata fields if present
    const optionalFields: Array<[string, any]> = [
      ['branch', event.branch],
      ['grounding_metadata', event.groundingMetadata],
      ['custom_metadata', event.customMetadata],
      ['usage_metadata', event.usageMetadata],
      ['error_code', event.errorCode]
    ];

    for (const [fieldName, fieldValue] of optionalFields) {
      if (fieldValue !== null && fieldValue !== undefined) {
        metadata[getAdkMetadataKey(fieldName)] = serializeMetadataValue(fieldValue);
      }
    }

    return metadata;
  } catch (error) {
    console.error('Failed to create context metadata:', error);
    throw error;
  }
}

/**
 * Creates a unique artifact ID.
 */
function createArtifactId(
  appName: string,
  userId: string,
  sessionId: string,
  filename: string,
  version: number
): string {
  const components = [appName, userId, sessionId, filename, String(version)];
  return components.join(ARTIFACT_ID_SEPARATOR);
}

/**
 * Processes long-running tool metadata for an A2A part.
 */
function processLongRunningTool(a2aPart: Part, event: Event): void {
  if (
    a2aPart.kind === 'data' &&
    event.longRunningToolIds &&
    a2aPart.metadata &&
    a2aPart.metadata[getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY)] === A2A_DATA_PART_METADATA_TYPE_FUNCTION_CALL &&
    a2aPart.data &&
    typeof a2aPart.data === 'object' &&
    'id' in a2aPart.data &&
    typeof a2aPart.data.id === 'string' &&
    event.longRunningToolIds.has(a2aPart.data.id)
  ) {
    a2aPart.metadata[getAdkMetadataKey(A2A_DATA_PART_METADATA_IS_LONG_RUNNING_KEY)] = true;
  }
}

/**
 * Converts an A2A task to an ADK event.
 */
export function convertA2aTaskToEvent(
  a2aTask: Task,
  author?: string,
  invocationContext?: InvocationContext
): Event {
  if (!a2aTask) {
    throw new Error('A2A task cannot be null');
  }

  try {
    // Extract message from task status or history
    let message: Message | null = null;
    if (a2aTask.artifacts && a2aTask.artifacts.length > 0) {
      message = {
        kind: 'message',
        messageId: '',
        role: 'agent',
        parts: a2aTask.artifacts[a2aTask.artifacts.length - 1].parts
      };
    } else if (a2aTask.status?.message) {
      message = a2aTask.status.message;
    } else if (a2aTask.history && a2aTask.history.length > 0) {
      message = a2aTask.history[a2aTask.history.length - 1];
    }

    // Convert message if available
    if (message) {
      try {
        return convertA2aMessageToEvent(message, author, invocationContext);
      } catch (error) {
        console.error('Failed to convert A2A task message to event:', error);
        throw new Error(`Failed to convert task message: ${error}`);
      }
    }

    // Create minimal event if no message is available
    return new Event({
      invocationId: invocationContext?.invocationId || crypto.randomUUID(),
      author: author || 'a2a agent',
      branch: invocationContext?.branch
    });
  } catch (error) {
    console.error('Failed to convert A2A task to event:', error);
    throw error;
  }
}

/**
 * Converts an A2A message to an ADK event.
 */
export function convertA2aMessageToEvent(
  a2aMessage: Message,
  author?: string,
  invocationContext?: InvocationContext
): Event {
  if (!a2aMessage) {
    throw new Error('A2A message cannot be null');
  }

  if (!a2aMessage.parts || a2aMessage.parts.length === 0) {
    console.warn('A2A message has no parts, creating event with empty content');
    return new Event({
      invocationId: invocationContext?.invocationId || crypto.randomUUID(),
      author: author || 'a2a agent',
      branch: invocationContext?.branch,
      content: {
        role: 'model',
        parts: []
      }
    });
  }

  try {
    const parts: any[] = [];
    const longRunningToolIds = new Set<string>();

    for (const a2aPart of a2aMessage.parts) {
      try {
        const part = convertA2aPartToGenaiPart(a2aPart);
        if (!part) {
          console.warn('Failed to convert A2A part, skipping:', a2aPart);
          continue;
        }

        // Check for long-running tools
        if (
          a2aPart.kind === 'data' &&
          a2aPart.metadata &&
          a2aPart.metadata[getAdkMetadataKey(A2A_DATA_PART_METADATA_IS_LONG_RUNNING_KEY)] === true &&
          part.functionCall?.id
        ) {
          longRunningToolIds.add(part.functionCall.id);
        }

        parts.push(part);
      } catch (error) {
        console.error('Failed to convert A2A part:', a2aPart, 'error:', error);
        // Continue processing other parts instead of failing completely
        continue;
      }
    }

    if (parts.length === 0) {
      console.warn('No parts could be converted from A2A message', a2aMessage);
    }

    return new Event({
      invocationId: invocationContext?.invocationId || crypto.randomUUID(),
      author: author || 'a2a agent',
      branch: invocationContext?.branch,
      longRunningToolIds: longRunningToolIds.size > 0 ? longRunningToolIds : undefined,
      content: {
        role: 'model',
        parts
      }
    });
  } catch (error) {
    console.error('Failed to convert A2A message to event:', error);
    throw new Error(`Failed to convert message: ${error}`);
  }
}

/**
 * Converts an ADK event to an A2A message.
 */
export function convertEventToA2aMessage(
  event: Event,
  invocationContext: InvocationContext,
  role: 'user' | 'agent' = 'agent'
): Message | null {
  if (!event) {
    throw new Error('Event cannot be null');
  }
  if (!invocationContext) {
    throw new Error('Invocation context cannot be null');
  }

  if (!event.content || !event.content.parts || event.content.parts.length === 0) {
    return null;
  }

  try {
    const a2aParts: Part[] = [];
    for (const part of event.content.parts) {
      const a2aPart = convertGenaiPartToA2aPart(part);
      if (a2aPart) {
        a2aParts.push(a2aPart);
        processLongRunningTool(a2aPart, event);
      }
    }

    if (a2aParts.length > 0) {
      return {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role,
        parts: a2aParts
      };
    }
  } catch (error) {
    console.error('Failed to convert event to status message:', error);
    throw error;
  }

  return null;
}

/**
 * Creates a TaskStatusUpdateEvent for error scenarios.
 */
function createErrorStatusEvent(
  event: Event,
  invocationContext: InvocationContext,
  taskId: string = '',
  contextId: string = ''
): TaskStatusUpdateEvent {
  const errorMessage = event.errorMessage || DEFAULT_ERROR_MESSAGE;

  // Get context metadata and add error code
  const eventMetadata = getContextMetadata(event, invocationContext);
  if (event.errorCode) {
    eventMetadata[getAdkMetadataKey('error_code')] = String(event.errorCode);
  }

  return {
    kind: 'status-update',
    taskId,
    contextId,
    metadata: eventMetadata,
    status: {
      state: 'failed',
      message: {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'agent',
        parts: [{
          kind: 'text',
          text: errorMessage,
          metadata: event.errorCode ? {
            [getAdkMetadataKey('error_code')]: String(event.errorCode)
          } : {}
        }]
      },
      timestamp: new Date().toISOString()
    },
    final: false
  };
}

/**
 * Creates a TaskStatusUpdateEvent for running scenarios.
 */
function createStatusUpdateEvent(
  message: Message,
  invocationContext: InvocationContext,
  event: Event,
  taskId: string = '',
  contextId: string = ''
): TaskStatusUpdateEvent {
  let state: 'working' | 'auth-required' | 'input-required' = 'working';

  // Check for auth required
  if (message.parts.some(part =>
    part.kind === 'data' &&
    part.metadata &&
    part.metadata[getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY)] === A2A_DATA_PART_METADATA_TYPE_FUNCTION_CALL &&
    part.metadata[getAdkMetadataKey(A2A_DATA_PART_METADATA_IS_LONG_RUNNING_KEY)] === true &&
    part.data &&
    typeof part.data === 'object' &&
    'name' in part.data &&
    part.data.name === REQUEST_EUC_FUNCTION_CALL_NAME
  )) {
    state = 'auth-required';
  } else if (message.parts.some(part =>
    part.kind === 'data' &&
    part.metadata &&
    part.metadata[getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY)] === A2A_DATA_PART_METADATA_TYPE_FUNCTION_CALL &&
    part.metadata[getAdkMetadataKey(A2A_DATA_PART_METADATA_IS_LONG_RUNNING_KEY)] === true
  )) {
    state = 'input-required';
  }

  return {
    kind: 'status-update',
    taskId,
    contextId,
    status: {
      state,
      message,
      timestamp: new Date().toISOString()
    },
    metadata: getContextMetadata(event, invocationContext),
    final: false
  };
}

/**
 * Converts a GenAI event to a list of A2A events.
 */
export function convertEventToA2aEvents(
  event: Event,
  invocationContext: InvocationContext,
  taskId: string = '',
  contextId: string = ''
): (A2AEvent)[] {
  if (!event) {
    throw new Error('Event cannot be null');
  }
  if (!invocationContext) {
    throw new Error('Invocation context cannot be null');
  }

  const a2aEvents: (TaskStatusUpdateEvent | TaskArtifactUpdateEvent)[] = [];

  try {
    // Handle error scenarios
    if (event.errorCode) {
      const errorEvent = createErrorStatusEvent(event, invocationContext, taskId, contextId);
      a2aEvents.push(errorEvent);
    }

    // Handle regular message content
    const message = convertEventToA2aMessage(event, invocationContext);
    if (message) {
      const runningEvent = createStatusUpdateEvent(message, invocationContext, event, taskId, contextId);
      a2aEvents.push(runningEvent);
    }
  } catch (error) {
    console.error('Failed to convert event to A2A events:', error);
    throw error;
  }

  return a2aEvents;
}

// Export the unused function to maintain compatibility
export { createArtifactId };