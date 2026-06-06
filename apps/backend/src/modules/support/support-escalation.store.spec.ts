import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SupportEscalationStore } from './support-escalation.store';

describe('SupportEscalationStore', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-support-esc-'));
    process.env.BANYONE_SUPPORT_DATA_DIR = dataDir;
  });

  afterEach(() => {
    delete process.env.BANYONE_SUPPORT_DATA_DIR;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('creates, gets, lists, and updates escalation records', () => {
    const store = new SupportEscalationStore();
    store.create({
      escalationId: 'esc-1',
      jobId: 'job-1',
      createdAt: '2026-04-05T00:00:00.000Z',
      traceId: 'trace-escalation-1',
      actorUserId: 'support-1',
      userImpactSummary:
        'Customer campaign launch is blocked while rendering repeatedly fails.',
      diagnosticsSnapshot: {
        jobId: 'job-1',
        status: 'failed',
        ownerUserId: 'user-1',
        updatedAt: '2026-04-05T00:00:00.000Z',
        traceId: 'trace-job-1',
        failureCategory: 'processing-retryable',
      },
      status: 'open',
      statusUpdatedAt: '2026-04-05T00:00:00.000Z',
    });

    const single = store.getById('esc-1');
    expect(single).toMatchObject({
      escalationId: 'esc-1',
      jobId: 'job-1',
      actorUserId: 'support-1',
      status: 'open',
    });

    const listed = store.list({ jobId: 'job-1', status: 'open' });
    expect(listed).toHaveLength(1);
    expect(listed[0].escalationId).toBe('esc-1');

    const updated = store.updateStatus({
      escalationId: 'esc-1',
      status: 'resolved',
      statusUpdatedAt: '2026-04-05T00:15:00.000Z',
      resolutionNotes: 'Escalated issue fixed after worker restart.',
    });
    expect(updated).toMatchObject({
      escalationId: 'esc-1',
      status: 'resolved',
      resolutionNotes: 'Escalated issue fixed after worker restart.',
    });
  });
});
