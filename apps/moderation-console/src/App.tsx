import { useMemo, useState } from 'react';
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import type {
  AbuseRestrictionEnvelope,
  AbuseRestrictionMutationEnvelope,
  AbuseSubjectType,
  CreateModerationActionRequest,
  ModerationActionEnvelope,
  ModerationQueueDetailEnvelope,
  ModerationQueueItem,
  ModerationQueueListEnvelope,
  SupportEscalationEnvelope,
  SupportEscalationListEnvelope,
  SupportJobDiagnosticsEnvelope,
  SupportRecoveryPlaybooksEnvelope,
} from '@banyone/contracts';

const backendBaseUrl =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() ||
  'http://localhost:3000';

function readFirebaseConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
      | string
      | undefined,
  };
}

function getFirebaseAuth() {
  const config = readFirebaseConfig();
  if (!config) return null;
  const app = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  return getAuth(app);
}

async function fetchWithBearer<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return (await response.json()) as T;
}

export function App() {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const [token, setToken] = useState('');
  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModerationQueueDetailEnvelope['data'] | null>(null);
  const [statusText, setStatusText] = useState('Not connected.');
  const [actionType, setActionType] =
    useState<CreateModerationActionRequest['actionType']>('DISMISS');
  const [notes, setNotes] = useState('');
  const [restrictionSubjectType, setRestrictionSubjectType] =
    useState<AbuseSubjectType>('account');
  const [restrictionSubjectId, setRestrictionSubjectId] = useState('');
  const [restrictionReason, setRestrictionReason] = useState('');
  const [activeRestriction, setActiveRestriction] =
    useState<AbuseRestrictionEnvelope['data'] | null>(null);
  const [supportJobId, setSupportJobId] = useState('');
  const [supportDiagnostics, setSupportDiagnostics] =
    useState<SupportJobDiagnosticsEnvelope['data'] | null>(null);
  const [supportPlaybook, setSupportPlaybook] =
    useState<SupportRecoveryPlaybooksEnvelope['data'] | null>(null);
  const [supportImpactSummary, setSupportImpactSummary] = useState('');
  const [supportEscalationStatus, setSupportEscalationStatus] = useState('');
  const [supportEscalations, setSupportEscalations] = useState<
    SupportEscalationListEnvelope['data']['items']
  >([]);

  const loadQueue = async () => {
    if (!token) {
      setStatusText('Missing ID token.');
      return;
    }
    const result = await fetchWithBearer<ModerationQueueListEnvelope>(
      '/v1/moderation/output-reports?page=1&pageSize=50',
      token,
      { method: 'GET' },
    );
    if (result.error) {
      setQueue([]);
      setStatusText(`Queue load failed: ${result.error.code}`);
      return;
    }
    setQueue(result.data.items);
    setStatusText(`Loaded ${result.data.items.length} reports.`);
  };

  const loadDetail = async (reportId: string) => {
    if (!token) return;
    setSelectedReportId(reportId);
    const result = await fetchWithBearer<ModerationQueueDetailEnvelope>(
      `/v1/moderation/output-reports/${reportId}`,
      token,
      { method: 'GET' },
    );
    if (result.error) {
      setDetail(null);
      setStatusText(`Detail load failed: ${result.error.code}`);
      return;
    }
    setDetail(result.data);
    setStatusText(`Loaded report ${reportId}.`);
  };

  const submitAction = async () => {
    if (!token || !selectedReportId) return;
    const result = await fetchWithBearer<ModerationActionEnvelope>(
      `/v1/moderation/output-reports/${selectedReportId}/actions`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          actionType,
          ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
        }),
      },
    );
    if (result.error) {
      setStatusText(`Action failed: ${result.error.code}`);
      return;
    }
    setStatusText('Action submitted.');
    setNotes('');
    await loadDetail(selectedReportId);
    await loadQueue();
  };

  const lookupRestriction = async () => {
    if (!token || !restrictionSubjectId.trim()) {
      setStatusText('Restriction lookup requires token and subject ID.');
      return;
    }
    const query = new URLSearchParams({
      subjectType: restrictionSubjectType,
      subjectId: restrictionSubjectId.trim(),
    });
    const result = await fetchWithBearer<AbuseRestrictionEnvelope>(
      `/v1/moderation/abuse-restrictions?${query.toString()}`,
      token,
      { method: 'GET' },
    );
    if (result.error) {
      setActiveRestriction(null);
      setStatusText(`Restriction lookup failed: ${result.error.code}`);
      return;
    }
    setActiveRestriction(result.data);
    setStatusText(result.data.restriction ? 'Active restriction loaded.' : 'No active restriction.');
  };

  const applyRestriction = async () => {
    if (!token || !restrictionSubjectId.trim() || !restrictionReason.trim()) {
      setStatusText('Apply restriction requires token, subject ID, and reason.');
      return;
    }
    const result = await fetchWithBearer<AbuseRestrictionMutationEnvelope>(
      '/v1/moderation/abuse-restrictions',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          subjectType: restrictionSubjectType,
          subjectId: restrictionSubjectId.trim(),
          reason: restrictionReason.trim(),
        }),
      },
    );
    if (result.error) {
      setStatusText(`Apply restriction failed: ${result.error.code}`);
      return;
    }
    setRestrictionReason('');
    setStatusText('Restriction applied.');
    await lookupRestriction();
  };

  const clearRestriction = async () => {
    if (!token || !restrictionSubjectId.trim()) {
      setStatusText('Clear restriction requires token and subject ID.');
      return;
    }
    const result = await fetchWithBearer<AbuseRestrictionMutationEnvelope>(
      '/v1/moderation/abuse-restrictions/clear',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          subjectType: restrictionSubjectType,
          subjectId: restrictionSubjectId.trim(),
          reason: 'Cleared from moderation console',
        }),
      },
    );
    if (result.error) {
      setStatusText(`Clear restriction failed: ${result.error.code}`);
      return;
    }
    setStatusText('Restriction cleared.');
    await lookupRestriction();
  };

  const loadSupportRecovery = async () => {
    if (!token || !supportJobId.trim()) {
      setStatusText('Support lookup requires token and job ID.');
      return;
    }

    const diagnosticsResult = await fetchWithBearer<SupportJobDiagnosticsEnvelope>(
      `/v1/support/job-diagnostics?jobId=${encodeURIComponent(supportJobId.trim())}`,
      token,
      { method: 'GET' },
    );
    if (diagnosticsResult.error) {
      setSupportDiagnostics(null);
      setSupportPlaybook(null);
      setStatusText(`Diagnostics lookup failed: ${diagnosticsResult.error.code}`);
      return;
    }

    setSupportDiagnostics(diagnosticsResult.data);
    const playbookQuery = new URLSearchParams({
      failureCategory: diagnosticsResult.data.failureCategory,
      ...(diagnosticsResult.data.failure?.reasonCode
        ? { reasonCode: diagnosticsResult.data.failure.reasonCode }
        : {}),
    });
    const playbookResult = await fetchWithBearer<SupportRecoveryPlaybooksEnvelope>(
      `/v1/support/recovery-playbooks?${playbookQuery.toString()}`,
      token,
      { method: 'GET' },
    );
    if (playbookResult.error) {
      setSupportPlaybook(null);
      setStatusText(`Playbook lookup failed: ${playbookResult.error.code}`);
      return;
    }

    setSupportPlaybook(playbookResult.data);
    setStatusText(`Loaded diagnostics and playbook for ${supportJobId.trim()}.`);
  };

  const createSupportEscalation = async () => {
    if (!token || !supportDiagnostics || !supportJobId.trim()) {
      setStatusText('Load support diagnostics before creating an escalation.');
      return;
    }

    const summary = supportImpactSummary.trim();
    if (summary.length < 20) {
      setStatusText('User impact summary must be at least 20 characters.');
      return;
    }

    const body = {
      jobId: supportJobId.trim(),
      userImpactSummary: summary,
      ...(supportPlaybook?.items[0]?.id
        ? { recoveryPlaybookId: supportPlaybook.items[0].id }
        : {}),
    };
    const result = await fetchWithBearer<SupportEscalationEnvelope>(
      '/v1/support/escalations',
      token,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
    if (result.error) {
      setStatusText(`Escalation create failed: ${result.error.code}`);
      return;
    }

    setSupportEscalationStatus(
      `Created escalation ${result.data.escalationId} (${result.data.status}).`,
    );
    setSupportImpactSummary('');
    await loadSupportEscalations();
  };

  const loadSupportEscalations = async () => {
    if (!token || !supportJobId.trim()) {
      setStatusText('Support escalation list requires token and job ID.');
      return;
    }
    const query = new URLSearchParams({
      jobId: supportJobId.trim(),
      limit: '10',
    });
    const result = await fetchWithBearer<SupportEscalationListEnvelope>(
      `/v1/support/escalations?${query.toString()}`,
      token,
      { method: 'GET' },
    );
    if (result.error) {
      setSupportEscalations([]);
      setStatusText(`Escalation list failed: ${result.error.code}`);
      return;
    }
    setSupportEscalations(result.data.items);
    setSupportEscalationStatus(`Loaded ${result.data.items.length} escalation(s).`);
  };

  const signInModerator = async () => {
    if (!auth) {
      setStatusText('Firebase config missing. Paste an ID token manually.');
      return;
    }
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();
    setToken(idToken);
    setStatusText(`Signed in as ${credential.user.email ?? credential.user.uid}.`);
  };

  const signOutModerator = async () => {
    if (auth) {
      await signOut(auth);
    }
    setToken('');
    setQueue([]);
    setDetail(null);
    setSelectedReportId(null);
    setStatusText('Signed out.');
  };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Banyone Moderation Console</h1>
      <p>{statusText}</p>

      <section style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={signInModerator}>Sign In With Firebase</button>
        <button onClick={signOutModerator}>Sign Out</button>
        <button onClick={loadQueue}>Load Queue</button>
      </section>

      <label style={{ display: 'block', marginBottom: 12 }}>
        Bearer token (dev/test override):
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          style={{ width: '100%', padding: 8, marginTop: 4 }}
          placeholder="Paste Firebase ID token if needed"
        />
      </label>

      <section style={{ border: '1px solid #ccc', padding: 12, marginBottom: 16 }}>
        <h2>Abuse Restrictions</h2>
        <p style={{ marginTop: 0 }}>
          `RESTRICT_RECOMMENDED` stays recommendation-only. Apply real restrictions here.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
          <label>Subject Type</label>
          <select
            value={restrictionSubjectType}
            onChange={(event) => setRestrictionSubjectType(event.target.value as AbuseSubjectType)}
          >
            <option value="account">account</option>
            <option value="device">device</option>
          </select>
          <label>Subject ID</label>
          <input
            value={restrictionSubjectId}
            onChange={(event) => setRestrictionSubjectId(event.target.value)}
            placeholder="Firebase UID or device ID"
          />
          <label>Reason</label>
          <input
            value={restrictionReason}
            onChange={(event) => setRestrictionReason(event.target.value)}
            placeholder="Required when applying"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={lookupRestriction}>Lookup</button>
          <button onClick={applyRestriction}>Apply</button>
          <button onClick={clearRestriction}>Clear</button>
        </div>
        {activeRestriction?.restriction ? (
          <pre style={{ background: '#f7f7f7', padding: 8, marginTop: 10 }}>
            {JSON.stringify(activeRestriction.restriction, null, 2)}
          </pre>
        ) : null}
      </section>

      <section style={{ border: '1px solid #ccc', padding: 12, marginBottom: 16 }}>
        <h2>Support Recovery Guidance</h2>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Job ID
          <input
            value={supportJobId}
            onChange={(event) => setSupportJobId(event.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
            placeholder="Enter job ID for diagnostics"
          />
        </label>
        <button onClick={loadSupportRecovery}>Load Diagnostics + Playbook</button>
        {supportDiagnostics ? (
          <div style={{ marginTop: 10 }}>
            <p>
              <strong>Failure Category:</strong> {supportDiagnostics.failureCategory}
            </p>
            <p>
              <strong>Trace ID:</strong> {supportDiagnostics.traceId}
            </p>
            <p>
              <strong>Reason Code:</strong>{' '}
              {supportDiagnostics.failure?.reasonCode ?? '(none)'}
            </p>
          </div>
        ) : null}
        {supportPlaybook?.items[0] ? (
          <div
            style={{
              marginTop: 10,
              background: '#f7f7f7',
              border: '1px solid #ddd',
              padding: 10,
            }}
          >
            <h3 style={{ marginTop: 0 }}>{supportPlaybook.items[0].title}</h3>
            <p style={{ marginTop: 0 }}>{supportPlaybook.items[0].summary}</p>
            <p>{supportPlaybook.items[0].explanation}</p>
            <p>
              <strong>Retry Guidance:</strong> {supportPlaybook.items[0].retryGuidance}
            </p>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {supportPlaybook.items[0].nextSteps
                .map((step, idx) => `${idx + 1}. ${step}`)
                .join('\n')}
            </pre>
          </div>
        ) : null}
        <div style={{ marginTop: 12, borderTop: '1px solid #ddd', paddingTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Escalation</h3>
          <label style={{ display: 'block', marginBottom: 8 }}>
            User impact summary (required, min 20 chars)
            <textarea
              value={supportImpactSummary}
              onChange={(event) => setSupportImpactSummary(event.target.value)}
              rows={3}
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Describe customer impact and urgency"
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createSupportEscalation}>Create Escalation</button>
            <button onClick={loadSupportEscalations}>Load Escalations</button>
          </div>
          {supportEscalationStatus ? (
            <p style={{ marginBottom: 0 }}>{supportEscalationStatus}</p>
          ) : null}
          {supportEscalations.length > 0 ? (
            <ul>
              {supportEscalations.map((item) => (
                <li key={item.escalationId}>
                  {item.escalationId} - {item.status} - {item.createdAt}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section>
          <h2>Queue</h2>
          {queue.length === 0 ? (
            <p>No reports loaded.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {queue.map((item) => (
                <li key={item.reportId} style={{ border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
                  <div>
                    <strong>{item.reasonCategory}</strong> - {item.reportId}
                  </div>
                  <div>Job: {item.jobId}</div>
                  <div>Owner: {item.job.userId ?? 'unknown'}</div>
                  <button onClick={() => loadDetail(item.reportId)}>Open</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Detail</h2>
          {!detail ? (
            <p>Select a report to view details.</p>
          ) : (
            <>
              <p>
                <strong>Report:</strong> {detail.reportId}
              </p>
              <p>
                <strong>Job:</strong> {detail.jobId} ({detail.job.status ?? 'missing'})
              </p>
              <p>
                <strong>Details:</strong> {detail.details ?? '(none)'}
              </p>

              <h3>Actions</h3>
              <ul>
                {detail.actions.map((action) => (
                  <li key={action.actionId}>
                    {action.createdAt} - {action.actionType} by {action.actorUserId}
                    {action.notes ? ` (${action.notes})` : ''}
                  </li>
                ))}
              </ul>

              <h3>Submit Action</h3>
              <label>
                Action Type
                <select
                  value={actionType}
                  onChange={(event) =>
                    setActionType(event.target.value as CreateModerationActionRequest['actionType'])
                  }
                >
                  <option value="DISMISS">DISMISS</option>
                  <option value="ESCALATE">ESCALATE</option>
                  <option value="RESTRICT_RECOMMENDED">RESTRICT_RECOMMENDED</option>
                </select>
              </label>
              <label style={{ display: 'block', marginTop: 8 }}>
                Notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  style={{ width: '100%' }}
                />
              </label>
              <button style={{ marginTop: 8 }} onClick={submitAction}>
                Submit Action
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
