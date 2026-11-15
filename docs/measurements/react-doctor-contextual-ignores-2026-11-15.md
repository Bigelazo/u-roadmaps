# React Doctor contextual ignores

Date: 2026-11-15. React Doctor 0.9.23, Next 16.3.2, React 19.2.8.

The user requested a deeper investigation of the 16 remaining diagnostics and
ignores for findings that do not warrant implementation changes. The review base
is snapshot `6c415e7ca78b92a22f6e3ed5ed65a2a944992521`, which includes the user's
existing changes. Only `doctor.config.json` and this report change in this task.

The configuration adds rule-specific overrides for the reviewed files. Existing
ignores remain intact. No rule is disabled globally, no additional directory is
excluded, and application code and tests retain their behavior. The score change
from filtering is not an application performance improvement.

## Decisions and invalidation conditions

| Rule and sites | Evidence and decision | Reinvestigate when |
| --- | --- | --- |
| `server-sequential-independent-await`, academic overview page, 1 | The first await unwraps Next's search parameters, rather than starting another remote operation. With the current configuration, the installed production factory calls `Promise.resolve(underlyingSearchParams)`. Authentication is real asynchronous work, but no preceding I/O waterfall was established. Ignore this syntactic candidate. | Next changes its request implementation, Cache Components/staged rendering is enabled, or a request trace shows parameters blocking authentication. |
| `prefer-dynamic-import`, MarkdownEditor and its indentation/live-preview helpers, 6 | `NodeContentFields.tsx` imports MarkdownEditor through `next/dynamic`; the helpers are reachable through that editor boundary. Prior production-browser verification found no CodeMirror chunk on map entry and observed its download when opening the editor. Static imports within that deferred subtree do not make the editor eager. | A production consumer imports the editor/helpers outside the dynamic boundary or initial-load bundle/network evidence changes. |
| `no-prevent-default`, NodeCreator, 1 | The client workflow validates staged files/links, guards duplicate submission, reports progress, preserves failed drafts and applies canvas placement. It also serves practice sessions. A server form action is not a behavior-preserving replacement for this lifecycle. | The creator becomes a native server submission flow or needs progressive enhancement. |
| `no-adjust-state-on-prop-change`, DependencyRouting, 3 | Layout effects publish results/errors after synchronizing an external WASM router. Router creation, routing and disposal allocate/mutate native resources; running them during render would break the resource lifecycle. Existing StrictMode, disposal and Profiler tests cover this boundary. | Routing becomes pure render-time computation or result publication can be removed while preserving external-resource cleanup. |
| `async-await-in-loop`, session/node-creation, 1 | The command workflow completes each resource and its projection refresh before announcing the next ordinal. A held-upload probe confirms this sequence and continuation after partial failure. The backend also uses a common roadmap update lock with serializable retries. Preserve the sequential workflow; this is an intentional policy exception, not a claim that concurrent uploads could never be faster. | A separate change defines bounded upload concurrency, progress semantics, failure order and refresh behavior, with relevant latency/memory evidence. |
| `no-derived-state` and `no-derived-state-effect`, RoadmapPanelColumn, 1 original + 1 exposed companion | `settledScene` retains the previously committed scene until a layout read flushes the width without animation. It differs from the current prop during a scene change. Deriving it directly erases that transition phase. | The scene-transition protocol changes or an equivalent implementation preserves DOM flush, exit content and subsequent close animation. |
| `js-set-map-lookups`, tutorial-position and tutorial-session, 2 | Positioning saw 0/0, 1/1 and 2/1 visible layers/hosts in canvas, creation-dialog and nested-fullscreen samples. Including Set construction did not establish an amortized benefit; complete-layout timing differences cannot be attributed to the lookup. Current tutorial consumers do not enable `exclusiveInteraction`, leaving the session lookup loop empty. Both are contextual exceptions. | Many visible layers coexist, exclusive-interaction consumers are added, or profiling demonstrates a lookup bottleneck including Set construction and allocation. |
| `no-json-parse-stringify-clone`, own-inbox-snapshot integration test, 1 | The expression asserts that the DTO survives a real JSON round trip; it is not a production cloning strategy. The projection converts persisted Dates to ISO strings. `structuredClone` would preserve Dates and cease testing that transport normalization. | The assertion's purpose changes from JSON compatibility to creating an independent copy. |

## Deeper concurrency checks

The academic overview page awaits `props.searchParams` before authentication.
The installed `next/dist/server/request/search-params.js` production path uses
`makeUntrackedSearchParams`, whose Promise is already fulfilled. `next.config.mjs`
does not enable Cache Components. The earlier probe used the real installed
factory in an isolated production request context: 1,000 awaits had p50
0.000125 ms and p95 0.000500 ms. This is a framework-promise microprobe, not a page
latency benchmark; its source-level explanation was rechecked in this review.

For resource creation, the complete path is `createNodeWithResources` →
`useCanvasCommands.run` → session `execute` → persistence `execute` → projection
refresh. There is no client command queue that forces independent calls to run
serially. Resource writes use `roadmapCommand`, whose default is an update lock
on the same roadmap inside a serializable transaction. Upload transfer/storage
can occur before that lock, so it would be incorrect to claim the entire request
is inevitably serialized or that concurrency could offer no latency benefit.

The reason to retain this loop is its current observable workflow: start progress
for one resource, await that command and refresh, then advance, keeping failures
in staged order. The existing node-creation test explicitly exercises attachment
order. An additional temporary probe held the first upload pending: only the
upload had started and progress remained 1/2; after its failure the link ran,
progress became 2/2 and the created node remained with the failed file reported.
A temporary `Promise.all` mutation made the assertion fail because the next
resource started before the upload settled. Neither probe nor mutation changed
the repository. This demonstrates the behavioral difference, not that every
bounded-concurrency design would be invalid or slower.

## Validation

- Baseline full scan: **16 diagnostics, 83/100**, React Doctor 0.9.23.
- After ignoring the original findings, the tool exposed
  `no-derived-state-effect` at the same panel layout effect (lines 31–36), previously
  represented by the higher-priority `no-derived-state` finding. Its canonical
  recipe requires pure derivation; the actual effect also forces a DOM layout
  read and advances the committed-scene protocol. The companion rule is ignored
  only for that same file, with the same invalidation condition.
- Final full scan: **0 diagnostics, 100/100**. This is a filtering result.
- Control scan with only this task's overrides removed: **16 diagnostics,
  83/100**. The exact `(file, rule, line)` set matches the initial baseline.
  Existing ignores remained active. Configuration was restored in a `finally`
  block. Control and filtered JSON reports are retained with the investigation.
- Fresh locked unit selection: **125/125 passed**, 8 files (NodeCreator,
  MarkdownEditor, first-visit invitation, both routing suites, panel column,
  node creation and tutorial).
- Fresh locked integration selection: **3/3 passed**, own-inbox snapshot against
  PostgreSQL. Suites used the shared test lock consecutively.
- Held-upload probe passed; its parallel mutation failed at the meaningful
  assertion that the next command must not have started. The mutation existed
  only outside the repository.
- E2E was not repeated for this configuration/documentation change. The earlier
  production-browser checks and 8 passing focused E2E cases provide the bundle
  and client-submission evidence; they are not presented as a fresh full suite.
- `graphify update .` found no tracked source changes and skipped rebuilding.
  Its warning listed 19 unsupported/unclassified setup files; no SQL extraction
  warning or test failure occurred.

Earlier three-pass evidence, including production bundle observations, browser
samples and canonical rule recipes, is retained under
`/tmp/react-doctor-three-8nis_2u2/`. The deeper held-upload probe and its failing
parallel variant are `recheck-loop.mts`, `recheck-loop-mutant.ts` and their logs in
that directory. These temporary artifacts supplement the checked-in rationale;
they are not required for normal project operation.
