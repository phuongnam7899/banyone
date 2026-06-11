/**
 * Validates Android dev-build prerequisites and prints / runs EAS steps.
 * Usage: node scripts/setup-android-dev.mjs [--build]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(root, '../..');
const runBuild = process.argv.includes('--build');

const firebaseAdminKey = resolve(
  repoRoot,
  'apps/backend/banyone-bce0f-firebase-adminsdk-fbsvc-721d6adeb7.json',
);

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function runEas(args) {
  const result = spawnSync('npx', ['eas-cli', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  return result.status === 0;
}

function readEnvKeys() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return [];
  const text = readFileSync(envPath, 'utf8');
  return [...text.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]);
}

console.log('\nAndroid dev build setup\n');

const requiredEnv = [
  'EXPO_PUBLIC_BACKEND_URL',
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];
const envKeys = new Set(readEnvKeys());
for (const key of requiredEnv) {
  if (envKeys.has(key)) pass(`${key} present in apps/mobile/.env`);
  else fail(`Missing ${key} in apps/mobile/.env`);
}

for (const file of ['eas.json', 'google-services.json', 'app.json']) {
  if (existsSync(resolve(root, file))) pass(file);
  else fail(`Missing apps/mobile/${file}`);
}

if (existsSync(firebaseAdminKey)) {
  pass('Firebase Admin key found for FCM V1 upload');
} else {
  fail(
    `Firebase Admin key not found at ${firebaseAdminKey} (needed for eas credentials FCM)`,
  );
}

const appJson = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8'));
if (appJson.expo?.scheme === 'com.banyone') {
  pass('app.json scheme is com.banyone (Google OAuth redirect)');
} else {
  fail(`app.json scheme should be com.banyone, got ${appJson.expo?.scheme}`);
}

if (!appJson.expo?.plugins?.includes('expo-dev-client')) {
  fail('expo-dev-client plugin missing from app.json');
} else {
  pass('expo-dev-client plugin configured');
}

console.log('\nEAS auth\n');
const loggedIn = runEas(['whoami']);
if (!loggedIn) {
  console.log('\nNot logged in to Expo yet. Next steps:');
  console.log('  1. npx eas-cli login');
  console.log('  2. npm run configure:android-credentials --workspace mobile');
  console.log(`     (FCM V1 key: ${firebaseAdminKey})`);
  console.log('  3. npm run build:dev:android --workspace mobile');
  console.log('  4. After first build: add EAS keystore SHA-1 to Firebase + Google OAuth client');
  console.log('  5. npm run start:dev-client --workspace mobile');
  process.exit(process.exitCode ?? 0);
}

console.log('\nConfiguring EAS project (if needed)…\n');
runEas(['build:configure', '--platform', 'android']);

if (runBuild) {
  console.log('\nStarting EAS development build…\n');
  const ok = runEas([
    'build',
    '--profile',
    'development',
    '--platform',
    'android',
    '--non-interactive',
  ]);
  if (!ok) process.exitCode = 1;
} else {
  console.log('\nReady. Start a dev APK build with:');
  console.log('  npm run build:dev:android --workspace mobile');
  console.log('\nOr run this script with --build after credentials are configured.');
}

console.log('');
