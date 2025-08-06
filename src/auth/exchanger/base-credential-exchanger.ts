import { experimental } from "@/utils";
import { AuthCredential } from "../auth-credential";
import { AuthScheme } from "../auth-schemes";


/**
 * Base exception for credential exchange errors.
 */
export class CredentialExchangeError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'CredentialExchangeError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CredentialExchangeError);
    }
  }
}

/**
 * 
 * Base interface for credential exchangers.
 * 
 * Credential exchangers are responsible for exchanging credentials from
 * one format or scheme to another.
 */
@experimental()
export abstract class BaseCredentialExchanger {
  
  /**
   * Exchange credential if needed.
   * 
   * @param authCredential - The credential to exchange.
   * @param authScheme - The authentication scheme (optional, some exchangers don't need it).
   * @returns The exchanged credential.
   * @throws CredentialExchangeError - If credential exchange fails.
   */
  abstract exchange(
    authCredential: AuthCredential,
    authScheme?: AuthScheme
  ): Promise<AuthCredential>;
}
