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

import { RunConfig } from '../../agents/run-config';
import { convertA2aPartToGenaiPart } from './part-converter';
import type { Message } from '@a2a-js/sdk';

// A2A server types - these would be imported from the A2A server library
interface CallContext {
  user?: {
    userName?: string;
  };
}

interface RequestContext {
  contextId: string;
  callContext?: CallContext;
  message?: Message;
}

interface Content {
  role: string;
  parts: any[];
}

/**
 * Gets the user ID from the request context.
 * @param request - The request context.
 * @returns The user ID.
 */
function getUserId(request: RequestContext): string {
  // Get user from call context if available (auth is enabled on a2a server)
  if (
    request.callContext &&
    request.callContext.user &&
    request.callContext.user.userName
  ) {
    return request.callContext.user.userName;
  }

  // Get user from context id
  return `A2A_USER_${request.contextId}`;
}

/**
 * Converts an A2A request to ADK run arguments.
 * @param request - The A2A request context.
 * @returns The ADK run arguments.
 * @throws Error if request message is null.
 */
export function convertA2aRequestToAdkRunArgs(request: RequestContext): {
  userId: string;
  sessionId: string;
  newMessage: Content;
  runConfig: RunConfig;
} {
  if (!request.message) {
    throw new Error('Request message cannot be null');
  }

  return {
    userId: getUserId(request),
    sessionId: request.contextId,
    newMessage: {
      role: 'user',
      parts: request.message.parts
        .map(part => convertA2aPartToGenaiPart(part))
        .filter(Boolean)
    },
    runConfig: new RunConfig()
  };
}