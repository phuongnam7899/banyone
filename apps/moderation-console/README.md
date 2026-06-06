# Moderation Console

Minimal internal operator UI for Story 3.4 and Story 3.5.

## Run locally

1. Install workspace dependencies from repo root:
   - `npm install`
2. Copy env template:
   - `cp apps/moderation-console/.env.example apps/moderation-console/.env`
3. Configure Firebase web client env vars in `.env`.
4. Start console:
   - `npm run dev --workspace moderation-console`

## Notes

- Uses Firebase client auth (Google popup sign-in) to obtain bearer token.
- Allows manual token paste for dev/test flows.
- Calls real moderation API endpoints:
  - `GET /v1/moderation/output-reports`
  - `GET /v1/moderation/output-reports/:reportId`
  - `POST /v1/moderation/output-reports/:reportId/actions`
  - `GET /v1/moderation/abuse-restrictions`
  - `POST /v1/moderation/abuse-restrictions`
  - `POST /v1/moderation/abuse-restrictions/clear`
- `RESTRICT_RECOMMENDED` remains recommendation-only; use abuse-restriction endpoints for enforceable blocks.
