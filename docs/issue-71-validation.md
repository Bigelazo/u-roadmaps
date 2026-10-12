# Issue #71 validation

Date: 2026-10-12. Baseline: `fdd64bea55e05d7a9ad7d9b004c28fd741086c13`.

Small touch viewports (below 1024px with a coarse primary pointer) present the
Node action menu in the existing shadcn `Sheet`, positioned at the bottom.
The desktop fan and touch sheet consume the same ordered action definitions
and emit the same editing intents, keeping previews, confirmations, mutations,
authorization, and draft guards in their existing workflows.

The modal blocks the entire page, contains keyboard focus, and returns focus
to the contextual indicator on dismissal. Native touch restoration waits for
the modal background to become interactive. Action selection suppresses that
restoration so confirmations and the Resource editor retain focus. Resource
commands expand the mobile editor before its existing composer receives focus.

## Focused validation

- The first browser regression failed because the indicator was unavailable on
  a small touch viewport. The implemented journey passes without hover.
- `pnpm typecheck`: passed repeatedly.
- Focused graph, Node editor, and canvas session unit tests: 99 passed.
- Final trigger-refactoring check: 50 graph/Node unit tests passed.
- `pnpm test:e2e tests/e2e/node-action-sheet.spec.ts`: all four Chromium touch
  journeys passed. They cover ordering, visible labels, contextual actions,
  bottom placement, focus containment/return/handoff, backdrop isolation,
  hidden-node omission, visibility, Resource creation, dirty-draft protection,
  deletion, pending controls, recovery after a failed mutation, and student,
  Canvas preview, and frozen-Roadmap authorization.
- Existing desktop radial focus-treatment and geometry browser checks passed.
- ESLint and Prettier of changed code, and `git diff --check`: passed.

Validation uses the existing local PostgreSQL service and the configured
dedicated test databases. No service was restarted.

An existing uploaded `.ts` attachment caused the initial production build and
typecheck to fail on unresolved relative imports. TypeScript now excludes
`uploads` and `uploads-e2e`, preserving attachment contents. Existing graph
tests declare their desktop media-query environment, and the React Flow
`fitView` mock now returns its public API's promise instead of `undefined`.

## Single code-review

One code-review invocation compared the implementation with the baseline using
parallel Standards and Spec agents. Standards reported no blocking violations
and one nonblocking duplication in the contextual trigger, which was removed.
Spec reported zero substantive findings. No second code-review was run.

## Knowledge graph

`graphify update .` refreshed the AST graph without semantic extraction or API
cost. It reported a changed community set and retained generated navigation
labels; this does not affect application validation.

## Full-suite validation

The final aggregate command is
`pnpm exec dotenv -e .env -- env -u NEXTAUTH_URL pnpm test`.
The fixed origin is removed for unit tests that exercise multiple NextAuth
origins; Playwright assigns its own isolated origin.

The first aggregate run passed typechecking, 458 unit tests (67 files), and 93
integration tests (16 files). Its browser run passed 195 of 196 tests. The
teaching Practice roadmap's reopening test failed because its Node actions
remained hidden. The preserved trace showed every React Flow Node becoming
`visibility: hidden` after opening the menu, while the correct action was
present. The existing projection replacement and tutorial lifecycle are
unchanged by this issue. No timeout or retry policy was changed.

The same case passed independently:
`pnpm test:e2e tests/e2e/practice-roadmap.spec.ts --grep 'canvas actions'`
(one passed, 16.3 seconds including preparation). The initial trace was saved
as `/private/tmp/issue-71-practice-initial-trace.zip` before rerunning.

The second aggregate run exited successfully against `7f3bbc7`:

- TypeScript: passed.
- Unit: 67 files, 458 tests passed (21.67 seconds).
- Integration: 16 files, 93 tests passed (9.95 seconds).
- Chromium E2E: 196 tests passed (3.2 minutes), with no skipped tests or runner
  retries. The teaching Practice roadmap reopening case passed in 9.9 seconds.

The initial intermittent Practice roadmap failure was not reproduced in the
isolated case or the second complete run. Its cause remains unconfirmed.

## Atomic implementation commits

- `aa29b34`: exclude uploaded attachments from TypeScript build inputs.
- `2758e21`: expand the mobile Node editor for Resource commands.
- `7f3bbc7`: add the shadcn action sheet, shared actions, and browser regressions.

Publication sequence: commit this validation record, synchronize `main` with
`git pull --rebase origin main`, push the commits, then close #71.
