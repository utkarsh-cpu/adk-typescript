/**
 * Agent-specific error classes
 */

import { ADKError } from './adk-error';

/**
 * Base class for agent-related errors
 */
export abstract class AgentError extends ADKError {
  constructor(message: string, details?: Record<string, any>, pythonEquivalent?: string) {
    super(message, details, pythonEquivalent || 'Agent-related error (no direct Python equivalent)');
  }
}

/**
 * Generic agent error
 */
export class GenericAgentError extends AgentError {
  readonly code = 'AGENT_ERROR';
  
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error thrown when agent configuration is invalid
 */
export class AgentConfigurationError extends AgentError {
  readonly code = 'AGENT_CONFIGURATION_ERROR';
  
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error thrown when agent execution fails
 */
export class AgentExecutionError extends AgentError {
  readonly code = 'AGENT_EXECUTION_ERROR';
  
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Error thrown when agent card resolution fails
 */
export class AgentCardResolutionError extends AgentError {
  readonly code = 'AGENT_CARD_RESOLUTION_ERROR';
  
  constructor(message: string, details?: Record<string, any>) {
    super(message, details, 'google.adk.agents.remote_a2a_agent.AgentCardResolutionError');
  }
}

/**
 * Error thrown when A2A client operations fail
 */
export class A2AClientError extends AgentError {
  readonly code = 'A2A_CLIENT_ERROR';
  
  constructor(message: string, details?: Record<string, any>) {
    super(message, details, 'google.adk.agents.remote_a2a_agent.A2AClientError');
  }
}
