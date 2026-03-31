import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateJobDraftV1 } from '@banyone/contracts';
import { CREATE_JOB_DRAFT_SCHEMA_VERSION, isCreateJobDraftV1 } from '@banyone/contracts';

const STORAGE_KEY = '@banyone/create-job-draft/v1';

export async function loadCreateJobDraft(): Promise<CreateJobDraftV1 | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isCreateJobDraftV1(parsed)) return null;
    return {
      ...parsed,
      pendingIdempotencyKey: parsed.pendingIdempotencyKey ?? null,
    };
  } catch {
    return null;
  }
}

export async function saveCreateJobDraft(draft: CreateJobDraftV1): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export async function clearCreateJobDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function buildDraftPayload(
  partial: Omit<CreateJobDraftV1, 'schemaVersion' | 'savedAt'> & { savedAt?: string },
): CreateJobDraftV1 {
  return {
    schemaVersion: CREATE_JOB_DRAFT_SCHEMA_VERSION,
    savedAt: partial.savedAt ?? new Date().toISOString(),
    selection: partial.selection,
    pendingIdempotencyKey: partial.pendingIdempotencyKey ?? null,
  };
}
