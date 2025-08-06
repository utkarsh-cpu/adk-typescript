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

/**
 * Utility functions for structured A2A request and response logging.
 */

import type { 
  Part, 
  TextPart, 
  DataPart, 
  Message, 
  Task, 
  SendMessageRequest, 
  SendMessageResponse 
} from '@a2a-js/sdk';

// Constants
const NEW_LINE = '\n';
const EXCLUDED_PART_FIELD = { file: { bytes: true } };

/**
 * Check if an object is an A2A Task.
 */
function isA2aTask(obj: any): obj is Task {
  return obj && typeof obj === 'object' && 'status' in obj && 'id' in obj && 'kind' in obj && obj.kind === 'task';
}

/**
 * Check if an object is an A2A Message.
 */
function isA2aMessage(obj: any): obj is Message {
  return obj && typeof obj === 'object' && 'role' in obj && 'messageId' in obj && 'kind' in obj && obj.kind === 'message';
}

/**
 * Check if an object is an A2A TextPart.
 */
function isA2aTextPart(obj: any): obj is TextPart {
  return obj && typeof obj === 'object' && 'text' in obj && 'kind' in obj && obj.kind === 'text';
}

/**
 * Check if an object is an A2A DataPart.
 */
function isA2aDataPart(obj: any): obj is DataPart {
  return obj && typeof obj === 'object' && 'data' in obj && 'kind' in obj && obj.kind === 'data';
}

/**
 * Builds a log representation of an A2A message part.
 */
export function buildMessagePartLog(part: Part): string {
  let partContent = '';
  
  if (isA2aTextPart(part)) {
    const text = part.text;
    partContent = `TextPart: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`;
  } else if (isA2aDataPart(part)) {
    // For data parts, show the data keys but exclude large values
    const dataSummary: Record<string, any> = {};
    for (const [k, v] of Object.entries(part.data)) {
      if ((typeof v === 'object') && JSON.stringify(v).length > 100) {
        dataSummary[k] = `<${typeof v}>`;
      } else {
        dataSummary[k] = v;
      }
    }
    partContent = `DataPart: ${JSON.stringify(dataSummary, null, 2)}`;
  } else {
    partContent = `${part.kind}: ${JSON.stringify(part, null, 2)}`;
  }

  // Add part metadata if it exists
  if (part.metadata) {
    const metadataStr = JSON.stringify(part.metadata, null, 2).replace(/\n/g, '\n    ');
    partContent += `\n    Part Metadata: ${metadataStr}`;
  }

  return partContent;
}

/**
 * Builds a structured log representation of an A2A request.
 */
export function buildA2aRequestLog(req: SendMessageRequest): string {
  // Message parts logs
  const messagePartsLogs: string[] = [];
  if (req.params.message.parts) {
    req.params.message.parts.forEach((part, i) => {
      const partLog = buildMessagePartLog(part);
      const partLogFormatted = partLog.replace(/\n/g, '\n  ');
      messagePartsLogs.push(`Part ${i}: ${partLogFormatted}`);
    });
  }

  // Configuration logs
  let configLog = 'None';
  if (req.params.configuration) {
    const configData = {
      acceptedOutputModes: req.params.configuration.acceptedOutputModes,
      blocking: req.params.configuration.blocking,
      historyLength: req.params.configuration.historyLength,
      pushNotificationConfig: !!req.params.configuration.pushNotificationConfig
    };
    configLog = JSON.stringify(configData, null, 2);
  }

  // Build message metadata section
  let messageMetadataSection = '';
  if (req.params.message.metadata) {
    messageMetadataSection = `
  Metadata:
  ${JSON.stringify(req.params.message.metadata, null, 2).replace(/\n/g, '\n  ')}`;
  }

  // Build optional sections
  const optionalSections: string[] = [];
  if (req.params.metadata) {
    optionalSections.push(
      `-----------------------------------------------------------
Metadata:
${JSON.stringify(req.params.metadata, null, 2)}`
    );
  }

  const optionalSectionsStr = optionalSections.join(NEW_LINE);

  return `
A2A Request:
-----------------------------------------------------------
Request ID: ${req.id}
Method: ${req.method}
JSON-RPC: ${req.jsonrpc}
-----------------------------------------------------------
Message:
  ID: ${req.params.message.messageId}
  Role: ${req.params.message.role}
  Task ID: ${req.params.message.taskId}
  Context ID: ${req.params.message.contextId}${messageMetadataSection}
-----------------------------------------------------------
Message Parts:
${messagePartsLogs.length > 0 ? messagePartsLogs.join(NEW_LINE) : 'No parts'}
-----------------------------------------------------------
Configuration:
${configLog}
${optionalSectionsStr}
-----------------------------------------------------------
`;
}

/**
 * Builds a structured log representation of an A2A response.
 */
export function buildA2aResponseLog(resp: SendMessageResponse): string {
  // Handle error responses
  if (resp.root.error) {
    return `
A2A Response:
-----------------------------------------------------------
Type: ERROR
Error Code: ${resp.root.error.code}
Error Message: ${resp.root.error.message}
Error Data: ${resp.root.error.data ? JSON.stringify(resp.root.error.data, null, 2) : 'None'}
-----------------------------------------------------------
Response ID: ${resp.root.id}
JSON-RPC: ${resp.root.jsonrpc}
-----------------------------------------------------------
`;
  }

  // Handle success responses
  const result = resp.root.result!;
  const resultType = result.constructor.name;

  // Build result details based on type
  const resultDetails: string[] = [];

  if (isA2aTask(result)) {
    resultDetails.push(
      `Task ID: ${result.id}`,
      `Context ID: ${result.contextId}`,
      `Status State: ${result.status.state}`,
      `Status Timestamp: ${result.status.timestamp}`,
      `History Length: ${result.history?.length || 0}`,
      `Artifacts Count: ${result.artifacts?.length || 0}`
    );

    // Add task metadata if it exists
    if (result.metadata) {
      resultDetails.push('Task Metadata:');
      const metadataFormatted = JSON.stringify(result.metadata, null, 2).replace(/\n/g, '\n  ');
      resultDetails.push(`  ${metadataFormatted}`);
    }
  } else if (isA2aMessage(result)) {
    resultDetails.push(
      `Message ID: ${result.messageId}`,
      `Role: ${result.role}`,
      `Task ID: ${result.taskId}`,
      `Context ID: ${result.contextId}`
    );

    // Add message parts
    if (result.parts) {
      resultDetails.push('Message Parts:');
      result.parts.forEach((part, i) => {
        const partLog = buildMessagePartLog(part);
        const partLogFormatted = partLog.replace(/\n/g, '\n    ');
        resultDetails.push(`  Part ${i}: ${partLogFormatted}`);
      });
    }

    // Add metadata if it exists
    if (result.metadata) {
      resultDetails.push('Metadata:');
      const metadataFormatted = JSON.stringify(result.metadata, null, 2).replace(/\n/g, '\n  ');
      resultDetails.push(`  ${metadataFormatted}`);
    }
  } else {
    // Handle other result types by showing their JSON representation
    try {
      const resultJson = JSON.stringify(result);
      resultDetails.push(`JSON Data: ${resultJson}`);
    } catch {
      resultDetails.push('JSON Data: <unable to serialize>');
    }
  }

  // Build status message section
  let statusMessageSection = 'None';
  if (isA2aTask(result) && result.status.message) {
    const statusPartsLogs: string[] = [];
    if (result.status.message.parts) {
      result.status.message.parts.forEach((part, i) => {
        const partLog = buildMessagePartLog(part);
        const partLogFormatted = partLog.replace(/\n/g, '\n  ');
        statusPartsLogs.push(`Part ${i}: ${partLogFormatted}`);
      });
    }

    // Build status message metadata section
    let statusMetadataSection = '';
    if (result.status.message.metadata) {
      statusMetadataSection = `
Metadata:
${JSON.stringify(result.status.message.metadata, null, 2)}`;
    }

    statusMessageSection = `ID: ${result.status.message.messageId}
Role: ${result.status.message.role}
Task ID: ${result.status.message.taskId}
Context ID: ${result.status.message.contextId}
Message Parts:
${statusPartsLogs.length > 0 ? statusPartsLogs.join(NEW_LINE) : 'No parts'}${statusMetadataSection}`;
  }

  // Build history section
  let historySection = 'No history';
  if (isA2aTask(result) && result.history) {
    const historyLogs: string[] = [];
    result.history.forEach((message, i) => {
      const messagePartsLogs: string[] = [];
      if (message.parts) {
        message.parts.forEach((part, j) => {
          const partLog = buildMessagePartLog(part);
          const partLogFormatted = partLog.replace(/\n/g, '\n    ');
          messagePartsLogs.push(`  Part ${j}: ${partLogFormatted}`);
        });
      }

      // Build message metadata section
      let messageMetadataSection = '';
      if (message.metadata) {
        messageMetadataSection = `
  Metadata:
  ${JSON.stringify(message.metadata, null, 2).replace(/\n/g, '\n  ')}`;
      }

      historyLogs.push(
        `Message ${i + 1}:
  ID: ${message.messageId}
  Role: ${message.role}
  Task ID: ${message.taskId}
  Context ID: ${message.contextId}
  Message Parts:
${messagePartsLogs.length > 0 ? messagePartsLogs.join(NEW_LINE) : '  No parts'}${messageMetadataSection}`
      );
    });

    historySection = historyLogs.join(NEW_LINE);
  }

  return `
A2A Response:
-----------------------------------------------------------
Type: SUCCESS
Result Type: ${resultType}
-----------------------------------------------------------
Result Details:
${resultDetails.join(NEW_LINE)}
-----------------------------------------------------------
Status Message:
${statusMessageSection}
-----------------------------------------------------------
History:
${historySection}
-----------------------------------------------------------
Response ID: ${resp.root.id}
JSON-RPC: ${resp.root.jsonrpc}
-----------------------------------------------------------
`;
}