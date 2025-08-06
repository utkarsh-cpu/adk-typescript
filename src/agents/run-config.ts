import type {
    SpeechConfig,
    AudioTranscriptionConfig,
    RealtimeInputConfig,
    ProactivityConfig,
    SessionResumptionConfig,
  } from '@google/genai';
  
  // TODO: Implement in task 3.1
  
  /**
   * Streaming mode options.
   */
  export enum StreamingMode {
    NONE = 'none',
    SSE = 'sse',
    BIDI = 'bidi',
  }
  
  /**
   * Configs for runtime behavior of agents.
   */
  export class RunConfig {
    /**
     * Speech configuration for the live agent.
     */
    speechConfig?: SpeechConfig;
  
    /**
     * The output modalities. If not set, it's default to AUDIO.
     */
    responseModalities?: string[];
  
    /**
     * Whether or not to save the input blobs as artifacts.
     */
    saveInputBlobsAsArtifacts: boolean = false;
  
    /**
     * Whether to support CFC (Compositional Function Calling). Only applicable for
     * StreamingMode.SSE. If it's true, the LIVE API will be invoked. Since only LIVE
     * API supports CFC.
     *
     * WARNING: This feature is experimental and its API or behavior may change
     * in future releases.
     */
    supportCfc: boolean = false;
  
    /**
     * Streaming mode, StreamingMode.NONE or StreamingMode.SSE or StreamingMode.BIDI.
     */
    streamingMode: StreamingMode = StreamingMode.NONE;
  
    /**
     * Output transcription for live agents with audio response.
     */
    outputAudioTranscription?: AudioTranscriptionConfig;
  
    /**
     * Input transcription for live agents with audio input from user.
     */
    inputAudioTranscription?: AudioTranscriptionConfig;
  
    /**
     * Realtime input config for live agents with audio input from user.
     */
    realtimeInputConfig?: RealtimeInputConfig;
  
    /**
     * If enabled, the model will detect emotions and adapt its responses accordingly.
     */
    enableAffectiveDialog?: boolean;
  
    /**
     * Configures the proactivity of the model. This allows the model to respond proactively to the input and to ignore irrelevant input.
     */
    proactivity?: ProactivityConfig;
  
    /**
     * Configures session resumption mechanism. Only support transparent session resumption mode now.
     */
    sessionResumption?: SessionResumptionConfig;
  
    private _maxLlmCalls: number = 500;
  
    constructor(init?: Partial<RunConfig>) {
      Object.assign(this, init);
      // Validate maxLlmCalls on initialization if provided
      if (init?.maxLlmCalls !== undefined) {
        this.maxLlmCalls = init.maxLlmCalls;
      }
    }
  
    /**
     * A limit on the total number of llm calls for a given run.
     *
     * Valid Values:
     *   - More than 0 and less than Number.MAX_SAFE_INTEGER: The bound on the number of llm
     *     calls is enforced, if the value is set in this range.
     *   - Less than or equal to 0: This allows for unbounded number of llm calls.
     */
    get maxLlmCalls(): number {
      return this._maxLlmCalls;
    }
  
    set maxLlmCalls(value: number) {
      if (value === Number.MAX_SAFE_INTEGER) {
        throw new Error(`maxLlmCalls should be less than ${Number.MAX_SAFE_INTEGER}.`);
      } else if (value <= 0) {
        console.warn(
          'maxLlmCalls is less than or equal to 0. This will result in ' +
          'no enforcement on total number of llm calls that will be made for a ' +
          'run. This may not be ideal, as this could result in a never ' +
          'ending communication between the model and the agent in certain cases.'
        );
      }
      this._maxLlmCalls = value;
    }
  }
  