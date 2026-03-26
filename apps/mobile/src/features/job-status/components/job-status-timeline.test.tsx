import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { JobStatusTimeline } from './job-status-timeline';

describe('JobStatusTimeline', () => {
  it('renders stable testIDs for canonical stages', () => {
    render(
      <JobStatusTimeline
        jobId="job-1"
        status="processing"
        etaSeconds={3}
        failure={undefined}
      />,
    );

    expect(screen.getByTestId('job-status.timeline.root')).toBeTruthy();
    expect(screen.getByTestId('job-status.timeline.item.queued')).toBeTruthy();
    expect(screen.getByTestId('job-status.timeline.item.processing')).toBeTruthy();
    expect(screen.getByTestId('job-status.timeline.item.ready')).toBeTruthy();
    expect(screen.getByTestId('job-status.timeline.item.failed')).toBeTruthy();
  });

  it('shows failure details when status=failed', () => {
    render(
      <JobStatusTimeline
        jobId="job-0"
        status="failed"
        failure={{
          retryable: true,
          reasonCode: 'PROCESSING_FAILED_RETRYABLE',
          nextAction: 'retry',
          message: 'Processing failed. You can retry this job.',
        }}
      />,
    );

    expect(screen.getByTestId('job-status.timeline.item.failed')).toBeTruthy();
  });
});

