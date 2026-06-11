/**
 * Integration smoke test against deployed Render API.
 * Usage: node scripts/test-render-integration.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.argv[2] ?? 'https://banyone-api.onrender.com').replace(
  /\/$/,
  '',
);
const firebaseApiKey = 'AIzaSyBhWhz4oL-SI2IOWaI4c6Y9EQs1orV3Uqk';
const testUid = `render-integration-${Date.now()}`;

const creds = JSON.parse(
  readFileSync(
    resolve(root, 'banyone-bce0f-firebase-adminsdk-fbsvc-721d6adeb7.json'),
    'utf8',
  ),
);

admin.initializeApp({
  credential: admin.credential.cert(creds),
  storageBucket: 'banyone-bce0f.firebasestorage.app',
});

async function getIdToken() {
  const customToken = await admin.auth().createCustomToken(testUid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `Firebase signInWithCustomToken failed: ${JSON.stringify(body)}`,
    );
  }
  return body.idToken;
}

async function api(path, options = {}) {
  const started = Date.now();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, ms: Date.now() - started };
}

function pass(label, detail) {
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail) {
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

const results = { passed: 0, failed: 0 };

function assertOk(label, condition, detail) {
  if (condition) {
    results.passed += 1;
    pass(label, detail);
  } else {
    results.failed += 1;
    fail(label, detail);
  }
}

console.log(`\nRender integration test → ${baseUrl}\n`);

const health = await api('/');
assertOk('GET / health', health.status === 200 && health.json.raw === 'Hello World!', `${health.status} (${health.ms}ms)`);

console.log('\nObtaining Firebase ID token for test user...');
const idToken = await getIdToken();
pass('Firebase auth', `uid=${testUid}`);

const authHeaders = {
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
};

const disclosure = await api('/v1/synthetic-media-disclosure/acknowledge', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ version: 'v1' }),
});
assertOk(
  'POST /v1/synthetic-media-disclosure/acknowledge',
  disclosure.status === 200 && disclosure.json?.data?.accepted === true,
  `${disclosure.status} (${disclosure.ms}ms)`,
);

const credits = await api('/v1/generation-jobs/credits', {
  headers: { Authorization: `Bearer ${idToken}` },
});
assertOk(
  'GET /v1/generation-jobs/credits',
  credits.status === 200 && credits.json?.data != null,
  `${credits.status} balance=${credits.json?.data?.balance ?? 'n/a'} (${credits.ms}ms)`,
);

const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0xff, 0xd9,
]);
const form = new FormData();
form.append('slot', 'image');
form.append(
  'file',
  new Blob([jpeg], { type: 'image/jpeg' }),
  'render-integration.jpg',
);

const uploadStarted = Date.now();
const uploadRes = await fetch(`${baseUrl}/v1/generation-jobs/assets`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${idToken}` },
  body: form,
});
const uploadJson = await uploadRes.json();
const uploadMs = Date.now() - uploadStarted;
const assetUrl = uploadJson?.data?.assetUrl ?? '';
assertOk(
  'POST /v1/generation-jobs/assets (Firebase Storage)',
  uploadRes.status === 201 &&
    assetUrl.includes('firebasestorage.googleapis.com'),
  `${uploadRes.status} url=${assetUrl.slice(0, 80)}... (${uploadMs}ms)`,
);

if (assetUrl) {
  const dl = await fetch(assetUrl);
  const dlBytes = (await dl.arrayBuffer()).byteLength;
  assertOk(
    'Download uploaded asset URL',
    dl.status === 200 && dlBytes > 0,
    `${dl.status} ${dlBytes} bytes`,
  );
}

console.log(`\n${results.passed} passed, ${results.failed} failed\n`);
process.exit(results.failed > 0 ? 1 : 0);
