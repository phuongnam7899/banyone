import { Injectable } from '@nestjs/common';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { getDownloadURL, getStorage } from 'firebase-admin/storage';

import { getOrInitializeFirebaseAdminApp } from '../../infra/firebase-admin-app';

const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const STORAGE_OBJECT_PREFIX = 'media';

type PersistUploadResult = {
  assetUrl: string;
  mimeType: string | null;
  sizeBytes: number;
  storedFilename: string;
};

@Injectable()
export class JobMediaAssetsService {
  private readonly rootDir: string;
  private readonly maxUploadSizeBytes: number;
  private readonly publicBaseUrl: string;
  private readonly storageBucket: string | null;

  constructor() {
    this.storageBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim() || null;
    this.rootDir =
      process.env.BANYONE_MEDIA_ASSETS_DIR?.trim() ||
      path.join(process.cwd(), '.banyone-media-assets');
    if (!this.storageBucket) {
      mkdirSync(this.rootDir, { recursive: true });
    }
    const maxUploadMb = Number(process.env.BANYONE_MEDIA_MAX_UPLOAD_MB ?? '50');
    this.maxUploadSizeBytes =
      Number.isFinite(maxUploadMb) && maxUploadMb > 0
        ? Math.floor(maxUploadMb * 1024 * 1024)
        : DEFAULT_MAX_UPLOAD_SIZE_BYTES;
    this.publicBaseUrl = (
      process.env.BANYONE_MEDIA_PUBLIC_BASE_URL?.trim() ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  usesFirebaseStorage(): boolean {
    return this.storageBucket !== null;
  }

  getPublicServeRoot(): string {
    return this.rootDir;
  }

  getMaxUploadSizeBytes(): number {
    return this.maxUploadSizeBytes;
  }

  async persistUpload(params: {
    userId: string;
    slot: 'video' | 'image';
    originalName?: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<PersistUploadResult> {
    const extension = this.resolveExtension(
      params.originalName,
      params.mimeType,
    );
    const filename = `${params.slot}-${params.userId}-${randomUUID()}${extension}`;

    if (this.storageBucket) {
      return this.persistUploadToStorage({
        filename,
        buffer: params.buffer,
        mimeType: params.mimeType,
      });
    }

    const absolutePath = path.join(this.rootDir, filename);
    writeFileSync(absolutePath, params.buffer);

    return {
      assetUrl: `${this.publicBaseUrl}/v1/media/${filename}`,
      mimeType: params.mimeType ?? null,
      sizeBytes: params.buffer.byteLength,
      storedFilename: filename,
    };
  }

  /** True when `uri` is a URL served from this backend's managed media store. */
  isManagedAssetUrl(uri: string | null | undefined): uri is string {
    if (typeof uri !== 'string' || !uri.trim()) return false;
    const trimmed = uri.trim();
    if (this.storageBucket) {
      const bucketMarker = `/v0/b/${this.storageBucket}/o/`;
      if (trimmed.includes(bucketMarker)) return true;
      const gcsPrefix = `https://storage.googleapis.com/${this.storageBucket}/`;
      if (trimmed.startsWith(gcsPrefix)) return true;
    }
    return trimmed.startsWith(`${this.publicBaseUrl}/v1/media/`);
  }

  /**
   * Read bytes for an asset previously returned by {@link persistUpload}.
   * Used to pass file content to Replicate via the official SDK.
   */
  async readUploadedAssetBuffer(assetUrl: string): Promise<Buffer> {
    if (this.storageBucket && this.isFirebaseStorageUrl(assetUrl)) {
      const objectPath = this.parseStorageObjectPath(assetUrl);
      const [buffer] = await getStorage(getOrInitializeFirebaseAdminApp())
        .bucket(this.storageBucket)
        .file(objectPath)
        .download();
      return buffer;
    }

    const prefix = `${this.publicBaseUrl}/v1/media/`;
    const trimmed = assetUrl.trim();
    if (!trimmed.startsWith(prefix)) {
      throw new Error('ASSET_URL_NOT_MANAGED');
    }
    const suffix = trimmed.slice(prefix.length);
    const filename = path.basename(suffix);
    if (!filename || filename !== suffix || suffix.includes('..')) {
      throw new Error('INVALID_ASSET_FILENAME');
    }
    const absolutePath = path.join(this.rootDir, filename);
    const resolvedRoot = path.resolve(this.rootDir);
    const resolvedFile = path.resolve(absolutePath);
    const rel = path.relative(resolvedRoot, resolvedFile);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('INVALID_ASSET_PATH');
    }
    return readFileSync(resolvedFile);
  }

  async deleteByUrl(assetUrl: string | undefined): Promise<void> {
    if (!assetUrl) return;

    if (this.storageBucket && this.isFirebaseStorageUrl(assetUrl)) {
      try {
        const objectPath = this.parseStorageObjectPath(assetUrl);
        await getStorage(getOrInitializeFirebaseAdminApp())
          .bucket(this.storageBucket)
          .file(objectPath)
          .delete({ ignoreNotFound: true });
      } catch {
        // best-effort cleanup
      }
      return;
    }

    const prefix = `${this.publicBaseUrl}/v1/media/`;
    if (!assetUrl.startsWith(prefix)) return;
    const filename = assetUrl.slice(prefix.length);
    if (!filename) return;
    try {
      unlinkSync(path.join(this.rootDir, filename));
    } catch {
      // best-effort cleanup
    }
  }

  private async persistUploadToStorage(params: {
    filename: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<PersistUploadResult> {
    const bucketName = this.storageBucket as string;
    const objectPath = `${STORAGE_OBJECT_PREFIX}/${params.filename}`;
    const bucket = getStorage(getOrInitializeFirebaseAdminApp()).bucket(
      bucketName,
    );
    const file = bucket.file(objectPath);
    await file.save(params.buffer, {
      resumable: false,
      metadata: {
        contentType: params.mimeType ?? 'application/octet-stream',
      },
    });
    const assetUrl = await getDownloadURL(file);
    return {
      assetUrl,
      mimeType: params.mimeType ?? null,
      sizeBytes: params.buffer.byteLength,
      storedFilename: params.filename,
    };
  }

  private isFirebaseStorageUrl(uri: string): boolean {
    const trimmed = uri.trim();
    if (!this.storageBucket) return false;
    return (
      trimmed.includes(`/v0/b/${this.storageBucket}/o/`) ||
      trimmed.startsWith(
        `https://storage.googleapis.com/${this.storageBucket}/`,
      )
    );
  }

  private parseStorageObjectPath(assetUrl: string): string {
    const trimmed = assetUrl.trim();
    const gcsPrefix = `https://storage.googleapis.com/${this.storageBucket}/`;
    if (trimmed.startsWith(gcsPrefix)) {
      const objectPath = trimmed.slice(gcsPrefix.length).split('?')[0] ?? '';
      if (!objectPath || objectPath.includes('..')) {
        throw new Error('INVALID_ASSET_PATH');
      }
      return decodeURIComponent(objectPath);
    }

    const bucketMarker = `/v0/b/${this.storageBucket}/o/`;
    const markerIndex = trimmed.indexOf(bucketMarker);
    if (markerIndex < 0) {
      throw new Error('ASSET_URL_NOT_MANAGED');
    }
    const encodedPath =
      trimmed.slice(markerIndex + bucketMarker.length).split('?')[0] ?? '';
    const objectPath = decodeURIComponent(encodedPath);
    if (!objectPath || objectPath.includes('..')) {
      throw new Error('INVALID_ASSET_PATH');
    }
    return objectPath;
  }

  private resolveExtension(
    originalName: string | undefined,
    mimeType: string | undefined,
  ): string {
    const fromName = originalName?.trim();
    if (fromName && fromName.includes('.')) {
      const ext = path.extname(fromName).toLowerCase();
      if (ext.length > 1 && ext.length <= 8) return ext;
    }
    if (mimeType?.startsWith('video/')) return '.mp4';
    if (mimeType?.startsWith('image/')) return '.jpg';
    return '';
  }
}
