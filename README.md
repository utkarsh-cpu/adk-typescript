# Google Agent Development Kit (ADK) - TypeScript/React Native

A comprehensive TypeScript implementation of Google's Agent Development Kit, specifically optimized for React Native applications. This library provides all the core functionality of the Google ADK Python SDK with mobile-specific optimizations, React Native integration, and enhanced developer experience through TypeScript's type system.

## Features

- 🤖 **Complete Agent System**: BaseAgent, LlmAgent, SequentialAgent, ParallelAgent, LoopAgent
- 🛠️ **Rich Tool Ecosystem**: Built-in tools plus React Native-specific device integration tools
- 🧠 **Multi-LLM Support**: Gemini, OpenAI, Anthropic, and more with unified API
- 📱 **React Native Optimized**: Mobile-first design with React hooks and components ##( in working not yet done )
- 🔐 **Secure Authentication**: OAuth2, biometric authentication, secure credential storage
- 💾 **Comprehensive Memory**: Session management, memory services, and artifact handling
- 🎯 **Type Safe**: Full TypeScript support with comprehensive type definitions
- 🧪 **Testing Ready**: Jest integration with React Native Testing Library
- 📚 **Well Documented**: Comprehensive documentation with Python ADK cross-references

## Installation

```bash
npm install @google/adk-react-native
# or
yarn add @google/adk-react-native
```

### Peer Dependencies

Make sure you have the required peer dependencies installed:

```bash
npm install react@>=18.0.0 react-native@>=0.70.0
```

## Quick Start

### Basic Agent Setup

```typescript
import { LlmAgent, GeminiLlm } from '@google/adk-react-native';

const agent = new LlmAgent({
  name: 'MyAgent',
  description: 'A helpful assistant',
  model: 'gemini-1.5-pro',
  instruction: 'You are a helpful assistant.',
  llm: new GeminiLlm({ apiKey: 'your-api-key' }),
});

// Run the agent
const response = await agent.runAsync({
  message: 'Hello, how can you help me?',
});
```
### NOT YET IMPLEMENTED
### React Native Integration

```tsx
import React from 'react';
import { useAgent, ChatInterface } from '@google/adk-react-native';

export function MyApp() {
  const { agent, isLoading, runAgent } = useAgent({
    name: 'ChatBot',
    model: 'gemini-1.5-pro',
    instruction: 'You are a helpful mobile assistant.',
  });

  return (
    <ChatInterface
      agent={agent}
      isLoading={isLoading}
      onMessage={runAgent}
    />
  );
}
```
### NOT YET IMPLEMENTED
### Using Device Tools

```typescript
import { CameraTool, LocationTool } from '@google/adk-react-native';

const agent = new LlmAgent({
  name: 'MobileAgent',
  model: 'gemini-1.5-pro',
  tools: [
    new CameraTool(),
    new LocationTool(),
  ],
});
```

## Architecture

The TypeScript ADK follows a modular architecture that mirrors the Python implementation:

```
@google/adk-react-native/
├── agents/          # Agent implementations
├── tools/           # Tool system and device integrations
├── models/          # LLM provider integrations
├── flows/           # Flow management
├── memory/          # Memory and session management
├── auth/            # Authentication and security
├── react-native/    # React Native specific components
└── utils/           # Utility functions
```
## TO BE BUILT
## Documentation

- [API Documentation](./docs/api/README.md)
- [React Native Integration Guide](./docs/react-native/README.md)
- [Migration from Python ADK](./docs/migration/README.md)
- [Examples and Tutorials](./examples/README.md)

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
npm run test:coverage
```

### Linting and Formatting

```bash
npm run lint
npm run format
```
# WILL BE IMPLEMENTED
## Examples

Check out the [examples directory](./examples/) for complete React Native applications demonstrating various ADK features:

- [Basic Chat App](./examples/basic-chat/)
- [Multi-Agent System](./examples/multi-agent/)
- [Device Integration](./examples/device-integration/)
- [Voice Assistant](./examples/voice-assistant/)

## Contributing

Please read our [Contributing Guide](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/google/agent-development-kit/issues)
- [Documentation](./docs/)
- [Python ADK Reference](../README.md)
