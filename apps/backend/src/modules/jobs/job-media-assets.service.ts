import { Injectable } from '@nestjs/common';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';

const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

@Injectable()
export class JobMediaAssetsService {
  private readonly rootDir: string;
  private readonly maxUploadSizeBytes: number;
  private readonly publicBaseUrl: string;

  constructor() {
    this.rootDir =
      process.env.BANYONE_MEDIA_ASSETS_DIR?.trim() ||
      path.join(process.cwd(), '.banyone-media-assets');
    mkdirSync(this.rootDir, { recursive: true });
    const maxUploadMb = Number(process.env.BANYONE_MEDIA_MAX_UPLOAD_MB ?? '50');
    this.maxUploadSizeBytes =
      Number.isFinite(maxUploadMb) && maxUploadMb > 0
        ? Math.floor(maxUploadMb * 1024 * 1024)
        : DEFAULT_MAX_UPLOAD_SIZE_BYTES;
    this.publicBaseUrl = (
      process.env.BANYONE_MEDIA_PUBLIC_BASE_URL?.trim() || 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  getPublicServeRoot(): string {
    return this.rootDir;
  }

  getMaxUploadSizeBytes(): number {
    return this.maxUploadSizeBytes;
  }

  persistUpload(params: {
    userId: string;
    slot: 'video' | 'image';
    originalName?: string;
    buffer: Buffer;
    mimeType?: string;
  }): {
    assetUrl: string;
    mimeType: string | null;
    sizeBytes: number;
    storedFilename: string;
  } {
    const extension = this.resolveExtension(params.originalName, params.mimeType);
    const filename = `${params.slot}-${params.userId}-${randomUUID()}${extension}`;
    const absolutePath = path.join(this.rootDir, filename);
    writeFileSync(absolutePath, params.buffer);

    return {
      assetUrl: `${this.publicBaseUrl}/v1/media/${filename}`,
      mimeType: params.mimeType ?? null,
      sizeBytes: params.buffer.byteLength,
      storedFilename: filename,
    };
  }

  /** True when `uri` is a URL served from this backend's `/v1/media/` store. */
  isManagedAssetUrl(uri: string | null | undefined): uri is string {
    if (typeof uri !== 'string' || !uri.trim()) return false;
    const prefix = `${this.publicBaseUrl}/v1/media/`;
    return uri.trim().startsWith(prefix);
  }

  /**
   * Read bytes for an asset previously returned by {@link persistUpload}.
   * Used to pass file content to Replicate via the official SDK (same pattern as ai_video_demo).
   */
  readUploadedAssetBuffer(assetUrl: string): Buffer {
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

  deleteByUrl(assetUrl: string | undefined): void {
    if (!assetUrl) return;
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

