---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# banyone - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for banyone, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can create a generation job by selecting one source video and one reference image.
FR2: Users can view accepted input constraints before job submission.
FR3: Users can submit a job and receive immediate confirmation of acceptance or rejection.
FR4: Users can view real-time job status states from queued through completion.
FR5: Users can preview generated output before exporting.
FR6: Users can export completed output to local device storage.
FR7: Users can share completed output through native mobile share actions.
FR8: Users can receive explicit validation feedback when inputs violate limits.
FR9: Users can retry job creation after correcting invalid inputs.
FR10: Users can access supported file format guidance at upload time.
FR11: Users can recover from interrupted uploads without redoing all prior selections.
FR12: Users can create or use a lightweight identity sufficient for job tracking and abuse controls.
FR13: Users can access their recent job history and status.
FR14: Users can receive user-facing notices when account/device rate limits are reached.
FR15: Users can review synthetic-media disclosures before first generation.
FR16: Users can report generated outputs that violate policy.
FR17: The system can apply policy-based rejection at job acceptance for disallowed submissions.
FR18: Operations users can review policy-flagged jobs and apply moderation actions.
FR19: Operations users can apply throttling or restrictions to abusive accounts/devices.
FR20: Users can receive job lifecycle notifications for key events.
FR21: Users can manage notification preferences while retaining in-app status visibility.
FR22: Support users can view job-level diagnostics including failure category and timestamps.
FR23: Support users can issue standardized recovery guidance tied to failure category.
FR24: Support users can escalate unresolved technical issues with attached diagnostic context.
FR25: Product teams can measure funnel conversion from upload to export completion.
FR26: Product teams can measure time-to-preview and export reliability by segment and tier.
FR27: Product teams can measure per-job cost signals needed for unit economics decisions.
FR28: Product teams can compare outcomes across quality tiers to guide pricing and default settings.

### NonFunctional Requirements

NFR1: The system shall acknowledge successful job submission within 3 seconds for 95th percentile of valid requests.
NFR2: The system shall produce first preview readiness within 5 minutes median for in-cap jobs under normal load.
NFR3: The mobile app shall render job-status updates within 2 seconds of backend state changes for 95th percentile of updates.
NFR4: The system shall achieve at least 95% successful completion for accepted jobs measured weekly.
NFR5: The system shall preserve job state through transient client disconnects and allow status recovery on app relaunch.
NFR6: The system shall provide deterministic user-visible error categories for 100% of failed jobs.
NFR7: The system shall encrypt user media in transit and at rest.
NFR8: The system shall enforce least-privilege access for internal operations tools handling job metadata and outputs.
NFR9: The system shall provide user-initiated deletion for generated outputs and associated metadata within defined retention windows.
NFR10: The system shall maintain audit logs for moderation and policy actions.
NFR11: The system shall support 10x growth from initial launch traffic through queue-based horizontal job processing without functional degradation.
NFR12: The system shall preserve core submission and status features during demand spikes by applying controlled queue backpressure.
NFR13: The mobile app shall support screen-reader-accessible labels and navigation for all core generation-flow controls.
NFR14: The mobile app shall maintain minimum contrast and touch-target sizing aligned with platform accessibility guidelines.
NFR15: The system shall tolerate temporary inference-provider unavailability and return actionable retry messaging.
NFR16: The system shall validate upstream and downstream media format compatibility before expensive processing starts.

### Additional Requirements

- Starter template is explicitly required: initialize with Expo mobile starter (`create-expo-app` SDK 55 template) and NestJS backend starter (`nest new`) as the first implementation story.
- Use a TypeScript-first architecture across mobile and backend to reduce implementation drift and improve consistency.
- Firebase-first MVP baseline is required: Firebase Auth, Firestore, Storage, FCM, and Analytics.
- Backend must verify Firebase ID tokens and enforce role/claim-based authorization for user, support, and moderation/admin scopes.
- API must be REST-first with explicit versioning (`/v1`) and OpenAPI-documented contracts.
- Canonical job lifecycle state machine is required (`queued -> processing -> ready | failed`) with deterministic transitions and transition tests.
- Job submission and retry-prone endpoints must use idempotency keys and retry-safe behavior.
- Error handling must follow a deterministic taxonomy with machine-readable codes plus user-actionable messages.
- API responses must follow canonical success/error envelope structure consistently.
- Inference provider must be isolated behind an adapter boundary to support future provider changes.
- Queue-based async workers are required for generation execution, with controlled backpressure for spikes.
- Monitoring and observability are required for funnel steps, lifecycle transitions, failure classes, retry counts, and per-job COGS.
- Trust and safety controls are required at both pre-submit acceptance and post-generation moderation with auditable outcomes.
- Abuse controls are required (device/account throttling, rate limits on compute-heavy endpoints).
- Environment isolation is required across dev/staging/prod for Firebase projects and backend configuration.
- CI quality gates must include lint/typecheck/tests; contract and lifecycle invariant testing are required.
- Shared contracts package is required to keep API/event/error schemas synchronized between mobile and backend.
- Frontend must expose stable `testID` values for interactive elements and use deterministic naming conventions.
- Draft selections and pending context must persist through app restarts/backgrounding and reconcile on reconnect.
- Push notifications are assistive only; in-app/backend status remains the source of truth.

### UX Design Requirements

UX-DR1: Implement a minimal linear "two inputs to one output" flow (select source video, select reference image, submit, track, preview, export/share) with one dominant CTA per screen.
UX-DR2: Implement pre-submit inline validation for duration/format/resolution constraints with exact failure reasons and fix guidance (not generic errors).
UX-DR3: Implement immediate submission acknowledgment and explicit job status progression labels (`queued`, `processing`, `ready`, `failed`) including ETA band communication.
UX-DR4: Implement actionable recovery UX for each failure category, preserving prior user effort and allowing quick retry without restarting the full flow.
UX-DR5: Implement draft persistence for selected inputs and in-progress context across app backgrounding, restarts, and network interruptions.
UX-DR6: Implement preview-first completion UX with clear one-tap export and native share actions to reinforce first-success outcomes.
UX-DR7: Implement a reusable Job Status Timeline Card component with accessible state announcements for async progress.
UX-DR8: Implement a reusable Input Compliance Checker component with pending/valid/invalid-with-fix states and field-linked error text.
UX-DR9: Implement a reusable Preview Compare Surface component with loading/ready/failed-preview states and clear export affordances.
UX-DR10: Implement consistent feedback patterns across app surfaces: concise success messaging, plain-language error messaging, proactive warnings, and contextual informational text.
UX-DR11: Implement 8px spacing scale and consistent hierarchy tokens (typography, color semantics, radius/elevation) to standardize form/status/action surfaces.
UX-DR12: Enforce accessibility baseline: minimum 44x44 touch targets, non-color status cues, clear focus indicators, screen-reader labels/navigation, and dynamic text resilience.
UX-DR13: Ensure contrast for semantic status colors and primary actions meets WCAG 2.2 AA targets for core workflow screens.
UX-DR14: Implement mobile-first responsive behavior with tablet adaptations (higher-density layouts and optional side-by-side preview/status where appropriate).
UX-DR15: Implement notification preference controls that preserve in-app status visibility as authoritative while push remains assistive.
UX-DR16: Implement transparent policy and synthetic-media disclosure touchpoints before first submission without creating excessive friction.
UX-DR17: Standardize loading behavior to use explicit stage labels and progress context (avoid spinner-only states for long-running operations).
UX-DR18: Implement empty-state patterns that explain value and provide direct next actions for first-time and return users.
UX-DR19: Preserve back-navigation context through the creation flow so users do not lose progress when reviewing or editing prior inputs.
UX-DR20: Treat accessibility and failure-path UX as release gates for core creation flow surfaces in QA acceptance.

### FR Coverage Map

FR1: Epic 1 - Create generation jobs with one video and one reference image.
FR2: Epic 1 - Show accepted input constraints before submission.
FR3: Epic 1 - Submit job with immediate acceptance or rejection feedback.
FR4: Epic 1 - Track lifecycle status from queued to completion.
FR5: Epic 1 - Preview generated result before export.
FR6: Epic 1 - Export completed output to local storage.
FR7: Epic 1 - Share completed output via native mobile share.
FR8: Epic 1 - Provide explicit validation feedback for invalid inputs.
FR9: Epic 1 - Support retry after user corrects invalid inputs.
FR10: Epic 1 - Show supported file format guidance at upload.
FR11: Epic 1 - Recover interrupted uploads without full restart.
FR12: Epic 2 - Provide lightweight identity for tracking and abuse controls.
FR13: Epic 2 - Show recent job history and status.
FR14: Epic 2 - Show rate-limit notices to affected users.
FR15: Epic 3 - Present synthetic-media disclosures before first generation.
FR16: Epic 3 - Allow users to report policy-violating outputs.
FR17: Epic 3 - Enforce policy-based rejection at acceptance time.
FR18: Epic 3 - Enable operations moderation actions for flagged jobs.
FR19: Epic 3 - Apply throttling or restrictions for abusive accounts/devices.
FR20: Epic 2 - Send lifecycle notifications for key job events.
FR21: Epic 2 - Let users manage notification preferences.
FR22: Epic 4 - Provide support diagnostics with failure categories and timestamps.
FR23: Epic 4 - Provide standardized support recovery guidance.
FR24: Epic 4 - Support escalations with diagnostic context.
FR25: Epic 5 - Track funnel conversion from upload to export.
FR26: Epic 5 - Track time-to-preview and export reliability by segment/tier.
FR27: Epic 5 - Measure per-job cost signals for unit economics.
FR28: Epic 5 - Compare outcomes across quality tiers.

### UX-DR Traceability Map

UX-DR1: Story 1.2 (linear two-input flow), Story 1.4 (submit), Story 1.5 (track), Story 1.6 (preview/export/share)
UX-DR2: Story 1.2 (constraint visibility), Story 1.3 (inline validation + fix guidance)
UX-DR3: Story 1.4 (immediate acknowledgment), Story 1.5 (explicit lifecycle labels)
UX-DR4: Story 1.3 (fixable validation), Story 1.5 (retry path), Story 1.6 (preview/export failure recovery)
UX-DR5: Story 1.7 (draft persistence and interruption recovery)
UX-DR6: Story 1.6 (preview-first completion, one-tap export, native share)
UX-DR7: Story 1.5 (status timeline states and accessibility announcements)
UX-DR8: Story 1.2 and Story 1.3 (input compliance/validation states)
UX-DR9: Story 1.6 (preview surface with loading/ready/failed states)
UX-DR10: Story 1.3, Story 1.5, Story 1.6 (consistent success/error/warning/info patterns)
UX-DR11: Story 1.2 and Story 1.6 (form/action surface consistency), Story 1.5 (status card consistency)
UX-DR12: Story 1.2, Story 1.5, Story 1.6 (touch targets, non-color cues, screen-reader support)
UX-DR13: Story 1.2 and Story 1.6 (semantic action/status contrast checks for core workflow)
UX-DR14: Story 1.2, Story 1.5, Story 1.6 (mobile-first behavior with tablet-safe layouts)
UX-DR15: Story 2.4 and Story 2.5 (push assistive, in-app status authoritative, preference controls)
UX-DR16: Story 3.1 (pre-submit synthetic media disclosure touchpoint)
UX-DR17: Story 1.5 (explicit stage labels and progress context for long-running operations)
UX-DR18: Story 2.2 (history empty states with clear next actions)
UX-DR19: Story 1.2, Story 1.3, Story 1.7 (back-navigation with preserved progress/context)
UX-DR20: Story 1.3, Story 1.5, Story 1.6 (failure-path + accessibility treated as release-gate acceptance scope)

## Epic List

### Epic 1: First Creation to Export
Enable a new user to complete the full core journey from media selection to preview, export, and share, including validation and retry recovery.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11

### Epic 2: Identity, History, and Re-Engagement
Enable users to persist identity, track job history, and stay informed through lifecycle notifications with preference control.
**FRs covered:** FR12, FR13, FR14, FR20, FR21

### Epic 3: Trust, Policy, and Safe Operations
Enable compliant generation and safe platform operation via disclosures, reporting, policy enforcement, and abuse controls.
**FRs covered:** FR15, FR16, FR17, FR18, FR19

### Epic 4: Support Resolution Workflow
Enable support teams to diagnose failures quickly, guide recovery, and escalate with complete context.
**FRs covered:** FR22, FR23, FR24

### Epic 5: Product Intelligence and Unit Economics
Enable product/business teams to measure funnel, reliability, latency, and cost-performance tradeoffs for decision-making.
**FRs covered:** FR25, FR26, FR27, FR28

## Epic 1: First Creation to Export

Enable a new user to complete the full core journey from media selection to preview, export, and share, including validation and retry recovery.

### Story 1.1: Set Up Initial Project from Starter Template

As a developer,
I want the Expo mobile app and NestJS backend initialized with shared workspace structure,
So that subsequent stories can deliver user-facing value on a stable, consistent platform.

**Story Type:** Enabler (Platform Foundation)
**Note:** This is intentionally a non-user-facing enabling story and must be completed before user-value stories in Epic 1.
**Data Scope Constraint:** Create only foundational project/config assets required to run mobile/backend apps and CI baseline; do not introduce full production data models or complete schema upfront.

**Acceptance Criteria:**

**Given** a new repository workspace
**When** the project is bootstrapped with Expo and NestJS starters
**Then** both apps run locally with documented setup commands
**And** shared TypeScript base config and lint/test scripts are available.
**And** CI baseline checks for lint, typecheck, and unit test command execution are configured and passing for both apps.

### Story 1.2: Upload Inputs with Constraint Guidance

As a casual creator,
I want to select one source video and one reference image with clear limits shown upfront,
So that I can prepare a valid generation job without confusion.

**Acceptance Criteria:**

**Given** I am on the create screen
**When** I choose media inputs
**Then** the app enforces one-video and one-image selection
**And** duration/format/resolution constraints are visible before submit.
**And** required semantic contrast for primary actions/status cues meets WCAG 2.2 AA on core creation surfaces.

### Story 1.3: Pre-Submit Validation and Fixable Errors

As a casual creator,
I want inline validation with exact failure reasons and fix guidance,
So that I can correct invalid inputs quickly and continue.

**Acceptance Criteria:**

**Given** one or more selected inputs violate constraints
**When** validation runs
**Then** I see specific, plain-language error details
**And** each error includes a direct recovery action I can take.

### Story 1.4: Submit Job with Immediate Acknowledgment

As a casual creator,
I want to submit a valid job and receive immediate acceptance or rejection feedback,
So that I know the system has handled my request.

**Acceptance Criteria:**

**Given** all inputs are valid
**When** I tap submit
**Then** the app receives response acknowledgment within 3 seconds at p95 under normal load
**And** I see accepted or rejected state with reason and next action.
**And** duplicate submissions with the same idempotency key do not create duplicate jobs.
**Verification Note:** Validate p95 acknowledgment with API telemetry from representative load tests (non-cached, in-cap jobs).

### Story 1.5: Real-Time Status Timeline with Retry Path

As a casual creator,
I want transparent lifecycle status during processing,
So that I trust progress and can recover from failures.

**Acceptance Criteria:**

**Given** I have a submitted job
**When** the backend state changes
**Then** the app shows status stages (`queued`, `processing`, `ready`, `failed`) with ETA context
**And** status updates are reflected in the UI within 2 seconds at p95 after backend state change.
**And** retry controls appear only when failure is retryable.
**And** the timeline never skips illegal transitions outside (`queued -> processing -> ready|failed`).
**Verification Note:** Validate state freshness and transition integrity via lifecycle telemetry assertions plus integration tests.

### Story 1.6: Preview, Export, and Native Share

As a casual creator,
I want to preview output and complete export/share in minimal taps,
So that I can reach first-success quickly.

**Acceptance Criteria:**

**Given** a job is in `ready` state
**When** I open the result screen
**Then** I can preview output and execute one-tap export
**And** I can invoke native share after export completes.
**And** if preview loading fails, I receive a deterministic error message with retry guidance and traceable error code.
**And** if export fails, I receive an actionable recovery path without losing the ready output state.
**Verification Note:** Validate failure-path UX with deterministic error fixtures and confirm recovery without state loss.

### Story 1.7: Persist Drafts and Recover Interrupted Uploads

As a casual creator,
I want selected inputs and upload progress to survive app interruptions,
So that I do not lose work after backgrounding, restart, or transient network loss.

**Acceptance Criteria:**

**Given** I started media selection or upload
**When** app lifecycle interruption occurs
**Then** draft state is restored on return
**And** interrupted uploads can resume without redoing all prior selections.

## Epic 2: Identity, History, and Re-Engagement

Enable users to persist identity, track job history, and stay informed through lifecycle notifications with preference control.

### Story 2.1: Lightweight User Identity and Session Binding

As a returning user,
I want a lightweight identity tied to my jobs,
So that my history and protections follow me consistently.

**Acceptance Criteria:**

**Given** the app is opened by a new or returning user
**When** identity is established
**Then** jobs are associated to a stable user identifier
**And** backend token verification protects user-scoped endpoints.

### Story 2.2: Job History List and Detail Views

As a returning user,
I want to view recent jobs and statuses,
So that I can revisit outputs and understand past attempts.

**Dependencies:** Story 2.1 (stable user identity/session), backend job lifecycle event persistence from Epic 1.
**Data Scope Constraint:** Persist only job history fields required for list/detail rendering (status, timestamps, identifiers, retryability metadata); defer non-essential analytics attributes to Epic 5.

**Acceptance Criteria:**

**Given** I have previous jobs
**When** I open history
**Then** I see a list with status, timestamps, and quick actions
**And** selecting an item opens detailed lifecycle information.

### Story 2.3: User-Facing Rate-Limit Notices

As a user,
I want clear notices when account or device limits are reached,
So that I understand why actions are temporarily blocked and what to do next.

**Acceptance Criteria:**

**Given** a rate policy threshold is exceeded
**When** I attempt a blocked action
**Then** I receive deterministic notice with cause and wait/recovery guidance
**And** blocked state is not shown as generic system failure.

### Story 2.4: Lifecycle Push Notifications

As a user,
I want notifications for key job events,
So that I can return at the right time without repeatedly checking manually.

**Dependencies:** Story 1.5 (status lifecycle source), Story 2.1 (identity/session), notification token registration.

**Acceptance Criteria:**

**Given** I have a submitted job
**When** it reaches accepted, ready, or failed milestones
**Then** I receive corresponding push notifications
**And** tapping a notification deep-links to relevant in-app status context.
**And** if push delivery fails or is disabled, in-app status remains complete and authoritative with no loss of lifecycle visibility.
**Verification Note:** Validate push-disabled and delivery-failure scenarios on device while confirming in-app status remains source of truth.

### Story 2.5: Notification Preferences Management

As a user,
I want control over notification preferences,
So that the app matches my communication preferences while preserving in-app visibility.

**Acceptance Criteria:**

**Given** I am in settings
**When** I update lifecycle notification preferences
**Then** backend/mobile settings are persisted
**And** in-app status remains available regardless of push preference state.

## Epic 3: Trust, Policy, and Safe Operations

Enable compliant generation and safe platform operation via disclosures, reporting, policy enforcement, and abuse controls.

### Story 3.1: Synthetic Media Disclosure Gate

As a new user,
I want to review synthetic-media disclosures before first generation,
So that I understand acceptable use and platform expectations.

**Acceptance Criteria:**

**Given** I have not accepted disclosure terms
**When** I attempt first submission
**Then** disclosure content is shown with explicit acknowledgment action
**And** generation is blocked until acknowledgment is completed.

### Story 3.2: Policy Screening at Job Acceptance

As the platform,
I want policy checks at acceptance time,
So that disallowed submissions are prevented before expensive processing.

**Acceptance Criteria:**

**Given** a user submits a job
**When** pre-acceptance policy checks run
**Then** disallowed jobs are deterministically rejected with documented codes
**And** allowed jobs continue through normal queue flow.

### Story 3.3: In-App Reporting for Generated Outputs

As a user,
I want to report outputs that violate policy,
So that unsafe or abusive content can be reviewed promptly.

**Acceptance Criteria:**

**Given** I am viewing an output
**When** I submit a policy report
**Then** the report is stored with required metadata and reason category
**And** I receive confirmation that the report was received.

### Story 3.4: Moderation Queue and Actions

As an operations moderator,
I want a queue of flagged jobs with moderation controls,
So that I can review incidents and apply policy actions effectively.

**Acceptance Criteria:**

**Given** flagged jobs exist
**When** moderator opens moderation tools
**Then** queue items show sufficient context for decision making
**And** moderation actions are saved with audit trail fields.

### Story 3.5: Abuse Throttling Controls

As the platform,
I want account/device abuse throttling controls,
So that runaway misuse and cost spikes are contained.

**Acceptance Criteria:**

**Given** abuse thresholds are detected
**When** automated or manual throttling triggers
**Then** restricted actions are blocked by policy rules
**And** all throttle actions are logged for support and audit usage.

## Epic 4: Support Resolution Workflow

Enable support teams to diagnose failures quickly, guide recovery, and escalate with complete context.

### Story 4.1: Job Diagnostics View for Support

As a support agent,
I want searchable job diagnostics,
So that I can identify failures quickly and respond accurately.

**Acceptance Criteria:**

**Given** support user has access permissions
**When** they search for a job
**Then** diagnostics show failure category, lifecycle timestamps, and trace identifier
**And** data visibility follows least-privilege policy boundaries.

### Story 4.2: Standard Recovery Guidance Playbooks

As a support agent,
I want predefined guidance mapped to failure categories,
So that users receive consistent, actionable recovery instructions.

**Acceptance Criteria:**

**Given** a diagnosed failure category
**When** support selects response guidance
**Then** templated instructions align to retryability and user next steps
**And** guidance references the same error taxonomy shown in product UI.

### Story 4.3: Escalation Workflow with Context Handoff

As a support agent,
I want to escalate unresolved incidents with complete context,
So that technical teams can resolve issues without repeating triage.

**Acceptance Criteria:**

**Given** support cannot resolve a case
**When** escalation is triggered
**Then** relevant diagnostics, timeline, and user impact summary are attached
**And** escalation status is trackable until resolution.

## Epic 5: Product Intelligence and Unit Economics

Enable product/business teams to measure funnel, reliability, latency, and cost-performance tradeoffs for decision-making.

### Story 5.1: Funnel Event Instrumentation

As a product manager,
I want event tracking across the creation funnel,
So that I can identify drop-offs from input to export.

**Acceptance Criteria:**

**Given** a user moves through core flow steps
**When** each key action/state occurs
**Then** analytics events are emitted with standard schema and identifiers
**And** dashboards can segment conversion by stage.

### Story 5.2: Time-to-Preview and Reliability Metrics

As a product manager,
I want latency and completion reliability metrics by cohort,
So that I can monitor experience quality and operational health.

**Acceptance Criteria:**

**Given** jobs are processed in production
**When** lifecycle telemetry is aggregated
**Then** median time-to-preview and completion rates are reportable by segment/tier
**And** metric definitions are consistent across analytics and backend telemetry.

### Story 5.3: Per-Job Cost Signal Pipeline

As a business stakeholder,
I want per-job cost signals joined with outcome data,
So that I can evaluate unit economics and margin path.

**Acceptance Criteria:**

**Given** each completed or failed job
**When** cost telemetry is ingested
**Then** job-level cost dimensions are stored and queryable
**And** reports can compare cost against completion and quality outcomes.

### Story 5.4: Quality Tier Outcome Comparison

As a product manager,
I want quality-tier comparative reporting,
So that I can tune defaults and pricing decisions with evidence.

**Acceptance Criteria:**

**Given** jobs across quality tiers
**When** analytics reports are generated
**Then** outcome metrics (latency, reliability, conversion, cost) are comparable per tier
**And** findings can support default-tier and monetization experiments.
