/**
 * Agent runners and execution utilities
 */

export interface Runner {
  runAgent(agent: any, context: any): Promise<any>;
}

export class InMemoryRunner implements Runner {
  async runAgent(agent: any, context: any): Promise<any> {
    // TODO: Implement in-memory runner
    throw new Error('Not implemented');
  }
}

export class ReactNativeRunner implements Runner {
  async runAgent(agent: any, context: any): Promise<any> {
    // TODO: Implement React Native optimized runner
    throw new Error('Not implemented');
  }
}