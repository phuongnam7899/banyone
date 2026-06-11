/**
 * Post-login helper: configure Android FCM (V1) credentials on EAS.
 * Requires: npx eas-cli login (or EXPO_TOKEN in environment).
 *
 * Usage: node scripts/configure-android-credentials.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(root, '../..');
const firebaseAdminKey = resolve(
  repoRoot,
  'apps/backend/banyone-bce0f-firebase-adminsdk-fbsvc-721d6adeb7.json',
);

if (!existsSync(firebaseAdminKey)) {
  console.error(`Missing Firebase Admin key: ${firebaseAdminKey}`);
  process.exit(1);
}

const whoami = spawnSync('npx', ['eas-cli', 'whoami'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});

if (whoami.status !== 0) {
  console.error('Not logged in to Expo. Run: npx eas-cli login');
  process.exit(1);
}

console.log(`Logged in as: ${whoami.stdout.trim()}`);
console.log('\nConfigure Android credentials interactively:');
console.log('  npx eas-cli credentials -p android');
console.log('\nSteps in the wizard:');
console.log('  1. Push Notifications (FCM V1) → Upload service account key');
console.log(`  2. Select file: ${firebaseAdminKey}`);
console.log('  3. After first dev build, copy keystore SHA-1 from EAS → Firebase Console');
console.log('     (Project settings → Android app com.banyone → Add fingerprint)');
console.log('  4. Register com.banyone:/oauthredirect on the Google OAuth web client');
console.log('\nLaunching credentials wizard now…\n');

const result = spawnSync('npx', ['eas-cli', 'credentials', '-p', 'android'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
