/**
 * Tool-specific error classes
 */

import { ADKError } from './adk-error';

/**
 * Base class for tool-related errors
 */
export abstract class ToolError extends ADKError {
  constructor(message: string, details?: Record<string, any>, pythonEquivalent?: string) {
    super(message, details, pythonEquivalent || 'Tool-related error (no direct Python equivalent)');
  }
}

/**
 * Generic tool error
 */
export class GenericToolError extends ToolError {
  readonly code = 'TOOL_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error thrown when tool configuration is invalid
 */
export class ToolConfigurationError extends ToolError {
  readonly code = 'TOOL_CONFIGURATION_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends ToolError {
  readonly code = 'TOOL_EXECUTION_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error thrown when tool is not found
 */
export class ToolNotFoundError extends ToolError {
  readonly code = 'TOOL_NOT_FOUND';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error thrown when tool authentication fails
 */
export class ToolAuthenticationError extends ToolError {
  readonly code = 'TOOL_AUTHENTICATION_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}
