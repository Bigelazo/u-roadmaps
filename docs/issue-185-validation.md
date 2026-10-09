# Issue #185 validation

Validated on 2026-10-07 against issue #185 and ADR-0014, using the existing local
PostgreSQL service. The single code-review compared the implementation with
`5b90873de1902202032c77424eb7f02a29ff1eca`.

## Standards

One P3 finding: the changed test title used “Course” when it described loss of
access to a Course offering. `docs/agents/domain.md` requires the terminology
from `CONTEXT.md`. Fixed the title to use “Course offering”. No actionable
baseline code smells were reported.

## Spec

Two findings against ADR-0014 section 11, which requires a recovered
Participation to start with no restored notices:

- P1: opening and recognition could race with withdrawal and leave an opening
  that recreated withdrawn targets after reactivation. Both now acquire the
  Participation row lock before the recipient/Roadmap advisory lock, using the
  same order as delivery. API E2E covers concurrent opening and withdrawal.
- P2: migration cleanup removed notices for already inactive Participations but
  retained their saved openings. It now deletes those openings too.

All three findings were fixed. Standards: 1 finding, worst P3. Spec: 2 findings,
worst P1. Code-review was not invoked again.

## Verification

- Full `pnpm test`: passed with exit 0, including typechecking, 345 unit tests
  and all 110 configured Chromium E2E tests (zero failures or omissions).
- Unit suite: 67 files, 345 tests passed.
- Focused visibility E2E: all four acceptance tests passed, including hidden
  recognition, notice identity restoration, isolated permanent withdrawal,
  stale-opening rejection and concurrent opening/withdrawal.
- Typechecking, ESLint and Prettier checks passed for the changed TypeScript files.
- Applied the complete migration history in a temporary schema inside
  `roadmap_e2e_db`, inserted an already inactive Participation with a pending
  notice and saved opening, applied the new migration, and confirmed that both
  were removed. Rolled back the entire schema and its data.
- Ran `graphify update .` without an API call. SQL extraction remains unavailable
  because this installation lacks `tree_sitter_sql`; migration behavior was
  checked directly against PostgreSQL instead.

The current local Playwright configuration selects Chromium only. Unrelated
local documentation and Playwright changes were excluded from the commit. The
existing access-migration reorder was included because its old timestamp altered
the Node content Known value table (dropped since #209) before the migration that
created it.
