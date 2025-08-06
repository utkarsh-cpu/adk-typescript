// TODO: Implement
import { Part } from "@google/genai";

export abstract class BaseArtifactService {
    abstract saveArtifact(params: {
        appName: string;
        userId: string;
        sessionId: string;
        filename: string;
        artifact: Part;
    }):Promise<number>;
    abstract loadArtifact(params: {
        appName: string;
        userId: string;
        sessionId: string;
        filename: string;
        version?: number | null;
    }): Promise<Part | null>;
    abstract listArtifactKeys(params: {
        appName: string;
        userId: string;
        sessionId: string;
      }): Promise<string[]>;
    abstract deleteArtifact(params: {
        appName: string;
        userId: string;
        sessionId: string;
        filename: string;
    }): Promise<void>;
    abstract listVersions(params: {
        appName: string;
        userId: string;
        sessionId: string;
        filename: string;
    }): Promise<number[]>;
}
