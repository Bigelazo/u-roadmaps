# Issue #188 validation

Date: 2026-10-08. Baseline: `7cb9a91` (the recorded closure pass from #192).

The remaining implementation refuses teaching-staff mutations with HTTP 409,
`ROADMAP_CLOSED`, and a Spanish read-only message. The shared editor guard takes
the Roadmap lock and then rereads its recorded closure before any mutation.
Creation resolves the synchronized freeze date or semester fallback and refuses
at the first Chilean instant after the complete freeze day.

The canvas consumes recorded closure in refreshed projections. A closure refusal
latches read-only state for that Course offering, reloads its projection, and
keeps the refusal visible even if recovery fails. Canvas preview remains
inspectable. Recovery cannot publish a stale error after changing Course offering.

## Test seams and regression evidence

The ticket pre-agrees pure rules, HTTP with real PostgreSQL, and browser seams.
The first edit regression failed with 200 instead of 409; the creation regression
failed with 201 instead of 409; the browser regression retained editing controls
after a refused save. Each passed after its implementation slice.

The closure spec passes all 12 cases. It covers every Node, Dependency, Node type,
Resource (including file upload), visibility, Teacher block, unlock, schedule and
position mutation; unchanged content after refusals; creation through the entire
freeze day and both missing-calendar fallbacks; student access after Teacher block
removal; preserved Prerequisite blocks; Completion and simulation refusal; silent
closure with pending notices preserved; repeated passes; atomic failure recovery;
the edit/closure race; a stale open canvas's refused save; and foreground recovery
without a save. The configured E2E browser is Chromium, using local PostgreSQL.

Focused unit checks: 9 pure closure-rule cases and 25 canvas-session cases pass.
Typechecking, ESLint and Prettier of changed files pass.

## Single code-review

One invocation reviewed `git diff 7cb9a91...HEAD`, with separate Standards and
Spec agents. Both suggested fixes were implemented:

- Standards: extract duplicated closure failure handling and recheck the active
  Course offering after awaiting recovery.
- Spec: include `closedAt` in the additional teaching DTO and verify foreground
  refresh removes editing controls without a failed mutation.

No second code-review was run.

## Knowledge graph

`graphify update .` refreshed the AST graph without an API call. SQL extraction
remains unavailable because the installed environment lacks `tree_sitter_sql`;
this does not affect the TypeScript graph or test execution.

## Full-suite validation

The initial aggregate run stopped after unit tests: 71 files/460 tests passed,
and eight tests failed in two database mock fixtures that omitted the new
Roadmap reread. Both fixtures now model an open Roadmap for that read; their
existing notification assertions are unchanged. Their focused rerun passed all
nine tests.

The subsequent complete unit run passed all 73 files and 468 tests in 23.86 s.
The aggregate run also passed typechecking before entering E2E.

That complete run passed all 151 E2E tests. It also exposed an unrelated-offering
cleanup race: Prisma could load a candidate Roadmap whose Course offering had
just been deleted, causing that closure pass to stop early. The pass now skips
such deleted candidates.

The final `pnpm test` run, including this guard and every review fix, exited 0:
73 unit files / 468 unit tests passed in 24.67 s, and 151 Chromium E2E tests
passed in 1.5 minutes, with no failures or omissions. The previous cleanup-race
warning did not recur; the deliberately injected closure failure was still
reported and its atomic rollback/recovery scenario passed.
