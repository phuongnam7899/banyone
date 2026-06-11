import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const saJson = JSON.stringify(
  JSON.parse(
    readFileSync(
      resolve(root, 'banyone-bce0f-firebase-adminsdk-fbsvc-721d6adeb7.json'),
      'utf8',
    ),
  ),
);

const localEnv = readFileSync(resolve(root, '.env'), 'utf8');
const replicateToken =
  localEnv.match(/^REPLICATE_API_TOKEN=(.+)$/m)?.[1]?.trim() ?? '';

const content = `# Render production env — paste into Render Dashboard → Environment
# DO NOT COMMIT THIS FILE

NODE_VERSION=22

# Firebase Admin (required on Render — do not use GOOGLE_APPLICATION_CREDENTIALS)
FIREBASE_SERVICE_ACCOUNT_JSON=${saJson}
FIREBASE_STORAGE_BUCKET=banyone-bce0f.firebasestorage.app

# Replicate
REPLICATE_API_TOKEN=${replicateToken}
REPLICATE_MODEL=wan-video/wan-2.2-animate-replace
REPLICATE_VIDEO_INPUT_KEY=video
REPLICATE_CHARACTER_IMAGE_KEY=character_image
REPLICATE_PROMPT_INPUT_KEY=prompt
REPLICATE_EXTRA_INPUT_JSON={"go_fast":true,"refert_num":1,"resolution":"480","merge_audio":true,"frames_per_second":24}

# CORS — Expo dev; add https://your-app.onrender.com if needed
CORS_ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006

# RevenueCat — set Authorization header secret from RevenueCat dashboard
# REVENUECAT_WEBHOOK_SECRET=

# NOT for production Render:
# - BANYONE_AUTH_VERIFIER=test
# - BANYONE_DEV_GRANT_SUBSCRIPTION_CREDITS=true
# - BANYONE_IS_TESTING_ENV=true
# - GOOGLE_APPLICATION_CREDENTIALS=...
`;

writeFileSync(resolve(root, '.env.render'), content, 'utf8');
console.log(`Wrote ${resolve(root, '.env.render')}`);
