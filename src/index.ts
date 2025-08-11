/**
 * Google Agent Development Kit (ADK) - TypeScript/React Native
 * 
 * Main entry point for the TypeScript ADK library.
 * This library provides a complete TypeScript implementation of the Python ADK
 * with React Native optimizations and mobile-specific features.
 */

// Core exports
export * from './agents';
export * from './models';
export * from './memory';
export * from './sessions';
export * from './artifacts';
export * from './events';
export * from './utils';
export * from './a2a';

// Flows exports (excluding conflicting requestProcessor)
export * from './flows/llm-flows';
export * from './flows/streaming';

// Auth exports (excluding conflicting requestProcessor)
export * from './auth/auth-credential';
export * from './auth/auth-handler';
export * from './auth/auth-schemes';
export * from './auth/auth-tool';
export * from './auth/credential-manager';
export * from './auth/oauth2-credential-util';
export * from './auth/react-native';

// Explicit re-exports with aliases to resolve naming conflicts
export { requestProcessor as authRequestProcessor } from './auth/auth-preprocessor';
export { requestProcessor as contentRequestProcessor } from './flows/llm-flows/contents';
export { requestProcessor as basicRequestProcessor } from './flows/llm-flows/basic';

// React Native specific exports
export * from './react-native';

// Version information
export { version } from './version';

// Runners and telemetry
export * from './runners';
export * from './telemetry';