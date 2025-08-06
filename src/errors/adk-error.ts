/**
 * Base ADK error classes
 * Based on Python ADK error patterns
 */

/**
 * Base class for all ADK errors
 * 
 * This provides a foundation for error handling with references to Python ADK
 * equivalent errors for debugging and migration purposes.
 */
export abstract class ADKError extends Error {
  /** Error code for categorization */
  abstract readonly code: string;

  /** Additional error details */
  details?: Record<string, any>;

  /** Reference to equivalent Python ADK error for debugging */
  pythonEquivalent?: string;

  constructor(message: string, details?: Record<string, any>, pythonEquivalent?: string) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    this.pythonEquivalent = pythonEquivalent;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Returns a JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      pythonEquivalent: this.pythonEquivalent,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when an entity is not found
 */
export class NotFoundError extends ADKError {
  readonly code = 'NOT_FOUND';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details, 'google.adk.errors.not_found_error.NotFoundError');
  }
}

/**
 * Error thrown when LLM calls exceed the limit
 */
export class LlmCallsLimitExceededError extends ADKError {
  readonly code = 'LLM_CALLS_LIMIT_EXCEEDED';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details, 'google.adk.agents.invocation_context.LlmCallsLimitExceededError');
  }
}

/**
 * Base exception for credential refresh errors
 */
export class CredentialRefresherError extends ADKError {
  readonly code = 'CREDENTIAL_REFRESH_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details, 'google.adk.auth.refresher.base_credential_refresher.CredentialRefresherError');
  }
}

/**
 * Base exception for credential exchange errors
 */
export class CredentialExchangeError extends ADKError {
  readonly code = 'CREDENTIAL_EXCHANGE_ERROR';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details, 'google.adk.auth.exchanger.base_credential_exchanger.CredentialExchangError');
  }
}

/**
 * Exception raised when required authentication credentials are missing
 */
export class AuthCredentialMissingError extends ADKError {
  readonly code = 'AUTH_CREDENTIAL_MISSING';

  constructor(message: string, details?: Record<string, any>) {
    super(message, details, 'google.adk.tools.openapi_tool.auth.credential_exchangers.base_credential_exchanger.AuthCredentialMissingError');
  }
}
