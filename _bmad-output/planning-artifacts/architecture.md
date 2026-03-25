---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/product-brief-banyone-2026-03-22.md
workflowType: 'architecture'
project_name: 'banyone'
user_name: 'Nam'
date: '2026-03-23'
lastStep: 8
status: 'complete'
completedAt: '2026-03-23'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The product requires a complete asynchronous creation workflow (video + reference image -> queued processing -> preview -> export/share), supported by robust pre-submit validation and guided retry loops. Beyond end-user flow, requirements include lightweight identity/session controls, policy-aware moderation operations, support diagnostics, and product analytics instrumentation. Architecturally, this implies at least four bounded capability areas: mobile app experience, job orchestration backend, trust/safety operations, and analytics/telemetry.

**Non-Functional Requirements:**
The architecture is heavily shaped by responsiveness and reliability constraints: fast submission acknowledgment, near-real-time status propagation to clients, deterministic failure categorization, and high completion reliability for accepted jobs. Security/privacy requirements (encryption in transit/at rest, least privilege, deletion workflows, moderation audit logs) and compliance obligations (synthetic media policy/store readiness) are mandatory. Scalability expectations (10x growth with queue backpressure) require decoupled, resilient processing pipelines rather than synchronous request-response processing.

**Scale & Complexity:**
The project is medium-high complexity because it combines consumer mobile UX simplicity with backend AI processing complexity, policy controls, and operational tooling.

- Primary domain: mobile + backend AI media orchestration
- Complexity level: medium-high
- Estimated architectural components: 10-14 major components/subsystems

### Technical Constraints & Dependencies

- External inference provider dependency with asynchronous execution and temporary unavailability handling.
- Cloud object storage dependency for secure upload, processing assets, and output retrieval.
- Strict media constraints (duration, format, resolution) enforced before expensive compute.
- Mobile platform constraints: resumable transfers, app lifecycle interruptions, reconnection/state reconciliation.
- Cost constraints requiring quality-tier defaults, hard caps, and per-job economics visibility.
- Push notification integration for lifecycle events while preserving in-app status as source of truth.

### Architectural Decision Pressures

- **Job lifecycle state machine:** enforce explicit transitions (`queued -> processing -> ready|failed`) to prevent ambiguous states across mobile, backend, and operations tooling.
- **Idempotency and retry safety:** define idempotent boundaries for upload, submit, and retry flows to prevent duplicate jobs, duplicated billing/cost, and inconsistent outcomes.
- **Inference provider abstraction:** isolate model vendor integration behind stable contracts so provider changes do not ripple through client and orchestration layers.
- **Policy gate insertion points:** require enforceable checks at both pre-submit acceptance and post-generation moderation stages, each with auditable outcomes.

### UX Runtime Contracts

- **Status truth model:** in-app status is authoritative; push notifications are assistive and must not become the source of truth.
- **Draft/state restoration:** input selections and in-progress job context must survive app backgrounding, restarts, and transient network loss.
- **Actionable error contract:** every user-visible failure must include cause, impact, and concrete next action/retry path.
- **Accessibility as release gate:** core flow accessibility (labels, navigation, contrast, touch targets) is a non-negotiable acceptance gate for production readiness.

### Cross-Cutting Concerns Identified

- **Observability & diagnostics:** end-to-end tracing of job lifecycle for support and ops.
- **Resilience & idempotency:** safe retries for uploads/submissions and deterministic state transitions.
- **Trust & safety:** policy gates at acceptance, post-generation moderation, abuse throttling.
- **Privacy & compliance:** retention/deletion controls, auditability, clear user disclosures.
- **Accessibility & UX consistency:** WCAG-aligned interactions and transparent async feedback.
- **Cost governance:** controls and telemetry linking quality settings to COGS and margin paths.
- **Experimentation readiness:** configuration and experiment toggles for quality defaults and UX variants without hard dependency on mobile release cycles.

### Observability & Cost Governance Requirements

- Instrument funnel events per critical step (select input, validation pass/fail, submit, queued, processing, preview-ready, export).
- Correlate product metrics with operational metrics (latency, failure class, retry count) and economics metrics (per-job COGS, tier mix).
- Preserve analytics dimensions needed for cohort analysis and pricing/quality strategy decisions.
- Support controlled runtime configuration changes and experimentation in ways that are safe, auditable, and reversible.

## Starter Template Evaluation

### Primary Technology Domain

Mobile + backend AI media orchestration with a TypeScript-first stack, based on product requirements and technical preference alignment.

### Starter Options Considered

- **Expo React Native starter (`create-expo-app`)**: fast onboarding, TypeScript-ready templates, strong ecosystem for auth/analytics/push/media plugins, and strong fit for MVP iteration speed.
- **Flutter starter (`flutter create`)**: strong UI consistency/performance, but adds a second language/toolchain relative to NestJS backend and increases onboarding complexity for this team profile.
- **NestJS backend starter (`nest new`)**: modular architecture, DI, and TypeScript consistency for API/orchestration services.

### Selected Starter: Expo + NestJS

**Rationale for Selection:**
This selection optimizes for fast MVP delivery, consistency, and maintainability. Expo aligns with mobile-first requirements and reduces setup friction, while NestJS provides a scalable backend foundation for asynchronous job orchestration, policy controls, and integration services. Keeping mobile and backend in TypeScript reduces context switching and improves implementation consistency for AI agents.

**Initialization Commands:**

```bash
npx create-expo-app@latest --template default@sdk-55 mobile
npm i -g @nestjs/cli
nest new backend
```

**Architectural Decisions Provided by Starters:**

**Language & Runtime:**
- TypeScript-first setup for both mobile and backend.
- Node.js runtime for backend services via NestJS.

**Styling Solution:**
- Expo default styling baseline (React Native style primitives) with flexibility to layer a design system.

**Build Tooling:**
- Expo-managed build/dev pipeline for mobile.
- Nest CLI and standard TypeScript build tooling for backend.

**Testing Framework:**
- NestJS starter includes Jest testing setup.
- Mobile testing setup can be layered incrementally in implementation stories.

**Code Organization:**
- Expo starter provides app-focused structure suitable for route/screen-driven mobile features.
- Nest starter provides modular backend organization aligned with bounded contexts.

**Development Experience:**
- Fast local iteration, hot reload support, and straightforward project bootstrap.
- Clear integration points for Firebase Auth, Firebase Analytics, Firebase Storage, and FCM.

**Supporting Platform Choices (MVP):**
- **Data/storage baseline:** Firebase Firestore + Firebase Storage.
- **Authentication:** Firebase Auth with Google Sign-In.
- **Analytics:** Firebase Analytics.
- **Push notifications:** Firebase Cloud Messaging (FCM).
- **Payments:** Store-native billing via App Store/Google Play, with optional RevenueCat abstraction.
- **Infrastructure preference:** Start with Firebase Spark where possible; use low-cost backend hosting tier for NestJS API as needed.

**Note:** Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- **Data platform:** Firebase-first data architecture (`Firestore + Storage`) for MVP velocity and minimal ops overhead.
- **Authentication boundary:** Firebase Auth with Google Sign-In; backend verifies Firebase ID tokens for protected API access.
- **API style:** REST-first API contracts with OpenAPI documentation for deterministic client/backend alignment.
- **Hosting baseline:** Firebase services plus low-cost managed hosting for NestJS API.
- **Payments architecture:** Store-native billing (App Store/Google Play) using RevenueCat as an orchestration abstraction.

**Important Decisions (Shape Architecture):**
- **Idempotency model:** idempotent job submission and retry-safe upload/job lifecycle endpoints.
- **State authority:** backend job state is source of truth; mobile syncs from API, push used for notification only.
- **Error taxonomy:** deterministic machine-readable error codes plus user-actionable messages.
- **Observability:** event instrumentation across funnel + backend lifecycle + cost per job signals.
- **Provider abstraction:** isolate inference vendor via adapter boundary to reduce replacement cost later.

**Deferred Decisions (Post-MVP):**
- Relational data platform migration path (PostgreSQL) if query complexity and multi-entity workflows outgrow Firestore ergonomics.
- Multi-region active-active deployment.
- Advanced event bus for high-volume inter-service workflows.

### Data Architecture

- **Primary store:** Cloud Firestore (document model) for core app entities (users, jobs, job states, moderation events, support diagnostics metadata).
- **Object storage:** Firebase Cloud Storage for source media, intermediate artifacts (if retained), and final outputs.
- **Validation strategy:** schema validation at API edge (NestJS DTO + validation pipes), plus rule-level constraints in Firebase security rules.
- **Migration approach:** versioned data schemas and migration scripts at application layer; dual-write strategy if future relational migration is required.
- **Caching strategy:** start with in-memory cache at API layer for hot metadata and short-lived status reads; introduce Redis only when measured bottlenecks appear.

### Authentication & Security

- **Authentication:** Firebase Auth with Google provider.
- **Authorization:** backend role/claim checks (user, support, moderation/admin scopes) based on verified Firebase token claims.
- **API security:** token verification guards on all protected endpoints; request throttling on job creation and media operations.
- **Encryption:** TLS in transit; provider-managed encryption at rest for Firebase services; scoped service credentials for backend integrations.
- **Abuse controls:** device/account throttling, policy pre-checks before expensive job execution, auditable moderation actions.

### API & Communication Patterns

- **API pattern:** REST with explicit versioning (`/v1/...`) and OpenAPI contract as canonical interface.
- **Status model:** normalized job lifecycle (`queued -> processing -> ready | failed`) and deterministic transition rules.
- **Error handling standard:** structured errors containing `code`, `message`, `details?`, and `retryable` metadata.
- **Rate limiting:** per-endpoint and per-identity class (guest/new/trusted users) with stricter limits on compute-heavy endpoints.
- **Service communication:** synchronous API for user operations; asynchronous worker processing for inference jobs via queue-driven execution model.

### Frontend Architecture

- **Stack:** Expo React Native with TypeScript.
- **State management:** lightweight server-state-first pattern (API state as source of truth), local UI state only for transient interactions.
- **Routing:** Expo Router conventions from starter defaults.
- **Offline/resume behavior:** persist draft selections and pending action context locally; reconcile with backend on reconnect.
- **Performance strategy:** optimize for first-success flow responsiveness, progressive media handling, and resilient background/resume lifecycle.

### Infrastructure & Deployment

- **MVP deployment:** Firebase services (Auth/Firestore/Storage/FCM/Analytics) + low-cost managed hosting for NestJS API.
- **CI/CD approach:** Git-based pipeline with lint/test/build gates and environment-specific deployment workflows.
- **Environment configuration:** strict separation of dev/staging/prod Firebase projects and backend environment variables.
- **Monitoring/logging:** centralized backend logs, job lifecycle metrics, and funnel instrumentation linked to analytics.
- **Scaling strategy:** queue-based worker scaling with caps and backpressure controls to protect cost and reliability targets.

### Version Verification Snapshot

- Expo official docs currently highlight `create-expo-app` with template `default@sdk-55`.
- Flutter official docs currently reflect version `3.41.2` (evaluated alternative, not selected).
- NestJS official docs continue to recommend scaffold via Nest CLI (`nest new`) for current setup.

### Decision Impact Analysis

**Implementation Sequence:**
1. Initialize Expo mobile app and NestJS backend from selected starters.
2. Set up Firebase project baseline (Auth, Firestore, Storage, FCM, Analytics) with environment separation.
3. Implement token verification + role guard foundation in backend.
4. Implement job submission/status APIs with lifecycle state machine and error taxonomy.
5. Integrate async worker/inference adapter and retry/idempotency protections.
6. Implement mobile creation flow with status sync, push hooks, preview/export path.
7. Add observability, abuse controls, and support/moderation diagnostics.
8. Integrate store billing via RevenueCat and enforce entitlement checks.

**Cross-Component Dependencies:**
- Auth decisions influence API guards, data security rules, and moderation/support tooling access.
- Data model choices influence API payload structure, mobile state handling, and analytics dimensions.
- Job lifecycle and error taxonomy influence both UX clarity and support operational effectiveness.
- Hosting and queue strategy directly affect latency/reliability/cost targets defined in PRD.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
15 areas where AI agents could make incompatible choices without explicit standards.

### Naming Patterns

**Database Naming Conventions:**
- Firestore collections use `snake_case` plural nouns: `users`, `generation_jobs`, `moderation_events`.
- Firestore document IDs are opaque strings (no semantic encoding).
- Timestamp fields use suffix `_at` (example: `created_at`, `updated_at`).
- Foreign references use `_id` suffix (example: `user_id`, `job_id`).

**API Naming Conventions:**
- REST resources are plural and kebab-case path segments: `/v1/generation-jobs`.
- Route parameters use `:id` style in server definitions and `{id}` in OpenAPI docs.
- Query params use `camelCase` in API contracts (example: `createdAfter`, `pageSize`).
- Headers use standard HTTP naming; custom headers prefixed with `x-banyone-`.

**Code Naming Conventions:**
- TypeScript symbols: `PascalCase` for classes/types, `camelCase` for functions/variables.
- File names: `kebab-case.ts` / `kebab-case.tsx`.
- React components: `PascalCase` component names, file names still kebab-case.
- Constants: `UPPER_SNAKE_CASE`.

### Frontend Test Identity Convention

- All interactive UI elements in mobile screens MUST expose stable test identifiers.
- Use `testID` for React Native components and `accessibilityLabel` only for accessibility semantics (not as a test-ID substitute).
- Test IDs follow this format: `screen.element.action[.state]`.
  - Examples: `create-job.upload-video.button`, `create-job.upload-image.button`, `create-job.submit.button`, `job-status.timeline.item.processing`, `job-result.export.button`.
- Test IDs must be deterministic and language-independent (never based on visible text).
- Dynamic lists must include stable suffixes from business identifiers (example: `job-history.item.<jobId>`).
- Shared components accept a `testID` prop and propagate it to the primary interactive root.
- Any new screen-level feature is incomplete without test IDs on all primary actions and assertion points.

### Structure Patterns

**Project Organization:**
- Backend (`NestJS`) is feature-module based: each domain has `controller`, `service`, `dto`, `entities/types`, `repository/adapter`, `tests`.
- Mobile (`Expo`) organized by feature surfaces: `features/<feature>/` with `screens`, `components`, `hooks`, `services`, `types`.
- Shared contract package for API DTO/types is preferred to avoid drift.
- Tests are co-located with source (`*.spec.ts`, `*.test.ts[x]`) plus focused integration/e2e suites in dedicated test folders.

**File Structure Patterns:**
- Environment config centralized and typed; no ad-hoc `process.env` reads across codebase.
- Firebase integration code isolated in infra/service layer; UI/components must not call Firebase SDK directly.
- Static assets grouped by feature when feature-specific, otherwise in shared asset folders.
- Architecture decision updates recorded in planning artifacts with explicit section-level diffs.

### Format Patterns

**API Response Formats:**
- Success envelope: `{ data, meta?, error: null }`.
- Error envelope: `{ data: null, error: { code, message, retryable, details?, traceId }, meta? }`.
- All endpoints must return one of the two canonical envelopes.

**Data Exchange Formats:**
- External API JSON fields use `camelCase`.
- Internal persistence field naming may remain `snake_case` where storage conventions require; mapping layer is mandatory.
- Datetime values in API use ISO 8601 UTC strings only.
- Booleans are true booleans (`true/false`), never numeric encodings.

### Communication Patterns

**Event System Patterns:**
- Event naming convention: `domain.entity.action.v1` (example: `jobs.generation.submitted.v1`).
- Event payloads must include: `eventId`, `occurredAt`, `version`, `actor`, `resourceId`, `payload`.
- Version bump required for breaking payload changes; consumers remain backward compatible for at least one version window.
- Event publication occurs only after successful state transition commits.

**State Management Patterns:**
- Backend job state machine is canonical: `queued -> processing -> ready | failed`.
- Forbidden transitions are explicit and test-covered.
- Mobile treats backend status as source of truth; local optimistic state must reconcile on refresh/poll/push.
- State updates are immutable in UI layers.

### Process Patterns

**Error Handling Patterns:**
- All backend errors map to canonical error codes and retryability flags.
- User-facing messages are actionable and non-technical; logs preserve technical detail via `traceId`.
- Global exception filters in NestJS enforce response contract.
- Policy and validation failures must return deterministic, documented codes.

**Loading State Patterns:**
- Loading states are explicit by operation (`isSubmittingJob`, `isUploadingMedia`, `isRefreshingStatus`) not generic `isLoading`.
- Long-running job UI uses staged status labels, never spinner-only feedback.
- Retry affordances appear only for `retryable=true` failures.
- Draft input state persists across app backgrounding/restart.

### Agent Implementation Guardrails

**All AI Agents MUST:**
- Use canonical DTO validation at API boundaries (NestJS DTO + class-validator or equivalent).
- Implement idempotency keys for job-creation and retry-prone endpoints.
- Follow service-layer boundaries (no direct persistence/provider access from controllers or UI components).
- Keep inference provider access behind adapter interfaces.
- Add/maintain OpenAPI docs for all public endpoints.
- Add tests for any new lifecycle transition, error code, or contract field.
- Add stable `testID` values for new interactive frontend elements.

### Verification & Enforcement

**Required CI Gates:**
- Format + lint + typecheck must pass.
- Unit tests for touched modules must pass.
- Contract tests for API envelope/error schema must pass.
- Integration/e2e for critical path changes must pass.

**Minimum Test Matrix by Feature Type:**
- API endpoint change: unit + contract test + integration test.
- Job lifecycle change: state-machine transition tests + retry/idempotency tests.
- Mobile workflow change: component/screen tests + at least one flow-level test on happy/failure paths.

**Pattern Enforcement Process:**
- Pattern violations are documented in PR notes with remediation plan.
- Any pattern change requires architecture document update and migration note.
- Breaking contract changes require explicit versioning strategy and compatibility window.
- PR checklist includes: "All new interactive FE elements expose stable `testID` values."
- E2E tests target `testID` selectors first; text selectors only as fallback.

### Pattern Examples

**Good Examples:**
- `POST /v1/generation-jobs` returns `{ data: { jobId, status }, error: null }`.
- Failed validation returns `error.code=INPUT_INVALID`, `retryable=false`, actionable `message`, and `traceId`.
- Event `jobs.generation.failed.v1` includes deterministic `reasonCode` and `retryable`.

**Anti-Patterns:**
- Returning raw arrays/objects without envelope.
- Mixing `snake_case` and `camelCase` fields in the same API response.
- UI components directly calling Firebase SDK for protected resources.
- Adding new job states without updating state-machine tests and docs.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
banyone/
├── README.md
├── docs/
├── .github/
│   └── workflows/
│       ├── mobile-ci.yml
│       ├── backend-ci.yml
│       └── contract-ci.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .editorconfig
├── .gitignore
├── .env.example
├── apps/
│   ├── mobile/
│   │   ├── app.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── babel.config.js
│   │   ├── metro.config.js
│   │   ├── eas.json
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx
│   │   │   ├── create-job.tsx
│   │   │   ├── job-status/
│   │   │   │   └── [jobId].tsx
│   │   │   ├── history.tsx
│   │   │   ├── profile.tsx
│   │   │   └── settings.tsx
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── screens/
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   ├── services/
│   │   │   │   │   └── types/
│   │   │   │   ├── create-job/
│   │   │   │   ├── job-status/
│   │   │   │   ├── preview-export/
│   │   │   │   ├── history/
│   │   │   │   └── moderation-report/
│   │   │   ├── shared/
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── services/
│   │   │   │   ├── constants/
│   │   │   │   ├── utils/
│   │   │   │   └── types/
│   │   │   ├── infra/
│   │   │   │   ├── api-client/
│   │   │   │   ├── firebase/
│   │   │   │   ├── storage/
│   │   │   │   └── telemetry/
│   │   │   ├── state/
│   │   │   └── config/
│   │   ├── assets/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── animations/
│   │   └── test/
│   │       ├── e2e/
│   │       ├── integration/
│   │       └── fixtures/
│   └── backend/
│       ├── package.json
│       ├── nest-cli.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── .env.example
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── config/
│       │   ├── common/
│       │   │   ├── filters/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   ├── decorators/
│       │   │   ├── dto/
│       │   │   └── errors/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── jobs/
│       │   │   ├── uploads/
│       │   │   ├── previews/
│       │   │   ├── exports/
│       │   │   ├── moderation/
│       │   │   ├── support/
│       │   │   ├── analytics/
│       │   │   ├── notifications/
│       │   │   ├── billing/
│       │   │   └── health/
│       │   ├── workers/
│       │   │   ├── inference-worker/
│       │   │   ├── retry-worker/
│       │   │   └── cleanup-worker/
│       │   ├── adapters/
│       │   │   ├── inference-provider/
│       │   │   ├── firebase-storage/
│       │   │   ├── fcm/
│       │   │   └── revenuecat/
│       │   ├── queues/
│       │   └── telemetry/
│       ├── test/
│       │   ├── unit/
│       │   ├── integration/
│       │   ├── contract/
│       │   └── e2e/
│       └── scripts/
├── packages/
│   ├── contracts/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── api/
│   │       ├── events/
│   │       ├── errors/
│   │       └── index.ts
│   ├── eslint-config/
│   └── tsconfig/
└── tooling/
    ├── openapi/
    ├── scripts/
    └── templates/
```

### Architectural Boundaries

**API Boundaries:**
- Public mobile API served by `apps/backend/src/modules/*` under `/v1/*`.
- Authentication boundary at backend guards: all protected routes require verified Firebase ID token.
- Job lifecycle boundary centralized in `modules/jobs` with canonical state transition control.
- Billing and moderation APIs remain separate modules to enforce least privilege access.

**Component Boundaries:**
- Mobile UI components live inside feature folders and only consume feature services/hooks.
- Shared UI and utilities are under `apps/mobile/src/shared` and may not include business workflow logic.
- Infra adapters in mobile (`infra/api-client`, `infra/firebase`) isolate third-party SDK usage from screens/components.

**Service Boundaries:**
- Backend modules encapsulate business logic; controllers orchestrate request/response only.
- Provider integrations (inference, storage, FCM, billing) are isolated behind adapter interfaces in `apps/backend/src/adapters`.
- Workers own asynchronous execution and never bypass module-level domain rules.

**Data Boundaries:**
- Firestore access is mediated through repository/service layers, not direct controller access.
- Storage object paths and metadata conventions are centralized in storage adapter/service modules.
- Contract package (`packages/contracts`) is source of truth for API DTOs, event shapes, and error schema.

### Requirements to Structure Mapping

**Feature/FR Mapping:**
- Core creation flow (FR1-FR7) -> `apps/mobile/src/features/create-job`, `job-status`, `preview-export`, and backend `modules/jobs`, `uploads`, `previews`, `exports`.
- Validation/recovery (FR8-FR11) -> mobile `create-job` + backend `modules/uploads`, `modules/jobs`, `common/errors`.
- Identity/session (FR12-FR14) -> mobile `features/auth`, backend `modules/auth`, `modules/users`, guards.
- Trust/safety (FR15-FR19) -> mobile `moderation-report`, backend `modules/moderation`, `modules/support`.
- Notifications (FR20-FR21) -> mobile notification preference UI, backend `modules/notifications`, `adapters/fcm`.
- Support tooling (FR22-FR24) -> backend `modules/support`, telemetry, and diagnostics data models.
- Analytics/business instrumentation (FR25-FR28) -> backend `modules/analytics`, mobile telemetry layer, shared contracts.

**Cross-Cutting Concerns:**
- Auth and policy guardrails -> `apps/backend/src/common/guards`, `decorators`, `modules/auth`.
- Observability -> `apps/backend/src/telemetry`, `apps/mobile/src/infra/telemetry`.
- Error taxonomy -> `packages/contracts/src/errors`, `apps/backend/src/common/errors`.
- FE automation test identity conventions -> enforced in mobile feature components and `apps/mobile/test/e2e`.

### Integration Points

**Internal Communication:**
- Mobile feature services call backend REST endpoints through `infra/api-client`.
- Backend modules communicate synchronously through injected services and asynchronously via queues/workers.
- Shared contract package is consumed by both apps to reduce schema drift.

**External Integrations:**
- Firebase Auth/Firestore/Storage/FCM from backend adapters and selected mobile SDK surfaces.
- Inference provider integration via `adapters/inference-provider`.
- RevenueCat integration via `adapters/revenuecat` and mobile billing bridge.

**Data Flow:**
- User submits media from mobile -> backend validates/authenticates -> upload metadata persisted -> async job queued -> worker calls inference provider -> result stored -> job status updated -> mobile polls/receives push -> preview/export.

### File Organization Patterns

**Configuration Files:**
- Root workspace configuration for shared tooling and CI.
- App-local configs in `apps/mobile` and `apps/backend`.
- Environment templates (`.env.example`) at root and app-level with strict separation by environment.

**Source Organization:**
- Feature-first for both mobile and backend domains.
- Shared contracts/types in `packages/contracts`.
- Third-party integration code isolated in `infra`/`adapters`.

**Test Organization:**
- Unit/integration/contract/e2e separation in backend `test/`.
- E2E-first mobile automation under `apps/mobile/test/e2e` with `testID`-based selectors.
- Co-located unit/component tests near implementation for fast feedback.

**Asset Organization:**
- Mobile assets in `apps/mobile/assets` grouped by type.
- Generated media remains in cloud storage, with local fixtures only for testing.

### Development Workflow Integration

**Development Server Structure:**
- Mobile and backend run independently but share contract package.
- Contract changes trigger dependent type checks in both apps.

**Build Process Structure:**
- Separate mobile/backend CI pipelines plus contract validation pipeline.
- OpenAPI generation and contract checks run as mandatory gates.

**Deployment Structure:**
- Mobile distributed via Expo/EAS workflow.
- Backend deployed independently to managed hosting.
- Firebase project separation (dev/staging/prod) aligned with environment configs.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All core decisions are technically compatible and mutually reinforcing: Expo + NestJS + Firebase + contract-first patterns support the same TypeScript-centric development model, and the selected integrations (FCM, Firebase Auth/Storage/Analytics, RevenueCat) align with the defined module boundaries.

**Pattern Consistency:**
Implementation patterns directly support architecture decisions: canonical API envelope, explicit error schema, lifecycle state machine, idempotency rules, and frontend `testID` conventions provide consistent behavior across mobile, API, and worker layers.

**Structure Alignment:**
The project tree and boundaries map cleanly to architectural responsibilities, with clear separation between feature modules, adapters, shared contracts, and test suites. No major boundary conflicts were identified.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
All major feature domains from the PRD are mapped to concrete mobile/backend modules and integration points, including creation flow, validation/recovery, trust/safety, support, notifications, and analytics instrumentation.

**Functional Requirements Coverage:**
FR1-FR28 are architecturally supported through defined modules, API contracts, event/state patterns, and required test organization.

**Non-Functional Requirements Coverage:**
Performance, reliability, security/privacy, scalability, accessibility, and compliance requirements are addressed via queue-driven processing, deterministic error taxonomy, auth/guard boundaries, observability, and policy-oriented moderation architecture.

### Implementation Readiness Validation ✅

**Decision Completeness:**
Critical stack and integration decisions are documented, with rationale and implementation sequencing. Starter and boundary choices are explicit enough for agent execution.

**Structure Completeness:**
Project structure is concrete and implementation-oriented (not placeholder-only), including app/workspace layout, module allocation, adapters, tests, and shared contracts.

**Pattern Completeness:**
Conflict-prone areas are covered: naming, response formats, lifecycle transitions, event patterns, process behaviors, and FE automation IDs.

### Gap Analysis Results

**Critical Gaps:** None identified.

**Important Gaps (addressed in validation guidance):**
- Add and maintain an explicit FR traceability matrix (`FR -> module -> contract -> tests`) as implementation progresses.
- Formalize degraded-mode behavior for inference latency/outage scenarios in runtime runbooks.

**Nice-to-Have Gaps:**
- Expand contract snapshot examples for edge error categories.
- Add optional static checks for missing frontend `testID` on selected component types.

### Validation Issues Addressed

- Added SLO/fallback validation addendum for inference degradation and user messaging behavior.
- Added FR traceability matrix requirement for sustained implementation alignment.
- Expanded quality gates to include lifecycle invariants, error-code completeness, and `testID` enforcement coverage.
- Added business instrumentation gates for first-export funnel, per-job COGS by quality tier, and retry-journey telemetry.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Strong cross-layer consistency model (contracts, state machine, error taxonomy).
- Clear module boundaries with adapter isolation for third-party dependencies.
- Explicit QA/automation conventions, including frontend `testID` identity standards.
- Practical MVP-first stack with scalable evolution path.

**Areas for Future Enhancement:**
- Formal runbooks for incident/degradation handling.
- Progressive hardening of contract compatibility windows and automated drift detection.
- Additional cost-governance dashboards as volume grows.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across all components.
- Respect project structure and boundaries.
- Maintain FR traceability across code and tests.

**First Implementation Priority:**

1. Initialize projects:
   - `npx create-expo-app@latest --template default@sdk-55 mobile`
   - `nest new backend`
2. Establish shared contracts package and CI quality gates.
3. Implement auth verification and core job lifecycle endpoints before feature expansion.
