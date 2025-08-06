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
import type {
  AgentCapabilities,
  AgentProvider,
  SecurityScheme,
  AgentSkill,
  AgentCard
} from '@a2a-js/sdk';

// Agent type interfaces - these would be imported from agents
interface LlmAgent extends BaseAgent {
  instruction?: string;
  globalInstruction?: string;
  tools?: any[];
  planner?: any;
  codeExecutor?: any;
  generateContentConfig?: {
    responseModalities?: string[];
  };
  canonicalTools(): Promise<any[]>;
}

interface SequentialAgent extends BaseAgent {
  // Sequential agent specific properties
}

interface ParallelAgent extends BaseAgent {
  maxIterations?: number;
}

interface LoopAgent extends BaseAgent {
  maxIterations?: number;
}

// Tool interfaces
interface ExampleTool {
  examples: Array<{
    input: any;
    output: any[];
  }>;
}

/**
 * Builder class for creating agent cards from ADK agents.
 * 
 * This class provides functionality to convert ADK agents into A2A agent cards,
 * including extracting skills, capabilities, and metadata from various agent types.
 */
export class AgentCardBuilder {
  private agent: BaseAgent;
  private rpcUrl: string;
  private capabilities: AgentCapabilities;
  private docUrl?: string;
  private provider?: AgentProvider;
  private agentVersion: string;
  private securitySchemes?: Record<string, SecurityScheme>;

  constructor(options: {
    agent: BaseAgent;
    rpcUrl?: string;
    capabilities?: AgentCapabilities;
    docUrl?: string;
    provider?: AgentProvider;
    agentVersion?: string;
    securitySchemes?: Record<string, SecurityScheme>;
  }) {
    if (!options.agent) {
      throw new Error('Agent cannot be null or empty.');
    }

    this.agent = options.agent;
    this.rpcUrl = options.rpcUrl || 'http://localhost:80/a2a';
    this.capabilities = options.capabilities || {} as AgentCapabilities;
    this.docUrl = options.docUrl;
    this.provider = options.provider;
    this.securitySchemes = options.securitySchemes;
    this.agentVersion = options.agentVersion || '0.0.1';
  }

  /**
   * Build and return the complete agent card.
   */
  async build(): Promise<AgentCard> {
    try {
      const primarySkills = await this.buildPrimarySkills(this.agent);
      const subAgentSkills = await this.buildSubAgentSkills(this.agent);
      const allSkills = [...primarySkills, ...subAgentSkills];

      return {
        name: this.agent.name,
        description: this.agent.description || 'An ADK Agent',
        documentationUrl: this.docUrl,
        url: this.rpcUrl.replace(/\/$/, ''),
        version: this.agentVersion,
        protocolVersion: '1.0.0',
        capabilities: this.capabilities,
        skills: allSkills,
        defaultInputModes: ['text/plain'],
        defaultOutputModes: ['text/plain'],
        supportsAuthenticatedExtendedCard: false,
        provider: this.provider,
        securitySchemes: this.securitySchemes
      };
    } catch (error) {
      throw new Error(`Failed to build agent card for ${this.agent.name}: ${error}`);
    }
  }

  /**
   * Build skills for any agent type.
   */
  private async buildPrimarySkills(agent: BaseAgent): Promise<AgentSkill[]> {
    if (this.isLlmAgent(agent)) {
      return await this.buildLlmAgentSkills(agent as LlmAgent);
    } else {
      return await this.buildNonLlmAgentSkills(agent);
    }
  }

  /**
   * Build skills for LLM agent.
   */
  private async buildLlmAgentSkills(agent: LlmAgent): Promise<AgentSkill[]> {
    const skills: AgentSkill[] = [];

    // 1. Agent skill (main model skill)
    const agentDescription = this.buildLlmAgentDescriptionWithInstructions(agent);
    const agentExamples = await this.extractExamplesFromAgent(agent);

    skills.push({
      id: agent.name,
      name: 'model',
      description: agentDescription,
      examples: agentExamples,
      inputModes: this.getInputModes(agent),
      outputModes: this.getOutputModes(agent),
      tags: ['llm']
    });

    // 2. Tool skills
    if (agent.tools) {
      const toolSkills = await this.buildToolSkills(agent);
      skills.push(...toolSkills);
    }

    // 3. Planner skill
    if (agent.planner) {
      skills.push(this.buildPlannerSkill(agent));
    }

    // 4. Code executor skill
    if (agent.codeExecutor) {
      skills.push(this.buildCodeExecutorSkill(agent));
    }

    return skills;
  }

  /**
   * Build skills for all sub-agents.
   */
  private async buildSubAgentSkills(agent: BaseAgent): Promise<AgentSkill[]> {
    const subAgentSkills: AgentSkill[] = [];

    for (const subAgent of agent.subAgents || []) {
      try {
        const subSkills = await this.buildPrimarySkills(subAgent);
        for (const skill of subSkills) {
          // Create a new skill instance to avoid modifying original if shared
          const aggregatedSkill: AgentSkill = {
            id: `${subAgent.name}_${skill.id}`,
            name: `${subAgent.name}: ${skill.name}`,
            description: skill.description,
            examples: skill.examples,
            inputModes: skill.inputModes,
            outputModes: skill.outputModes,
            tags: [`sub_agent:${subAgent.name}`, ...(skill.tags || [])]
          };
          subAgentSkills.push(aggregatedSkill);
        }
      } catch (error) {
        // Log warning but continue with other sub-agents
        console.warn(`Warning: Failed to build skills for sub-agent ${subAgent.name}: ${error}`);
        continue;
      }
    }

    return subAgentSkills;
  }

  /**
   * Build skills for agent tools.
   */
  private async buildToolSkills(agent: LlmAgent): Promise<AgentSkill[]> {
    const toolSkills: AgentSkill[] = [];
    const canonicalTools = await agent.canonicalTools();

    for (const tool of canonicalTools) {
      // Skip example tools as they're handled separately
      if (this.isExampleTool(tool)) {
        continue;
      }

      const toolName = (tool.name && tool.name) || tool.constructor.name;

      toolSkills.push({
        id: `${agent.name}-${toolName}`,
        name: toolName,
        description: tool.description || `Tool: ${toolName}`,
        examples: undefined,
        inputModes: undefined,
        outputModes: undefined,
        tags: ['llm', 'tools']
      });
    }

    return toolSkills;
  }

  /**
   * Build planner skill for LLM agent.
   */
  private buildPlannerSkill(agent: LlmAgent): AgentSkill {
    return {
      id: `${agent.name}-planner`,
      name: 'planning',
      description: 'Can think about the tasks to do and make plans',
      examples: undefined,
      inputModes: undefined,
      outputModes: undefined,
      tags: ['llm', 'planning']
    };
  }

  /**
   * Build code executor skill for LLM agent.
   */
  private buildCodeExecutorSkill(agent: LlmAgent): AgentSkill {
    return {
      id: `${agent.name}-code-executor`,
      name: 'code-execution',
      description: 'Can execute code',
      examples: undefined,
      inputModes: undefined,
      outputModes: undefined,
      tags: ['llm', 'code_execution']
    };
  }

  /**
   * Build skills for non-LLM agents.
   */
  private async buildNonLlmAgentSkills(agent: BaseAgent): Promise<AgentSkill[]> {
    const skills: AgentSkill[] = [];

    // 1. Agent skill (main agent skill)
    const agentDescription = this.buildAgentDescription(agent);
    const agentExamples = await this.extractExamplesFromAgent(agent);

    // Determine agent type and name
    const agentType = this.getAgentType(agent);
    const agentName = this.getAgentSkillName(agent);

    skills.push({
      id: agent.name,
      name: agentName,
      description: agentDescription,
      examples: agentExamples,
      inputModes: this.getInputModes(agent),
      outputModes: this.getOutputModes(agent),
      tags: [agentType]
    });

    // 2. Sub-agent orchestration skill (for agents with sub-agents)
    if (agent.subAgents && agent.subAgents.length > 0) {
      const orchestrationSkill = this.buildOrchestrationSkill(agent, agentType);
      if (orchestrationSkill) {
        skills.push(orchestrationSkill);
      }
    }

    return skills;
  }

  /**
   * Build orchestration skill for agents with sub-agents.
   */
  private buildOrchestrationSkill(agent: BaseAgent, agentType: string): AgentSkill | null {
    const subAgentDescriptions: string[] = [];

    for (const subAgent of agent.subAgents || []) {
      const description = subAgent.description || 'No description';
      subAgentDescriptions.push(`${subAgent.name}: ${description}`);
    }

    if (subAgentDescriptions.length === 0) {
      return null;
    }

    return {
      id: `${agent.name}-sub-agents`,
      name: 'sub-agents',
      description: 'Orchestrates: ' + subAgentDescriptions.join('; '),
      examples: undefined,
      inputModes: undefined,
      outputModes: undefined,
      tags: [agentType, 'orchestration']
    };
  }

  /**
   * Get the agent type for tagging.
   */
  private getAgentType(agent: BaseAgent): string {
    if (this.isLlmAgent(agent)) {
      return 'llm';
    } else if (this.isSequentialAgent(agent)) {
      return 'sequential_workflow';
    } else if (this.isParallelAgent(agent)) {
      return 'parallel_workflow';
    } else if (this.isLoopAgent(agent)) {
      return 'loop_workflow';
    } else {
      return 'custom_agent';
    }
  }

  /**
   * Get the skill name based on agent type.
   */
  private getAgentSkillName(agent: BaseAgent): string {
    if (this.isLlmAgent(agent)) {
      return 'model';
    } else if (this.isSequentialAgent(agent) || this.isParallelAgent(agent) || this.isLoopAgent(agent)) {
      return 'workflow';
    } else {
      return 'custom';
    }
  }

  /**
   * Build agent description from agent.description and workflow-specific descriptions.
   */
  private buildAgentDescription(agent: BaseAgent): string {
    const descriptionParts: string[] = [];

    // Add agent description
    if (agent.description) {
      descriptionParts.push(agent.description);
    }

    // Add workflow-specific descriptions for non-LLM agents
    if (!this.isLlmAgent(agent)) {
      const workflowDescription = this.getWorkflowDescription(agent);
      if (workflowDescription) {
        descriptionParts.push(workflowDescription);
      }
    }

    return descriptionParts.length > 0
      ? descriptionParts.join(' ')
      : this.getDefaultDescription(agent);
  }

  /**
   * Build agent description including instructions for LlmAgents.
   */
  private buildLlmAgentDescriptionWithInstructions(agent: LlmAgent): string {
    const descriptionParts: string[] = [];

    // Add agent description
    if (agent.description) {
      descriptionParts.push(agent.description);
    }

    // Add instruction (with pronoun replacement) - only for LlmAgent
    if (agent.instruction) {
      const instruction = this.replacePronouns(agent.instruction);
      descriptionParts.push(instruction);
    }

    // Add global instruction (with pronoun replacement) - only for LlmAgent
    if (agent.globalInstruction) {
      const globalInstruction = this.replacePronouns(agent.globalInstruction);
      descriptionParts.push(globalInstruction);
    }

    return descriptionParts.length > 0
      ? descriptionParts.join(' ')
      : this.getDefaultDescription(agent);
  }

  /**
   * Replace pronouns and conjugate common verbs for agent description.
   * (e.g., "You are" -> "I am", "your" -> "my").
   */
  private replacePronouns(text: string): string {
    const pronounMap: Record<string, string> = {
      // Longer phrases with verb conjugations
      'you are': 'I am',
      'you were': 'I was',
      "you're": 'I am',
      "you've": 'I have',
      // Standalone pronouns
      'yours': 'mine',
      'your': 'my',
      'you': 'I'
    };

    // Sort keys by length (descending) to ensure longer phrases are matched first
    const sortedKeys = Object.keys(pronounMap).sort((a, b) => b.length - a.length);
    const pattern = new RegExp('\\b(' + sortedKeys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');

    return text.replace(pattern, (match) => pronounMap[match.toLowerCase()] || match);
  }

  /**
   * Get workflow-specific description for non-LLM agents.
   */
  private getWorkflowDescription(agent: BaseAgent): string | null {
    if (!agent.subAgents || agent.subAgents.length === 0) {
      return null;
    }

    if (this.isSequentialAgent(agent)) {
      return this.buildSequentialDescription(agent as SequentialAgent);
    } else if (this.isParallelAgent(agent)) {
      return this.buildParallelDescription(agent as ParallelAgent);
    } else if (this.isLoopAgent(agent)) {
      return this.buildLoopDescription(agent as LoopAgent);
    }

    return null;
  }

  /**
   * Build description for sequential workflow agent.
   */
  private buildSequentialDescription(agent: SequentialAgent): string {
    const descriptions: string[] = [];

    for (let i = 0; i < agent.subAgents.length; i++) {
      const subAgent = agent.subAgents[i];
      const subDescription = subAgent.description || `execute the ${subAgent.name} agent`;

      if (i === 0) {
        descriptions.push(`First, this agent will ${subDescription}`);
      } else if (i === agent.subAgents.length - 1) {
        descriptions.push(`Finally, this agent will ${subDescription}`);
      } else {
        descriptions.push(`Then, this agent will ${subDescription}`);
      }
    }

    return descriptions.join(' ') + '.';
  }

  /**
   * Build description for parallel workflow agent.
   */
  private buildParallelDescription(agent: ParallelAgent): string {
    const descriptions: string[] = [];

    for (let i = 0; i < agent.subAgents.length; i++) {
      const subAgent = agent.subAgents[i];
      const subDescription = subAgent.description || `execute the ${subAgent.name} agent`;

      if (i === 0) {
        descriptions.push(`This agent will ${subDescription}`);
      } else if (i === agent.subAgents.length - 1) {
        descriptions.push(`and ${subDescription}`);
      } else {
        descriptions.push(`, ${subDescription}`);
      }
    }

    return descriptions.join(' ') + ' simultaneously.';
  }

  /**
   * Build description for loop workflow agent.
   */
  private buildLoopDescription(agent: LoopAgent): string {
    const maxIterations = agent.maxIterations || 'unlimited';
    const descriptions: string[] = [];

    for (let i = 0; i < agent.subAgents.length; i++) {
      const subAgent = agent.subAgents[i];
      const subDescription = subAgent.description || `execute the ${subAgent.name} agent`;

      if (i === 0) {
        descriptions.push(`This agent will ${subDescription}`);
      } else if (i === agent.subAgents.length - 1) {
        descriptions.push(`and ${subDescription}`);
      } else {
        descriptions.push(`, ${subDescription}`);
      }
    }

    return `${descriptions.join(' ')} in a loop (max ${maxIterations} iterations).`;
  }

  /**
   * Get default description based on agent type.
   */
  private getDefaultDescription(agent: BaseAgent): string {
    if (this.isLlmAgent(agent)) {
      return 'An LLM-based agent';
    } else if (this.isSequentialAgent(agent)) {
      return 'A sequential workflow agent';
    } else if (this.isParallelAgent(agent)) {
      return 'A parallel workflow agent';
    } else if (this.isLoopAgent(agent)) {
      return 'A loop workflow agent';
    } else {
      return 'A custom agent';
    }
  }

  /**
   * Extract examples from example_tool if configured, otherwise from agent instruction.
   */
  private async extractExamplesFromAgent(agent: BaseAgent): Promise<string[] | undefined> {
    if (!this.isLlmAgent(agent)) {
      return undefined;
    }

    const llmAgent = agent as LlmAgent;

    // First, try to find example_tool in tools
    try {
      const canonicalTools = await llmAgent.canonicalTools();
      for (const tool of canonicalTools) {
        if (this.isExampleTool(tool)) {
          return this.convertExampleToolExamples(tool as ExampleTool);
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to extract examples from tools: ${error}`);
    }

    // If no example_tool found, try to extract examples from instruction
    if (llmAgent.instruction) {
      return this.extractExamplesFromInstruction(llmAgent.instruction);
    }

    return undefined;
  }

  /**
   * Convert ExampleTool examples to the expected format.
   */
  private convertExampleToolExamples(tool: ExampleTool): string[] {
    const examples: string[] = [];

    for (const example of tool.examples) {
      // Convert the example to a string representation
      const input = (example.input && typeof example.input === 'object' && 'modelDump' in example.input)
        ? (example.input as any).modelDump()
        : example.input;

      const output = example.output.map(output =>
        (output && typeof output === 'object' && 'modelDump' in output)
          ? (output as any).modelDump()
          : output
      );

      // Create a string representation of the example
      const exampleStr = `Input: ${JSON.stringify(input)}, Output: ${JSON.stringify(output)}`;
      examples.push(exampleStr);
    }

    return examples;
  }

  /**
   * Extract examples from agent instruction text using regex patterns.
   */
  private extractExamplesFromInstruction(instruction: string): string[] | undefined {
    const examples: string[] = [];

    // Look for common example patterns in instructions
    const examplePatterns = [
      /Example Query:\s*["']([^"']+)["']/gi,
      /Example Response:\s*["']([^"']+)["']/gi,
      /Example:\s*["']([^"']+)["']/gi
    ];

    for (const pattern of examplePatterns) {
      const matches = Array.from(instruction.matchAll(pattern));
      if (matches.length > 0) {
        for (let i = 0; i < matches.length; i += 2) {
          if (i + 1 < matches.length) {
            // Create a string representation of the example
            const exampleStr = `Query: "${matches[i][1]}", Response: "${matches[i + 1][1]}"`;
            examples.push(exampleStr);
          }
        }
      }
    }

    return examples.length > 0 ? examples : undefined;
  }

  /**
   * Get input modes based on agent model.
   */
  private getInputModes(agent: BaseAgent): string[] | undefined {
    if (!this.isLlmAgent(agent)) {
      return undefined;
    }

    // This could be enhanced to check model capabilities
    // For now, return undefined to use default_input_modes
    return undefined;
  }

  /**
   * Get output modes from Agent.generate_content_config.response_modalities.
   */
  private getOutputModes(agent: BaseAgent): string[] | undefined {
    if (!this.isLlmAgent(agent)) {
      return undefined;
    }

    const llmAgent = agent as LlmAgent;
    if (llmAgent.generateContentConfig?.responseModalities) {
      return llmAgent.generateContentConfig.responseModalities;
    }

    return undefined;
  }

  // Type guard methods
  private isLlmAgent(agent: BaseAgent): agent is LlmAgent {
    return 'instruction' in agent || 'tools' in agent;
  }

  private isSequentialAgent(agent: BaseAgent): agent is SequentialAgent {
    return agent.constructor.name === 'SequentialAgent';
  }

  private isParallelAgent(agent: BaseAgent): agent is ParallelAgent {
    return agent.constructor.name === 'ParallelAgent';
  }

  private isLoopAgent(agent: BaseAgent): agent is LoopAgent {
    return agent.constructor.name === 'LoopAgent';
  }

  private isExampleTool(tool: any): tool is ExampleTool {
    return tool && 'examples' in tool && Array.isArray(tool.examples);
  }
}