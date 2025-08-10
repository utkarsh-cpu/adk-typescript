import { Storage, Bucket } from '@google-cloud/storage';
import { Part } from '@google/genai';
import { BaseArtifactService } from './base-artifact-service';

/**
 * An artifact service implementation using Google Cloud Storage (GCS).
 */
export class GcsArtifactService extends BaseArtifactService {
  private readonly bucketName: string;
  private readonly storageClient: Storage;
  private readonly bucket: Bucket;

  /**
   * Initializes the GcsArtifactService.
   *
   * @param bucketName - The name of the bucket to use.
   * @param options - Options to pass to the Google Cloud Storage client.
   */
  constructor(bucketName: string, options?: any) {
    super();
    this.bucketName = bucketName;
    this.storageClient = new Storage(options);
    this.bucket = this.storageClient.bucket(this.bucketName);
  }

  public override async saveArtifact({
    appName,
    userId,
    sessionId,
    filename,
    artifact,
  }: {
    appName: string;
    userId: string;
    sessionId: string;
    filename: string;
    artifact: Part;
  }): Promise<number> {
    return await this._saveArtifact(
      appName,
      userId,
      sessionId,
      filename,
      artifact
    );
  }

  public override async loadArtifact({
    appName,
    userId,
    sessionId,
    filename,
    version,
  }: {
    appName: string;
    userId: string;
    sessionId: string;
    filename: string;
    version?: number;
  }): Promise<Part | null> {
    return await this._loadArtifact(
      appName,
      userId,
      sessionId,
      filename,
      version
    );
  }

  public override async listArtifactKeys({
    appName,
    userId,
    sessionId,
  }: {
    appName: string;
    userId: string;
    sessionId: string;
  }): Promise<string[]> {
    return await this._listArtifactKeys(appName, userId, sessionId);
  }

  public override async deleteArtifact({
    appName,
    userId,
    sessionId,
    filename,
  }: {
    appName: string;
    userId: string;
    sessionId: string;
    filename: string;
  }): Promise<void> {
    await this._deleteArtifact(appName, userId, sessionId, filename);
  }

  public override async listVersions({
    appName,
    userId,
    sessionId,
    filename,
  }: {
    appName: string;
    userId: string;
    sessionId: string;
    filename: string;
  }): Promise<number[]> {
    return await this._listVersions(appName, userId, sessionId, filename);
  }

  /**
   * Checks if the filename has a user namespace.
   *
   * @param filename - The filename to check.
   * @returns True if the filename has a user namespace (starts with "user:"), false otherwise.
   */
  private _fileHasUserNamespace(filename: string): boolean {
    return filename.startsWith('user:');
  }

  /**
   * Constructs the blob name in GCS.
   *
   * @param appName - The name of the application.
   * @param userId - The ID of the user.
   * @param sessionId - The ID of the session.
   * @param filename - The name of the artifact file.
   * @param version - The version of the artifact.
   * @returns The constructed blob name in GCS.
   */
  private _getBlobName(
    appName: string,
    userId: string,
    sessionId: string,
    filename: string,
    version: number | string
  ): string {
    if (this._fileHasUserNamespace(filename)) {
      return `${appName}/${userId}/user/${filename}/${version}`;
    }
    return `${appName}/${userId}/${sessionId}/${filename}/${version}`;
  }

  private async _saveArtifact(
    appName: string,
    userId: string,
    sessionId: string,
    filename: string,
    artifact: Part
  ): Promise<number> {
    const versions = await this._listVersions(
      appName,
      userId,
      sessionId,
      filename
    );
    const version = versions.length === 0 ? 0 : Math.max(...versions) + 1;

    const blobName = this._getBlobName(
      appName,
      userId,
      sessionId,
      filename,
      version
    );
    const file = this.bucket.file(blobName);

    const inline = artifact.inlineData;
    if (!inline?.data) {
      throw new Error('Artifact must have inline data');
    }

    // Convert to Buffer without instanceof on union
    let dataBuf: Buffer;
    if (typeof inline.data === 'string') {
      // Treat as base64 string
      dataBuf = Buffer.from(inline.data, 'base64');
    } else if (
      inline.data &&
      typeof inline.data === 'object' &&
      'byteLength' in inline.data
    ) {
      // Accept Uint8Array or any ArrayBufferView-like object
      const view = inline.data as ArrayBufferView;
      dataBuf = Buffer.from(
        new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
      );
    } else {
      throw new Error('Unsupported inline data type');
    }

    await file.save(dataBuf, {
      metadata: {
        contentType: inline.mimeType ?? 'application/octet-stream',
      },
    });

    return version;
  }

  private async _loadArtifact(
    appName: string,
    userId: string,
    sessionId: string,
    filename: string,
    version?: number
  ): Promise<Part | null> {
    let targetVersion = version;

    if (targetVersion === undefined) {
      const versions = await this._listVersions(
        appName,
        userId,
        sessionId,
        filename
      );
      if (versions.length === 0) {
        return null;
      }
      targetVersion = Math.max(...versions);
    }

    const blobName = this._getBlobName(
      appName,
      userId,
      sessionId,
      filename,
      targetVersion
    );
    const file = this.bucket.file(blobName);

    try {
      const [buffer] = await file.download();
      if (!buffer || buffer.length === 0) {
        return null;
      }

      const [metadata] = await file.getMetadata();
      const mimeType = metadata.contentType || 'application/octet-stream';

      return {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      } as Part;
    } catch {
      // Not found or other errors -> treat as missing
      return null;
    }
  }

  private async _listArtifactKeys(
    appName: string,
    userId: string,
    sessionId: string
  ): Promise<string[]> {
    const filenames = new Set<string>();

    // Session-specific artifacts
    const sessionPrefix = `${appName}/${userId}/${sessionId}/`;
    const [sessionFiles] = await this.bucket.getFiles({
      prefix: sessionPrefix,
    });

    for (const file of sessionFiles) {
      const parts = file.name.split('/');
      if (parts.length >= 2) {
        const fname = parts[parts.length - 2]; // Second to last
        if (fname) filenames.add(fname);
      }
    }

    // User namespace artifacts
    const userNamespacePrefix = `${appName}/${userId}/user/`;
    const [userFiles] = await this.bucket.getFiles({
      prefix: userNamespacePrefix,
    });

    for (const file of userFiles) {
      const parts = file.name.split('/');
      if (parts.length >= 2) {
        const fname = parts[parts.length - 2]; // Second to last
        if (fname) filenames.add(fname);
      }
    }

    return Array.from(filenames).sort();
  }

  private async _deleteArtifact(
    appName: string,
    userId: string,
    sessionId: string,
    filename: string
  ): Promise<void> {
    const versions = await this._listVersions(
      appName,
      userId,
      sessionId,
      filename
    );

    // Delete each version
    await Promise.all(
      versions.map(async (version) => {
        const blobName = this._getBlobName(
          appName,
          userId,
          sessionId,
          filename,
          version
        );
        const file = this.bucket.file(blobName);
        try {
          await file.delete({ ignoreNotFound: true });
        } catch {
          // Swallow errors; best-effort delete
        }
      })
    );
  }

  /**
   * Lists all available versions of an artifact.
   *
   * This method retrieves all versions of a specific artifact by querying GCS blobs
   * that match the constructed blob name prefix.
   */
  private async _listVersions(
    appName: string,
    userId: string,
    sessionId: string,
    filename: string
  ): Promise<number[]> {
    const prefix = this._getBlobName(appName, userId, sessionId, filename, '');
    const [files] = await this.bucket.getFiles({ prefix });

    const versions: number[] = [];
    for (const file of files) {
      const parts = file.name.split('/');
      const versionStr = parts[parts.length - 1]; // Last part
      const v = parseInt(versionStr, 10);
      if (!Number.isNaN(v)) {
        versions.push(v);
      }
    }

    return versions;
  }
}
