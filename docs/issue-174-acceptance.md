# Acceptance audit of #174

Issue: [Roadmap live updates for teaching staff only](https://github.com/Bigelazo/u-roadmaps/issues/174).
The implementation was delivered in `8039bab` (#176). This parent audit checks
the complete specification and adds stale student action regressions at its
existing browser/HTTP seam. It does not implement the notice redesign in #175.

| Criteria / user stories | Implementation and regression evidence |
| --- | --- |
| Stable student and observer canvas; no interruption (1, 5, 6) | `session.tsx` ignores ordinary content signals for the student experience. `RoadmapCanvasSession.test.tsx` exercises changes and recovery without replacing the canvas; `academic-participation.test.ts` verifies that observers map to the student role. `own-sse-notifications.spec.ts` observes stable student details and no dialog after real teacher edits. |
| Refresh and same-Roadmap notice entry (2, 3) | A fresh server-prepared opening identifier restarts `RoadmapCanvasSession`. The real SSE spec verifies both notice navigation on the same Roadmap and browser refresh. Dismissing the notice dialog retains the session cutoff. |
| Live Inbox and counters; recovery for every User (4) | The shared SSE provider and Inbox/counts invalidations remain active for every role. The real SSE spec observes live badge/feed updates, cross-tab recognition, and offline recovery while student content remains stable. `own-realtime.test.tsx` covers recovery invalidations. |
| Live teaching canvas and draft conflicts (7–11, 14) | `roadmap-realtime-prototype.spec.ts` observes a colleague's edit, retained draft, warning, disabled save, explicit keep-draft choice and remote deletion. It also covers transient failures and reconnection. ADR-0015 documents that removing teaching live reloads requires replacement concurrency protection. No stale-write check was added. |
| Independent Canvas preview (12) | Existing `roadmap-canvas-preview.spec.ts`, `roadmap-simulation.spec.ts` and canvas-session tests cover independent simulated progress. |
| Entry-only dialog behavior (13) | Live invalidations do not navigate or prepare a new opening; they never open a notice dialog. The Change summary and its redesigned recognition rules belong to #175; the current notice-entry dialog remains transitional. |
| Participation loss (15) | A user-scoped access invalidation makes an authorized HTTP request. The SSE browser test revokes Participation in PostgreSQL, observes HTTP 403 and removal of protected content. The canvas-session test verifies authoritative denial. |
| Rejected actions from a stale student canvas (16) | Three new cases in `student-node-access.spec.ts` open an accessible Node, then block, hide or delete it through teaching HTTP. After a real notice arrives, the old detail remains visible. Clicking Complete receives 403/404, shows the existing error and retains the stale view. |
| Role-scoped signals, recovery and documentation | `session.tsx` restricts content/recovery reloads to teaching sessions. The server still sends identifier-only content signals; students ignore them, preserving user-scoped access-loss handling. `docs/notifications-sse.md` describes role-scoped behavior and ADR-0015. |

## Validation — 2026-10-06

Focused canvas-session and academic-role validation: **24 unit tests passed**.
The three new stale-action browser cases passed. Final `pnpm test` completed
with **exit code 0**: typechecking, **61 unit files / 321 tests**, and
**76 Chromium E2E tests**, zero failures or skips, with two workers. E2E took
59.4 seconds; the complete command took 85.76 seconds. The local Playwright
configuration selects Chromium only; Firefox is not claimed by this audit.
Pre-existing edits in `playwright.config.ts` and `docs/agents/testing.md` are
outside this commit.

The first focused browser run failed because its alert selector also matched
Next's route announcer; the selector now names the product error. An initial
validation wrapper incorrectly propagated `.env` into unit tests, causing two
URL tests to fail before E2E. Preserving the normal command environment repaired
the wrapper; the successful final run above used that environment. Neither
failure required a production change.

Code-review ran **once**, covering `8039bab` from fixed point `c812ae1` and this
audit's test/document changes. **Standards: 0 findings. Spec: 0 findings.**
The Spec reviewer requested filling the validation result after execution; that
is recorded here. There are no outstanding review fixes. ESLint, Prettier and
`git diff --check` passed. `graphify update .` refreshed the AST graph.

The final command's database audit preserved the development fingerprint
`1ac558d2cb366285e2bdef5529079188`, and all **826** historical seeded
acknowledgements retained fingerprint `9de8e5a3ddd91c4136db4e829a216321`.
Test-owned Courses, Users and notice-rejection triggers each returned **zero**.
