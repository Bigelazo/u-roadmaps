# React Doctor: three sequential agent passes

Date: 2026-11-13.

The user requested exactly three sequential implementation subagents, each GPT-6.1 Sol with high reasoning. Each read and applied `code-review` and `vercel-react-best-practices`. Each implementation was independently reviewed on Standards and Spec by two parallel review subagents. No fourth implementation pass was started.

The baseline includes all original pending workspace changes, as confirmed by the user. Work ran in an isolated, prepared worktree. Only the implementation delta was applied back to the primary checkout, preserving its index and concurrent edits. All 27 integrated implementation files matched the reviewed worktree byte for byte immediately after application. No commits were made on the primary branch.

## Results

| Pass | Entry warnings | Exit warnings | Score | Implementation commit |
| --- | ---: | ---: | ---: | --- |
| 1 | 44 | 33 | 79 → 81 | `263963fcb4f1c409733edac1396825dc6c02ff1f` |
| 2 | 33 | 32 | 81 → 81 | `db986d7b908859fd2b5672dac5d3affd0d391b46` |
| 3 | 32 | 31 | 81 → 81 | `cc8d03ff01fd2d1dc1922e1174f071a870f63868` |

Baseline snapshot: `02cf7b4965062b8f4b752c013822163ab6cff3b1`.

Each next prompt came from the updated real React Doctor diagnostic set, rather than repeating the initial findings. The actual “Hand off to an agent” menu was used for all three passes. For pass 3, its clipboard copy returned empty; the parent saved the output of the exact installed `buildHandoffPayload` implementation using the same diagnostics and a stable diagnostics directory.

No React Doctor rules were suppressed and no detector configuration was changed by these passes.

## Changes

- Split shared helpers, contexts and hooks from component modules; made three internal-only helpers private. All ten mixed-export findings disappeared. This improves development Fast Refresh state preservation.
- Moved asynchronous inbox snapshot ownership into a provider hook, removing the invisible child that sent data upward through an effect. Preserved pending interactivity, acknowledged notices, unavailable-snapshot retry, User changes and error propagation. Added coverage for input-draft preservation and late completion from the previous User.
- Initialized the Scheduled unlock Date lazily. A real-editor measurement changed Date constructions during ten title edits from ten to zero, while retaining the displayed schedule. This is a minor allocation cleanup, with no claimed noticeable speedup.
- Built a Set outside repeated icon membership checks in the Node type picker. A local replay using the actual 80-icon catalog and three reserved identifiers, including Set construction, measured a median 515 ns → 450 ns per filter and approximately 240 bytes of additional retained Set memory. This is a tiny computation improvement, not a measured browser interaction speedup.

## Retained diagnostics

- Sequential await in Academic overview: **Needs evidence**. Unwrapping Next's searchParams promise is not enough to demonstrate an avoidable I/O waterfall; no request-latency improvement was established.
- NodeCreator preventDefault: **Rejected, high confidence** under the canonical intentional client-owned submission exception. The form manages staged Resources, progress, duplicate prevention, validation and retryable drafts.
- Two tutorial array lookups: **Needs evidence**. Actual collections are small; no representative benefit including allocation was established.

The isolated final scan retains 31 warnings: state adjustment after prop changes 11; complex React functions 6; large components 3; array lookups 2; await in loops 2; and one each of sequential await, prevented default, transition-all, complete state reset, derived state, render-time locale formatting and JSON deep clone.

## Validation

- Pass 1 focused locked tests: **19/19 passed**. A semantic mutation proved the new inbox assertion detects discarded resolved data.
- Pass 1 full locked unit suite: **1219 passed, 7 timeout failures** across six files. All six affected files then passed with one worker, **23/23**. The original full run remains failed; its baseline status is unproven.
- Pass 2 focused locked tests: **65/65 passed**.
- Pass 3 focused locked tests: **7/7 passed**.
- Types, lint and changed-file formatting passed in each isolated pass. Lint retained 13 unchanged warnings.
- Global formatting has an existing failure in `.github/workflows/react-doctor.yml`, preserved from the starting snapshot.
- Real full, affected-file and changed-scope Doctor checks ran in the relevant passes. No new diagnostics were introduced.
- Graphify was updated after code changes.
- No visible layout changed. Screenshots and E2E/integration suites were not run.

## Standards

Pass 1: **0 findings**. Helper extraction preserves feature boundaries and client directives. The provider hook subscribes to asynchronous completion rather than copying render-available data. No comments or substantiated Fowler smells introduced.

Pass 2: **0 findings**. Lazy initialization follows Vercel guidance, preserves terminology and adds no unnecessary abstraction.

Pass 3: **0 findings**. The Set is built outside repeated checks, uses a clear name and preserves membership semantics and module boundaries.

## Spec

Pass 1: **0 substantiated implementation findings**. Export and upward-effect root causes were addressed without suppression; inbox behavior remains covered. The await candidate is explicitly unresolved.

Pass 2: **0 findings**. The lazy initializer preserves schedule behavior; leaving the two other diagnostics follows the evidence requirement and client submission exception.

Pass 3: **0 findings**. The membership substitution preserves order, labels and choices. Measurement claims remain limited, and unproven candidates were retained.

Review totals: Standards **0**, Spec **0**; neither axis has a worst issue.

## Detailed artifacts

Isolated worktree and exact handoff prompts, canonical recipes, measurements, diagnostics, full check logs and per-pass reports:

`/var/folders/dd/klb51fzs2gld1_tsy7_8fx7w0000gn/T/memoria-doctor-three-y3cznsh9`

## Integrated checkout verification

- `pnpm typecheck`: passed.
- `npx react-doctor@latest --verbose --yes`: passed; **31 warnings, 81/100**, matching the reviewed final pass. Diagnostics and log are saved in `integrated/` and `integrated.log` beside the detailed artifacts.
- `graphify update .`: completed; re-extracted 27 changed files and updated the ignored graph outputs.
- The original staged workflow remains staged; the three-pass implementation remains available as working-tree changes on the primary checkout.

