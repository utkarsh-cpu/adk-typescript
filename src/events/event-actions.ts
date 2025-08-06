/**
 * Event actions types
 * Based on Python ADK EventActions class
 */

import { AuthConfig } from '@/auth/auth-tool';

/**
 * Represents the actions attached to an event.
 * 
 *
 */
export class EventActions {
  /** If true, it won't call model to summarize function response */
  skipSummarization?: boolean;
  
  /** Indicates that the event is updating the state with the given delta */
  stateDelta: Record<string, any> = {};
  
  /** Indicates that the event is updating an artifact (key: filename, value: version) */
  artifactDelta: Record<string, number> = {};
  
  /** If set, the event transfers to the specified agent */
  transferToAgent?: string;
  
  /** The agent is escalating to a higher level agent */
  escalate?: boolean;
  
  /** Authentication configurations requested by tool responses */
  requestedAuthConfigs: Record<string, AuthConfig>= {};
  constructor(data?: Partial<EventActions>) {
    if (data) {
      // Handle alias mapping for backward compatibility
      const mappedData = this.mapAliases(data);
      this.validateNoExtraFields(mappedData);
      Object.assign(this, mappedData);
    }

    // Ensure default values for dict fields
    this.stateDelta = this.stateDelta || {};
    this.artifactDelta = this.artifactDelta || {};
    this.requestedAuthConfigs = this.requestedAuthConfigs || {};
  }

private mapAliases(data: any): any {
  const aliasMap: Record<string, string> = {
    'skip_summarization': 'skipSummarization',
    'state_delta': 'stateDelta',
    'artifact_delta': 'artifactDelta',
    'transfer_to_agent': 'transferToAgent',
    'requested_auth_configs': 'requestedAuthConfigs',
  };
  
  const mapped: any = {};
  for (const [key, value] of Object.entries(data)) {
    const mappedKey = aliasMap[key] || key;
    mapped[mappedKey] = value;
  }
  return mapped;
  }
  
  private validateNoExtraFields(data: any): void {
  const allowedFields = [
    'skipSummarization',
    'stateDelta',
    'artifactDelta',
    'transferToAgent',
    'escalate',
    'requestedAuthConfigs'
  ];
  
  const extraFields = Object.keys(data).filter(key => !allowedFields.includes(key));
  if (extraFields.length > 0) {
    throw new Error(`Extra fields not allowed in EventActions: ${extraFields.join(', ')}`);
  }
}
  /**
   * Creates EventActions from snake_case data
   */
  static fromSnakeCase(data: any): EventActions {
    return new EventActions(data);
  };

  toDict(): Record<string, any> {
    return {
      skipSummarization: this.skipSummarization,
      stateDelta: this.stateDelta,
      artifactDelta: this.artifactDelta,
      transferToAgent: this.transferToAgent,
      escalate: this.escalate,
      requestedAuthConfigs: this.requestedAuthConfigs,
    };
  }
}



