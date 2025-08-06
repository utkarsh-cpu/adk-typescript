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
export * from './flows';
export * from './memory';
export * from './sessions';
export * from './artifacts';
export * from './auth';
export * from './events';
export * from './utils';
export * from './a2a';

// React Native specific exports
export * from './react-native';

// Version information
export { version } from './version';

// Runners and telemetry
export * from './runners';
export * from './telemetry';