import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

/**
 * Must be imported before `./app.module` (side-effect only). Nest evaluates
 * `BillingModule` at import time; if `.env` is loaded only inside `bootstrap()`,
 * `BANYONE_DEV_GRANT_SUBSCRIPTION_CREDITS` is still unset and the dev billing
 * routes are omitted (404).
 */
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/backend/.env'),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}
