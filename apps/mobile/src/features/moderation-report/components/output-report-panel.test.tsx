import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { OutputReportPanel } from './output-report-panel';

jest.mock('@/features/auth/auth-context', () => ({
  useBanyoneAuth: () => ({
    getIdToken: async () => 'test-token',
  }),
}));

function jsonFetchResponse(body: unknown, status = 200) {
  const serialized = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => serialized,
  };
}

describe('OutputReportPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn();
  });

  it('submits report and shows explicit confirmation', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch.mockResolvedValueOnce(
      jsonFetchResponse(
        {
          data: {
            reportId: 'report-1',
            jobId: 'job-9',
            reporterUserId: 'user-1',
            reasonCategory: 'SPAM',
            createdAt: new Date().toISOString(),
            traceId: 'trace-1',
          },
          error: null,
        },
        201,
      ),
    );

    render(<OutputReportPanel jobId="job-9" />);
    fireEvent.press(screen.getByTestId('job-result.report.open.button'));
    fireEvent.press(screen.getByTestId('job-result.report.category.SPAM'));
    fireEvent.press(screen.getByTestId('job-result.report.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-result.report.confirmation')).toBeTruthy();
    });

    expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/generation-jobs/job-9/reports'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows explicit error state when API returns canonical error envelope', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch.mockResolvedValueOnce(
      jsonFetchResponse(
        {
          data: null,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Generation job not found.',
            retryable: false,
            traceId: 'trace-404',
          },
        },
        201,
      ),
    );

    render(<OutputReportPanel jobId="job-404" />);
    fireEvent.press(screen.getByTestId('job-result.report.open.button'));
    fireEvent.press(screen.getByTestId('job-result.report.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-result.report.error')).toBeTruthy();
    });

    expect(screen.getByText(/Generation job not found\./)).toBeTruthy();
  });

  it('shows OUTPUT_REPORT_INVALID messaging when API rejects the payload', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch.mockResolvedValueOnce(
      jsonFetchResponse(
        {
          data: null,
          error: {
            code: 'OUTPUT_REPORT_INVALID',
            message:
              'Invalid report payload. reasonCategory is required and details may be up to 1000 characters.',
            retryable: false,
            traceId: 'trace-invalid',
          },
        },
        201,
      ),
    );

    render(<OutputReportPanel jobId="job-9" />);
    fireEvent.press(screen.getByTestId('job-result.report.open.button'));
    fireEvent.press(screen.getByTestId('job-result.report.category.OTHER'));
    fireEvent.press(screen.getByTestId('job-result.report.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-result.report.error')).toBeTruthy();
    });

    expect(screen.getByText(/Invalid report payload/)).toBeTruthy();
    expect(screen.getByText(/OUTPUT_REPORT_INVALID \(trace-invalid\)/)).toBeTruthy();
  });
});
