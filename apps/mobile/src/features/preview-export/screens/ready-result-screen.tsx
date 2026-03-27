import React from 'react';

import { PreviewExportPanel } from '@/features/preview-export/components/preview-export-panel';
import type { JobStatusPayload } from '@/features/job-status/types/job-status';

type Props = {
  jobStatus: JobStatusPayload;
  colorScheme: 'light' | 'dark';
};

export function ReadyResultScreen({ jobStatus, colorScheme }: Props) {
  return <PreviewExportPanel jobStatus={jobStatus} colorScheme={colorScheme} />;
}
