// AuthConfig.ts

import { AuthCredential } from '@/auth';
import { AuthScheme } from '@/auth';

/**
 * The auth config sent by tool asking client to collect auth credentials and
 *
 * adk and client will help to fill in the response
 */
export class AuthConfig {
    /** The auth scheme used to collect credentials */
    authScheme: AuthScheme;

    /**
     * The raw auth credential used to collect credentials. The raw auth
     * credentials are used in some auth scheme that needs to exchange auth
     * credentials. e.g. OAuth2 and OIDC. For other auth scheme, it could be None.
     */
    rawAuthCredential?: AuthCredential | null;

    /**
     * The exchanged auth credential used to collect credentials. adk and client
     * will work together to fill it. For those auth scheme that doesn't need to
     * exchange auth credentials, e.g. API key, service account etc. It's filled by
     * client directly. For those auth scheme that need to exchange auth credentials,
     * e.g. OAuth2 and OIDC, it's first filled by adk. If the raw credentials
     * passed by tool only has client id and client credential, adk will help to
     * generate the corresponding authorization uri and state and store the processed
     * credential in this field. If the raw credentials passed by tool already has
     * authorization uri, state, etc. then it's copied to this field. Client will use
     * this field to guide the user through the OAuth2 flow and fill auth response in
     * this field
     */
    exchangedAuthCredential?: AuthCredential | null;

    /**
     * A user specified key used to load and save this credential in a credential
     * service.
     */
    credentialKey?: string | null;

    constructor(data: {
        authScheme: AuthScheme;
        rawAuthCredential?: AuthCredential | null;
        exchangedAuthCredential?: AuthCredential | null;
        credentialKey?: string | null;
    }) {
        this.authScheme = data.authScheme;
        this.rawAuthCredential = data.rawAuthCredential ?? null;
        this.exchangedAuthCredential = data.exchangedAuthCredential ?? null;
        this.credentialKey = data.credentialKey ?? this.getCredentialKey();
    }

    /**
     * @deprecated This method is deprecated. Use credentialKey instead.
     *
     * Builds a hash key based on authScheme and rawAuthCredential used to
     * save / load this credential to / from a credentials service.
     */
    getCredentialKey(): string {
        let schemeName = "";
        if (this.authScheme) {
            // Mimic deep copy and clearing modelExtra
            const authSchemeCopy = { ...this.authScheme } as any;
            if (authSchemeCopy.modelExtra) {
                authSchemeCopy.modelExtra = {};
            }
            const schemeJson = JSON.stringify(authSchemeCopy);
            schemeName = `${this.authScheme.type}_${this.hashCode(schemeJson)}`;
        }

        let credentialName = "";
        if (this.rawAuthCredential) {
            const authCredentialCopy = { ...this.rawAuthCredential } as any;
            if (authCredentialCopy.modelExtra) {
                authCredentialCopy.modelExtra = {};
            }
            const credentialJson = JSON.stringify(authCredentialCopy);
            credentialName = `${this.rawAuthCredential.authType}_${this.hashCode(credentialJson)}`;
        }

        return `adk_${schemeName}_${credentialName}`;
    }

    // Simple hash function to simulate Python's hash
    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const chr = str.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
}

/**
 * The arguments for the special long running function tool that is used to
 * request end user credentials.
 */
export class AuthToolArguments {
    functionCallId: string;
    authConfig: AuthConfig;

    constructor(data: { functionCallId: string; authConfig: AuthConfig }) {
        this.functionCallId = data.functionCallId;
        this.authConfig = data.authConfig;
    }
}
