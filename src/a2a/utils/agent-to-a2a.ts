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

import express, { Express } from "express";
import { InMemoryTaskStore, DefaultRequestHandler } from "@a2a-js/sdk/dist/server";
import { A2AExpressApp } from "./a2a-express-app";
import { BaseAgent } from "../../agents/base-agent";
import { AgentCardBuilder } from "./agent-card-builder";
import { A2aAgentExecutor } from "../executor/a2a-agent-executor";
import { Runner } from "../../runners";
import { InMemoryArtifactService } from "../../artifacts/in-memory-artifact-service";
import { InMemorySessionService } from "../../sessions/in-memory-session-service";
import { InMemoryMemoryService } from "../../memory/in-memory-memory-service";
import { InMemoryCredentialService } from "@/auth/credential_service";

/**
 * Convert an ADK agent to an A2A Express application.
 * @param agent - The ADK agent to convert.
 * @param options - Configuration options.
 * @returns An Express application that can be run with Node.js (e.g., app.listen(...))
 *
 * @example
 * ```typescript
 * const agent = new MyAgent();
 * const app = await toA2a(agent, { host: "localhost", port: 8000 });
 * app.listen(8000, () => console.log("A2A Agent running!"));
 * ```
 */
export async function toA2a(
  agent: BaseAgent,
  options: { host?: string; port?: number } = {}
): Promise<Express> {
  const { host = "localhost", port = 8000 } = options;

  // Create services and runner
  const adkRunner = new Runner({
    appName: agent.name || "adk_agent",
    agent,
    artifactService: new InMemoryArtifactService(new Map()),
    sessionService: new InMemorySessionService(),
    memoryService: new InMemoryMemoryService(),
    credentialService: new InMemoryCredentialService(),
  });

  // Runner adapter for A2aAgentExecutor
  const runnerAdapter = {
    appName: adkRunner.appName,
    sessionService: adkRunner.sessionService,
    runAsync: adkRunner.runAsync.bind(adkRunner),
    newInvocationContext: (options: any) => ({
      ...options,
      timestamp: new Date().toISOString(),
      agentName: adkRunner.appName,
    }),
  };

  // A2A SDK components
  const taskStore = new InMemoryTaskStore();
  const agentExecutor = new A2aAgentExecutor({ runner: runnerAdapter });
  const rpcUrl = `http://${host}:${port}/`;
  const cardBuilder = new AgentCardBuilder({
    agent,
    rpcUrl,
  });

  // Build agent card, then wire up server
  const agentCard = await cardBuilder.build();

  const requestHandler = new DefaultRequestHandler(
    agentCard,
    taskStore,
    agentExecutor
  );

  // Create Express app and add A2A routes
  const app = express();
  const a2aApp = new A2AExpressApp(requestHandler);
  a2aApp.setupRoutes(app);

  return app;
}