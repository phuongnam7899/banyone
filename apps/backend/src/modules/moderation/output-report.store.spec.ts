import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { OutputReportStore } from './output-report.store';

describe('OutputReportStore', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'banyone-moderation-store-'),
    );
    process.env.BANYONE_MODERATION_DATA_DIR = dataDir;
  });

  afterEach(() => {
    delete process.env.BANYONE_MODERATION_DATA_DIR;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('persists created reports to file-backed store', () => {
    const store = new OutputReportStore();
    const created = store.create({
      reportId: 'report-1',
      jobId: 'job-1',
      reporterUserId: 'user-1',
      reasonCategory: 'SPAM',
      details: 'contains spammy links',
      createdAt: '2026-04-05T12:00:00.000Z',
      traceId: 'trace-1',
    });

    expect(created).toEqual({
      reportId: 'report-1',
      jobId: 'job-1',
      reporterUserId: 'user-1',
      reasonCategory: 'SPAM',
      createdAt: '2026-04-05T12:00:00.000Z',
      traceId: 'trace-1',
    });

    const persistedPath = path.join(dataDir, 'output-reports.json');
    const persistedRaw = fs.readFileSync(persistedPath, 'utf-8');
    const persisted = JSON.parse(persistedRaw) as {
      reports_by_id: Record<
        string,
        { reason_category: string; job_id: string }
      >;
    };
    expect(persisted.reports_by_id['report-1']).toMatchObject({
      reason_category: 'SPAM',
      job_id: 'job-1',
    });
  });

  it('lists reports newest-first and supports filtering', () => {
    const store = new OutputReportStore();
    store.create({
      reportId: 'report-old',
      jobId: 'job-1',
      reporterUserId: 'user-1',
      reasonCategory: 'SPAM',
      createdAt: '2026-04-05T12:00:00.000Z',
      traceId: 'trace-old',
    });
    store.create({
      reportId: 'report-new',
      jobId: 'job-2',
      reporterUserId: 'user-2',
      reasonCategory: 'HATE',
      createdAt: '2026-04-05T13:00:00.000Z',
      traceId: 'trace-new',
    });

    const all = store.list({});
    expect(all.map((item) => item.reportId)).toEqual([
      'report-new',
      'report-old',
    ]);

    const filtered = store.list({ reasonCategory: 'SPAM' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].reportId).toBe('report-old');
  });

  it('gets a report by id', () => {
    const store = new OutputReportStore();
    store.create({
      reportId: 'report-1',
      jobId: 'job-1',
      reporterUserId: 'user-1',
      reasonCategory: 'SPAM',
      createdAt: '2026-04-05T12:00:00.000Z',
      traceId: 'trace-1',
    });

    expect(store.getById('report-1')).toMatchObject({
      reportId: 'report-1',
      jobId: 'job-1',
    });
    expect(store.getById('missing')).toBeNull();
  });
});
