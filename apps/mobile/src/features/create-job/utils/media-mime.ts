/** Pure helpers shared by picker flow and tests (no native side effects). */

export function extensionFromFileNameOrUri(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.split('?')[0];
  const lastSegment = clean.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === lastSegment.length - 1) return null;
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

export function mimeTypeFromExtension(ext: string | null): string | null {
  if (!ext) return null;

  const normalized = ext.toLowerCase();

  switch (normalized) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'ogg':
      return 'video/ogg';

    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'heic':
    case 'heif':
      return 'image/heic';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

export function durationSecFromAssetDuration(durationMs: number | null | undefined): number | null {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  return durationMs / 1000;
}
