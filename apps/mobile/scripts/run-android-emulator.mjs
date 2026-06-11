/**
 * Start the Android emulator, install the latest EAS dev build, and launch Metro.
 *
 * Prerequisites:
 * - Android SDK (default: %LOCALAPPDATA%\Android\Sdk)
 * - An AVD created in Android Studio
 * - EAS dev build already completed (development profile)
 * - Logged in: npx eas-cli login
 *
 * Usage:
 *   node scripts/run-android-emulator.mjs
 *   node scripts/run-android-emulator.mjs --avd Pixel_3a_API_34_extension_level_7_x86_64
 *   node scripts/run-android-emulator.mjs --skip-emulator   # emulator already running
 *   node scripts/run-android-emulator.mjs --skip-install    # dev client already installed
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const skipEmulator = args.includes('--skip-emulator');
const skipInstall = args.includes('--skip-install');
const avdFlag = args.indexOf('--avd');
const avdName =
  avdFlag >= 0 && args[avdFlag + 1] ? args[avdFlag + 1] : null;

function sdkRoot() {
  const fromEnv = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const local = join(
    process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
    'Android',
    'Sdk',
  );
  if (existsSync(local)) return local;
  return null;
}

function tool(name) {
  const sdk = sdkRoot();
  if (!sdk) return null;
  const ext = process.platform === 'win32' ? '.exe' : '';
  const subdir =
    name === 'adb'
      ? 'platform-tools'
      : name === 'emulator'
        ? 'emulator'
        : '';
  const path = join(sdk, subdir, `${name}${ext}`);
  return existsSync(path) ? path : null;
}

function run(cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  return result.status === 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDevice(adb, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const list = spawnSync(adb, ['devices'], { encoding: 'utf8', shell: true });
    const lines = (list.stdout ?? '')
      .split('\n')
      .filter((l) => l.includes('\tdevice'));
    if (lines.length > 0) {
      console.log(`✓ Emulator ready (${lines[0].split('\t')[0]})`);
      return true;
    }
    process.stdout.write('.');
    await sleep(3000);
  }
  console.error('\n✗ Timed out waiting for emulator');
  return false;
}

function listAvds(emulator) {
  const result = spawnSync(emulator, ['-list-avds'], {
    encoding: 'utf8',
    shell: true,
  });
  return (result.stdout ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const adb = tool('adb');
  const emulator = tool('emulator');
  if (!adb || !emulator) {
    console.error(
      'Android SDK not found. Install Android Studio and create an AVD.',
    );
    process.exit(1);
  }

  if (!skipEmulator) {
    const avds = listAvds(emulator);
    if (avds.length === 0) {
      console.error('No AVDs found. Create one in Android Studio → Device Manager.');
      process.exit(1);
    }
    const chosen = avdName && avds.includes(avdName) ? avdName : avds[0];
    console.log(`Starting emulator: ${chosen}`);
    spawn(emulator, ['-avd', chosen], {
      detached: true,
      stdio: 'ignore',
      shell: true,
    }).unref();
    console.log('Waiting for emulator boot');
    const ready = await waitForDevice(adb);
    if (!ready) process.exit(1);
  } else {
    const ready = await waitForDevice(adb, 10_000);
    if (!ready) {
      console.error('No running emulator detected. Start one or drop --skip-emulator.');
      process.exit(1);
    }
  }

  if (!skipInstall) {
    console.log('\nFetching latest EAS development build…\n');
    const view = spawnSync(
      'npx',
      [
        'eas-cli',
        'build:list',
        '--platform',
        'android',
        '--build-profile',
        'development',
        '--status',
        'finished',
        '--limit',
        '1',
        '--json',
        '--non-interactive',
      ],
      { cwd: root, encoding: 'utf8', shell: true },
    );
    if (view.status !== 0) {
      console.error('Could not list EAS builds. Run: npx eas-cli login');
      process.exit(1);
    }
    let builds;
    try {
      builds = JSON.parse(view.stdout);
    } catch {
      console.error('Unexpected eas build:list output');
      process.exit(1);
    }
    const apkUrl = builds?.[0]?.artifacts?.applicationArchiveUrl;
    if (!apkUrl) {
      console.error('No finished development APK found. Run: npm run build:dev:android --workspace mobile');
      process.exit(1);
    }
    const tmpApk = join(
      process.env.TEMP ?? process.env.TMP ?? '/tmp',
      'banyone-dev.apk',
    );
    console.log(`Downloading ${apkUrl}`);
    const dl = spawnSync(
      process.platform === 'win32' ? 'powershell' : 'curl',
      process.platform === 'win32'
        ? [
            '-Command',
            `Invoke-WebRequest -Uri '${apkUrl}' -OutFile '${tmpApk}'`,
          ]
        : ['-L', apkUrl, '-o', tmpApk],
      { stdio: 'inherit', shell: true },
    );
    if (dl.status !== 0) {
      console.error('APK download failed');
      process.exit(1);
    }
    console.log(`Installing on emulator via ${adb}`);
    if (!run(adb, ['install', '-r', tmpApk])) {
      console.error('adb install failed');
      process.exit(1);
    }
    console.log('✓ Dev client installed');
  }

  console.log('\nStarting Metro for dev client…');
  console.log('Press Ctrl+C to stop.\n');
  const metro = spawn('npx', ['expo', 'start', '--dev-client', '--android'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  metro.on('exit', (code) => process.exit(code ?? 0));
}

void main();
