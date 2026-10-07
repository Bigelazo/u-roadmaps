# Issue #183 — Grouped roadmap notice

Validated on 2026-10-06 against the existing local PostgreSQL E2E database.

- `pnpm typecheck`: passed.
- ESLint and Prettier for changed source/tests: passed.
- Final sequential `pnpm test:unit`: 65 files, 338 tests passed (23.78 s).
- Final sequential `pnpm test:e2e`: 100 tests passed (1.4 min), Chromium only,
  matching the pre-existing working-tree Playwright configuration.
- Focused coverage: three targets after twelve edits; all three counters;
  grouped browser row and Roadmap-only navigation; withdrawal to two targets;
  independent Roadmaps; absorption date/order; grouping before pagination.
- Unit threshold tests also cover availability exclusion. Existing availability
  E2E tests verify its individual row and count.

The Inbox requests `groupBy=roadmapId`; the ungrouped HTTP list retains its
individual notice contract. Browser journeys formerly selecting individual
notices now select the grouped row when the threshold is met.

Code-review was used once against `ed272fb`. Standards found one heuristic issue:
its generic helper return type claimed to preserve arbitrary payload subtypes.
The helper now declares explicit supported row/JSON types. Spec found no issues.

Earlier full E2E runs identified individual-row expectations in classification,
Dependency, access, Node count and Resource journeys; those were updated and
verified. One full unit run hit the existing architecture test timeout while
other validation workloads ran; the final sequential suite passed without
changing timeouts.

`graphify update .` completed with AST-only extraction. SQL extraction remains
unavailable because the installed graphify lacks `tree_sitter_sql`; no graph
health corruption was reported.

Pre-existing edits to `CONTEXT.md`, `docs/agents/testing.md`, and
`playwright.config.ts` are excluded from the implementation commit.
