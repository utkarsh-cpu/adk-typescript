// TODO: Implement in task 3.1
import { ReadonlyContext } from '@/agents/read-only-context';
import { Part } from '@google/genai';
import { AuthCredential } from '@/auth/auth-credential';
import { AuthConfig } from '@/auth/auth-tool';
import { EventActions } from '@/events/event-actions';
import { State } from '../sessions/state';
import type { InvocationContext } from '@/agents/invocation-context';

/**
 * The context of various callbacks within an agent run.
 */
export class CallbackContext extends ReadonlyContext {
  _event_actions: EventActions;
  private _state: State;

  constructor(
    invocation_context: InvocationContext,
    event_actions?: EventActions
  ) {
    super(invocation_context);

    // Dynamic imports would need to be handled differently in TS
    // Assuming EventActions and State are available in scope
    this._event_actions = event_actions || new EventActions();
    this._state = new State(
      invocation_context.session.state,
      this._event_actions.stateDelta,

    );
  }

  /**
   * The delta-aware state of the current session.
   * 
   * For any state change, you can mutate this object directly,
   * e.g. `ctx.state['foo'] = 'bar'`
   */
  get state(): State {
    return this._state;
  }

  /**
   * Loads an artifact attached to the current session.
   * 
   * @param filename - The filename of the artifact.
   * @param version - The version of the artifact. If undefined, the latest version will be returned.
   * @returns The artifact.
   */
  async loadArtifact(
    filename: string,
    version?: number
  ): Promise<Part | undefined> {
    if (this._invocationContext.artifactService === null) {
      throw new Error("Artifact service is not initialized.");
    }

    const result = await this._invocationContext.artifactService?.loadArtifact({
      appName: this._invocationContext.appName,
      userId: this._invocationContext.userId,
      sessionId: this._invocationContext.session.id,
      filename,
      version,
    });
    return result ?? undefined;
  }

  /**
   * Saves an artifact and records it as delta for the current session.
   * 
   * @param filename - The filename of the artifact.
   * @param artifact - The artifact to save.
   * @returns The version of the artifact.
   */
  async saveArtifact(filename: string, artifact: Part): Promise<number> {
    if (this._invocationContext.artifactService === null) {
      throw new Error("Artifact service is not initialized.");
    }

    const version = await this._invocationContext.artifactService?.saveArtifact({
      appName: this._invocationContext.appName,
      userId: this._invocationContext.userId,
      sessionId: this._invocationContext.session.id,
      filename,
      artifact,
    });

    if (version === undefined) {
      throw new Error("Failed to save artifact: version is undefined");
    }

    this._event_actions.artifactDelta[filename] = version;
    return version;
  }

  /**
   * Lists the filenames of the artifacts attached to the current session.
   */
  async listArtifacts(): Promise<string[]> {
    if (this._invocationContext.artifactService === null) {
      throw new Error("Artifact service is not initialized.");
    }

    const result = await this._invocationContext.artifactService?.listArtifactKeys({
      appName: this._invocationContext.appName,
      userId: this._invocationContext.userId,
      sessionId: this._invocationContext.session.id,
    });

    if (result === undefined) {
      throw new Error("Failed to list artifacts: result is undefined");
    }

    return result;
  }

  /**
   * Saves a credential to the credential service.
   * 
   * @param auth_config - The authentication configuration containing the credential.
   */
  async saveCredential(auth_config: AuthConfig): Promise<void> {
    if (this._invocationContext.credentialService === null) {
      throw new Error("Credential service is not initialized.");
    }

    await this._invocationContext.credentialService?.saveCredential(
      auth_config,
      this
    );
  }

  /**
   * Loads a credential from the credential service.
   * 
   * @param auth_config - The authentication configuration for the credential.
   * @returns The loaded credential, or undefined if not found.
   */
  async loadCredential(
    auth_config: AuthConfig
  ): Promise<AuthCredential | undefined> {
    if (this._invocationContext.credentialService === null) {
      throw new Error("Credential service is not initialized.");
    }

    const result = await this._invocationContext.credentialService?.loadCredential(
      auth_config,
      this
    );

    return result ?? undefined;
  }
}
