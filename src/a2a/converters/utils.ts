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

import { tuple } from "zod";

const ADK_METADATA_KEY_PREFIX = 'adk_';
const ADK_CONTEXT_ID_PREFIX = 'adk';
const ADK_CONTEXT_ID_SEPARATOR = ':';

/**
 * Gets the A2A event metadata key for the given key.
 * @param key - The metadata key to prefix.
 * @returns The prefixed metadata key.
 * @throws Error if key is empty or null.
 */
export function getAdkMetadataKey(key: string): string {
  if (!key) {
    throw new Error('Metadata key cannot be empty or null');
  }
  return `${ADK_METADATA_KEY_PREFIX}${key}`;
}

/**
 * Converts app name, user id and session id to an A2A context id.
 * @param appName - The app name.
 * @param userId - The user id.
 * @param sessionId - The session id.
 * @returns The A2A context id.
 * @throws Error if any of the input parameters are empty or null.
 */
export function toA2AContextId(appName: string, userId: string, sessionId: string): string {
  if (!appName || !userId || !sessionId) {
    throw new Error('All parameters (appName, userId, sessionId) must be non-empty');
  }
  return [ADK_CONTEXT_ID_PREFIX, appName, userId, sessionId].join(ADK_CONTEXT_ID_SEPARATOR);
}

export function fromA2AContextId(contextId: string | null):[string| null,string| null,string | null]{
  if (contextId=null){
    return [null, null, null];
  }
  try{
    const parts = contextId!.split(ADK_CONTEXT_ID_SEPARATOR)
    if (parts.length != 4){
      return [null, null, null];
    }
    const [prefix, appName, userId, sessionId] = parts;
    if (prefix === ADK_CONTEXT_ID_PREFIX && 
      appName.trim() && 
      userId.trim() && 
      sessionId.trim()) {
      return [appName.trim(), userId.trim(), sessionId.trim()];
    }
  }catch(error){

  }
  return [null, null, null];
}