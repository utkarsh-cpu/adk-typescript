import { AuthCredential } from '../auth-credential';
import { AuthConfig } from '../auth-tool';
import { CallbackContext } from '../../agents/callback-context';
import { experimental } from '../../utils/feature-decorator';

/**
 * Abstract class for Service that loads / saves tool credentials from / to
 * the backend credential store.
 */
@experimental()
export abstract class BaseCredentialService {
  /**
   * Loads the credential by auth config and current callback context from the
   * backend credential store.
   *
   * @param authConfig - The auth config which contains the auth scheme and auth
   * credential information. authConfig.getCredentialKey will be used to
   * build the key to load the credential.
   * 
   * @param callbackContext - The context of the current invocation when the tool is
   * trying to load the credential.
   *
   * @returns The credential saved in the store, or null if not found.
   */
  abstract loadCredential(
    authConfig: AuthConfig,
    callbackContext: CallbackContext
  ): Promise<AuthCredential | null>;

  /**
   * Saves the exchanged_auth_credential in auth config to the backend credential
   * store.
   *
   * @param authConfig - The auth config which contains the auth scheme and auth
   * credential information. authConfig.getCredentialKey will be used to
   * build the key to save the credential.
   * 
   * @param callbackContext - The context of the current invocation when the tool is
   * trying to save the credential.
   *
   * @returns Promise that resolves when the credential is saved.
   */
  abstract saveCredential(
    authConfig: AuthConfig,
    callbackContext: CallbackContext
  ): Promise<void>;
}
