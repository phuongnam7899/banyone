/**
 * Build Android development APK via EAS (requires Expo login).
 * Usage: node scripts/build-android-dev.mjs
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(args) {
  const result = spawnSync('npx', ['eas-cli', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  return result.status === 0;
}

console.log('\nAndroid development build (EAS)\n');

if (!run(['whoami'])) {
  console.error('\nLog in first: npx eas-cli login');
  console.error('Then configure credentials: npm run configure:android-credentials --workspace mobile');
  process.exit(1);
}

run(['build:configure', '--platform', 'android']);

const ok = run([
  'build',
  '--profile',
  'development',
  '--platform',
  'android',
]);

if (!ok) {
  process.exit(1);
}

console.log('\nWhen the build finishes, open the EAS download link on your Android device');
console.log('or install via USB: adb install path/to/downloaded.apk');
console.log('\nThen connect to Metro: npm run start:dev-client --workspace mobile\n');
