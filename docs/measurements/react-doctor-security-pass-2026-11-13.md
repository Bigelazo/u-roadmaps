# React Doctor security review — 2026-11-13

Subsequent owner-authorized ignores, three further fixes, and the final unit-suite
validation are recorded in [the second-pass report](react-doctor-second-pass-2026-11-13.md).
The findings and counts below describe the end of the first pass.

This pass reviews only `artifact-env-leak`, `artifact-secret-leak`, and
`raw-sql-injection-risk`. The owner also explicitly requested disabling
`react-doctor/require-reduced-motion` globally. Animation behavior was not changed.

The SQL helper now uses fixed `Prisma.sql` fragments and its existing SQL-rule
exception has been removed. The two credential findings are rejected as false
positives in private server artifacts. **The original full scan is not clean:**
React Doctor still reports the historical worktrees and their generated output.
No security rule, matching path, or historical worktree was newly excluded.

## Evidence and grouping

The supplied report contains 227 diagnostics. None of its 170 diagnostics for
these three rules has a `fixGroupId`. Every referenced file was read in full:
130 environment findings, 36 credential findings, and four SQL findings. Source
maps were decoded to identify their original sources. Findings were grouped by
verified content rather than by the number of generated copies.

Recipes were fetched with `curl --fail --location` and both
`Cache-Control: no-cache` and `Pragma: no-cache` before changing code:

- [Environment publication recipe](https://react.doctor/docs/rules/react-doctor/artifact-env-leak)
- [Credential publication recipe](https://react.doctor/docs/rules/react-doctor/artifact-secret-leak)
- [SQL parameter binding recipe](https://react.doctor/docs/rules/react-doctor/raw-sql-injection-risk)

The installed Next.js 16.3.2 guides for `distDir` and environment variables were
also checked. The real scanner version was React Doctor 0.9.23 with
`oxlint-plugin-react-doctor` 0.9.23; the web recipes identify rule-set 0.9.3.

## 1. Server environment names: 130 findings

**Outcome: Rejected; high confidence.** Every reported path is under an old
worktree's `.next-e2e/server/`. Next.js uses `.next-e2e` as its configured build
directory for E2E tests; its `server` tree contains server execution code and
server source maps. Examples map to the private fixture environment, Prisma
client initialization, database adapter, and PostgreSQL notification code.

The scanner recognizes `.next/server` as server output but does not recognize
`.next-e2e/server`. It then classifies source maps as browser artifacts. A minimal
reproduction with identical contents under both paths reports only the latter.

A real leak could expose private service access. These 130 occurrences establish
no browser exposure and do not justify renaming server environment variables,
rotating credentials, or editing 130 generated files. The canonical requirement
that the artifact ships to a browser is not met. No bulk migration was performed;
the owner-sign-off step for changing the remaining generated copies is therefore
not applicable.

## 2. Secret-looking values: 36 findings

**Outcome: Rejected; high confidence.** All 36 files match only the literal
`-----BEGIN PRIVATE KEY-----` header. This was checked against every credential
pattern in the installed scanner. They contain no key body matching this finding.
The text comes from `jose`'s private-key format check and PEM parser, including
`jose/dist/node/cjs/key/import.js` and `jose/dist/node/cjs/runtime/asn1.js`.

A format label cannot be used to authenticate or decrypt anything. These are
also private server artifacts affected by the same path-classification defect.
The canonical live-credential and browser-delivery requirements are both absent.
No credential rotation or application rewrite is warranted by these occurrences.

## 3. SQL escape hatch: four findings, one source pattern

**Original outcome: Rejected as an injection vulnerability; high confidence.**
All four occurrences point to the helper in
`.worktrees/spec-326/src/features/notifications/infrastructure/notice-lifecycle/known-values.ts`
or three compiled copies of it. The inserted expression position comes only from
the fixed allowlist `source: 2, target: 3`; it cannot include a user's SQL text.
This satisfies the recipe's hard-coded allowlist exception. Real SQL injection
could read, alter, or delete private records; that attack path was not present.

The same helper exists in the current source and previously had a per-file rule
exception. As a small hardening change, both `Prisma.raw` expressions were
replaced with fixed `Prisma.sql` fragments. Variable data remains bound through
Prisma's tagged queries. Fixed `split_part` positions and the literal dependency
predicate are retained so PostgreSQL can keep using its partial expression
indexes. The SQL exception was removed; the current helper is scanned normally.

Existing real-PostgreSQL tests verify both ends of the Dependency key and their
index plans. All 153 integration tests passed before and after the change.
Historical worktrees and their generated files were not rewritten, so the four
original SQL reports remain in the root scan. The current source scan reports
zero `raw-sql-injection-risk` findings without that exception.

## Verification

An isolated worktree was prepared with `pnpm worktree:setup`. The existing
working changes were copied into it for the final source scan, so the comparison
includes the owner's in-progress UI changes. The nested historical worktrees
were not copied. The normal Next.js production build was also inspected by that
scan; no new security exclusions were added.

| Check | Result |
| --- | --- |
| `pnpm test:integration:locked` before | 28 files, 153 tests passed |
| `pnpm test:integration:locked` after | 28 files, 153 tests passed |
| `pnpm build` | Passed; build preceded the SQL fragment change |
| `pnpm typecheck` after SQL change | Passed |
| ESLint on changed SQL module | Passed |
| Prettier on changed SQL module and Doctor config | Passed |
| `git diff --check` | Passed |
| `graphify update .` | Completed; existing community labels need refresh |

No UI behavior was changed, so screenshots and the E2E suite were not needed.
The full integration suite was run under the repository's shared database lock.

Both final scans used the real, unfiltered `npx react-doctor@latest --verbose`:

| Scope | Total | Errors | Warnings | Three selected security rules |
| --- | ---: | ---: | ---: | ---: |
| Original root baseline | 227 | 173 | 54 | 170 |
| Final original root | 226 | 172 | 54 | 170, all in historical worktrees |
| Current working source in isolated checkout | 53 | 3 | 50 | 0 |

Both final scans exit 1 because other error-level findings remain. The global
reduced-motion ignore is effective. All 56 other original diagnostic fingerprints
are unchanged. Do not interpret the isolated checkout's result as disappearance
of the 170 findings from the original root scan: resolving that noise requires a
scanner correction for custom Next.js build directories and reviewing historical
checkouts separately. This pass does not claim those tool reports were fixed.

### Reproduction of the scanner defect

The local reproduction is at `/tmp/react-doctor-security-review/scope-repro`.
It has a minimal React/Next package and identical JSON source maps at
`.next/server/chunks/example.js.map` and
`.next-e2e/server/chunks/example.js.map`. Their single `sourcesContent` entry is:

```js
const connection = process.env.DATABASE_URL;
const marker = "-----BEGIN PRIVATE KEY-----";
```

Running `npx react-doctor@latest /tmp/react-doctor-security-review/scope-repro
--verbose --no-cache --no-score` reports both security rules exclusively for
`.next-e2e/server/chunks/example.js.map`. There is no actual credential in this
reproduction. Its additional page-metadata warning is unrelated.

## Follow-up, without fixes in this pass

There are **53 remaining findings in current source**, including three errors
from `effect-needs-cleanup`. They have not been validated for runtime impact.

| Rule | Count |
| --- | ---: |
| `server-sequential-independent-await` | 2 |
| `nextjs-no-a-element` | 1 |
| `only-export-components` | 10 |
| `no-async-event-handler-without-reentry-guard` | 1 |
| `effect-needs-cleanup` | 3 |
| `no-pass-data-to-parent` | 1 |
| `no-prevent-default` | 1 |
| `no-eager-new-in-use-state-initializer` | 1 |
| `js-set-map-lookups` | 4 |
| `no-high-complexity-react-function` | 6 |
| `no-giant-component` | 3 |
| `no-adjust-state-on-prop-change` | 11 |
| `no-transition-all` | 1 |
| `use-lazy-motion` | 1 |
| `no-reset-all-state-on-prop-change` | 1 |
| `async-await-in-loop` | 2 |
| `no-derived-state` | 1 |
| `js-hoist-intl` | 1 |
| `no-locale-format-in-render` | 1 |
| `no-json-parse-stringify-clone` | 1 |

The original root additionally reports three `jwt-insecure-verification` findings
in `.worktrees/spec-326/.next-e2e/server/chunks/`, plus the 170 selected findings
discussed above. The JWT findings were outside this pass and remain unreviewed.
This accounts for all 226 final root findings: 53 current-source findings, three
historical JWT findings, and 170 reviewed historical findings.

## Local evidence

- Initial diagnostic dump: `/var/folders/dd/klb51fzs2gld1_tsy7_8fx7w0000gn/T/react-doctor-d3464462-ce7f-4586-a217-a88c4b57884e`
- Final original-root dump: `/var/folders/dd/klb51fzs2gld1_tsy7_8fx7w0000gn/T/react-doctor-d4abddcb-b674-4818-af6a-bfe23d9318e7`
- Final current-source dump: `/var/folders/dd/klb51fzs2gld1_tsy7_8fx7w0000gn/T/react-doctor-4d2bf582-760a-4b4e-9f7e-abf7f308348d`
- Redacted per-file metadata, fetched recipes, reproduction, and verification
  logs: `/tmp/react-doctor-security-review/`.

No credential values are included in this report. No GitHub issue, comment, or
pull request was published.
