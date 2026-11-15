# React Doctor — second pass, 2026-11-13

The owner authorized scoped ignores for verified false positives and requested
three further real problems, with root-cause diagnosis before fixes. This pass
fixes report submission re-entry, unnecessary Motion features in the browser,
and repeated construction of the academic-calendar formatter.

## Results

The main checkout's real `npx react-doctor@latest --verbose` now reports
**44 warnings, zero errors, score 79/100**. The previous pass ended with 226
reports: 179 verified false-positive occurrences are now covered by scoped
ignores, and the three confirmed findings were corrected in code.
`react-doctor/require-reduced-motion` remains globally ignored as requested.
The three newly fixed rules are enabled and report zero occurrences.

## Root cause 1: report submission lifecycle

Rule: [no-async-event-handler-without-reentry-guard](https://react.doctor/docs/rules/react-doctor/no-async-event-handler-without-reentry-guard).

**Confirmed, high confidence.** The disabled button was driven by React state,
which does not synchronously prevent a second submit before the controls update.
The handler also cleared `sending` as soon as HTTP headers arrived, before it
finished reading an error response body. That reopened the dialog during an
unfinished submission and allowed duplicate requests or stale errors from an
earlier attempt to interfere with a retry.

Two regression tests exercised the rendered form and the real submit handler
with controlled fetch responses. The final tests were also rerun against the
original report handler: the two new cases failed and the three original cases
passed (`report-final-tests-on-baseline.log`). Before the fix, two submissions made two fetch
calls rather than one, and the form became enabled while a streamed error body
was still pending. This is a concrete submission bug of moderate severity: a
user can send duplicate reports or encounter confusing retry behavior. The
broader server security boundary is unchanged.

The handler now takes a synchronous ref lock before its first wait and releases
that lock in `finally`, after processing the response. The same lock protects
closing the dialog. The button, fields, error messages, draft preservation, and
successful retry behavior remain covered by tests. There is no rule exception
for this fix.

Files: `src/app/_components/ReportProblemDialog.tsx` and
`tests/app/_components/ReportProblemDialog.test.tsx`.

## Root cause 2: full Motion feature bundle

Rule: [use-lazy-motion](https://react.doctor/docs/rules/react-doctor/use-lazy-motion).

**Confirmed, high confidence after measuring the build.** `RoadmapNode` was the
remaining source import of the full `motion` component factory. Its actual uses
are animation values, enter/exit animations, and hover, focus, and press gestures.
Dragging is handled by React Flow; this subtree uses no Motion drag, pan, or
layout projection features. Loading those unused features increased browser work
and transfer size, especially on slower devices or connections.

All Motion elements in the node subtree now use `motion/react-m`. One
`LazyMotion features={domAnimation} strict` boundary owns that subtree, so the
node remains usable through its existing exported interface and its animations
keep working when rendered independently. Every full Motion descendant was
converted before enabling strict mode. This follows the installed Motion 14.2.0
API and the [official bundle-size guidance](https://motion.dev/docs/react-reduce-bundle-size).

A separate production build held the other current client changes fixed and
restored only the old `RoadmapNode` import. Measurements used the actual client
entry files listed by the Course offering page's Next.js client manifest:

| Metric | Full Motion | Lightweight Motion | Reduction |
| --- | ---: | ---: | ---: |
| JavaScript entry files | 15 | 15 | 0 |
| Minified JavaScript bytes | 1,371,208 | 1,307,546 | 63,662 |
| Gzip bytes | 450,660 | 432,522 | 18,138 |

This is about 4% of the measured route's gzip JavaScript. It is a measured bundle
improvement, not a claim of a specific page-load timing reduction. Animations,
interaction behavior, and reduced-motion policy were preserved. The selected
component and animation regression tests passed (41 tests).

File: `src/features/roadmap/graph/RoadmapNode.tsx`.

## Root cause 3: repeated locale-data initialization

Rule: [js-hoist-intl](https://react.doctor/docs/rules/react-doctor/js-hoist-intl).

**Confirmed, high confidence; low practical severity.** Both current-term
selection and calendar-publication checks call `santiagoDate`. Each invocation
constructed the same `Intl.DateTimeFormat`, even though its locale, time zone,
and formatting options are fixed. The duplicate work provides no new result.

The formatter now lives at module scope. The input date is still formatted on
every call; date results are not cached. The existing Santiago timezone and
year/semester boundary tests passed.

A local microbenchmark called both public operations 2,000 times. The repeated
constructor count dropped from 4,000 to zero after module initialization (one
formatter per module instance). The measured loop dropped from 153.6 ms to
13.3 ms. This measures only the helper; no visible latency problem was established
for a typical user. It removes avoidable backend work without changing dates.

File: `src/integrations/academic-calendar/server.ts`.

## Verified false-positive ignores

The owner explicitly authorized these exceptions. None of these rules was
switched off globally. The existing global reduced-motion preference is separate.

| Occurrences | Scoped rule / path | Evidence |
| ---: | --- | --- |
| 130 | `artifact-env-leak`, historical `.next-e2e/server/**` | Private server code misclassified because the scanner only recognizes `.next/server`; reproduction in the first-pass report. |
| 36 | `artifact-secret-leak`, same private server tree | Only the PEM format marker in `jose`; no usable key in the matched text. |
| 4 | `raw-sql-injection-risk`, historical generated copies and `spec-326` helper | Fixed allowlist of key positions 2 and 3, no user-supplied SQL; current source uses fixed tagged fragments with the rule enabled. |
| 3 | `jwt-insecure-verification`, three exact `spec-326` server chunks | `jose/dist/node/cjs/jwt/unsecured.js` implements its optional unsecured-JWT utility. It is not the application's verification call. Application code uses `jwtVerify(..., { algorithms: ['HS256'] })` and does not call `UnsecuredJWT`. |
| 3 | `effect-needs-cleanup`, three exact component files | Landing tour clears every captured timeout; DependencyPath returns Motion's unsubscribe function; routing teardown cancels status/retry timers and ignores late results. Existing lifecycle tests verify subscription removal and routing cancellation. |
| 1 | `server-sequential-independent-await`, Course offering page | Synchronization materializes or changes the row that the next database read needs. Parallel execution can read before the Course offering exists. |
| 1 | `nextjs-no-a-element`, third-party licenses page | Opens the static `/vendor/libavoid/0.4.5/LICENSE` document, not a Next.js application page. |
| 1 | `js-set-map-lookups`, StudentRoster | Receiver is a string: substring name matching is required. Replacing it with Set membership changes search semantics. |

The canonical recipes for these rules were fetched with no-cache headers before
classification. For the literal `(site)` route group, the ignore pattern uses
`[(]site[)]`, because picomatch otherwise treats parentheses as pattern syntax.
All new exceptions are centralized in `doctor.config.json`.

## Regression discovered by broader validation

The prior SQL hardening constructed its fixed fragments while importing the
module. Two unrelated notification tests intentionally provide only a database
mock and therefore failed on that eager import-time access. Fragment creation
now happens only when `dependencyKeyNode` is called, preserving the previous
initialization behavior. The fragments remain fixed `Prisma.sql` templates and
the SQL security rule remains enabled for current source.

No notification test mocks were expanded to conceal this regression.

## Verification

- Full unit suite with the repository database lock and two workers:
  **122 files, 1,224 tests passed**.
- Full real-PostgreSQL integration suite with its lock:
  **28 files, 153 tests passed**.
- Production builds for both Motion variants passed. An additional comparison
  build launched during an overloaded run was canceled and then rebuilt alone.
- TypeScript, targeted ESLint, Prettier, and `git diff --check` passed after the
  final SQL initialization adjustment.
- The first broad parallel attempt exceeded machine resources (8 GB RAM, 7%
  free reported), causing worker/test timeouts and a Playwright server-start
  timeout. Running the unit suite with two workers removed those timeouts.
  Test timeouts and application behavior were not weakened.
- Full E2E run: 38 passed, three failed, one interrupted, 259 not run because
  the repository's three-failure limit stopped the suite. The failures concern
  account-cache propagation, a footer visibility expectation, and compact-editor
  pointer interception.
- Focused animation and interaction E2E run: 12 passed, two failed. The sequential
  Dependency animation test, connector click creation, all seven action-sheet
  cases, and three practice cases passed. The two failures are an expected opaque
  connector pseudo-element whose computed background is transparent, and the
  existing Create control being covered by the canvas pane.
- A baseline with the old Motion implementation reproduced those same five
  current-run failures, as well as two further compact-editor cases. The final
  comparison restored all three implementations to their pre-pass versions and
  reproduced all seven failures. Logs: `e2e-all-changes-baseline.log`.
- Chromium visual inspection at 1440×900 rendered eight nodes and reported no
  page errors. Screenshot:
  [.playwright-mcp/doctor-motion-practice-1440.png](../../.playwright-mcp/doctor-motion-practice-1440.png).
  The shared Playwright MCP browser was occupied, so this inspection used a fresh
  isolated Playwright Chromium instance against the repository's development
  server.

The three corrected rules were checked with the real verbose React Doctor after
each fix. Final full-root diagnostics: `/var/folders/dd/klb51fzs2gld1_tsy7_8fx7w0000gn/T/react-doctor-bf2d08c5-f532-47d3-82f5-8242ad6d6141`.
Raw recipes, reproduction failures, test logs, route manifests/sizes, and the
minimal benchmarks are under `/tmp/react-doctor-second-pass/`.

The E2E suite is **not green**. A focused selection does not replace that full
suite result; the unexecuted cases remain unverified. No failing assertion was
removed, no timeout was increased, and none of these unrelated UI behaviors was
changed to improve the test result.

Graphify's AST index was updated after the code changes. Its community structure
changed, and saved community names were partially reassigned automatically; this
was an AST-only update with no semantic-document refresh.

The seven reproduced baseline E2E failures also need follow-up. They are listed
in `e2e-all-changes-baseline.log`, with traces in the baseline worktree's
`test-results/`. They were not converted into passing assertions in this pass.

## Follow-up only

These 44 warnings remain unreviewed in this pass:

| Rule | Occurrences |
| --- | ---: |
| `server-sequential-independent-await` | 1 |
| `only-export-components` | 10 |
| `no-pass-data-to-parent` | 1 |
| `no-prevent-default` | 1 |
| `no-eager-new-in-use-state-initializer` | 1 |
| `js-set-map-lookups` | 3 |
| `no-high-complexity-react-function` | 6 |
| `no-giant-component` | 3 |
| `no-adjust-state-on-prop-change` | 11 |
| `no-transition-all` | 1 |
| `no-reset-all-state-on-prop-change` | 1 |
| `async-await-in-loop` | 2 |
| `no-derived-state` | 1 |
| `no-locale-format-in-render` | 1 |
| `no-json-parse-stringify-clone` | 1 |

Do not infer a user-visible failure from an unreviewed diagnostic. No other
warning family was fixed, no historical worktree source was rewritten, and no
GitHub issue, comment, or pull request was published.
