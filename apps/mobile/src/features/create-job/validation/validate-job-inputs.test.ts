import {
  MAX_REFERENCE_IMAGE_HEIGHT_PX,
  MAX_REFERENCE_IMAGE_WIDTH_PX,
  MAX_SOURCE_VIDEO_DURATION_SEC,
  MAX_SOURCE_VIDEO_HEIGHT_PX,
  MAX_SOURCE_VIDEO_WIDTH_PX,
  getCreateJobConstraintBullets,
  validateJobInputCompliance,
} from '@banyone/contracts';

describe('validateJobInputCompliance', () => {
  const formatsBulletBody = (() => {
    const bullet = getCreateJobConstraintBullets().find((b) => b.key === 'formats');
    return bullet?.body ?? '';
  })();

  it('returns pending for a slot with no uri selected', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: null,
        durationSec: null,
        widthPx: null,
        heightPx: null,
        mimeType: null,
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('pending');
    expect(result.video.violations).toHaveLength(0);

    expect(result.image.status).toBe('valid');
    expect(result.image.violations).toHaveLength(0);
  });

  it('returns INPUT_VIDEO_DURATION_EXCEEDS_MAX when duration is too long', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: MAX_SOURCE_VIDEO_DURATION_SEC + 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/mp4',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_VIDEO_DURATION_EXCEEDS_MAX');
    expect(result.video.violations[0].message).toContain(String(MAX_SOURCE_VIDEO_DURATION_SEC));
    expect(result.video.violations[0].fixAction).toContain(`<= ${MAX_SOURCE_VIDEO_DURATION_SEC}`);
  });

  it('returns INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX when width/height exceed', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX + 1,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/mp4',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX');
    expect(result.video.violations[0].message).toContain(String(MAX_SOURCE_VIDEO_WIDTH_PX));
    expect(result.video.violations[0].fixAction).toContain(String(MAX_SOURCE_VIDEO_HEIGHT_PX));
  });

  it('returns INPUT_METADATA_UNAVAILABLE when selected video uri exists but duration metadata is missing', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: null,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/mp4',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_METADATA_UNAVAILABLE');
    expect(result.video.violations[0].fixAction.toLowerCase()).toContain('pick');
  });

  it('returns INPUT_IMAGE_RESOLUTION_EXCEEDS_MAX when reference image width/height exceed', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/mp4',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX + 1,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.image.status).toBe('invalid-with-fix');
    expect(result.image.violations[0].code).toBe('INPUT_IMAGE_RESOLUTION_EXCEEDS_MAX');
    expect(result.image.violations[0].message).toContain(String(MAX_REFERENCE_IMAGE_WIDTH_PX));
    expect(result.image.violations[0].fixAction).toContain(String(MAX_REFERENCE_IMAGE_HEIGHT_PX));
  });

  it('returns INPUT_VIDEO_FORMAT_UNSUPPORTED when video mimeType is not in supported descriptors', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.bin',
        durationSec: 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'application/octet-stream',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_VIDEO_FORMAT_UNSUPPORTED');
    expect(result.video.violations[0].message).toBe(`Source video format is not supported. Supported: ${formatsBulletBody}`);
    expect(result.video.violations[0].fixAction).toContain(`Supported: ${formatsBulletBody}`);
  });

  it('returns INPUT_IMAGE_FORMAT_UNSUPPORTED when image mimeType is not in supported descriptors', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/mp4',
      },
      image: {
        uri: 'file:///ref.gif',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/gif',
      },
    });

    expect(result.image.status).toBe('invalid-with-fix');
    expect(result.image.violations[0].code).toBe('INPUT_IMAGE_FORMAT_UNSUPPORTED');
    expect(result.image.violations[0].message).toBe(
      `Reference image format is not supported. Supported: ${formatsBulletBody}`,
    );
  });

  it('returns INPUT_METADATA_UNAVAILABLE when video duration is NaN', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: Number.NaN,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/mp4',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_METADATA_UNAVAILABLE');
  });

  it('returns INPUT_METADATA_UNAVAILABLE when video duration is Infinity', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: Number.POSITIVE_INFINITY,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/mp4',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_METADATA_UNAVAILABLE');
  });

  it('returns INPUT_METADATA_UNAVAILABLE when width/height are negative', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: 1,
        widthPx: -1,
        heightPx: -1,
        mimeType: 'video/mp4',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_METADATA_UNAVAILABLE');
  });

  it('returns INPUT_METADATA_UNAVAILABLE when mimeType is malformed token (no slash)', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.bin',
        durationSec: 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_METADATA_UNAVAILABLE');
  });

  it('accepts comma-separated mime alternatives when at least one supported', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/mp4, video/quicktime',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('valid');
    expect(result.image.status).toBe('valid');
  });

  it('returns INPUT_VIDEO_FORMAT_UNSUPPORTED when comma-separated mime alternatives contain none supported', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'video/x-unknown, video/y-unknown',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations[0].code).toBe('INPUT_VIDEO_FORMAT_UNSUPPORTED');
  });

  it('returns multiple violations in deterministic order (duration, resolution, format)', () => {
    const result = validateJobInputCompliance({
      video: {
        uri: 'file:///source.mp4',
        durationSec: MAX_SOURCE_VIDEO_DURATION_SEC + 1,
        widthPx: MAX_SOURCE_VIDEO_WIDTH_PX + 1,
        heightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
        mimeType: 'application/octet-stream',
      },
      image: {
        uri: 'file:///ref.jpg',
        widthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
        heightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
        mimeType: 'image/jpeg',
      },
    });

    expect(result.video.status).toBe('invalid-with-fix');
    expect(result.video.violations.map((v) => v.code)).toEqual([
      'INPUT_VIDEO_DURATION_EXCEEDS_MAX',
      'INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX',
      'INPUT_VIDEO_FORMAT_UNSUPPORTED',
    ]);
  });
});

