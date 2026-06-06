---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-banyone-2026-03-22.md
  - _bmad-output/brainstorming/brainstorming-session-2026-03-22-100809.md
workflowType: prd
workflow: edit
documentCounts:
  productBriefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
classification:
  projectType: mobile_app
  domain: general
  complexity: medium
  projectContext: greenfield
completedAt: 2026-03-22
lastEdited: 2026-05-31
editHistory:
  - date: 2026-05-31
    changes: Added Phase 1 auto-renewable subscription (iOS + Android), user journeys, FRs, NFRs, and store billing compliance aligned with Banyone Pro paywall flow
---

# Product Requirements Document - banyone

**Author:** Nam
**Date:** 2026-03-22

## Executive Summary

`banyone` is a greenfield mobile app for iOS and Android that lets users upload one source video and one reference image, then generate a new video where the source character is replaced by the target character while preserving original motion, scene, and background. It targets mainstream creator and casual users who want strong AI video outcomes without technical complexity. The core problem is not model access; it is workflow friction. Existing options are either too complex, too technical, or not optimized for quick, believable character replacement on mobile. `banyone` addresses this by delivering a minimal-step, mobile-first flow optimized for first-success outcomes and repeat use.

### What Makes This Special

The product differentiates on usable power: few taps from inputs to believable output, without requiring AI prompting expertise or pro editing skills. Its core insight is that AI demand is broad, but usability is the bottleneck; reducing cognitive load unlocks wider adoption. The value proposition is clear: users can replace a video's character with a target character from a reference image in a few simple steps while keeping the original motion and scene. This simplicity is paired with cost-aware quality defaults and a credit-based **Banyone Pro** auto-renewable subscription that tops up generation credits on each billing period, enabling acceptable output quality and sustainable operating economics under constrained budget conditions.

## Project Classification

- Project Type: `mobile_app`
- Domain: `general` (consumer AI media creation)
- Complexity: `medium`
- Project Context: `greenfield`

## Success Criteria

### User Success

Users can complete their first full job (upload video, upload reference image, submit, preview, export) in their first session without external help. The primary success moment is seeing a believable character replacement where motion and scene continuity are preserved well enough to share. The product should minimize cognitive load, so most new users can finish the flow in a few guided steps and understand job status while waiting.

### Business Success

In the first 3 months, success means proving demand and usability with healthy first-export conversion, while keeping cost per completed export controlled under a constrained budget. In 12 months, success means sustainable economics with repeat usage from users who reached first export, plus a validated **Banyone Pro** subscription path where renewal credit grants cover model and operations cost at target gross margin.

### Technical Success

The system reliably completes jobs within published constraints (single source video + single reference image, defined duration/resolution caps) with clear failure states and retry guidance. Queueing, inference execution, and export should be predictable enough for users to trust the workflow. The launch stack must include basic abuse controls, rate-limiting, and policy-safe handling suitable for iOS/Android store distribution.

### Measurable Outcomes

- First successful export rate: at least 40% of new users within 24 hours.
- Median time to first preview: 5 minutes or less for in-cap jobs.
- Export completion reliability: at least 95% of accepted jobs complete without manual support.
- D7 retention (among users with first export): at least 20%.
- Unit economics gate: measured per-job COGS with a target gross margin path of at least 40% before paid scale-up.
- Paywall-to-subscription conversion: at least 8% of users who open the paywall complete an initial subscription within the same session.
- Credit top-up reliability: at least 99% of successful initial purchases and renewals result in a credited balance within 60 seconds.
- Billing support load: billing-related support tickets remain below 5% of total tickets in the first 90 days post-launch.

## Product Scope

### MVP - Minimum Viable Product

- Mobile app (iOS + Android) with minimal-step flow: select source video, select reference image, submit, track status, preview, export/share.
- One-to-one replacement pipeline: one video + one image to one output video, preserving scene and motion.
- Explicit input/output limits (duration, format, resolution tiers) with cost-aware default quality.
- Backend job orchestration: queue, storage, inference integration, status updates, and deterministic error handling.
- Baseline trust layer: content policy UX, abuse/rate controls, and app-store-compliant synthetic-media safeguards.
- **Banyone Pro subscription billing (iOS App Store + Google Play):** auto-renewable weekly, monthly, and yearly plans that grant generation credits on initial purchase and each renewal; paywall access from creation flow; subscription status and renewal credit visibility; platform subscription management entry points.

### Growth Features (Post-MVP)

- Higher quality and faster processing tiers with clear tradeoff controls.
- Better creative controls (hints, masks, quality tuning) without breaking simplicity.
- Improved onboarding and re-engagement loops to increase repeat exports and D7/D30 retention.
- Subscription packaging optimization (pricing experiments, plan merchandising, regional pricing localization).

### Vision (Future)

- More advanced replacement workflows (multi-character, batch processing, enhanced edit controls) when economics allow.
- Creator and partner surfaces, including potential API or B2B workflows.
- Expanded trust tooling (stronger consent validation, provenance/watermarking options, advanced moderation support).

## User Journeys

### Journey 1 - Primary User Success Path (Casual Creator: Linh)

Linh records a short dance clip and wants to swap the performer with a stylized character for social posting, but she does not know video editing or prompting tools. She installs `banyone`, immediately understands the two-input flow, and uploads one video and one character reference image. During processing, she sees clear job status and expected wait time instead of uncertainty. The climax is the first preview: motion is preserved, background remains intact, and the character swap looks believable enough for sharing. She exports in one tap and shares. Her new reality is confidence that she can produce AI-enhanced clips quickly without a pro workflow.

### Journey 2 - Primary User Edge Case (Aspiring Creator: Minh, Retry Flow)

Minh uploads a clip that exceeds the duration cap and gets rejected before processing. Instead of failing silently, the app explains the exact limit and offers guided recovery options (trim suggestion and accepted formats). Minh retries with a compliant clip, submits again, and receives a successful preview. The value moment is not only output quality but predictable recovery from error. This journey proves the product must handle constraints transparently and preserve user trust when jobs fail.

### Journey 3 - Operations/Moderation User (Trust Ops: An)

An is responsible for keeping the platform safe and store-compliant with limited team resources. She monitors moderation queues, abuse flags, and job outcomes from an internal operations console. When a suspicious job pattern appears, she can review metadata, apply policy actions, and trigger account/device throttling without blocking normal users. Her success state is low time-to-resolution for policy incidents and stable false-positive rates, so growth is not blocked by safety debt.

### Journey 4 - Support User (Customer Support: Trang)

Trang receives tickets from users who report "my video failed" or "result quality is poor." She looks up job history, sees the specific failure category, and uses pre-defined response playbooks (limits, retry guidance, refund/credit rules). If the issue is systemic, she escalates with diagnostic context rather than vague reports. The resolution is fast, consistent support that recovers frustrated users and reduces churn after first failure.

### Journey 5 - Subscribe to Continue Creating (Casual Creator: Linh, Insufficient Credits)

Linh tries to generate a video but her generation credit balance is too low. The app blocks submission with a clear insufficient-credits message and a path to the paywall. On the paywall she sees three **Banyone Pro** plans (weekly, monthly, yearly) with price and credits granted per billing period. She subscribes through the platform store purchase sheet or the hosted subscription options view. After purchase completes, her credit balance updates and she returns to create her job without losing her prior selections. On each renewal, credits are added automatically so she can keep creating without repeating the purchase flow.

### Journey 6 - Manage Active Subscription (Returning Creator: Minh, Pro Subscriber)

Minh already has an active **Banyone Pro** subscription. He opens the paywall from the credits badge and sees his current plan, the credits scheduled for the next renewal, and options to change or cancel. He changes plan through platform subscription management (in-app customer center when available, otherwise App Store or Google Play settings). When he returns to the app, subscription state and credit balance reflect the updated entitlement. If he reinstalls on a new device, he can restore his prior subscription and regain access to renewal credit grants.

### Journey Requirements Summary

These journeys require the following capability areas:

- **Guided Core Flow:** frictionless onboarding, input validation, clear upload/submit/preview/export steps.
- **Transparent Job Lifecycle:** queue status, ETA ranges, failure codes, retry pathways.
- **Quality and Constraint Controls:** explicit limits, safe defaults, and user-friendly correction guidance.
- **Trust and Safety Operations:** moderation tooling, abuse detection signals, rate limiting, and policy action workflows.
- **Supportability:** searchable job diagnostics, support playbooks, and escalation hooks.
- **Retention Hooks:** quick first-win moments, re-use prompts, and consistent output reliability.
- **Monetization and Credits:** credit balance visibility, paywall entry from creation flow, subscription purchase and renewal credit grants, active-plan management, and purchase restoration.

## Domain-Specific Requirements

### Compliance & Regulatory

- App Store and Google Play synthetic-media policy compliance is mandatory for launch and ongoing updates.
- Terms, consent disclosures, and prohibited-use policies must be presented before first job submission.
- User reporting and takedown workflows must exist for policy-violating outputs.
- Regional privacy obligations (for example GDPR-like expectations where applicable) must be addressed through transparent data handling notices and deletion controls.

### In-App Purchase & Store Billing Compliance

- Auto-renewable subscription products must comply with Apple App Store and Google Play billing policies, including clear disclosure of price, billing period, and renewal terms before purchase.
- Users must be able to restore prior subscription purchases after reinstall or device change.
- Subscription management (change plan, cancel, view billing history) must route through platform-provided subscription management surfaces.
- Refunds and billing disputes are handled per Apple and Google policies; the app must not promise in-app refunds outside store mechanisms.
- iOS and Android must offer feature parity on core subscription flows: view plans, purchase, view active plan, and access subscription management.
- Subscription entitlement must map to the same user account used for generation credit balance and job history.

### Technical Constraints

- The product must enforce strict input and output constraints (duration, resolution, formats) before processing to protect quality and cost.
- The job pipeline must fail safely with deterministic error categories and user-recoverable next steps.
- Identity-lite controls (device/account rate policies) are required to reduce abuse and runaway inference cost.
- Safety checks must be integrated into both job acceptance and post-generation moderation workflows.

### Integration Requirements

- Integration with a video generation/inference provider (WAN 2.2-class or equivalent) must support asynchronous job execution and status polling.
- Integration with cloud object storage must support secure upload, temporary processing assets, and controlled output retrieval.
- Integration with mobile-native share/export surfaces is required for the primary user outcome.
- Integration with platform in-app purchase and subscription services (iOS App Store and Google Play) must support purchase, renewal, entitlement verification, and server-side credit grant on billing events.

### Risk Mitigations

- **Misuse risk:** Add policy gates, abuse throttling, and moderation escalation paths.
- **Store rejection risk:** Maintain pre-release policy checklist and launch gate tied to app-review requirements.
- **Economics risk:** Enforce quality-tier defaults and hard caps to prevent uncontrolled COGS.
- **Trust risk:** Provide transparent job status, clear failure reasons, and predictable recovery actions.

## Innovation & Novel Patterns

### Detected Innovation Areas

- The innovation is not a new model category; it is a productized workflow innovation: "complex AI video transformation as a simple mobile interaction."
- `banyone` combines believable character replacement with minimal cognitive load, making advanced generation accessible to non-technical users.
- Cost-aware defaults are treated as a product primitive, not a backend afterthought, aligning user success with sustainable economics.

### Market Context & Competitive Landscape

- Existing alternatives often split into two weak fits for this audience: powerful but complex pro workflows, or simple but low-fidelity swap tools.
- The defensible gap is usability plus output believability under mobile constraints.
- Competitive pressure is expected on feature parity; differentiation should focus on first-run success rate, recovery UX, and predictable quality.

### Validation Approach

- Validate innovation through first-session completion and first-export quality satisfaction, not only install volume.
- Run structured benchmark tests against a small competitor set on identical sample inputs to compare step count, time-to-preview, and perceived output quality.
- Instrument drop-off points in the core flow to verify that simplification drives conversion.

### Risk Mitigation

- If "few steps" is easy to copy, defend with better reliability, clearer failure recovery, and trust safeguards.
- If output quality is inconsistent, protect retention by setting conservative default limits and exposing quality/speed tradeoff tiers.
- If demand softens, prioritize segments with repeat creation behavior over broad novelty traffic.

## Mobile App Specific Requirements

### Project-Type Overview

`banyone` is a cross-platform mobile product where success depends on fast comprehension, low-friction media handling, and transparent long-running job feedback. The app must deliver a dependable end-to-end flow that feels simple despite backend complexity.

### Technical Architecture Considerations

- The mobile client and backend must support asynchronous job lifecycles with robust reconnection and status reconciliation.
- Upload and export flows must handle large media payloads with resumable and retry-safe behavior.
- Platform parity is required across iOS and Android for primary actions and policy controls.

### Platform Requirements

- Support iOS and Android launch baselines with feature parity on core journey steps.
- Define minimum OS versions that support required media and networking capabilities.
- Ensure app behaviors align with both stores' media, privacy, and synthetic-content expectations.

### Device Permissions

- Request only required permissions (media library and optional notifications) with clear just-in-time rationale.
- Provide functional alternatives when optional permissions are denied.
- Support privacy-preserving defaults for local previews and controlled cloud upload steps.

### Offline Mode

- Full generation is online-only, but users can prepare jobs offline and submit when connectivity returns.
- The app must preserve draft input selections across app restarts and transient network loss.

### Push Strategy

- Push notifications must support key lifecycle events: accepted, ready for preview, failed with retry guidance.
- Users must be able to control notification preferences without blocking in-app status visibility.

### Store Compliance

- Include in-product disclosures for synthetic media behavior and prohibited use cases.
- Maintain review-ready evidence of moderation and abuse handling for store submissions.
- Configure auto-renewable subscription products in App Store Connect and Google Play Console with localized store pricing where available.
- Present subscription terms (price, period, renewal behavior) in the paywall before purchase completion.
- Link billing identity to the server credit account so purchase and renewal events credit the correct user.
- Refresh subscription entitlement when the app returns to foreground after external plan changes in store settings.

### Implementation Considerations

- Prioritize lowest-risk architecture that supports rapid iteration on quality and cost tiers.
- Keep core mobile interactions simple while allowing backend evolution of inference providers and policy tooling.
- Maintain explicit observability for each job state transition to support support/ops workflows.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP focused on first successful export for casual creators, with constrained but dependable output quality.  
**Resource Requirements:** Lean team (mobile engineer, backend engineer, ML/inference integration engineer, product/design, part-time trust/support operations).

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Primary user success path (first export).
- Primary user edge-case recovery (input constraint failures).
- Subscribe to continue creating (insufficient credits).
- Manage active subscription (plan change, cancel, restore).
- Support and moderation operational handling.

**Must-Have Capabilities:**
- One video + one image input flow.
- Async job submission, status tracking, preview, and export.
- Clear constraints and guided error recovery.
- Baseline moderation, abuse throttling, and policy disclosures.
- Core analytics for funnel, latency, failures, and COGS.
- **Banyone Pro auto-renewable subscription (iOS + Android):** weekly, monthly, and yearly plans; paywall from creation flow; platform store purchase; credit grant on initial purchase and renewal; active-plan and next-renewal visibility; subscription management and restore purchases.

### Post-MVP Features

**Phase 2 (Post-MVP):**
- Quality/speed tier controls.
- Better creative guidance and refinement controls.
- Subscription packaging and pricing optimization (experiments, merchandising, localization).
- Retention loops and creator-oriented repeat workflows.

**Phase 3 (Expansion):**
- Advanced generation modes (multi-character, batch, richer controls).
- Partner/business surfaces and possible API track.
- Stronger provenance, consent tooling, and scaled trust operations.

### Risk Mitigation Strategy

**Technical Risks:** Inference instability and media pipeline failures mitigated by strict caps, fallback quality tiers, and robust retry/error taxonomy.  
**Market Risks:** Novelty-driven churn mitigated by focusing on repeatable creator outcomes and measurable first-value loops.  
**Resource Risks:** Budget pressure mitigated by phased scope, lean MVP, and cost gates tied to rollout decisions.

## Functional Requirements

### Core Creation Flow

- FR1: Users can create a generation job by selecting one source video and one reference image.
- FR2: Users can view accepted input constraints before job submission.
- FR3: Users can submit a job and receive immediate confirmation of acceptance or rejection.
- FR4: Users can view real-time job status states from queued through completion.
- FR5: Users can preview generated output before exporting.
- FR6: Users can export completed output to local device storage.
- FR7: Users can share completed output through native mobile share actions.

### Input Validation and Recovery

- FR8: Users can receive explicit validation feedback when inputs violate limits.
- FR9: Users can retry job creation after correcting invalid inputs.
- FR10: Users can access supported file format guidance at upload time.
- FR11: Users can recover from interrupted uploads without redoing all prior selections.

### Account, Identity, and Session Controls

- FR12: Users can create or use a lightweight identity sufficient for job tracking and abuse controls.
- FR13: Users can access their recent job history and status.
- FR14: Users can receive user-facing notices when account/device rate limits are reached.

### Trust, Safety, and Policy

- FR15: Users can review synthetic-media disclosures before first generation.
- FR16: Users can report generated outputs that violate policy.
- FR17: The system can apply policy-based rejection at job acceptance for disallowed submissions.
- FR18: Operations users can review policy-flagged jobs and apply moderation actions.
- FR19: Operations users can apply throttling or restrictions to abusive accounts/devices.

### Notifications and Re-Engagement

- FR20: Users can receive job lifecycle notifications for key events.
- FR21: Users can manage notification preferences while retaining in-app status visibility.

### Support and Troubleshooting

- FR22: Support users can view job-level diagnostics including failure category and timestamps.
- FR23: Support users can issue standardized recovery guidance tied to failure category.
- FR24: Support users can escalate unresolved technical issues with attached diagnostic context.

### Product Analytics and Business Instrumentation

- FR25: Product teams can measure funnel conversion from upload to export completion.
- FR26: Product teams can measure time-to-preview and export reliability by segment and tier.
- FR27: Product teams can measure per-job cost signals needed for unit economics decisions.
- FR28: Product teams can compare outcomes across quality tiers to guide pricing and default settings.

### Monetization and Subscription

- FR29: Users can view their remaining generation credit balance before submitting a job.
- FR30: Users can open a paywall to subscribe when credits are insufficient or when proactively adding credits from the creation flow.
- FR31: Users can choose among weekly, monthly, and yearly auto-renewable **Banyone Pro** subscription plans with visible price and credits granted per billing period.
- FR32: Users can complete subscription purchase through the platform store on iOS and Android.
- FR33: Users receive generation credits automatically after initial subscription purchase and after each successful subscription renewal.
- FR34: Users can view their active subscription plan and the credits scheduled for the next renewal period.
- FR35: Users can change or cancel their subscription through platform subscription management surfaces.
- FR36: Users can restore prior subscription purchases after reinstall or on a new device.
- FR37: Support users can view subscription-linked credit grant history for a user account.
- FR38: The system can reject duplicate credit grants for the same billing event.

## Non-Functional Requirements

### Performance

- The system shall acknowledge successful job submission within 3 seconds for 95th percentile of valid requests.
- The system shall produce first preview readiness within 5 minutes median for in-cap jobs under normal load.
- The mobile app shall render job-status updates within 2 seconds of backend state changes for 95th percentile of updates.

### Reliability

- The system shall achieve at least 95% successful completion for accepted jobs measured weekly.
- The system shall preserve job state through transient client disconnects and allow status recovery on app relaunch.
- The system shall provide deterministic user-visible error categories for 100% of failed jobs.

### Security and Privacy

- The system shall encrypt user media in transit and at rest.
- The system shall enforce least-privilege access for internal operations tools handling job metadata and outputs.
- The system shall provide user-initiated deletion for generated outputs and associated metadata within defined retention windows.
- The system shall maintain audit logs for moderation and policy actions.

### Scalability

- The system shall support 10x growth from initial launch traffic through queue-based horizontal job processing without functional degradation.
- The system shall preserve core submission and status features during demand spikes by applying controlled queue backpressure.

### Accessibility

- The mobile app shall support screen-reader-accessible labels and navigation for all core generation-flow controls.
- The mobile app shall maintain minimum contrast and touch-target sizing aligned with platform accessibility guidelines.

### Integration

- The system shall tolerate temporary inference-provider unavailability and return actionable retry messaging.
- The system shall validate upstream and downstream media format compatibility before expensive processing starts.

### Billing and Subscription Reliability

- The system shall reflect successful subscription purchase or renewal in the user's credit balance within 60 seconds for 95th percentile of billing events, measured from store confirmation through client refresh.
- The system shall process each billable store event at most once for credit grants, with 100% idempotent handling of duplicate billing notifications.
- The mobile app shall present a recoverable error with retry when subscription options fail to load, without blocking unrelated app features.
- The mobile app shall refresh subscription entitlement within 5 seconds of returning to foreground after an external plan change in store settings for 95th percentile of sessions.
