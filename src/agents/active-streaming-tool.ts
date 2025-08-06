import { LiveRequestQueue } from './live-request-queue';

// Type for cancellable tasks
interface CancellableTask<T = any> {
  promise: Promise<T>;
  cancel: () => void;
  cancelled: boolean;
}

export class ActiveStreamingTool {
  /**
   * Manages streaming tool related resources during invocation.
   */

  /**
   * The active task of this streaming tool.
   */
  task?: CancellableTask;

  /**
   * The active (input) streams of this streaming tool.
   */
  stream?: LiveRequestQueue;

  constructor(data?: Partial<ActiveStreamingTool>) {
    if (data) {
      this.validateNoExtraFields(data);
      Object.assign(this, data);
    }
  }

  private validateNoExtraFields(data: any): void {
    const allowedFields = ['task', 'stream'];
    const extraFields = Object.keys(data).filter(key => !allowedFields.includes(key));
    if (extraFields.length > 0) {
      throw new Error(`Extra fields not allowed in ActiveStreamingTool: ${extraFields.join(', ')}`);
    }
  }

  /**
   * Sets a cancellable task
   */
  setTask<T>(taskPromise: Promise<T>, cancelFn?: () => void): void {
    this.task = {
      promise: taskPromise,
      cancel: cancelFn || (() => console.warn('No cancel function provided')),
      cancelled: false
    };
  }

  /**
   * Cancels the active task
   */
  async cancelTask(): Promise<void> {
    if (this.task && !this.task.cancelled) {
      this.task.cancel();
      this.task.cancelled = true;
      this.task = undefined;
    }
  }

  /**
   * Waits for the task to complete
   */
  async waitForTask<T>(): Promise<T | undefined> {
    if (this.task) {
      try {
        const result = await this.task.promise;
        this.task = undefined; // Clear completed task
        return result;
      } catch (error) {
        this.task = undefined; // Clear failed task
        throw error;
      }
    }
    return undefined;
  }

  /**
   * Checks if the task is currently running
   */
  isTaskActive(): boolean {
    return this.task !== undefined && !this.task.cancelled;
  }

  /**
   * Checks if the stream is active
   */
  isStreamActive(): boolean {
    return this.stream !== undefined;
  }

  /**
   * Cleans up resources
   */
  async cleanup(): Promise<void> {
    await this.cancelTask();
    if (this.stream) {
      // Assuming LiveRequestQueue has a cleanup method
      if (typeof this.stream.close === 'function') {
        await this.stream.close();
      }
      this.stream = undefined;
    }
  }
}
