# Automatic dependency routing research

Investigated 2026-11-04. Scope: design and source research only; no application implementation or dependency installation. External facts below come from primary project documentation and source snapshots. A recommendation is an engineering judgment, not a measured result in U-Roadmaps.

## Recommendation

Keep automatic orthogonal routing with rounded corners and obstacle avoidance, but revise the earlier build-first recommendation. Prefer evaluating **libavoid through a small application-owned adapter** for the desired combination of node avoidance and distinguishable parallel dependencies. Its engine already addresses routing as a scene containing multiple connectors, including segment nudging. Do not write a new visibility-graph router first.

**React Flow Smart Edge v5 is a credible lighter alternative** when the acceptance boundary is primarily avoiding nodes. Its MIT license and direct React Flow integration reduce integration work. It is not a drop-in guarantee for the stated requirement: defaults deliberately render native paths before routing and during drag; batch routing still computes each dependency independently, without coordinated parallel-channel separation.

Do not claim either engine is the fastest, most stable, or sufficient in this application without an isolated geometry and interaction evaluation. No head-to-head benchmark was performed.

## Comparison

| Option | Verified fit | Material limitation | Assessment |
| --- | --- | --- | --- |
| Existing `getSmoothStepPath` | Native rounded orthogonal paths | No obstacle input | Retain visual style, replace routing calculation |
| Bespoke grid or visibility-graph search | Can encode application-specific rules | Application owns endpoint escape, invalidation, smoothing safety, stability, and connector separation | Reserve for a demonstrated gap in existing engines |
| React Flow Smart Edge v5 | TypeScript, React Flow v12+, obstacle areas, Worker scheduling, smoothstep and floating endpoints | Native fallback; straight-line clear shortcut; independent connector searches | Strong lower-complexity candidate after strict configuration and validation |
| libavoid + JS/WASM binding | Orthogonal scene routing, mutable shapes, transactions, pins, nudging | WASM deployment/lifecycle, binding/version selection, adapter work | Preferred quality candidate for the fuller requirement |
| `avoid-nodes-edge` wrapper | React Flow v12 integration around libavoid, Worker, spacing controls | Fallbacks, custom license, version discrepancies; persistence of engine needs audit | Reference implementation, not automatic adoption |
| ELK Layered / ELK Fixed | Automatic layout / preserving existing layout | Layered solves node layout too; Fixed does not invent obstacle routes | Not the direct replacement for manual-position routing |

## React Flow Smart Edge: current capabilities and gaps

The current package source declares **5.0.0**, MIT, and React Flow compatibility. Its public documentation supplies smoothstep and floating variants, a shared provider and a low-level API. This is materially more capable than older descriptions of the package. The exact dependency/version must be pinned for an evaluation; branch snapshots are not a release guarantee. [Package manifest](https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/package.json), [introduction](https://tisoap.github.io/react-flow-smart-edge/docs/).

The provider runs batches in a Web Worker by default. It uses corridor-limited grids, incremental invalidation and an LRU route cache. However, native paths render while waiting; `routeWhileDragging` defaults to false; `routeOnlyWhenBlocked` defaults to true and tests a direct segment before rendering the native preset path. Workers improve responsiveness but do not make pending geometry correct. Published benchmarks are author measurements on their fixtures, not U-Roadmaps evidence. [Performance contract](https://tisoap.github.io/react-flow-smart-edge/docs/guides/performance/).

Two configuration changes are necessary for evaluating strict rounded orthogonal avoidance: `routeWhileDragging: true` and `routeOnlyWhenBlocked: false`. They are not sufficient to certify every visible frame: asynchronous latency, old results, initial measurement and no-route handling still require an application policy. [Provider API](https://tisoap.github.io/react-flow-smart-edge/docs/api/smart-edge-provider/).

Source inspection confirms that `routeSmartEdgeBatch` loops over edges and calls `getSmartEdge`/`getSmartEdgeWaypoints` using the node set and each edge's endpoints. It does not introduce completed connector geometry into the next search. Thus shared batching is scheduling and shared input preparation, not coordinated lane allocation. [Batch source](https://github.com/tisoap/react-flow-smart-edge/blob/main/src/routing/routeBatch.ts).

`getSmartEdge` searches corridor grids, widens attempts and ultimately tries the full graph. It aligns endpoints, constructs the SVG and returns an error on failure. Its inputs contain nodes and extra rectangular avoid areas, rather than a complete connector scene. [Routing core](https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/getSmartEdge/index.ts).

The custom-area facility can represent persistent badges outside node bounds. Those rectangles are in graph coordinates and receive node padding. They need exclusion/escape rules at their owning endpoint where appropriate. [Avoid-area guide](https://tisoap.github.io/react-flow-smart-edge/docs/guides/avoid-areas/), [padding option](https://tisoap.github.io/react-flow-smart-edge/docs/options/node-padding/).

The rounded-step SVG function clamps corner radius against adjacent segment lengths. That prevents overshooting short segments; it does not establish a geometric proof that every rounded curve or arrowhead clears every obstacle. A final geometry validator remains useful for either candidate. [Drawing source](https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/functions/drawSvgPath.ts).

Crossing hops add bridge arcs at transverse crossings. They should not be described as separating coincident parallel paths. [Hops reference](https://tisoap.github.io/react-flow-smart-edge/docs/options/hops/).

### Reproducible shortcut counterexample

The root investigation evaluated the installed React Flow `getSmoothStepPath` with source `(0, 0)` on the right side, target `(200, 100)` on the left, radius `8`, and an obstacle `{ x: 90, y: 75, width: 20, height: 10 }`.

With padding `10`, the direct diagonal crosses the padded obstacle's x range at y `40..60`, below its y range `65..95`. The native smoothstep instead contains a vertical segment at x `100`, y `8..92`, crossing the actual obstacle. Therefore a clear diagonal cannot certify a clear native orthogonal route. This is a diagnostic geometry result combined with the documented shortcut, not an executed test of the installed Smart Edge package.

## libavoid: why it better matches coordinated readability

libavoid is explicitly intended for object-avoiding connectors in interactive diagram editors. Its official overview links the research on orthogonal and incremental routing and lists usage in Inkscape and other editors. This is evidence of an established engine and problem fit, not a benchmark or guarantee about its JavaScript bindings. [Engine overview and papers](https://www.adaptagrams.org/documentation/libavoid.html).

The Router API supports mutable/movable/resizable shapes and batched transactions. Retaining one scene permits incremental edits instead of constructing an independent scene per edge. The application still decides which revisions to publish and how to manage Worker and WASM lifetimes. [Router API](https://www.adaptagrams.org/documentation/classAvoid_1_1Router.html).

Documented parameters include obstacle buffer distance, preferred nudging distance and a segment penalty. Nudging can separate overlapping orthogonal connector segments, including intermediate shared paths. Fixed attachment points can still force common initial/final segments. Several crossing/shared-path penalties are explicitly experimental; do not rely on them as production guarantees or enable every option indiscriminately. [Routing parameters and options](https://www.adaptagrams.org/documentation/namespaceAvoid.html).

The official React Flow edge-routing example uses libavoid, establishing that this integration is practical. The example itself has a Pro license; availability of that example does not make its source freely reusable. [React Flow example](https://reactflow.dev/examples/edges/edge-routing).

### Binding and wrapper risks

`libavoid-js` uses Emscripten/WebIDL bindings and requires a valid hosted WASM asset. Its repository/package manifest identifies LGPL-2.1-or-later. The inspected master manifest says 0.4.5, whereas published package and wrapper documentation discuss a 0.5.0 beta. Verify the exact shipped API and underlying engine before selecting a version; do not infer compatibility from a package name. [Binding README](https://github.com/Aksem/libavoid-js), [manifest](https://raw.githubusercontent.com/Aksem/libavoid-js/master/package.json), [published package](https://www.npmjs.com/package/libavoid-js).

The `avoid-nodes-edge` repository describes Worker routing, nudging and smoothstep/straight fallback while WASM loads. It also describes `routeAll` constructing and cleaning a Router for a routing pass, despite marketing incremental input updates. Incremental message transport alone does not prove persistent engine state. Audit the chosen release's source before relying on incremental engine performance. [Wrapper architecture](https://github.com/awaisshah228/react-flow-avoid-nodes-routing).

The wrapper manifest peers `libavoid-js` exactly 0.4.5 in the inspected source snapshot, another reason to verify version alignment. It declares a custom license file rather than plain MIT. [Wrapper manifest](https://raw.githubusercontent.com/awaisshah228/react-flow-avoid-nodes-routing/turbo-package/packages/avoid-nodes-edge/package.json).

That license expressly allows installing the official package in projects but adds a restriction against republishing modified or unmodified packages on public or private registries without written permission. Treat it as a maintenance/distribution constraint; do not label the wrapper ordinary MIT. This is a reading of its published text, not legal advice. [Exact package license](https://raw.githubusercontent.com/awaisshah228/react-flow-avoid-nodes-routing/turbo-package/packages/avoid-nodes-edge/LICENSE).

## Why ELK is not the first choice here

ELK Fixed preserves the supplied layout and bend points without automatic modification. It does not mean “keep nodes fixed and calculate obstacle-free bends.” [Fixed algorithm](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-fixed.html).

ELK does have a separate Libavoid edge-routing integration which explicitly routes without moving nodes. However, this is a distinct algorithm, not a property of Fixed or Layered. [ELK Libavoid](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-alg-libavoid.html).

elkjs documents its Java-to-JavaScript algorithm bundle and the default algorithm set (layered, stress, mrtree, radial, force, disco; box/fixed/random always included). The presence of a native ELK Libavoid provider is not evidence that installing stock elkjs supplies it. An additional bridge would need verification. [elkjs API](https://github.com/kieler/elkjs).

## Decision gates before implementation

1. Recreate the supplied geometry, plus shared corridors, endpoint fan-out, narrow passages and third-node movement.
2. Evaluate pinned libavoid binding and pinned Smart Edge against the same fixtures and exact final SVG geometry.
3. Check persistent-badge avoidance, endpoint direction, arrowhead clearance and rounded-corner clearance separately.
4. Measure cold readiness, drag latency, main-thread cost and route churn on representative roadmap sizes. Define acceptable budgets from application scenarios; do not substitute vendor benchmark numbers.
5. Verify invalid-result handling and Worker/WASM loading failure. A native crossing fallback would reintroduce the original defect.
6. Decide whether strict correctness during every drag frame is required. If so, node and dependency geometry must be published coherently; neither asynchronous worker engine makes this automatic.
7. Prefer libavoid if connector separation is part of acceptance and its integration passes these gates. Prefer Smart Edge if node avoidance is sufficient and its simpler integration demonstrably meets the contract. Build a bespoke router only after recording a gap that neither candidate can reasonably close.

No package was installed, no proposed implementation was tested against the running application, and no performance ranking is asserted.

## Application findings and revised design contract

The following observations were checked against the current working tree on the research date:

- `src/features/roadmap/graph/FloatingEdge.tsx:42` subscribes only to its endpoints. A third node cannot invalidate this edge through those subscriptions. The new calculation must observe all represented obstacles, including nodes outside the viewport.
- `src/features/roadmap/graph/geometry.ts:133` chooses endpoints by relative centers. Although `RoadmapGraph.tsx` supplies stored `sourceHandle` and `targetHandle`, the current custom renderer does not use those fields. Decide explicitly how stored sides become routing preferences; automatic routing must not silently rewrite persisted domain data.
- `geometry.ts:45` checks spacing for finding a new node position, but `RoadmapGraph.tsx` applies dragged positions without equivalent overlap rejection. Valid initial placement does not guarantee a routable future scene.
- `RoadmapNode.tsx` places persistent badges and action triggers outside the main rectangle. `NodeActionMenu.module.css` also defines a transient radial menu. Persistent ornaments belong in obstacle geometry. Opening a tooltip, menu, or dialog should not cause global route movement; temporary overlay occlusion is a separate UI condition from passing through a node.
- Student dependencies have selection disabled and pointer events removed in `RoadmapGraph.tsx:140`. Readability must work in the ordinary student view; selection highlighting cannot be the sole way to disambiguate parallel dependencies.
- `dagre-layout.ts` returns node positions, not connector routes. Keep automatic node arrangement separate from routing manually positioned scenes.

### Proposed invariant

For each published canvas geometry revision with a feasible route, the rendered dependency stroke, rounded corners and arrowhead avoid every unrelated represented node and its persistent ornaments. Source and target remain obstacles except for their designated terminal approach. A local clearance value is a design input to validate, not a universal guarantee.

Keep routes as derived presentation state; no database change is justified by the current requirement. Maintain one routing scene per mounted canvas, isolate the chosen engine behind an adapter, and publish route results by geometry revision. Reuse a previous route only after validating it against the new scene. Discard stale asynchronous results. Never silently replace a failed route with the old native smoothstep.

The stronger promise of correctness throughout dragging needs a publication policy: calculate within a bounded synchronous frame, or commit node positions and their routes together after an asynchronous calculation. A Worker alone cannot guarantee both immediate node movement and a matching valid route. Measure this tradeoff before selecting that policy. Invalid endpoint overlaps and complete enclosure require an explicit movement/conflict policy; no algorithm can route through physically unavailable space while also avoiding it.

Distinguishable parallel routes are an objective subject to channel capacity, rather than an unconditional mathematical guarantee. Multiple connectors using one fixed midpoint necessarily share that attachment point. Allow a short shared terminal segment or support automatic attachment offsets on the same side; evaluate both before changing the visible handles. Avoiding all transverse crossings is outside this request and cannot be generally guaranteed for arbitrary dependency graphs. Preserve existing visual styling where possible, and shorten a corner radius if its rounded curve would violate clearance.

### Evidence status

The only executed geometry experiment in this investigation was the pure installed `getSmoothStepPath` counterexample above, run with `node --input-type=module`. It returned `M0 0L20 0L 92,0Q 100,0 100,8L 100,92Q 100,100 108,100L180 100L200 100`. Neither candidate router was installed or benchmarked. Future evaluation should record collision counts on final paths, overlap length, route changes during a drag, startup readiness and input-to-paint latency on the same synthetic and representative fixtures. Synthetic sizes must be labeled as such; actual roadmap-size distributions remain unknown.

## Implementation follow-up — 2026-11-04

The preceding sections record the pre-implementation investigation. The accepted
solution is now implemented with pinned `libavoid-js@0.4.5`, a small typed adapter,
and one native scene per mounted canvas. The separately hosted, unmodified WASM
and its license live in `public/vendor/libavoid/0.4.5/`. React Flow and Dagre remain
in place; routes are derived presentation state and no database migration is needed.

The adapter updates shapes and dependencies incrementally, enables orthogonal
segment nudging, and validates segments, rounded corners and an arrowhead envelope.
Persistent corner ornaments are separate obstacles. Endpoints are chosen
automatically among the four existing side midpoints; stored handle fields are
not rewritten. Selection and menu state do not invalidate routing geometry.

Synchronous layout-effect transactions publish matching routes before paint
during controlled node movement. Loading waits for the engine; download failures
offer retry. Impossible or rejected routes are omitted with a visible conflict
message rather than replaced by an unsafe native path. Transient menus and
tooltips retain their normal overlay behavior.

Validation in the isolated worktree included the full unit suite (819 tests at
that point), a subsequent screenshot-topology regression and graph suite (81
tests), the integration suite (134 tests), production compilation, type checking,
formatting and lint (no errors; eight existing E2E warnings). Twenty distinct
Chromium scenarios passed across routing, practice, historical viewing and canvas
layout. Routing tests sample the actual SVG during third-node dragging, after
reload and in the mobile student view. A failed WASM download/retry test verifies
that every dependency in the standard fixture eventually renders. Desktop and
mobile captures were visually inspected.

A synthetic Node/WASM probe, excluding module load and React/browser rendering,
measured movement p95 of approximately 5.5 ms for 20 nodes/19 dependencies,
14.8 ms for 50/76, and 74.9 ms for 100/171 (20 position updates per case).
These are local observations, not production budgets or browser frame-rate
guarantees. A later experiment disabling optional unification was inconclusive
under machine contention and was reverted. Large dense roadmaps remain a
performance limitation of the synchronous publication policy; a future Worker
integration would need to preserve coherent node/route revisions.

After transferring the implementation and syncing dependencies in the primary
checkout, type checking and its complete unit suite passed again: 85 files,
821 tests, including the pre-existing tutorial changes. Unrelated working-tree
changes were preserved.
