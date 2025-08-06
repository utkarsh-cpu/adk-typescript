import { Content } from "@google/genai";
import { InvocationContext } from "./invocation-context";

// Utility type for deep readonly
type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
  
export class ReadonlyContext {
    readonly _invocationContext: InvocationContext;
  
    constructor(invocationContext: InvocationContext) {
      this._invocationContext = invocationContext;
    }
  
    get userContent(): Content | undefined {
      return this._invocationContext.userContent;
    }
  
    get invocationId(): string {
      return this._invocationContext.invocationId;
    }
  
    get agentName(): string {
      return this._invocationContext.agent.name;
    }
  
    /**
     * Returns a deep readonly copy of the state
     */
    get state(): DeepReadonly<Record<string, any>> {
      return this.deepFreeze({ ...this._invocationContext.session.state });
    }
  
    private deepFreeze<T>(obj: T): DeepReadonly<T> {
      // Get the property names defined on obj
      Object.getOwnPropertyNames(obj).forEach((name) => {
        const value = (obj as any)[name];
        
        // Freeze properties before freezing self
        if (value && typeof value === 'object') {
          this.deepFreeze(value);
        }
      });
      
      return Object.freeze(obj) as DeepReadonly<T>;
    }
}
  