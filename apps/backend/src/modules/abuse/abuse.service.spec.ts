import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AbuseRestrictionStore } from './abuse-restriction.store';
import { AbuseService } from './abuse.service';

describe('AbuseService', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-abuse-service-'));
    process.env.BANYONE_ABUSE_DATA_DIR = dataDir;
    process.env.BANYONE_ABUSE_THRESHOLD_MAX_JOBS = '1';
    process.env.BANYONE_ABUSE_THRESHOLD_WINDOW_MS = '60000';
  });

  afterEach(() => {
    delete process.env.BANYONE_ABUSE_DATA_DIR;
    delete process.env.BANYONE_ABUSE_THRESHOLD_MAX_JOBS;
    delete process.env.BANYONE_ABUSE_THRESHOLD_WINDOW_MS;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('applies and clears manual restrictions with audit records', () => {
    const service = new AbuseService(new AbuseRestrictionStore());
    const apply = service.applyManualRestriction({
      actorUserId: 'mod-1',
      subjectType: 'account',
      subjectId: 'user-1',
      reason: 'abusive behavior',
    });
    if (apply.error) throw new Error('expected apply success');
    expect(apply.data.restriction.subjectId).toBe('user-1');

    const blocked = service.checkRestriction({
      userId: 'user-1',
      action: 'generation_job_create',
    });
    expect(blocked.blocked).toBe(true);

    const cleared = service.clearManualRestriction({
      actorUserId: 'mod-1',
      subjectType: 'account',
      subjectId: 'user-1',
      reason: 'appeal accepted',
    });
    if (cleared.error) throw new Error('expected clear success');
    expect(cleared.data.restriction.clearedBy).toBe('mod-1');

    const unblocked = service.checkRestriction({
      userId: 'user-1',
      action: 'generation_job_create',
    });
    expect(unblocked.blocked).toBe(false);
  });

  it('creates automated restriction when threshold is crossed', () => {
    const service = new AbuseService(new AbuseRestrictionStore());
    const first = service.evaluateAutomatedThreshold({ userId: 'user-2' });
    expect(first).toBeNull();

    const second = service.evaluateAutomatedThreshold({ userId: 'user-2' });
    expect(second).not.toBeNull();
    expect(second?.source).toBe('automated');

    const blocked = service.checkRestriction({
      userId: 'user-2',
      action: 'generation_job_create',
    });
    expect(blocked.blocked).toBe(true);
  });
});
