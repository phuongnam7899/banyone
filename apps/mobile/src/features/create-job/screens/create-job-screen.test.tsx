import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

jest.mock('@/features/create-job/hooks/use-job-input-selection', () => ({
  useJobInputSelection: () => ({
    state: { videoUri: null, videoLabel: null, imageUri: null, imageLabel: null },
    pickVideo: jest.fn(),
    pickImage: jest.fn(),
    clearVideo: jest.fn(),
    clearImage: jest.fn(),
  }),
}));

describe('CreateJobScreen', () => {
  it('exposes stable testIDs on primary pickers', () => {
    render(<CreateJobScreen colorScheme="light" />);
    expect(screen.getByTestId('create-job.screen')).toBeTruthy();
    expect(screen.getByTestId('create-job.upload-video.button')).toBeTruthy();
    expect(screen.getByTestId('create-job.upload-image.button')).toBeTruthy();
    expect(screen.getByTestId('create-job.requirements.section')).toBeTruthy();
  });
});
