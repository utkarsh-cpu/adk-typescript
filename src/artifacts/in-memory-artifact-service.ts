import { BaseArtifactService } from "./base-artifact-service";
import { Part } from "@google/genai";
// TODO: Implement
export class InMemoryArtifactService extends BaseArtifactService {
    artifacts: Map<string, Part[]>;
    constructor(artifacts: Map<string, Part[]>) {
        super();
        this.artifacts = artifacts;
    }
    _fileHasUserNamespace(filename: string) {
        return filename.startsWith('user:');
    }
    _artifactPath(appName: string, userId: string, sessionId: string, filename: string): string {
        if (this._fileHasUserNamespace(filename)) {
            return `${appName}/${userId}/user/${filename}`;
        }
        return `${appName}/${userId}/${sessionId}/${filename}`;
    }
    override async saveArtifact(params: { appName: string; userId: string; sessionId: string; filename: string; artifact: Part; }): Promise<number> {
        let path: string = this._artifactPath(params.appName, params.userId, params.sessionId, params.filename);
        if (!this.artifacts.has(path)) {
            this.artifacts.set(path, []);
        }
        const artifactArray = this.artifacts.get(path)!;
        const version = artifactArray.length;
        artifactArray.push(params.artifact);

        return version;
    }
    override async loadArtifact(params: { appName: string; userId: string; sessionId: string; filename: string; version?: number | null; }): Promise<Part | null> {
        let path: string = this._artifactPath(params.appName, params.userId, params.sessionId, params.filename);
        let versions = this.artifacts.get(path)
        if (!versions) {
            return null;
        }
        if (params.version == null) {
            params.version = -1;
        }
        return versions[params.version];
    }
    override async listArtifactKeys(params: { appName: string; userId: string; sessionId: string; }): Promise<string[]> {
        const sessionPrefix = `${params.appName}/${params.userId}/${params.sessionId}/`;
        const usernamespacePrefix = `${params.appName}/${params.userId}/user/`;
        const filenames: string[] = [];
        for (const path of this.artifacts.keys()) {
            if (path.startsWith(sessionPrefix)) {
                const filename = path.substring(sessionPrefix.length);
                filenames.push(filename);
            } else if (path.startsWith(usernamespacePrefix)) {
                const filename = path.substring(usernamespacePrefix.length);
                filenames.push(filename);
            }
        }

        return filenames.sort();
    }
    override async deleteArtifact(params: { appName: string; userId: string; sessionId: string; filename: string; }): Promise<void> {
        const path: string = this._artifactPath(params.appName, params.userId, params.sessionId, params.filename);
        if (!this.artifacts.has(path)) {
            return;
        }
        this.artifacts.delete(path);
    }
    override async listVersions(params: { appName: string; userId: string; sessionId: string; filename: string; }): Promise<number[]> {
        const path: string = this._artifactPath(params.appName, params.userId, params.sessionId, params.filename);
        const versions = this.artifacts.get(path);
        if (!versions) {
            return [];
        }
        return Array.from({ length: versions.length }, (_, i) => i);
    }
}
