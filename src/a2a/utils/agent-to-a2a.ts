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

import { BaseAgent } from '../../agents/base-agent';
import { AgentCardBuilder } from './agent-card-builder';
import { A2aAgentExecutor } from '../executor/a2a-agent-executor';

// These would be imported from appropriate libraries
interface Runner {
  appName: string;
  agent: BaseAgent;
  artifactService: any;
  sessionService: any;
  memoryService: any;
  credentialService: any;
  runAsync(args: any): AsyncIterable<any>;
  newInvocationContext(options: any): any;
}

interface TaskStore {
  // Define task store interface
}

interface RequestHandler {
  // Define request handler interface
}

interface A2AStarletteApplication {
  addRoutesToApp(app: Application): void;
}

interface Application {
  addEventHandler(event: string, handler: () => Promise<void>): void;
}

// Service interfaces - these would be imported from their respective modules
interface InMemoryArtifactService {
  // Define artifact service interface
}

interface InMemorySessionService {
  // Define session service interface
}

interface InMemoryMemoryService {
  // Define memory service interface
}

interface InMemoryCredentialService {
  // Define credential service interface
}

interface InMemoryTaskStore extends TaskStore {
  // Define in-memory task store interface
}

interface DefaultRequestHandler extends RequestHandler {
  // Define default request handler interface
}

/**
 * Convert an ADK agent to a A2A Starlette application.
 * @param agent - The ADK agent to convert.
 * @param options - Configuration options.
 * @returns A Starlette application that can be run with uvicorn.
 * 
 * @example
 * ```typescript
 * const agent = new MyAgent();
 * const app = toA2a(agent, { host: "localhost", port: 8000 });
 * // Then run with: uvicorn module:app --host localhost --port 8000
 * ```
 */
export function toA2a(
  agent: BaseAgent,
  options: { host?: string; port?: number } = {}
): Application {
  const { host = 'localhost', port = 8000 } = options;

  // Set up ADK logging to ensure logs are visible when using uvicorn directly
  // This would be implemented based on the logging setup utility
  console.log('Setting up ADK logger for A2A application');

  /**
   * Create a runner for the agent.
   */
  async function createRunner(): Promise<Runner> {
    return {
      appName: agent.name || 'adk_agent',
      agent,
      // Use minimal services - in a real implementation these could be configured
      artifactService: {} as InMemoryArtifactService,
      sessionService: {} as InMemorySessionService,
      memoryService: {} as InMemoryMemoryService,
      credentialService: {} as InMemoryCredentialService
    };
  }

  // Create A2A components
  const _taskStore: InMemoryTaskStore = {} as InMemoryTaskStore;

  const _agentExecutor = new A2aAgentExecutor({
    runner: createRunner
  });

  const _requestHandler: DefaultRequestHandler = {
    // Implementation would depend on the actual request handler
  } as DefaultRequestHandler;

  // Build agent card
  const rpcUrl = `http://${host}:${port}/`;
  const cardBuilder = new AgentCardBuilder({
    agent,
    rpcUrl
  });

  // Create a Starlette app that will be configured during startup
  const app: Application = {
    addEventHandler: (event: string, handler: () => Promise<void>) => {
      // Implementation would depend on the web framework
      if (event === 'startup') {
        // Store the startup handler to be called when the app starts
        handler().catch(console.error);
      }
    }
  };

  // Add startup handler to build the agent card and configure A2A routes
  async function setupA2a(): Promise<void> {
    try {
      // Build the agent card asynchronously
      const _agentCard = await cardBuilder.build();

      // Create the A2A Starlette application
      const a2aApp: A2AStarletteApplication = {
        addRoutesToApp: (_targetApp: Application) => {
          // Implementation would add A2A routes to the target app
          console.log('Adding A2A routes to application');
        }
      };

      // Add A2A routes to the main app
      a2aApp.addRoutesToApp(app);
    } catch (error) {
      console.error('Failed to setup A2A application:', error);
      throw error;
    }
  }

  // Store the setup function to be called during startup
  app.addEventHandler('startup', setupA2a);

  return app;
}