# Story 1.1: Set Up Initial Project from Starter Template

Status: review

## Story

As a developer,  
I want the Expo mobile app and NestJS backend initialized with shared workspace structure,  
so that subsequent stories can deliver user-facing value on a stable, consistent platform.

## Acceptance Criteria

1. **Given** a new repository workspace  
   **When** the project is bootstrapped with Expo and NestJS starters  
   **Then** both apps run locally with documented setup commands.
2. **And** shared TypeScript base config and lint/test scripts are available.
3. **And** CI baseline checks for lint, typecheck, and unit test command execution are configured and passing for both apps.

## Tasks / Subtasks

- [x] Bootstrap monorepo foundation and root tooling (AC: 1, 2, 3)
  - [x] Create root workspace files: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.gitignore`, `.env.example`.
  - [x] Add root scripts for workspace-level `lint`, `typecheck`, and `test` orchestration.
  - [x] Ensure root package manager choice is consistent across docs and CI scripts.
- [x] Initialize Expo app in `apps/mobile` with SDK 55 template (AC: 1)
  - [x] Run `npx create-expo-app@latest --template default@sdk-55 apps/mobile`.
  - [x] Verify app starts locally with documented command.
  - [x] Keep starter routing/layout in place and avoid feature implementation beyond scaffold baseline.
- [x] Initialize NestJS app in `apps/backend` (AC: 1)
  - [x] Run `nest new apps/backend` from workspace root context.
  - [x] Verify backend starts locally with documented command.
  - [x] Preserve starter test setup and minimal module wiring.
- [x] Set up shared TypeScript and lint/test conventions (AC: 2, 3)
  - [x] Configure app-level `tsconfig.json` files to extend root `tsconfig.base.json`.
  - [x] Add/align ESLint config package and script usage for mobile and backend.
  - [x] Add baseline unit test command wiring for both apps (existing Nest tests + minimal mobile baseline command).
- [x] Add baseline shared package scaffold (AC: 2, 3)
  - [x] Create `packages/contracts` package with TypeScript config and `src/index.ts`.
  - [x] Wire workspace dependencies so both apps can import shared contracts package later.
- [x] Configure CI baseline workflows (AC: 3)
  - [x] Add `.github/workflows/mobile-ci.yml`, `.github/workflows/backend-ci.yml`, `.github/workflows/contract-ci.yml`.
  - [x] Ensure each workflow runs install + lint + typecheck + unit tests for its scope.
  - [x] Keep workflows fast and deterministic (no deployment in this story).
- [x] Document local setup and run commands (AC: 1, 3)
  - [x] Update `README.md` with prerequisites and first-run steps for mobile/backend.
  - [x] Include exact commands for lint/typecheck/test and app start commands.

## Dev Notes

### Story Type and Scope Guardrails

- Story type is **Enabler (Platform Foundation)** and must remain non-user-facing.
- Respect the data scope constraint: create only foundational project/config assets; do not add full production schemas or deep domain models in this story.
- Defer business logic, API endpoints, and feature workflows to later stories.

### Technical Requirements

- Technology baseline must match architecture: Expo React Native starter + NestJS starter, TypeScript-first across both apps.
- Keep backend API style decisions (`/v1`, canonical envelope, lifecycle/error taxonomy) as future-oriented constraints; do not pre-implement full endpoint surface in this story.
- Maintain feature/module boundaries described in architecture even if many modules are still placeholders.

### Architecture Compliance

- Follow project structure and boundaries from architecture:
  - Mobile scaffold at `apps/mobile`.
  - Backend scaffold at `apps/backend`.
  - Shared contracts at `packages/contracts`.
- Keep third-party integrations (Firebase/inference/provider code) out of UI components and controller layers from day one by placing placeholders in proper infra/adapters locations only when needed.
- Preserve naming conventions:
  - File names in kebab-case.
  - TypeScript symbol naming (`PascalCase` types/classes, `camelCase` functions/variables).

### Library / Framework Requirements

- Expo starter command should target SDK 55 template explicitly: `--template default@sdk-55`.
- NestJS project creation should use official CLI flow (`nest new`).
- Keep Nest test baseline compatible with scaffold defaults; avoid migration to alternate runners in this story unless required by starter output.

### File Structure Requirements

- Align with architecture target tree at minimum for:
  - `apps/mobile`
  - `apps/backend`
  - `packages/contracts`
  - root tooling and CI workflow folders.
- Add only essential starter and quality-gate files required for local run and CI baseline.
- Avoid speculative folders/files that add noise without immediate value.

### Testing Requirements

- Required passing commands for this story:
  - workspace lint
  - workspace typecheck
  - workspace unit test commands
  - local mobile and backend startup commands
- CI workflows must execute lint/typecheck/test command paths for mobile, backend, and contracts package.
- If mobile starter has limited tests by default, provide a minimal deterministic test command path rather than leaving CI undefined.

### Latest Technical Information

- Expo documentation currently supports explicit SDK 55 bootstrap using `create-expo-app` with `--template default@sdk-55`; include this exact command in setup documentation.
- NestJS CLI documentation continues to use `nest new` as the standard scaffold command for new projects.
- TypeScript monorepo best practice remains using a root shared tsconfig (`tsconfig.base.json`) with per-project extension to keep strictness and module resolution aligned.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.1]
- [Source: `_bmad-output/planning-artifacts/epics.md` - Additional Requirements]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Starter Template Evaluation]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Project Structure & Boundaries]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Agent Implementation Guardrails]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Required CI Gates]
- [Source: Expo docs search result - create-expo-app SDK 55 template]
- [Source: NestJS docs search result - CLI `nest new`]

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex-low

### Debug Log References

- Story generated via `/bmad-create-story` workflow with sprint auto-discovery.
- Bootstrapped Expo SDK 55 app with `npx create-expo-app@latest apps/mobile --template default@sdk-55 --yes`.
- Bootstrapped NestJS app with `npx @nestjs/cli@latest new apps/backend --package-manager npm --skip-git`.
- Ran workspace validations from repository root: `npm run lint`, `npm run typecheck`, `npm run test`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented starter monorepo structure with root quality scripts and shared TypeScript base config.
- Added `packages/contracts` baseline package and wired local package dependency from mobile/backend.
- Added CI baseline workflows for mobile, backend, and contracts lint/typecheck/test execution.
- Added deterministic mobile baseline unit test command and preserved Nest starter test setup.
- Story status set to `review`.

### File List

- `_bmad-output/implementation-artifacts/1-1-set-up-initial-project-from-starter-template.md`
- `.editorconfig`
- `.env.example`
- `.gitignore`
- `.github/workflows/backend-ci.yml`
- `.github/workflows/contract-ci.yml`
- `.github/workflows/mobile-ci.yml`
- `README.md`
- `package.json`
- `package-lock.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `apps/backend/*` (NestJS starter scaffold and config updates)
- `apps/mobile/*` (Expo starter scaffold, lint setup, and baseline test wiring)
- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/tsconfig.json`

### Change Log

- 2026-03-24: Bootstrapped Expo + NestJS monorepo foundation, added contracts package and CI baseline workflows, and validated lint/typecheck/test command paths.
