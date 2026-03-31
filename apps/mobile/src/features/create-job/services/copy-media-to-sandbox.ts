import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const SUBDIR = 'create-job-media';

function extensionFromLabelOrUri(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.split('?')[0];
  const lastSegment = clean.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === lastSegment.length - 1) return null;
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

function managedPrefix(): string | null {
  const base = documentDirectory;
  if (!base) return null;
  return `${base}${SUBDIR}/`;
}

export function isManagedSandboxUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  const prefix = managedPrefix();
  if (!prefix) return false;
  return uri.startsWith(prefix);
}

/**
 * Copies a picked asset into app sandbox so content:// / ph:// URIs survive restarts.
 * On web or when no document directory, returns the original URI.
 */
export async function copyPickedAssetToSandbox(params: {
  sourceUri: string;
  kind: 'video' | 'image';
  label: string | null;
}): Promise<{ uri: string }> {
  const { sourceUri, kind, label } = params;
  if (Platform.OS === 'web' || !documentDirectory) {
    return { uri: sourceUri };
  }

  const prefix = managedPrefix();
  if (!prefix) {
    return { uri: sourceUri };
  }

  await makeDirectoryAsync(prefix, { intermediates: true }).catch(() => undefined);

  const ext = extensionFromLabelOrUri(label ?? sourceUri) ?? (kind === 'video' ? 'mp4' : 'jpg');
  const dest = `${prefix}${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}.${ext}`;

  await copyAsync({ from: sourceUri, to: dest });
  return { uri: dest };
}

export async function deleteIfManagedLocalFile(uri: string | null | undefined): Promise<void> {
  if (!isManagedSandboxUri(uri)) return;
  try {
    await deleteAsync(uri as string, { idempotent: true });
  } catch {
    // ignore
  }
}
