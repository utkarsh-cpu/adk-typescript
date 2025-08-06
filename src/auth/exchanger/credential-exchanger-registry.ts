/**
 * Credential exchanger registry.
 */
import { experimental } from '@/utils';
import { AuthCredentialTypes } from '../auth-credential';
import { BaseCredentialExchanger } from './base-credential-exchanger';

/**
 * 
 * Registry for credential exchanger instances.
 */
@experimental()
export class CredentialExchangerRegistry {
  private _exchangers: Map<AuthCredentialTypes, BaseCredentialExchanger>;

  constructor() {
    this._exchangers = new Map<AuthCredentialTypes, BaseCredentialExchanger>();
  }

  /**
   * Register an exchanger instance for a credential type.
   *
   * @param credentialType - The credential type to register for.
   * @param exchangerInstance - The exchanger instance to register.
   */
  register(
    credentialType: AuthCredentialTypes,
    exchangerInstance: BaseCredentialExchanger
  ): void {
    this._exchangers.set(credentialType, exchangerInstance);
  }

  /**
   * Get the exchanger instance for a credential type.
   *
   * @param credentialType - The credential type to get exchanger for.
   * @returns The exchanger instance if registered, undefined otherwise.
   */
  getExchanger(credentialType: AuthCredentialTypes): BaseCredentialExchanger | undefined {
    return this._exchangers.get(credentialType);
  }

  /**
   * Check if an exchanger is registered for the given credential type.
   *
   * @param credentialType - The credential type to check.
   * @returns True if an exchanger is registered, false otherwise.
   */
  hasExchanger(credentialType: AuthCredentialTypes): boolean {
    return this._exchangers.has(credentialType);
  }

  /**
   * Unregister an exchanger for the given credential type.
   *
   * @param credentialType - The credential type to unregister.
   * @returns True if the exchanger was removed, false if it wasn't registered.
   */
  unregister(credentialType: AuthCredentialTypes): boolean {
    return this._exchangers.delete(credentialType);
  }

  /**
   * Get all registered credential types.
   *
   * @returns An array of all registered credential types.
   */
  getRegisteredTypes(): AuthCredentialTypes[] {
    return Array.from(this._exchangers.keys());
  }

  /**
   * Clear all registered exchangers.
   */
  clear(): void {
    this._exchangers.clear();
  }

  /**
   * Get the number of registered exchangers.
   *
   * @returns The count of registered exchangers.
   */
  get size(): number {
    return this._exchangers.size;
  }
}
