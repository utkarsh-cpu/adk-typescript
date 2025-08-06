/**
 * Base model interface - equivalent to Pydantic BaseModel
 */
export interface BaseModel {
  [key: string]: any;
}

/**
 * Type constructor for BaseModel classes
 */
export interface BaseModelConstructor {
  new (...args: any[]): BaseModel;
}