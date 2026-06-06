---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
documentAuthority:
  version: 1
  owner: Nam
  lastConsolidatedAt: 2026-05-31
---

# banyone - Epic Breakdown

## Overview

This is the canonical epic and story breakdown for banyone. It decomposes PRD, UX, and architecture requirements into implementation-ready stories with explicit FR traceability.

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
FR29: Users can view their remaining generation credit balance before submitting a job.  
FR30: Users can open a paywall to subscribe when credits are insufficient or when proactively adding credits from the creation flow.  
FR31: Users can choose among weekly, monthly, and yearly auto-renewable Banyone Pro subscription plans with visible price and credits granted per billing period.  
FR32: Users can complete subscription purchase through the platform store on iOS and Android.  
FR33: Users receive generation credits automatically after initial subscription purchase and after each successful subscription renewal.  
FR34: Users can view their active subscription plan and the credits scheduled for the next renewal period.  
FR35: Users can change or cancel their subscription through platform subscription management surfaces.  
FR36: Users can restore prior subscription purchases after reinstall or on a new device.  
FR37: Support users can view subscription-linked credit grant history for a user account.  
FR38: The system can reject duplicate credit grants for the same billing event.

### NonFunctional Requirements

NFR1: Submission acknowledgment within 3 seconds at p95 for valid requests.  
NFR2: First preview readiness within 5 minutes median for in-cap jobs.  
NFR3: Job status update render within 2 seconds at p95 after backend state change.  
NFR4: At least 95% successful completion for accepted jobs.  
NFR5: State recovery after transient disconnects and app relaunch.  
NFR6: Deterministic user-visible failure categories for 100% failed jobs.  
NFR7: Encryption in transit and at rest.  
NFR8: Least-privilege access for operations tooling.  
NFR9: User deletion for generated outputs and associated metadata.  
NFR10: Audit logs for moderation and policy actions.  
NFR11: 10x scale capability with queue-based horizontal processing.  
NFR12: Controlled backpressure under demand spikes.  
NFR13: Screen-reader-accessible core generation controls.  
NFR14: Accessibility-aligned contrast and touch-target sizing.  
NFR15: Actionable retries during temporary provider outages.  
NFR16: Format compatibility checks before expensive processing.  
NFR17: Credit balance updates within 60 seconds at p95 for successful billing events.  
NFR18: At-most-once credit grant processing with idempotent duplicate handling.  
NFR19: Recoverable paywall loading failures without blocking unrelated app usage.  
NFR20: Foreground entitlement refresh within 5 seconds at p95 after external plan changes.

## FR Coverage Map

FR1-FR11: Epic 1  
FR12-FR14, FR20-FR21: Epic 2  
FR15-FR19: Epic 3  
FR22-FR24: Epic 4  
FR25-FR28: Epic 5  
FR29-FR38: Epic 6

## Epic List

### Epic 1: First Creation to Export
Enable users to complete the full core creation journey from media selection to preview, export, and share, including validation and retry recovery.  
**FRs covered:** FR1-FR11

### Epic 2: Identity, History, and Re-Engagement
Enable users to maintain account continuity, view job history, and stay informed through lifecycle notifications with preference control.  
**FRs covered:** FR12, FR13, FR14, FR20, FR21

### Epic 3: Trust, Policy, and Safe Operations
Enable compliant generation and safe platform operations through disclosures, user reporting, policy enforcement, moderation actions, and abuse controls.  
**FRs covered:** FR15-FR19

### Epic 4: Support Resolution Workflow
Enable support teams to diagnose failures quickly, provide standardized recovery guidance, and escalate with complete context.  
**FRs covered:** FR22-FR24

### Epic 5: Product Intelligence and Unit Economics
Enable product and business teams to measure funnel conversion, reliability, latency, and cost-performance tradeoffs for product and pricing decisions.  
**FRs covered:** FR25-FR28

### Epic 6: Subscription, Credits, and Billing Reliability
Enable users to subscribe, manage plans, and reliably receive credits from billing events with support-safe diagnostics.  
**FRs covered:** FR29-FR38

## Epic 1: First Creation to Export

### Story 1.1: Set Up Initial Project from Starter Template
As a developer, I want the Expo mobile app and NestJS backend initialized with shared workspace structure, so that subsequent stories can deliver user-facing value on a stable, consistent platform.

**Acceptance Criteria:**
- **Given** a new repository workspace **when** the project is bootstrapped with Expo and NestJS starters **then** both apps run locally with documented setup commands.
- **And** shared TypeScript base config and lint/test scripts are available.
- **And** CI baseline checks for lint, typecheck, and unit test command execution are configured and passing for both apps.

### Story 1.2: Upload Inputs with Constraint Guidance
As a casual creator, I want to select one source video and one reference image with clear limits shown upfront, so that I can prepare a valid generation job without confusion.

**Acceptance Criteria:**
- **Given** I am on the create screen **when** I choose media inputs **then** the app enforces one-video and one-image selection.
- **And** duration/format/resolution constraints are visible before submit.

### Story 1.3: Pre-Submit Validation and Fixable Errors
As a casual creator, I want inline validation with exact failure reasons and fix guidance, so that I can correct invalid inputs quickly and continue.

**Acceptance Criteria:**
- **Given** selected inputs violate constraints **when** validation runs **then** I see specific, plain-language error details.
- **And** each error includes a direct recovery action.

### Story 1.4: Submit Job with Immediate Acknowledgment
As a casual creator, I want to submit a valid job and receive immediate acceptance or rejection feedback, so that I know the system has handled my request.

**Acceptance Criteria:**
- **Given** valid inputs **when** I tap submit **then** I receive acknowledgment within 3 seconds at p95 under normal load.
- **And** duplicate submissions with the same idempotency key do not create duplicate jobs.

### Story 1.5: Real-Time Status Timeline with Retry Path
As a casual creator, I want transparent lifecycle status during processing, so that I trust progress and can recover from failures.

**Acceptance Criteria:**
- **Given** I have a submitted job **when** backend state changes **then** the app shows `queued`, `processing`, `ready`, or `failed` with ETA context.
- **And** status updates appear in the UI within 2 seconds at p95.
- **And** retry controls appear only when `retryable=true`.

### Story 1.6: Preview, Export, and Native Share
As a casual creator, I want to preview output and complete export/share in minimal taps, so that I can reach first success quickly.

**Acceptance Criteria:**
- **Given** a job is `ready` **when** I open result screen **then** I can preview output and execute one-tap export.
- **And** native share is available after export.
- **And** deterministic recovery guidance is shown for preview/export failures.

### Story 1.7: Persist Drafts and Recover Interrupted Uploads
As a casual creator, I want selected inputs and upload progress to survive app interruptions, so that I do not lose work after backgrounding, restart, or transient network loss.

**Acceptance Criteria:**
- **Given** I started media selection or upload **when** app interruption occurs **then** draft state is restored on return.
- **And** interrupted uploads can resume without redoing all prior selections.

## Epic 2: Identity, History, and Re-Engagement

### Story 2.1: Lightweight User Identity and Session Binding
As a returning user, I want a lightweight identity tied to my jobs, so that my history and protections follow me consistently.

**Acceptance Criteria:**
- **Given** app open by new/returning user **when** identity is established **then** jobs are associated to a stable user identifier.
- **And** backend token verification protects user-scoped endpoints.

### Story 2.2: Job History List and Detail Views
As a returning user, I want to view recent jobs and statuses, so that I can revisit outputs and understand past attempts.

**Acceptance Criteria:**
- **Given** previous jobs exist **when** I open history **then** I see status, timestamps, and quick actions.
- **And** selecting an item opens detailed lifecycle information.

### Story 2.3: User-Facing Rate-Limit Notices
As a user, I want clear notices when account or device limits are reached, so that I understand why actions are temporarily blocked and what to do next.

**Acceptance Criteria:**
- **Given** a rate threshold is exceeded **when** I attempt a blocked action **then** I receive deterministic notice with recovery guidance.
- **And** blocked state is not shown as a generic system failure.

### Story 2.4: Lifecycle Push Notifications
As a user, I want notifications for key job events, so that I can return at the right time without repeatedly checking manually.

**Acceptance Criteria:**
- **Given** a submitted job **when** accepted/ready/failed milestones occur **then** I receive corresponding push notifications.
- **And** in-app status remains authoritative if push delivery fails or is disabled.

### Story 2.5: Notification Preferences Management
As a user, I want control over notification preferences, so that the app matches my communication preferences while preserving in-app visibility.

**Acceptance Criteria:**
- **Given** settings screen **when** I update preferences **then** backend/mobile settings are persisted.
- **And** in-app lifecycle visibility remains available regardless of push preference state.

## Epic 3: Trust, Policy, and Safe Operations

### Story 3.1: Synthetic Media Disclosure Gate
As a new user, I want to review synthetic-media disclosures before first generation, so that I understand acceptable use and platform expectations.

**Acceptance Criteria:**
- **Given** disclosure not acknowledged **when** first submission is attempted **then** disclosure is shown and generation remains blocked until acknowledged.

### Story 3.2: Policy Screening at Job Acceptance
As the platform, I want policy checks at acceptance time, so that disallowed submissions are prevented before expensive processing.

**Acceptance Criteria:**
- **Given** job submission **when** pre-acceptance checks run **then** disallowed jobs are deterministically rejected with documented codes.
- **And** allowed jobs continue through normal queue flow.

### Story 3.3: In-App Reporting for Generated Outputs
As a user, I want to report outputs that violate policy, so that unsafe content can be reviewed promptly.

**Acceptance Criteria:**
- **Given** output view **when** report is submitted **then** report is stored with required metadata and reason category.
- **And** user receives confirmation.

### Story 3.4: Moderation Queue and Actions
As an operations moderator, I want a queue of flagged jobs with moderation controls, so that I can review incidents and apply policy actions effectively.

**Acceptance Criteria:**
- **Given** flagged jobs exist **when** moderator opens tools **then** queue items show sufficient decision context.
- **And** moderation actions are saved with audit trail fields.

### Story 3.5: Abuse Throttling Controls
As the platform, I want account/device abuse throttling controls, so that runaway misuse and cost spikes are contained.

**Acceptance Criteria:**
- **Given** abuse thresholds are detected **when** throttling triggers **then** restricted actions are blocked by policy rules.
- **And** all throttling actions are logged for support and audit.

## Epic 4: Support Resolution Workflow

### Story 4.1: Job Diagnostics View for Support
As a support agent, I want searchable job diagnostics, so that I can identify failures quickly and respond accurately.

**Acceptance Criteria:**
- **Given** support access permissions **when** searching a job **then** diagnostics show failure category, lifecycle timestamps, and trace identifier.

### Story 4.2: Standard Recovery Guidance Playbooks
As a support agent, I want predefined guidance mapped to failure categories, so that users receive consistent, actionable recovery instructions.

**Acceptance Criteria:**
- **Given** diagnosed failure category **when** support selects guidance **then** instructions align to retryability and user next steps.
- **And** guidance references the same error taxonomy shown in product UI.

### Story 4.3: Escalation Workflow with Context Handoff
As a support agent, I want to escalate unresolved incidents with complete context, so that technical teams can resolve issues without repeating triage.

**Acceptance Criteria:**
- **Given** unresolved case **when** escalation is triggered **then** diagnostics, timeline, and user impact summary are attached.
- **And** escalation status is trackable until resolution.

## Epic 5: Product Intelligence and Unit Economics

### Story 5.1: Funnel Event Instrumentation
As a product manager, I want event tracking across the creation funnel, so that I can identify drop-offs from input to export.

**Acceptance Criteria:**
- **Given** user core-flow actions **when** each key step occurs **then** analytics events are emitted with standard schema.
- **And** dashboards can segment conversion by stage.

### Story 5.2: Time-to-Preview and Reliability Metrics
As a product manager, I want latency and completion reliability metrics by cohort, so that I can monitor experience quality and operational health.

**Acceptance Criteria:**
- **Given** production lifecycle telemetry **when** aggregated **then** median time-to-preview and completion rates are reportable by segment and tier.

### Story 5.3: Per-Job Cost Signal Pipeline
As a business stakeholder, I want per-job cost signals joined with outcome data, so that I can evaluate unit economics and margin path.

**Acceptance Criteria:**
- **Given** completed/failed jobs **when** cost telemetry is ingested **then** job-level cost dimensions are queryable.
- **And** reports compare cost against completion and quality outcomes.

### Story 5.4: Quality Tier Outcome Comparison
As a product manager, I want quality-tier comparative reporting, so that I can tune defaults and pricing decisions with evidence.

**Acceptance Criteria:**
- **Given** jobs across quality tiers **when** reports are generated **then** latency, reliability, conversion, and cost are comparable per tier.

## Epic 6: Subscription, Credits, and Billing Reliability

### Story 6.1: Credit Balance Visibility and Paywall Entry
As a creator, I want to see my available credits and open paywall when needed, so that I understand when I can create and how to continue.

**Acceptance Criteria:**
- **Given** create flow entry **when** credits are insufficient or user taps credits badge **then** paywall opens with clear context and no lost draft inputs.
- **And** pre-submit credit balance is visible before job creation.

### Story 6.2: Plan Selection and Store Purchase
As a creator, I want to choose weekly/monthly/yearly plans and complete purchase through platform stores, so that I can subscribe using trusted native billing.

**Acceptance Criteria:**
- **Given** paywall screen **when** plans are loaded **then** weekly/monthly/yearly options show price, billing period, and credits per period.
- **And** purchase completion is handled via iOS/Android store flows with deterministic success/failure handling.

### Story 6.3: Renewal Grants and Duplicate Event Protection
As the platform, I want renewal credit grants processed idempotently, so that users get correct balances without duplicates.

**Acceptance Criteria:**
- **Given** initial purchase or renewal billing event **when** backend processes event **then** eligible credits are granted and visible within 60 seconds at p95.
- **And** duplicate store events are treated as no-op grants while being logged for diagnostics.

### Story 6.4: Active Plan Management and Restore Purchases
As a subscriber, I want to view active plan details, restore purchases, and manage/cancel plan from platform surfaces, so that my subscription remains portable and controllable.

**Acceptance Criteria:**
- **Given** active subscription **when** user opens subscription settings **then** active plan and next renewal credits are visible.
- **And** restore purchases works after reinstall/new device.
- **And** manage/cancel actions route to platform-provided subscription management surfaces.

### Story 6.5: Support Billing Diagnostics
As a support agent, I want subscription-linked credit grant history per account, so that I can resolve billing-related user issues accurately.

**Acceptance Criteria:**
- **Given** support diagnostics access **when** viewing a user account **then** subscription state and billing-linked credit grant history are visible.
- **And** diagnostic detail is support-safe and excludes sensitive raw store payloads.
