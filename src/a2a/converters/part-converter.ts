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

import { getAdkMetadataKey } from './utils';
import type { Part, TextPart, FilePart, DataPart, FileWithUri, FileWithBytes } from '@a2a-js/sdk';
import type { Part as GenaiPart } from '@google/genai';

// Constants for A2A data part metadata
const A2A_DATA_PART_METADATA_TYPE_KEY = 'type';
const A2A_DATA_PART_METADATA_TYPE_FUNCTION_CALL = 'function_call';
const A2A_DATA_PART_METADATA_TYPE_FUNCTION_RESPONSE = 'function_response';
const A2A_DATA_PART_METADATA_TYPE_CODE_EXECUTION_RESULT = 'code_execution_result';
const A2A_DATA_PART_METADATA_TYPE_EXECUTABLE_CODE = 'executable_code';

/**
 * Convert an A2A Part to a Google GenAI Part.
 * @param a2aPart - The A2A part to convert.
 * @returns The converted GenAI part or null if conversion fails.
 */
export function convertA2aPartToGenaiPart(a2aPart: Part): GenaiPart | null {
  // Handle text parts
  if (a2aPart.kind === 'text') {
    const textPart = a2aPart as TextPart;
    const genaiPart: GenaiPart = { text: textPart.text };
    if (textPart.metadata && getAdkMetadataKey('thought') in textPart.metadata) {
      const thoughtValue = textPart.metadata[getAdkMetadataKey('thought')];
      genaiPart.thought = typeof thoughtValue === 'boolean' ? thoughtValue : undefined;
    }
    return genaiPart;
  }

  // Handle file parts
  if (a2aPart.kind === 'file') {
    const filePart = a2aPart as FilePart;
    if ('uri' in filePart.file) {
      const fileWithUri = filePart.file as FileWithUri;
      // Check if uri is defined before creating fileData
      if (!fileWithUri.uri) {
        console.warn('FileWithUri has undefined uri, skipping conversion:', a2aPart);
        return null;
      }
      return {
        fileData: {
          fileUri: fileWithUri.uri,
          mimeType: fileWithUri.mimeType || 'application/octet-stream'
        }
      };
    } else if ('bytes' in filePart.file) {
      const fileWithBytes = filePart.file as FileWithBytes;
      // The bytes are already base64 encoded, so we can use them directly
      const genaiPart: GenaiPart = {
        inlineData: {
          data: fileWithBytes.bytes,
          mimeType: fileWithBytes.mimeType || 'application/octet-stream'
        }
      };

      // Handle video metadata if present
      if (filePart.metadata && getAdkMetadataKey('video_metadata') in filePart.metadata) {
        // Video metadata would be handled here
      }

      return genaiPart;
    } else {
      console.warn('Cannot convert unsupported file type for A2A part:', a2aPart);
      return null;
    }
  }

  // Handle data parts
  if (a2aPart.kind === 'data') {
    const dataPart = a2aPart as DataPart;
    if (dataPart.metadata && getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY) in dataPart.metadata) {
      const dataType = dataPart.metadata[getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY)];

      switch (dataType) {
        case A2A_DATA_PART_METADATA_TYPE_FUNCTION_CALL:
          return { functionCall: dataPart.data };
        case A2A_DATA_PART_METADATA_TYPE_FUNCTION_RESPONSE:
          return { functionResponse: dataPart.data };
        case A2A_DATA_PART_METADATA_TYPE_CODE_EXECUTION_RESULT:
          return { codeExecutionResult: dataPart.data };
        case A2A_DATA_PART_METADATA_TYPE_EXECUTABLE_CODE:
          return { executableCode: dataPart.data };
      }
    }
    return { text: JSON.stringify(dataPart.data) };
  }

  console.warn('Cannot convert unsupported part type for A2A part:', a2aPart);
  return null;
}

/**
 * Convert a Google GenAI Part to an A2A Part.
 * @param part - The GenAI part to convert.
 * @returns The converted A2A part or null if conversion fails.
 */
export function convertGenaiPartToA2aPart(part: GenaiPart): Part | null {
  // Handle text parts
  if (part.text) {
    const a2aPart: TextPart = {
      kind: 'text',
      text: part.text
    };
    if (part.thought !== undefined) {
      a2aPart.metadata = { [getAdkMetadataKey('thought')]: part.thought };
    }
    return a2aPart;
  }

  // Handle file data
  if (part.fileData) {
    return {
      kind: 'file',
      file: {
        uri: part.fileData.fileUri,
        mimeType: part.fileData.mimeType
      } as FileWithUri
    } as FilePart;
  }

  // Handle inline data
  if (part.inlineData && part.inlineData.data) {
    // The data is already a base64 string, so we can use it directly
    return {
      kind: 'file',
      file: {
        bytes: part.inlineData.data,
        mimeType: part.inlineData.mimeType
      } as FileWithBytes
    } as FilePart;
  }

  // Handle function calls
  if (part.functionCall) {
    return {
      kind: 'data',
      data: part.functionCall,
      metadata: {
        [getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY)]: A2A_DATA_PART_METADATA_TYPE_FUNCTION_CALL
      }
    } as DataPart;
  }

  // Handle function responses
  if (part.functionResponse) {
    return {
      kind: 'data',
      data: part.functionResponse,
      metadata: {
        [getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY)]: A2A_DATA_PART_METADATA_TYPE_FUNCTION_RESPONSE
      }
    } as DataPart;
  }

  // Handle code execution results
  if (part.codeExecutionResult) {
    return {
      kind: 'data',
      data: part.codeExecutionResult,
      metadata: {
        [getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY)]: A2A_DATA_PART_METADATA_TYPE_CODE_EXECUTION_RESULT
      }
    } as DataPart;
  }

  // Handle executable code
  if (part.executableCode) {
    return {
      kind: 'data',
      data: part.executableCode,
      metadata: {
        [getAdkMetadataKey(A2A_DATA_PART_METADATA_TYPE_KEY)]: A2A_DATA_PART_METADATA_TYPE_EXECUTABLE_CODE
      }
    } as DataPart;
  }

  console.warn('Cannot convert unsupported part for Google GenAI part:', part);
  return null;
}