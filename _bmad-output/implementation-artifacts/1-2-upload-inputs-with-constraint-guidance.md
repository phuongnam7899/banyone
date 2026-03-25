# Story 1.2: Upload Inputs with Constraint Guidance

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a casual creator,  
I want to select one source video and one reference image with clear limits shown upfront,  
so that I can prepare a valid generation job without confusion.

## Acceptance Criteria

1. **Given** I am on the create screen  
   **When** I choose media inputs  
   **Then** the app enforces one-video and one-image selection (exactly one asset in the video slot and one in the reference-image slot; no multi-select that would leave the model ambiguous).

2. **And** duration, format, and resolution constraints are visible on the creation surface before any submit action (plain-language copy tied to the eventual validation rules used in Story 1.3).

3. **And** supported file format guidance is visible at upload/selection time (FR10 alignment — which container/codec families are accepted, at minimum as product-approved copy + extension/mime hints if listed in config).

4. **And** required semantic contrast for primary actions and status cues on this core creation surface meets WCAG 2.2 AA (UX-DR13 / NFR14 alignment: primary CTA, secondary actions, and any warning/info chips used for constraints).

5. **And** interactive controls for this flow expose stable `testID` values per architecture convention (`screen.element.action[.state]`), with proper accessibility labels for screen readers — without using visible text as the `testID`.

## Tasks / Subtasks

- [x] Establish canonical input constraint definitions (AC: 2, 3)
  - [x] Add a single source of truth for MVP numeric and enum limits (max duration, max resolution dimensions or tier labels, allowed format list) consumable by mobile; prefer `packages/contracts` exported constants or typed config shared with future backend DTO validation in Story 1.3+.
  - [x] If product has not yet ratified exact numbers, use clearly named placeholder constants (e.g. `MAX_SOURCE_VIDEO_DURATION_SEC`) with a short comment block listing the stakeholder decision needed — do not scatter magic numbers in UI.
- [x] Create-job feature scaffold aligned with architecture (AC: 1, 4, 5)
  - [x] Introduce `apps/mobile/src/features/create-job/` with `screens/`, `components/`, `hooks/`, `types/` as needed (architecture target tree).
  - [x] Add an Expo Router screen route (e.g. `apps/mobile/src/app/create-job.tsx` or equivalent) that renders the create flow and keeps one dominant primary action per step (UX-DR1).
- [x] Linear two-input selection UX (AC: 1)
  - [x] Implement distinct pick actions: source video (video-only) and reference image (image-only) using `expo-image-picker` (`launchImageLibraryAsync` with appropriate `mediaTypes` / options — video slot vs image slot must not accept the wrong media category).
  - [x] Enforce replacement semantics: re-picking replaces the prior asset for that slot; never allow two videos or zero video while claiming “ready” for the video slot.
  - [x] Surface selected state clearly (filename or thumbnail/preview where feasible without blocking on heavy processing).
- [x] Constraint and format guidance UI (AC: 2, 3)
  - [x] Render a compact, scannable “Requirements” / helper region that lists duration, resolution, and format limits from the shared config (not hard-coded strings diverging from constants).
  - [x] Avoid duplicating the full inline validation experience of Story 1.3 here: this story is visibility + selection enforcement; detailed invalid-state UX belongs in 1.3.
- [x] Accessibility & visual semantics (AC: 4, 5)
  - [x] Meet 44×44 pt minimum touch targets for primary pickers and primary navigation actions on this surface (UX-DR12).
  - [x] Pair color with text/icon for state (non-color-only cues).
  - [x] Verify contrast for primary and semantic colors against WCAG 2.2 AA for normal text and UI components on default light/dark theme tokens used on this screen.
- [x] Testing (AC: 1, 5)
  - [x] Add focused unit tests for selection reducer/hook logic: only one video, only one image, replace-on-repick.
  - [x] Add at least one RTL/component test asserting critical `testID`s exist on primary interactive roots.
- [x] Quality gates
  - [x] `npm run lint`, `npm run typecheck`, and mobile test script from repo root remain green.

## Dev Notes

### Story Type and Scope Guardrails

- **In scope:** First user-visible creation step: pick one video + one image, show constraints and format guidance, meet accessibility/contrast baseline, wire stable test IDs.
- **Out of scope for this story:** Deep inline validation with fix guidance (Story 1.3), job submission and API/Storage upload (Story 1.4), real-time job status (Story 1.5), draft persistence across process death (Story 1.7), Firebase Auth/session (Epic 2).
- **UX boundary:** Story 1.2 satisfies UX-DR2 for **constraint visibility**; UX-DR2’s “inline validation + fix guidance” is explicitly Story 1.3 per epics traceability — do not block Story 1.2 on full validator implementation, but **must** use the same constraint source of truth so 1.3 does not contradict UI copy.

### Previous Story Intelligence (1.1)

- Monorepo uses **npm workspaces** (not pnpm); root scripts orchestrate lint/typecheck/test.
- Mobile app path: `apps/mobile` with Expo; entry routes under `apps/mobile/src/app/`.
- Shared package `packages/contracts` exists but is minimal — extending it for constraint constants is consistent with “contracts as source of truth” direction.
- CI already runs mobile/backend/contracts gates; keep changes passing existing workflows.
- Do **not** reintroduce nested `.git` or per-app lockfiles under `apps/mobile`; depend on root `package-lock.json`.

### Technical Requirements

- Stack: Expo (SDK 55) + React Native + TypeScript; follow existing mobile patterns (`src/app`, `src/components`, etc.) while introducing `src/features/create-job` per architecture.
- Media picking: use `npx expo install expo-image-picker` for compatibility with the pinned SDK; request and handle library permissions per Expo docs.
- State: lightweight local/UI state for selections is sufficient for this story; persistence across restarts is deferred to Story 1.7.
- Do not call Firebase SDK from presentational components — if a future hook needs Firebase, place it under `src/infra/firebase` (architecture boundary).

### Architecture Compliance

- Feature mapping: core creation flow FR1–FR2, FR10 → `apps/mobile/src/features/create-job` (and related backend modules later).
- Respect **Frontend Test Identity Convention:** deterministic `testID`s, format `screen.element.action[.state]`; examples from architecture: `create-job.upload-video.button`, `create-job.upload-image.button`.
- Maintain **single dominant CTA** per screen in the stepped flow (UX-DR1).
- Prepare for eventual `infra/api-client` usage — no ad-hoc `fetch` for job APIs in this story.

### Library / Framework Requirements

- `expo-image-picker`: use for library selection; separate calls or options for video vs image slots; handle `canceled` results gracefully.
- Prefer Expo-supported config plugins if permission strings need plist/gradle updates — document any new permission copy in README or app config if required.

### File Structure Requirements

- Add feature code under `apps/mobile/src/features/create-job/`.
- Route file under `apps/mobile/src/app/` linking to the feature screen.
- Shared presentation pieces that are truly reusable and stateless may live under `apps/mobile/src/shared/components/`; avoid business rules in `shared/`.
- Constraint definitions: prefer `packages/contracts/src/...` (e.g. `constants/input-constraints.ts` or `config/input-constraints.ts`) exported through package entry — keeps mobile and future Nest DTOs aligned.

### Testing Requirements

- Satisfy architecture **Mobile workflow change** baseline: unit tests for hook/reducer + at least one component/flow-oriented test covering selection constraints.
- Preserve determinism: no network dependency in unit tests.

### Latest Technical Information

- Expo SDK 55 ships with React Native 0.83 / React 19.x line; use `expo install` to pin `expo-image-picker` to the SDK-compatible version.
- `expo-image-picker` provides `launchImageLibraryAsync` and `launchCameraAsync`; restrict `mediaTypes` so the video slot cannot pick a still-only asset and the image slot cannot pick a video.
- iOS behavior: some library videos require network download from iCloud — newer `expo-image-picker` versions include options affecting cloud download behavior; test on a real device when possible.

### Project Structure Notes

- Architecture document shows `apps/mobile/app/create-job.tsx`; **actual scaffold** uses `apps/mobile/src/app/`. New routes should live under `src/app` to match the implemented starter — treat architecture diagram as logical route name, not exact path.
- `pnpm-workspace.yaml` in architecture doc is outdated relative to repo; follow repo’s npm workspace layout from Story 1.1.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.2, Epic 1, FR coverage]
- [Source: `_bmad-output/planning-artifacts/epics.md` — UX-DR traceability: UX-DR1, UX-DR2 (visibility), UX-DR8, UX-DR11–UX-DR14, UX-DR19]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Core creation flow, input limits, FR1–FR2, FR10]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Frontend stack, Project Structure & Boundaries, Frontend Test Identity Convention, Requirements→Structure mapping]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — User journey, component strategy Input Compliance Checker (states split across 1.2 vs 1.3), accessibility/color]
- [Source: Expo docs — `expo-image-picker` installation and `launchImageLibraryAsync` usage]

## Dev Agent Record

### Agent Model Used

GPT-5.1 Codex

### Debug Log References

- Mobile: `npx expo install expo-image-picker` reported a post-install Expo CLI plugin error (`autoAddConfigPlugins.js`); dependency was still written to `package.json` and `app.json` includes the `expo-image-picker` config plugin manually.
- Jest: Initial `jest@30` + `jest-expo` mismatch caused `import outside test scope` from Expo winter runtime; resolved with `jest@29.7.x` per `jest-expo` peer alignment.

### Completion Notes List

- Implemented `packages/contracts` `input-constraints.ts` as single source for MVP limits + FR10-style format copy (`getCreateJobConstraintBullets()`), with placeholder comments for stakeholder-finalized numbers.
- Added `create-job` feature (screen, constraint card, media slots with `expo-image-picker`, reducer + hook). Third bottom tab “Create” routes to `create-job`; `mediaTypes` uses `videos` vs `images` only; `allowsMultipleSelection: false`.
- Theme extended with `primary` / `onPrimary` / info surfaces for WCAG-minded CTA and requirement chip styling; pickers use ≥44pt touch height and bullet + label pattern (not color-only).
- Tests: Jest + `jest-expo` + RTL; reducer unit tests; `CreateJobScreen` testIDs. Root `overrides` pin `@types/react` to dedupe; mobile `tsconfig` excludes `*.test.*` from `tsc`; web tabs `Pressable` ref typing fixed via `PressableProps` cast.

### File List

- `package.json`
- `package-lock.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-2-upload-inputs-with-constraint-guidance.md`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/input-constraints.ts`
- `apps/mobile/app.json`
- `apps/mobile/expo-env.d.ts`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest/cssMock.js`
- `apps/mobile/package.json`
- `apps/mobile/tsconfig.json`
- `apps/mobile/src/app/create-job.tsx`
- `apps/mobile/src/components/app-tabs.tsx`
- `apps/mobile/src/components/app-tabs.web.tsx`
- `apps/mobile/src/components/themed-text.tsx`
- `apps/mobile/src/constants/theme.ts`
- `apps/mobile/src/features/create-job/components/constraint-guidance.tsx`
- `apps/mobile/src/features/create-job/components/media-slot-picker.tsx`
- `apps/mobile/src/features/create-job/hooks/job-input-selection-reducer.ts`
- `apps/mobile/src/features/create-job/hooks/job-input-selection-reducer.test.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-input-selection.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-screen.test.tsx`
- `apps/mobile/src/features/create-job/types/selection.ts`
- `apps/mobile/test/smoke.test.js` (removed)

## Change Log

- 2026-03-25: Story context generated via `/bmad-create-story` — Ultimate context engine analysis completed - comprehensive developer guide created.
- 2026-03-25: Story 1.2 implemented — contracts input limits, create-job UI with `expo-image-picker`, a11y/testIDs, Jest+RTL tests; sprint status → review.
