import AsyncStorage from '@react-native-async-storage/async-storage';
import { CREATE_JOB_DRAFT_SCHEMA_VERSION } from '@banyone/contracts';

import {
  clearCreateJobDraft,
  loadCreateJobDraft,
  saveCreateJobDraft,
} from '@/features/create-job/services/job-draft-storage';

describe('job-draft-storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips a draft payload', async () => {
    const draft = {
      schemaVersion: CREATE_JOB_DRAFT_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      selection: {
        videoUri: 'file:///a.mp4',
        videoLabel: 'a.mp4',
        videoDurationSec: 1,
        videoWidthPx: 1,
        videoHeightPx: 1,
        videoMimeType: 'video/mp4',
        imageUri: 'file:///b.jpg',
        imageLabel: 'b.jpg',
        imageWidthPx: 2,
        imageHeightPx: 2,
        imageMimeType: 'image/jpeg',
      },
      pendingIdempotencyKey: 'idem_test',
    };
    await saveCreateJobDraft(draft);
    const loaded = await loadCreateJobDraft();
    expect(loaded).toEqual(draft);
  });

  it('clearCreateJobDraft removes storage', async () => {
    await saveCreateJobDraft({
      schemaVersion: CREATE_JOB_DRAFT_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      selection: {
        videoUri: null,
        videoLabel: null,
        videoDurationSec: null,
        videoWidthPx: null,
        videoHeightPx: null,
        videoMimeType: null,
        imageUri: null,
        imageLabel: null,
        imageWidthPx: null,
        imageHeightPx: null,
        imageMimeType: null,
      },
      pendingIdempotencyKey: null,
    });
    await clearCreateJobDraft();
    expect(await loadCreateJobDraft()).toBeNull();
  });
});
