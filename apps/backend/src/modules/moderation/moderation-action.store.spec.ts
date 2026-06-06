import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ModerationActionStore } from './moderation-action.store';

describe('ModerationActionStore', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'banyone-moderation-actions-'),
    );
    process.env.BANYONE_MODERATION_DATA_DIR = dataDir;
  });

  afterEach(() => {
    delete process.env.BANYONE_MODERATION_DATA_DIR;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('appends actions and lists them in ascending createdAt order', () => {
    const store = new ModerationActionStore();
    store.append({
      actionId: 'action-2',
      reportId: 'report-1',
      jobId: 'job-1',
      actorUserId: 'mod-1',
      actionType: 'ESCALATE',
      createdAt: '2026-04-05T12:05:00.000Z',
      traceId: 'trace-2',
    });
    store.append({
      actionId: 'action-1',
      reportId: 'report-1',
      jobId: 'job-1',
      actorUserId: 'mod-1',
      actionType: 'DISMISS',
      createdAt: '2026-04-05T12:00:00.000Z',
      traceId: 'trace-1',
      notes: 'false positive',
    });

    const actions = store.listByReportId('report-1');
    expect(actions.map((action) => action.actionId)).toEqual([
      'action-1',
      'action-2',
    ]);
    expect(actions[0].notes).toBe('false positive');
  });
});
