import { State } from "@/sessions";
import { File } from "./code-execution-utils";


const _CONTEXT_KEY: string = '_code_execution_context'
const _SESSION_ID_KEY: string = 'execution_session_id'
const _PROCESSED_FILE_NAMES_KEY: string = 'processed_input_files'
const _INPUT_FILE_KEY: string = '_code_executor_input_files'
const _ERROR_COUNT_KEY: string = '_code_executor_error_counts'
const _CODE_EXECUTION_RESULTS_KEY: string = '_code_execution_results'

export class CodeExecutorContext {
    _context: Map<string, any>;
    _sessionState: State;
    constructor(sessionState: State) {
        this._context = this._getCodeExecutorContext(sessionState);
        this._sessionState = sessionState;
    }
    getStateDelta(): Map<string, any> {
        const contextToUpdate = structuredClone(this._context);
        return new Map([[_CONTEXT_KEY, contextToUpdate]]);
    }
    getExecutionId(): string | null {
        if (!this._context.has(_SESSION_ID_KEY)) {
            return null;
        }
        return this._context.get(_SESSION_ID_KEY);
    }
    setExecutionId(sessionId: string): void {
        this._context.set(_SESSION_ID_KEY, sessionId);
    }
    getProcessedFileName(): string[] {
        if (!this._context.has(_PROCESSED_FILE_NAMES_KEY)) {
            return [];
        }
        return this._context.get(_PROCESSED_FILE_NAMES_KEY);
    }
    /**
     * Adds the processed file name to the session state.
     * @param fileNames - The processed file names to add to the session state.
     */
    addProcessedFileNames(fileNames: string[]): void {
        if (!this._context.has(_PROCESSED_FILE_NAMES_KEY)) {
            this._context.set(_PROCESSED_FILE_NAMES_KEY, []);
        }
        const existingFiles = this._context.get(_PROCESSED_FILE_NAMES_KEY) as string[];
        existingFiles.push(...fileNames);
    }

    /**
     * Gets the code executor input file names from the session state.
     * @returns A list of input files in the code executor context.
     */
    getInputFiles(): File[] {
        if (!(_INPUT_FILE_KEY in this._sessionState)) {
            return [];
        }
        return (this._sessionState[_INPUT_FILE_KEY] as any[]).map(file =>
            new File(file.name, file.content, file.mimeType)
        );
    }

    /**
     * Adds the input files to the code executor context.
     * @param inputFiles - The input files to add to the code executor context.
     */
    addInputFiles(inputFiles: File[]): void {
        if (!(_INPUT_FILE_KEY in this._sessionState)) {
            this._sessionState[_INPUT_FILE_KEY] = [];
        }
        for (const inputFile of inputFiles) {
            (this._sessionState[_INPUT_FILE_KEY] as any[]).push({ ...inputFile });
        }
    }

    /**
     * Removes the input files and processed file names to the code executor context.
     */
    clearInputFiles(): void {
        if (_INPUT_FILE_KEY in this._sessionState) {
            this._sessionState[_INPUT_FILE_KEY] = [];
        }
        if (this._context.has(_PROCESSED_FILE_NAMES_KEY)) {
            this._context.set(_PROCESSED_FILE_NAMES_KEY, []);
        }
    }

    /**
     * Gets the error count from the session state.
     * @param invocationId - The invocation ID to get the error count for.
     * @returns The error count for the given invocation ID.
     */
    getErrorCount(invocationId: string): number {
        if (!(_ERROR_COUNT_KEY in this._sessionState)) {
            return 0;
        }
        const errorCounts = this._sessionState[_ERROR_COUNT_KEY] as Record<string, number>;
        return errorCounts[invocationId] || 0;
    }

    /**
     * Increments the error count from the session state.
     * @param invocationId - The invocation ID to increment the error count for.
     */
    incrementErrorCount(invocationId: string): void {
        if (!(_ERROR_COUNT_KEY in this._sessionState)) {
            this._sessionState[_ERROR_COUNT_KEY] = {};
        }
        const errorCounts = this._sessionState[_ERROR_COUNT_KEY] as Record<string, number>;
        errorCounts[invocationId] = this.getErrorCount(invocationId) + 1;
    }

    /**
     * Resets the error count from the session state.
     * @param invocationId - The invocation ID to reset the error count for.
     */
    resetErrorCount(invocationId: string): void {
        if (!(_ERROR_COUNT_KEY in this._sessionState)) {
            return;
        }
        const errorCounts = this._sessionState[_ERROR_COUNT_KEY] as Record<string, number>;
        if (invocationId in errorCounts) {
            delete errorCounts[invocationId];
        }
    }

    /**
     * Updates the code execution result.
     * @param invocationId - The invocation ID to update the code execution result for.
     * @param code - The code to execute.
     * @param resultStdout - The standard output of the code execution.
     * @param resultStderr - The standard error of the code execution.
     */
    updateCodeExecutionResult(
        invocationId: string,
        code: string,
        resultStdout: string,
        resultStderr: string
    ): void {
        if (!(_CODE_EXECUTION_RESULTS_KEY in this._sessionState)) {
            this._sessionState[_CODE_EXECUTION_RESULTS_KEY] = {};
        }
        const results = this._sessionState[_CODE_EXECUTION_RESULTS_KEY] as Record<string, any[]>;
        if (!(invocationId in results)) {
            results[invocationId] = [];
        }
        results[invocationId].push({
            code: code,
            result_stdout: resultStdout,
            result_stderr: resultStderr,
            timestamp: Math.floor(Date.now() / 1000)
        });
    }

    /**
     * Gets the code executor context from the session state.
     * @param sessionState - The session state to get the code executor context from.
     * @returns A Map of code executor context.
     */
    private _getCodeExecutorContext(sessionState: State): Map<string, any> {
        if (!(_CONTEXT_KEY in sessionState)) {
            sessionState[_CONTEXT_KEY] = {};
        }
        return new Map(Object.entries(sessionState[_CONTEXT_KEY] as Record<string, any>));
    }
}