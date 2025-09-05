import { AsyncGeneratorContextManager } from 'contextlib/dist/src/generatorcm';
import { ContextError } from 'contextlib/dist/src/types';

export class Aclosing extends AsyncGeneratorContextManager<unknown> {
  constructor(async_generator: AsyncGenerator<unknown, unknown, unknown>) {
    super(async_generator);
  }

  override async enter(): Promise<unknown> {
    return this.gen;
  }

  // Prefer returning void/Promise<void>; the goal is deterministic cleanup
  // and not the IteratorResult from .return().
  override async exit(_error?: ContextError): Promise<boolean> {
    // Semantics: close the async generator so its `finally` runs, like Python's aclosing
    // Use an explicit value to satisfy lib types that require an argument (TS2554 fix)
    await this.gen.return?.(undefined);
    return false;
  }
}
