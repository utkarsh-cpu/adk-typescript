import { ReadonlyContext } from "@/agents/read-only-context";
import { BaseTool } from ".";
import { LlmRequest } from "@/models";
import { ToolContext } from ".";

/**
 * Base interface for a predicate that defines the interface to decide whether a
 * tool should be exposed to LLM. Toolset implementer could consider whether to
 * accept such instance in the toolset's constructor and apply the predicate in
 * get_tools method.
 */
export interface ToolPredicate {
    /**
     * Decide whether the passed-in tool should be exposed to LLM based on the
     * current context. True if the tool is usable by the LLM.
     * It's used to filter tools in the toolset.
     */
    (tool: BaseTool, readonlyContext?: ReadonlyContext): boolean;
}

/**
 * Runtime type guard to check if an object implements ToolPredicate
 */
export function isToolPredicate(obj: any): obj is ToolPredicate {
    return typeof obj === 'function';
}

/**
 * Base class for toolset.
 * A toolset is a collection of tools that can be used by an agent.
 */
export abstract class BaseToolset {
    protected toolFilter?: ToolPredicate | string[];

    constructor(options: { toolFilter?: ToolPredicate | string[] } = {}) {
        this.toolFilter = options.toolFilter;
    }

    /**
     * Return all tools in the toolset based on the provided context.
     * 
     * @param readonlyContext Context used to filter tools available to the agent. 
     *                       If undefined, all tools in the toolset are returned.
     * @returns A list of tools available under the specified context.
     */
    abstract getTools(readonlyContext?: ReadonlyContext): Promise<BaseTool[]>;

    /**
     * Performs cleanup and releases resources held by the toolset.
     * 
     * NOTE:
     * This method is invoked, for example, at the end of an agent server's
     * lifecycle or when the toolset is no longer needed. Implementations
     * should ensure that any open connections, files, or other managed
     * resources are properly released to prevent leaks.
     */
    abstract close(): Promise<void>;

    /**
     * Check if a tool should be selected based on the current filter
     */
    protected isToolSelected(tool: BaseTool, readonlyContext: ReadonlyContext): boolean {
        if (!this.toolFilter) {
            return true;
        }

        if (isToolPredicate(this.toolFilter)) {
            return this.toolFilter(tool, readonlyContext);
        }

        if (Array.isArray(this.toolFilter)) {
            return this.toolFilter.includes(tool.name);
        }

        return false;
    }

    /**
     * Processes the outgoing LLM request for this toolset. This method will be
     * called before each tool processes the llm request.
     * 
     * Use cases:
     * - Instead of let each tool process the llm request, we can let the toolset
     *   process the llm request. e.g. ComputerUseToolset can add computer use
     *   tool to the llm request.
     * 
     * @param toolContext The context of the tool.
     * @param llmRequest The outgoing LLM request, mutable this method.
     */
    async processLlmRequest(options: {
        toolContext: ToolContext;
        llmRequest: LlmRequest;
    }): Promise<void> {
        // Default implementation does nothing
        // Subclasses can override this method
    }
}