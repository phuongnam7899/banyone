import { validateJobInputCompliance } from '@banyone/contracts';

import {
  durationSecFromAssetDuration,
  extensionFromFileNameOrUri,
  mimeTypeFromExtension,
} from './use-job-input-selection';

describe('mime inference helpers', () => {
  it('maps .webp to image/webp (case-insensitive)', () => {
    expect(mimeTypeFromExtension('webp')).toBe('image/webp');
    expect(mimeTypeFromExtension('WEBP')).toBe('image/webp');
    expect(mimeTypeFromExtension(extensionFromFileNameOrUri('file:///a.WEBP?x=1'))).toBe('image/webp');
  });

  it('lets .webp images validate as supported when width/height are present', () => {
    const inferredMime = mimeTypeFromExtension('webp');

    const result = validateJobInputCompliance({
      video: {
        uri: null,
        durationSec: null,
        widthPx: null,
        heightPx: null,
        mimeType: null,
      },
      image: {
        uri: 'file:///ref.WEBP',
        widthPx: 4096,
        heightPx: 4096,
        mimeType: inferredMime,
      },
    });

    expect(result.image.status).toBe('valid');
  });

  it('converts picker video duration from milliseconds to seconds', () => {
    expect(durationSecFromAssetDuration(30_000)).toBe(30);
    expect(durationSecFromAssetDuration(120_400)).toBe(120.4);
    expect(durationSecFromAssetDuration(null)).toBeNull();
  });
});

