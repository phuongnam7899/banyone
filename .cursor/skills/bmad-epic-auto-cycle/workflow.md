# Epic Auto Cycle Workflow

**Goal:** Process all stories in one epic using this strict sequence per story:
1) `bmad-create-story`  
2) `bmad-code-review` (fix findings before continuing)  
3) `bmad-qa-generate-e2e-tests` (fix failing tests/issues before continuing)  
4) Update `sprint-status.yaml` story status to `done`

**Hard rule:** Never move to the next step, and never move to the next story, until current-step issues are resolved.

---

## Initialization

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:
- `communication_language`
- `implementation_artifacts`
- `date` as current datetime

Set:
- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`

---

## Inputs

Required input:
- `epic_num` (example: `6`)

Optional input:
- `start_story_key` (example: `6-2-plan-selection-and-store-purchase`) to resume from a specific story

If `epic_num` is missing, ask for it and wait.

---

## Execution

1. Load the full `sprint_status` file.
2. From `development_status`, collect story keys for this epic matching `^{{epic_num}}-[0-9]+-`.
3. Sort by story number ascending.
4. Build the processing list:
   - Include stories with status in: `backlog`, `ready-for-dev`, `in-progress`, `review`
   - Exclude `done`
   - If `start_story_key` is provided, start from that story in the sorted list
5. If no stories remain, report epic is already complete and stop.

For each story in the processing list, run this strict sub-flow:

### A) Story Preparation

- If current status is `backlog`, run `bmad-create-story` for that exact story key.
- If status is already `ready-for-dev` or beyond, do not recreate unless user explicitly asks.
- If story creation fails or has blockers, resolve blockers first; do not continue.

### B) Code Review Gate (must pass)

- Run `bmad-code-review` focused on this story's changes.
- If review returns findings, fix them immediately.
- Re-run `bmad-code-review` after fixes.
- Repeat fix -> review loop until review is approved / no blocking findings remain.

### C) QA Gate (must pass)

- Run `bmad-qa-generate-e2e-tests` focused on this story.
- If test generation or test execution fails, fix the issues immediately.
- Re-run QA until generated tests and test execution pass without blocking failures.

### D) Story Completion Update

- Update `development_status[story_key] = done` in `sprint_status`.
- Update `last_updated` to current datetime.
- Save file preserving existing comments and structure.

### E) Continue

- Move to the next story only after step D completes successfully.

After all stories are done:
- If every story under this epic is `done`, set `development_status[epic-{{epic_num}}] = done`.
- Update `last_updated`.
- Save.

---

## Reporting

At the end, report:
- Epic processed
- Stories completed in this run
- Any story skipped and why
- Final epic status
