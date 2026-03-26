import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { InputComplianceChecker } from '@/features/create-job/components/input-compliance-checker';
import type { SlotValidationResult } from '@banyone/contracts';

describe('InputComplianceChecker', () => {
  it('renders per-slot pending stage labels when metadata is absent', () => {
    const video: SlotValidationResult = { status: 'pending', violations: [] };
    const image: SlotValidationResult = { status: 'pending', violations: [] };

    const { getByTestId, queryByTestId } = render(
      <InputComplianceChecker
        colorScheme="light"
        video={video}
        image={image}
        onPickVideo={jest.fn()}
        onPickImage={jest.fn()}
      />,
    );

    expect(getByTestId('create-job.input-compliance-checker.video.stage.pending')).toBeTruthy();
    expect(getByTestId('create-job.input-compliance-checker.image.stage.pending')).toBeTruthy();

    expect(
      queryByTestId('create-job.input-compliance-checker.video.violation.INPUT_METADATA_UNAVAILABLE.message'),
    ).toBeNull();
  });

  it('renders invalid-with-fix violation message + recovery action and calls correct handler', () => {
    const video = {
      status: 'invalid-with-fix',
      violations: [
        {
          code: 'INPUT_VIDEO_DURATION_EXCEEDS_MAX',
          message: 'Source video duration must be <= 120 seconds.',
          fixAction: 'Pick a shorter video (<= 120 seconds).',
        },
      ],
    } satisfies SlotValidationResult;

    const image: SlotValidationResult = { status: 'pending', violations: [] };

    const onPickVideo = jest.fn();
    const onPickImage = jest.fn();

    const { getByTestId } = render(
      <InputComplianceChecker
        colorScheme="light"
        video={video}
        image={image}
        onPickVideo={onPickVideo}
        onPickImage={onPickImage}
      />,
    );

    const message = getByTestId(
      'create-job.input-compliance-checker.video.violation.INPUT_VIDEO_DURATION_EXCEEDS_MAX.message',
    );
    const actionBtn = getByTestId(
      'create-job.input-compliance-checker.video.violation.INPUT_VIDEO_DURATION_EXCEEDS_MAX.fix-action',
    );

    expect(message).toBeTruthy();
    fireEvent.press(actionBtn);
    expect(onPickVideo).toHaveBeenCalledTimes(1);
    expect(onPickImage).toHaveBeenCalledTimes(0);
  });

  it('renders multiple violations for the same slot even when codes repeat', () => {
    const video = {
      status: 'invalid-with-fix',
      violations: [
        {
          code: 'INPUT_VIDEO_DURATION_EXCEEDS_MAX',
          message: 'Source video duration must be <= 120 seconds (A).',
          fixAction: 'Pick a shorter video (<= 120 seconds).',
        },
        {
          code: 'INPUT_VIDEO_DURATION_EXCEEDS_MAX',
          message: 'Source video duration must be <= 120 seconds (B).',
          fixAction: 'Pick a shorter video (<= 120 seconds).',
        },
      ],
    } satisfies SlotValidationResult;

    const image: SlotValidationResult = { status: 'pending', violations: [] };

    const onPickVideo = jest.fn();
    const onPickImage = jest.fn();

    const { getAllByTestId } = render(
      <InputComplianceChecker
        colorScheme="light"
        video={video}
        image={image}
        onPickVideo={onPickVideo}
        onPickImage={onPickImage}
      />,
    );

    const messageTestId = 'create-job.input-compliance-checker.video.violation.INPUT_VIDEO_DURATION_EXCEEDS_MAX.message';
    const fixTestId = 'create-job.input-compliance-checker.video.violation.INPUT_VIDEO_DURATION_EXCEEDS_MAX.fix-action';

    const messages = getAllByTestId(messageTestId);
    const actions = getAllByTestId(fixTestId);

    expect(messages).toHaveLength(2);
    expect(actions).toHaveLength(2);

    fireEvent.press(actions[0]);
    fireEvent.press(actions[1]);

    expect(onPickVideo).toHaveBeenCalledTimes(2);
    expect(onPickImage).toHaveBeenCalledTimes(0);
  });

  it('renders multiple distinct violations for a slot', () => {
    const video = {
      status: 'invalid-with-fix',
      violations: [
        {
          code: 'INPUT_VIDEO_DURATION_EXCEEDS_MAX',
          message: 'Source video duration must be <= 120 seconds.',
          fixAction: 'Pick a shorter video (<= 120 seconds).',
        },
        {
          code: 'INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX',
          message: 'Source video resolution must be <= 1920×1080 pixels.',
          fixAction: 'Pick a smaller video (<= 1920×1080 pixels).',
        },
      ],
    } satisfies SlotValidationResult;

    const image: SlotValidationResult = { status: 'pending', violations: [] };

    const onPickVideo = jest.fn();
    const onPickImage = jest.fn();

    const { getByTestId } = render(
      <InputComplianceChecker
        colorScheme="light"
        video={video}
        image={image}
        onPickVideo={onPickVideo}
        onPickImage={onPickImage}
      />,
    );

    const durationMsg = getByTestId(
      'create-job.input-compliance-checker.video.violation.INPUT_VIDEO_DURATION_EXCEEDS_MAX.message',
    );
    const durationBtn = getByTestId(
      'create-job.input-compliance-checker.video.violation.INPUT_VIDEO_DURATION_EXCEEDS_MAX.fix-action',
    );

    const resolutionMsg = getByTestId(
      'create-job.input-compliance-checker.video.violation.INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX.message',
    );
    const resolutionBtn = getByTestId(
      'create-job.input-compliance-checker.video.violation.INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX.fix-action',
    );

    expect(durationMsg).toBeTruthy();
    expect(resolutionMsg).toBeTruthy();

    fireEvent.press(durationBtn);
    fireEvent.press(resolutionBtn);

    expect(onPickVideo).toHaveBeenCalledTimes(2);
    expect(onPickImage).toHaveBeenCalledTimes(0);
  });
});

