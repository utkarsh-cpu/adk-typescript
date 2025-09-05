import { Content, Blob, ActivityEnd, ActivityStart } from '@google/genai';

export class LiveRequest {
  content?: Content;
  blob?: Blob;
  activityStart?: ActivityStart;
  activityEnd?: ActivityEnd;
  close: boolean = false;

  constructor(data?: Partial<LiveRequest>) {
    if (data) {
      this.validateNoExtraFields(data);
      Object.assign(this, data);
    }
  }
  private validateNoExtraFields(data: any): void {
    const allowedFields = [
      'content',
      'blob',
      'activityStart',
      'activityEnd',
      'close',
    ];
    const extraFields = Object.keys(data).filter(
      (key) => !allowedFields.includes(key)
    );
    if (extraFields.length > 0) {
      throw new Error(
        `Extra fields not allowed in LiveRequest: ${extraFields.join(', ')}`
      );
    }
  }

  /**
   * Creates LiveRequest from snake_case data for backward compatibility
   */
  static fromSnakeCase(data: any): LiveRequest {
    const mappedData = {
      content: data.content,
      blob: data.blob,
      activityStart: data.activity_start,
      activityEnd: data.activity_end,
      close: data.close || false,
    };
    return new LiveRequest(mappedData);
  }
}

export class LiveRequestQueue {
  private _queue: LiveRequest[] = [];
  private _waitingResolvers: Array<(value: LiveRequest) => void> = [];
  private _closed: boolean = false;

  constructor() {
    // TypeScript/JavaScript doesn't require explicit event loop management
    // The Promise-based implementation handles async operations naturally
  }
  close(): void {
    if (!this._closed) {
      this._closed = true;
      this.putNowait(new LiveRequest({ close: true }));
    }
  }
  sendContent(content: Content): void {
    this.putNowait(new LiveRequest({ content }));
  }
  sendRealtime(blob: Blob): void {
    this.putNowait(new LiveRequest({ blob }));
  }
  sendActivityStart(): void {
    this.putNowait(
      new LiveRequest({
        activityStart: {} as ActivityStart, // You may need to create proper ActivityStart instance
      })
    );
  }
  sendActivityEnd(): void {
    this.putNowait(
      new LiveRequest({
        activityEnd: {} as ActivityEnd, // You may need to create proper ActivityEnd instance
      })
    );
  }

  /**
   * Sends a LiveRequest to the queue.
   */
  send(req: LiveRequest): void {
    this.putNowait(req);
  }

  /**
   * Gets the next LiveRequest from the queue (async).
   */
  async get(): Promise<LiveRequest> {
    // If there are items in the queue, return immediately
    const item = this._queue.shift();
    if (item) {
      return item;
    }

    // Otherwise, wait for the next item
    return new Promise<LiveRequest>((resolve) => {
      this._waitingResolvers.push(resolve);
    });
  }

  private putNowait(item: LiveRequest): void {
    const resolver = this._waitingResolvers.shift();
    if (resolver) {
      // If someone is waiting, resolve their promise immediately
      resolver(item);
    } else {
      // Otherwise, add to queue
      this._queue.push(item);
    }
  }

  /**
   * Returns the current size of the queue.
   */
  size(): number {
    return this._queue.length;
  }

  /**
   * Checks if the queue is closed.
   */
  isClosed(): boolean {
    return this._closed;
  }
  /**
   * Clears all pending items and resolvers.
   */
  clear(): void {
    this._queue.length = 0;
    this._waitingResolvers.length = 0;
  }
}
