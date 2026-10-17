# React Flow review

Reviewed on 2026-10-17 against installed `@xyflow/react` **12.11.3** and its resolved `@xyflow/system` **0.0.80**. The initial audit was research only. The implementation follow-up below records the subsequently authorized changes and validation. Detailed audit findings and code locations refer to the pre-refactor baseline.

Four **GPT-6.1 Sol / low** agents worked **sequentially**: components/configuration → hooks → types → utils. Each received the previous findings. To reduce repeated context, agents started without inherited conversation history and shared a single official article cache with repeated navigation removed. Examples, signatures, tables and notes were retained. Each agent reported complete reads and reread truncated tool output. The final coverage lists were checked against the crawl manifest: **119/119 unique API Reference pages**, no download failures or unassigned pages. Coverage is the API Reference subtree, not every external example, Learn article or GitHub link reachable from it.

Guiding criterion for every agent:

> You are not rushing for the quickest solution for this refactor. The code is already implemented, it works, so your thoughts should be how I make this code the least complex but robust at the same time, a middle ground.

## Implementation follow-up

The user authorized all recommended work after the audit. Implemented:

- `FloatingEdge` now accepts `EdgeProps<RoadmapFlowEdge>` and reads the typed optional delete callback without a cast or redundant runtime check. The optional callback/render guard remains.
- Node and edge registries use `satisfies` to check compatibility while preserving inferred keys.
- Both screen-to-flow conversions used to measure viewport corners explicitly disable snapping. Card positions, automatic layout and movement normalization still use the roadmap grid.
- Removed the inactive `Background size` prop for the Lines variant.

The conditional EdgeToolbar and RouteSpecimen alternatives remain outside this implementation: the audit did not recommend changing their zoom, geometry or bundle behavior without further decisions.

Measured production-source change: **3 nonblank lines removed** (typed callback −2; viewport precision 0 after formatting; inactive background prop −1; registry checks 0). Tests and documentation are excluded.

Regression evidence: two interaction cases failed before the viewport fix. With a panned viewport, the old code returned `{x:20,y:20}` instead of `{x:0,y:0}` for a 139-unit-wide viewport, and returned a position instead of `null` for a 119-unit-wide viewport that cannot fit the 120-unit card. Both pass after the fix. The test double models the installed library's option-sensitive snapping; the browser E2E also checks complete card containment during consecutive creation and saves a canvas screenshot.

Validation completed:

- `pnpm run typecheck`: passed.
- `pnpm exec dotenv -e .env -- env -u NEXTAUTH_URL pnpm test:unit`: **515 passed**, across 73 files.
- `pnpm run test:integration`: **94 passed**, across 17 files, against the existing local PostgreSQL service.
- `pnpm run test:e2e`: **209 passed** in the final complete Chromium run (2.9 minutes), using the dedicated local E2E database. The consecutive-creation test verifies full card containment and separation; its canvas screenshot was visually inspected.
- `pnpm run lint`: no errors. Existing warnings remain; focused checks confirmed no new warnings from these changes.
- Prettier checks and `git diff --check`: passed. `graphify update .` refreshed the AST graph without LLM/API usage.

The first E2E attempt was denied PostgreSQL access by the sandbox; an escalated attempt then hit a 5-second fixture transaction timeout before tests. After the other suites finished, a complete run passed 208 tests and exposed one pre-existing stale API read in `own-node-access-notifications.spec.ts`: it requested GET on the POST-only `/roadmap/nodes` route (405). The test now reads the supported Roadmap GET endpoint and retains the same persisted-node assertion. The subsequent complete run passed all 209 tests. No application API, database-service settings, retries or timeout configuration were changed.

Screenshot: `test-results/roadmaps-creating-consecut-f4cab-ated-selected-and-persisted-chromium/created-nodes.png`.

## Decision summary

There is no broad native replacement that removes the project's graph layer while preserving behavior. The canvas already delegates rendering, handles, paths, viewport commands and change application to React Flow. The clearest improvements are narrow typing changes. Two presentation replacements are conditional. A separate viewport precision issue deserves attention independently of LOC.

LOC below means estimated change in nonblank production source lines after normal formatting, including new imports where specified; negative means fewer lines. These are proposals, not measured implementation diffs. Counts exclude tests and this document. Do not sum rejected alternatives or overlapping candidates. Detailed sections state their individual counting bases and confidence.

| Candidate | Agent | Estimated net LOC | Decision and practical limit |
| --- | --- | ---: | --- |
| `EdgeProps<RoadmapFlowEdge>` instead of generic `EdgeProps` and callback cast | Types | **−2** | Recommend. Keep the optional callback guard for read-only views; the type-only import has no runtime cycle. |
| `satisfies EdgeTypes` / `satisfies NodeTypes` instead of registry assertions | Types | **0** | Recommend for checked compatibility and preserved literal keys. |
| `EdgeToolbar` instead of manual edge-label positioning | Components | **−2 to −7** | Conditional. The delete control becomes screen-sized rather than scaling with zoom. |
| `getSmoothStepPath` instead of `RouteSpecimen.stepPath` routing | Utils | **−2 to −6** | Conditional. Validate five fixture paths, ring clearance, drawing animation, responsive screenshots and tree-shaken bundle cost. Future tighter fixtures are not generally equivalent. |
| Explicit `snapToGrid: false` for both viewport-corner conversions | Types / Utils | **0 to +6** | Separate correctness candidate. Source confirms inherited snapping; browser reproduction and regression checks still needed. |
| Remove the `normalizedChanges` snapping map | Hooks / Utils | **−5** | Retain for now. Native movement snaps, but removing this map weakens an explicitly tested defensive boundary. Preserve layout/creation snapping and keyboard cause tracking. |
| Remove `Background size={1}` for the Lines variant | Components | **−1** | Optional no-op cleanup, not a substantive refactor. |
| Replace rect selectors with `useInternalNode` | Hooks | **−6 to −11** | Reject despite LOC reduction: broader endpoint subscriptions. |
| Native aliases for readonly position/viewport contracts | Types | **about −6** | Reject as unnecessary coupling of the session seam to library shapes. Plain aliases would lose readonly intent. |
| Native Bézier helper for decorative landing traces | Utils | **+7 to +9** | Reject: equivalent geometry requires more code and leaves DOM measurement intact. |

The initial recommended scope was typed edge props and checked registries, with viewport precision considered separately for robustness. The user subsequently authorized that work; see the implementation follow-up above. Constant screen-size edge controls and native specimen routing remain conditional alternatives.

## Coverage by agent

| Agent | Pages fully read | Main result |
| --- | ---: | --- |
| Components and configuration | 18 | Small EdgeToolbar candidate; keep radial menu, custom toolbar and restoration semantics. |
| Hooks | 20 | No compelling replacement; narrow subscriptions and event ordering are justified. |
| Types | 65 | Typed edge props and checked registries; retain independent readonly session contracts. |
| Utils | 16 | Conditional specimen routing and separate precision candidate; keep domain traversal, placement and floating endpoint policy. |
| **Total** | **119** | Complete API Reference subtree; exact URLs below. |

## Compatibility and verification limits

Live docs were checked against installed declarations and implementations where a recommendation depends on behavior. For example, current Controls documentation suggests its fit callback can override fitting, but installed 12.11.3 invokes fitting itself and calls the callback immediately. The existing button waits for the fit promise; a substitution would change timing. `useInternalNode` documentation also describes broad updates loosely; the installed hook selects one complete node, still broader than the current rectangle-only subscription.

During the initial audit, existing interaction and geometry tests were inspected as evidence of intended behavior, not executed or counted as validation of proposals. Implementation checks must preserve: selection during unpersisted dragging; keyboard versus pointer persistence causes; immutable position intents; single action menu, closing animation and focus return; mobile action sheet; settled user-only viewport reporting; one application per restoration token; shared domain validation and authoritative server/practice projections. Run relevant real-library interaction checks and repository-required E2E/screenshots when implementing behavior changes.

The viewport precision example is source-supported, not a reproduced UI defect: a true horizontal flow interval `[-7, 993]` can be measured as `[0, 1000]` through inherited snapping, allowing a candidate to cross the true boundary. Only the viewport measurement should opt out; candidate positions still belong on the grid.

## Detailed agent findings

### Agent 1: components (18 pages)

#### 1. Conditional: EdgeToolbar can own edge delete-control positioning, with a deliberate zoom behavior change

Current `src/features/roadmap/graph/FloatingEdge.tsx:75` uses EdgeLabelRenderer + absolute div + midpoint transform + pointer events for a selected-edge delete button. This directly matches the [EdgeLabelRenderer](https://reactflow.dev/api-reference/components/edge-label-renderer) recipe and is already valid. [EdgeToolbar](https://reactflow.dev/api-reference/components/edge-toolbar) replaces that wrapper with `edgeId`, `x`, `y`, `className="nodrag nopan"`; retain onDelete guard, tooltip, propagation control, accessible label and action. 12.11.3 exports it and supplies positioning, pointerEvents and z-index.

Semantic difference: current HTML label scales with the viewport; EdgeToolbar inversely compensates zoom so the button remains screen-sized. That may improve operability when zoomed out, but is not equivalent. Recommend only if constant-size edge controls are desired; otherwise keep current code. LOC basis: physical nonblank production lines of wrapper only, excluding unchanged button/tooltip. Current wrapper 10 lines (76–83,105–106); estimated replacement 3–8 depending formatting. Net ~2–7 lines removed, medium confidence. This is a small simplification, not a broad refactor.

#### 2. Reject: NodeToolbar does not replace radial menu lifecycle, responsive sheet, or overflow adjustment

`RoadmapNode.tsx:301` anchors a radial action ring around its bottom-right trigger. `RoadmapGraph.tsx:473` controls one menu, editing-session validity, animation closing, focus return; `NodeActionSheet.tsx:32` provides a modal touch alternative. [NodeToolbar](https://reactflow.dev/api-reference/components/node-toolbar) provides a screen-sized portal positioned beside a node, not those behaviors. It has no collision avoidance or auto-pan, as confirmed by its 12.11.3 implementation. A linear toolbar would be a product/UI redesign. Retaining radial content inside NodeToolbar adds mapping and changes scaling/anchoring without removing lifecycle logic.

`RoadmapGraph.tsx:352` adjusts viewport translation for menu room without changing zoom. NodeToolbar does not subsume it; autoPanOnNodeFocus handles a focused node, not its action ring. Retain overflow calculation unless separately redesigned around measured menu bounds. LOC basis: menu adjustment component 37 physical lines; replacement with NodeToolbar cannot remove these semantics, so equivalent before/after stays ~37 plus wrapper integration. Estimated net saving 0 or negative; high confidence in rejection, no fake implementation count.

#### 3. Reject: Controls/ControlButton replacement for custom toolbar has poor equivalence

`RoadmapGraph.tsx:231` combines centering, alternating Dagre layout action, contextual action slots, and collision-free node creation. [Controls](https://reactflow.dev/api-reference/components/controls) offers zoom/fit/interaction toggles; [ControlButton](https://reactflow.dev/api-reference/components/control-button) is a styled native button. Neither replaces placement logic or session actions. Current Panel + shared Button/Tooltip is appropriate and preserves the design system.

Version caveat: live Controls docs say onFitView can replace default fit; installed 12.11.3 `onFitViewHandler` calls `fitView(fitViewOptions); onFitView?.()` unconditionally. Current code at line 303 waits for fitView promise before invoking callback. Substituting Controls would change completion timing; supplying another fitView call would double-fit. Current fit button block ~21 physical nonblank lines; equivalent Controls with custom child would retain the custom button and add configuration. Whole toolbar 111 physical lines would remain roughly the same or grow; estimated net saving 0–5 at best if accepting behavior/styling changes, low confidence. Reject as a simplification.

#### 4. Reject: controlled viewport/defaultViewport/provider persistence replacement

`RoadmapGraph.tsx:337` applies each restoration token once; line 860 reports only settled user moves (ignores null programmatic events). Tests at `RoadmapGraph.interaction.test.tsx:462` and `:472` explicitly protect both. [ReactFlow](https://reactflow.dev/api-reference/react-flow) controlled viewport/onViewportChange is continuous synchronization, not token commands or user-only persistence. defaultViewport is initial-only and ignored with fitView. It cannot implement preview return. Keep current setViewport boundary; restoration component 17 physical lines remains ~17 for equivalent semantics, estimated saving 0, high confidence. Provider scope persistence is not a replacement for session snapshot/restore.

#### 5. Already appropriate components and no replacements

- FloatingEdge.tsx:68 uses [BaseEdge](https://reactflow.dev/api-reference/components/base-edge) for visible path, hit target, marker. Its built-in labels render EdgeText through SVG `<text>` in 12.11.3, so cannot replace the HTML Button/Tooltip with `label`. Keep it. SVG EdgeText would change control semantics; no saving estimate warranted beyond 0 equivalent lines removed.
- RoadmapGraph.tsx:295,440 and other overlay slots already use [Panel](https://reactflow.dev/api-reference/components/panel). ViewportPortal would make fixed UI pan/zoom with nodes; reject for those overlays (0 savings).
- RoadmapGraph.tsx:906 uses [Background](https://reactflow.dev/api-reference/components/background), matching grid spacing. `size={1}` is ignored for Lines; removing this no-op prop saves 1 production line with high confidence, purely optional cleanup.
- RoadmapNode.tsx:506 uses [Handle](https://reactflow.dev/api-reference/components/handle) with stable IDs/positions; loose connection mode intentionally permits source handles at both ends. Visibility rather than display:none preserves handle geometry in nonediting views. No replacement.
- ReactFlow already owns controlled rendering, snapping, interaction toggles, keyboard node movement, connection mechanics and initial fit. Existing applyNodeChanges/applyEdgeChanges use should remain subject to hooks/utils audit. Domain decisions and confirmation/persistence intents must remain outside library mechanics (ADR-0028/0025).
- No hand-built minimap or resize controls exist to replace. MiniMap adds a feature, NodeResizer/NodeResizeControl introduce user-controlled sizing that conflicts with title-derived grid sizing. Reject as scope expansion, 0 equivalent savings.
- No explicit ReactFlowProvider is needed presently: all flow hooks execute in descendant components inside ReactFlow; installed Wrapper creates the provider when absent. Adding provider would add lines; route persistence would change session lifetime.


### Agent 2: hooks (20 pages)

#### Recommend retaining narrow FloatingEdge subscriptions

`src/features/roadmap/graph/FloatingEdge.tsx:18–51` selects only measured width/height and absolute x/y with `sameRect`. [useInternalNode](https://reactflow.dev/api-reference/hooks/use-internal-node) is shorter but installed `dist/esm/index.js:4356` uses nodeLookup.get(id) plus shallow equality over the entire node. Endpoint data, selection and other node metadata can therefore trigger renders even when its rect is unchanged. Live docs' “whenever any node changes” overstates the installed implementation: it selects the requested node, not all nodes. The current selector is a justified [useStore](https://reactflow.dev/api-reference/hooks/use-store) use, following derived-state subscription guidance. Keep null guard: measurements are absent before initialization and deleted endpoints must not render. `useReactFlow().getInternalNode` is an on-demand read, so cannot keep edge geometry reactive.

LOC basis: physical nonblank helper/subscription lines, excluding imports, comment and unchanged render guard: current 23; estimated useInternalNode + rect conversion 12–17, saving 6–11, medium confidence. Reject that saving because it broadens subscriptions. Combining selectors or extracting a hook shifts code without a demonstrated robustness benefit.

#### Reject replacing combined flow with useNodesState/useEdgesState

`RoadmapGraph.tsx:618` keeps projected nodes/edges together; `:759` filters removal and separates keyboard position persistence; `:820` filters edge removal and updates appearance. Installed hooks (`index.js:4045,4097`) are useState plus unfiltered apply*Changes. [useNodesState](https://reactflow.dev/api-reference/hooks/use-nodes-state) and [useEdgesState](https://reactflow.dev/api-reference/hooks/use-edges-state) cannot replace custom filters, confirmation, cause tracking, atomic projection replacement or immutable domain intents. Splitting state increases projection/synchronization wiring and leaves custom handlers. Current simple initialization 9 nonblank lines would become roughly 10–16 plus changes to every combined update; net saving 0 or negative, medium confidence. Domain decisions stay outside library mechanics per ADR-0028/0025.

#### Reject useOnViewportChange for persistence

`RoadmapGraph.tsx:860` needs both settled movement and a non-null user event. [useOnViewportChange](https://reactflow.dev/api-reference/hooks/use-on-viewport-change) only supplies Viewport. Installed PanZoom forwarding (`index.js:1331–1333`) sends event to onMoveEnd but strips it from onViewportChangeEnd. Replacing it would report restoration and menu adjustment as user movement. Existing tests `RoadmapGraph.interaction.test.tsx:462,472` protect this boundary. Keep token-based restorer `RoadmapGraph.tsx:337` and imperative [useReactFlow](https://reactflow.dev/api-reference/hooks/use-react-flow); [useViewport](https://reactflow.dev/api-reference/hooks/use-viewport) introduces continuous subscriptions. Current onMoveEnd 4 nonblank lines remains 4 for equivalent semantics; hook integration would add a child and event-origin tracking. Saving 0, high confidence.

#### Reject useKeyPress for keyboard cause tracking

`RoadmapGraph.tsx:744–757` handles Escape ordering/propagation and marks a keyboard move before the node's bubbling handler emits changes. [useKeyPress](https://reactflow.dev/api-reference/hooks/use-key-press) returns boolean state, has no event target/propagation API and installs native bubbling listeners (`index.js:377–472`). A boolean effect cannot preserve per-keydown ordering or repeated arrow movement classification. Keep capture handler. Current capture block 22 nonblank lines needs approximately the same 22 plus hook/effect wiring to preserve semantics; saving 0 or negative, high confidence.

Installed keyboard movement already snaps (`index.js:1722–1756`). `normalizedChanges` at `RoadmapGraph.tsx:771–775` may duplicate library snapping, but is defensive boundary behavior also exercised by mock unsnapped `{27,13}` input expecting `{20,20}` (`interaction.test.tsx:141–147,595–620`). Do not remove cause tracking or domain snapping. A later real-library integration check could justify removing only normalization (5 lines plus changing its use to changes); conditional, outside this research task.

#### Reject global initialization hook for local geometry

[useNodesInitialized](https://reactflow.dev/api-reference/hooks/use-nodes-initialized) checks all relevant nodes/handle bounds and returns false for empty graphs; defaults to excluding hidden nodes. Installed selector at `index.js:4186` confirms this. FloatingEdge only needs two endpoint measurements and continuous rect changes; adding the boolean does not replace endpoint lookup or guard, can hide ready edges while another node initializes, and adds subscription. Current local validity guard/extraction 6 nonblank lines remains 6; global gate adds ~2–3, high confidence. Dagre and placement use title-derived dimensions (`geometry.ts:35`), so neither needs measurement readiness.

#### Other hooks: no replacements

[useNodes](https://reactflow.dev/api-reference/hooks/use-nodes) / [useEdges](https://reactflow.dev/api-reference/hooks/use-edges) broaden subscriptions. Existing [useReactFlow](https://reactflow.dev/api-reference/hooks/use-react-flow) viewport reads occur when callbacks/effects need them (`RoadmapGraph.tsx:262,359`), correctly deferring reads. Toolbar gets controlled nodes as props; swapping to getNodes would remove one prop but requires typed hook and changes snapshot source. At best 0–2 lines saved with low confidence; no need to change it. [useStoreApi](https://reactflow.dev/api-reference/hooks/use-store-api) adds internal coupling without replacing these public methods.

[useOnSelectionChange](https://reactflow.dev/api-reference/hooks/use-on-selection-change) reports selection, whereas Node click invokes session selection with block checks (`:832`); menu actions and explicit selectedNodeId remain separate. No simplification. [useNodesData](https://reactflow.dev/api-reference/hooks/use-nodes-data) duplicates NodeProps.data subscription; [useNodeId](https://reactflow.dev/api-reference/hooks/use-node-id) only avoids prop drilling where none is problematic. [useConnection](https://reactflow.dev/api-reference/hooks/use-connection), [useNodeConnections](https://reactflow.dev/api-reference/hooks/use-node-connections) add live connection presentation, not domain dependency validation. [useHandleConnections](https://reactflow.dev/api-reference/hooks/use-handle-connections) is deprecated in docs and 12.11.3. [useUpdateNodeInternals](https://reactflow.dev/api-reference/hooks/use-update-node-internals) is for dynamically changed handles; RoadmapNode has stable four handles and dimension observation. No manual counterpart exists for these to remove: 0 equivalent production LOC savings, high confidence.


### Agent 3: types (65 pages)

1. **Recommend: type custom edge props.** `src/features/roadmap/graph/FloatingEdge.tsx:44,61` can use `EdgeProps<RoadmapFlowEdge>` with a type-only import from DependencyEdge, then `const onDelete = data?.onDelete`. [EdgeProps](https://reactflow.dev/api-reference/types/edge-props) propagates declared optional callback type; `RoadmapFlowEdge` already exists at DependencyEdge.tsx:9. Retain selected/callback presence guard for nonediting projections. Runtime typeof check provides no meaningful validation at this wholly typed internal projection boundary. This introduces a type-only cycle, erased at runtime, without moving types. LOC: callback extraction 4→1, plus one import line: net 2 production lines removed, high confidence; signature changes no line count. It improves safety rather than merely shortening code.

2. **Recommend: check registries instead of asserting them.** `DependencyEdge.tsx:11` and `roadmap-node-types.ts:4`: use `{ dependency: FloatingEdge } satisfies EdgeTypes` and `{ roadmap: RoadmapNode } satisfies NodeTypes`; explicit annotations are also valid but widen keys. [EdgeTypes](https://reactflow.dev/api-reference/types/edge-types)/[NodeTypes](https://reactflow.dev/api-reference/types/node-types) docs simplify registry signatures; installed general.d.ts:43–50 deliberately widens data/type to any, supporting custom typed components. `satisfies` verifies compatibility and retains literal registry keys; it does not prove projection type strings match registrations. LOC 1→1 each, net 0, high confidence. Keep registries module-scoped for stable identity.

3. **Conditional: native geometry aliases; reject erasing readonly seam.** `geometry.ts:3–4` duplicates [Rect](https://reactflow.dev/api-reference/types/rect)/[XYPosition](https://reactflow.dev/api-reference/types/xy-position). `export type { Rect as NodeRect, XYPosition as Point }` plus local type import is equivalent; using native names throughout costs churn without runtime benefit. Current two alias lines→two import/re-export lines: net 0, high confidence. `roadmap-graph-projection.ts:14,26` deliberately exposes readonly positions/viewports. `Readonly<XYPosition>`/`Readonly<Viewport>` preserve types but import React Flow into the session contract; plain native types lose immutability. Existing 4+5 definition lines→2 aliases+1 import saves ~6, high counting confidence, but **retain independent domain-shaped seam**: this coupling is not worthwhile. Keep runtime freezing at RoadmapGraph.tsx:185 independently; readonly alone does not replace it.

4. **Reject: DefaultEdgeOptions replaces dynamic appearance.** `RoadmapGraph.tsx:153–166,388–395` varies editability, interaction, base color and selected/hover arrow color. [DefaultEdgeOptions](https://reactflow.dev/api-reference/types/default-edge-options) can centralize static defaults, but does not encode these states; [EdgeMarker](https://reactflow.dev/api-reference/types/edge-marker) is configuration, not conditional styling. Native defaultMarkerColor=null uses global edge stroke CSS, not this edge’s selected/hover color. Moving constant marker dimensions/type into defaults still needs per-edge colored marker overrides. Appearance function 8 nonblank lines→8 for equivalent behavior, net 0, high confidence. Keep native MarkerType.ArrowClosed; no custom marker implementation exists to remove.

5. **Reject: instance methods replace editing/session decisions.** `RoadmapGraph.tsx:630–679,763–855` uses controlled state and immutable intents. [ReactFlowInstance](https://reactflow.dev/api-reference/types/react-flow-instance) updateNode/setNodes/deleteElements/toObject can manipulate or serialize canvas state, but cannot replace cause tracking, confirmation, authoritative projection or persistence adapters. [OnBeforeDelete](https://reactflow.dev/api-reference/types/on-before-delete) could gate native deletion; current node actions and session confirmation need the same policy anyway. [IsValidConnection](https://reactflow.dev/api-reference/types/is-valid-connection) could add drag feedback by calling the shared decision, but cannot replace `domain/dependency.ts:31`, error messages or teacher-block impact (ADR-0028/0025). Reject duplicated cycle/visibility policy in Graph. No equivalent production block disappears: before/after same, net 0, high confidence. Connection normalization remains appropriate.

6. **Separate precision candidate:** `RoadmapGraph.tsx:260–264` correctly uses screenToFlowPosition, but installed index.js:549 inherits snapToGrid when options omit it. Both viewport corners therefore snap under the existing flow prop. Explicit `{ snapToGrid: false }` would preserve exact viewport containment while findOpenRoadmapPosition still snaps candidates. This changes boundary behavior; investigate test coverage rather than claim simplification. Two call options add ~0–6 formatted lines, net saving ≤0, medium confidence. fitBounds recalculates zoom and cannot replace translation-only menu adjustment (:352); getIntersectingNodes/isNodeIntersecting test actual overlap, not the one-cell clearance/deterministic search in geometry.ts:56–121. Equivalent geometry remains, 0 savings, high confidence.

#### Already appropriate and no-match coverage

Node/NodeProps custom generics, Edge/EdgeProps, NodeChange/EdgeChange, Connection, MarkerType, Position, BackgroundVariant, ConnectionMode.Loose, SnapGrid, PanelPosition and FitViewOptions already express the relevant library mechanics. Keep optional position checks: declaration unions contain optional position/dimensions despite terse docs tables. OnMove’s null event protects settled-user persistence; callback aliases (OnNodesChange, OnEdgesChange, OnConnect, OnNodeDrag, NodeMouseHandler, EdgeMouseHandler) only rename existing typed/inferred signatures, saving 0 lines.

No implementation counterpart: Align, ColorMode, CoordinateExtent, ConnectionLineComponent/Props/Type, ConnectionState, Handle/HandleConnection/NodeConnection/NodeHandle, InternalNode, KeyCode, MiniMapNodeProps, ResizeParams, SelectionDragHandler, SelectionMode, PanOnScrollMode, ZIndexMode, ProOptions; they configure absent features or already-inferred props, not replacement algorithms. AriaLabelConfig could localize native announcements, but adds behavior/configuration rather than simplifying code. OnConnectStart/End, OnDelete/NodesDelete/EdgesDelete, OnError, OnInit, OnReconnect, OnSelectionChangeFunc and DeleteElements require no new handlers. ReactFlowJsonObject is unsuitable as the persisted domain/session model, especially callback-bearing graph data. All have 0 equivalent savings.


### Agent 4: utils (16 pages)

#### Retain floating endpoint geometry; native path generation already used

`src/features/roadmap/graph/FloatingEdge.tsx:56` already delegates path and label coordinates to [getSmoothStepPath](https://reactflow.dev/api-reference/utils/get-smooth-step-path). `geometry.ts:124` selects the dominant center axis, chooses opposing side centers and supplies those endpoints. None of the 16 public utilities chooses a floating endpoint from two rectangles. [getBezierPath](https://reactflow.dev/api-reference/utils/get-bezier-path), [getSimpleBezierPath](https://reactflow.dev/api-reference/utils/get-simple-bezier-path) and [getStraightPath](https://reactflow.dev/api-reference/utils/get-straight-path) also require endpoints and change the rendered route. System's internal getEdgePosition uses stored handle IDs, not this floating rule. Calling a path helper merely to obtain a center would add mapping and throw away a generated path. Keep the measured endpoint selector and geometry null guard.

LOC: floating geometry helpers at geometry.ts:124–169 comprise 37 nonblank noncomment physical lines; equivalent alternative still needs the same policy, ~37 plus any helper adapter. Net equivalent saving 0, high confidence. Native path invocation already costs 4 lines and remains 4.

#### Conditional small opportunity: static specimen path

`src/features/roadmap/ui/RouteSpecimen.tsx:146` independently constructs a rounded stepped SVG path. [getSmoothStepPath](https://reactflow.dev/api-reference/utils/get-smooth-step-path) with default Bottom/Top, `offset: 0`, `borderRadius: edgeRadius`, and the existing computed source/target coordinates can replace its routing, retaining the target's six-pixel current-node-ring adjustment. Current fixture vertical gaps are 34 or 40, sufficient for radius 8; same-x paths remain visually straight. Native output is a different SVG command string and includes redundant collinear segments. Native bend radius caps at half each segment (a quarter of total vertical gap), whereas custom radius permits half total gap; equivalence does not extend to arbitrary tighter future fixtures.

Treat as conditional, not recommended solely for LOC: the file explicitly intends to avoid loading React Flow. Assess actual tree-shaken bundle cost before adding an import; geometry already imports Position, so do not assume either zero or whole-library overhead. Validate all five fixture paths, ring endpoint and path-drawing animation with screenshots at desktop/mobile plus production bundle comparison. No such checks were run here.

LOC: stepPath currently 18 nonblank noncomment lines. Keeping four endpoint declarations and returning a native call takes ~11–15, plus one import = ~12–16: estimated net 2–6 removed, medium confidence, formatting dependent. Depth traversal at :140 uses tuple fixtures, not React Flow nodes/edges; getIncomers adds adaptation and does not calculate depth. Retain it (3→3 equivalent lines, saving 0).

#### Reject bounds/collision substitution

`geometry.ts:56–121` implements a deterministic grid-ring search, strict whole-card viewport containment and a 20-pixel clearance between cards. [getNodesBounds](https://reactflow.dev/api-reference/utils/get-nodes-bounds) aggregates node extents, rather than testing candidate clearance or searching free space. Instance getIntersectingNodes/isNodeIntersecting calculate overlap, not clearance; using inflated rectangles can express clearance but adds conversion and leaves the containment/search intact. It also brings flow instance state into an independently testable pure helper. Title-derived dimensions are deliberately available before measurement. Retain existing four separation comparisons and containment checks.

LOC: hasRoomForNode = 9 nonblank lines, fitsWithinViewport = 8; equivalent public-instance approach still needs inflation, shape conversion and containment, ~17 or more plus instance wiring. Entire search remains. Net equivalent saving 0 or negative, high confidence. There is no custom aggregate node-bounds implementation to remove.

#### Reject fitBounds/getViewportForBounds for action-menu adjustment

`RoadmapGraph.tsx:352–385` translates only the required right/bottom overflow while preserving zoom and avoiding movement when no overflow exists. [getViewportForBounds](https://reactflow.dev/api-reference/utils/get-viewport-for-bounds) fits and centers bounds; native fitBounds delegates to that calculation. Even locking minZoom=maxZoom preserves zoom but still centers rather than applying minimum translation. Both require additional coordinate conversion for current DOM-measured menu allowances. Keep native screenToFlowPosition for viewport conversion and existing setViewport adjustment.

LOC: adjustment component is 32 nonblank lines; equivalent fitting alternative retains overflow detection and policy, roughly 32 plus mapping. Net equivalent saving 0 or negative, high confidence.

#### Separate correctness candidate: unsnapped viewport corners

`RoadmapGraph.tsx:260–264` calls screenToFlowPosition without options, while :808 enables snapToGrid. Installed React index.js:549–561 inherits this prop, so viewport corners snap. Explicit `{ snapToGrid: false }` on both conversions preserves precise containment while findOpenRoadmapPosition still snaps candidates. Example: true flow viewport [-7,993] becomes [0,1000]; candidate x=880,width=120 fits converted bounds yet extends seven units beyond the actual right edge if collision search selects it. This is a source-supported edge case, not a reproduced browser defect.

Existing interaction tests at :504–570 mock screenToFlowPosition with identity/translation only and geometry tests :92 test already-provided rectangles, so they cannot catch inherited snapping. Future meaningful check: actual React Flow with snap20, panned/noninteger viewport, occupied center forcing edge placement, assert the whole new card stays inside the DOM viewport; also test no-room returns null. A focused mock that models option-sensitive snapping can check both conversions explicitly disable it. This changes boundary behavior, not a simplification. LOC: two calls gain an options argument, ~0–6 extra formatted lines (negative saving), high semantic confidence, medium formatting confidence.

#### Retain domain adjacency, traversal and dependency creation

`domain/access.ts:13–60` builds adjacency maps once and traverses transitively with visited protection; :108 and :154 add branch-unlock eligibility, teacher-block precedence, completion and memoized access. [getOutgoers](https://reactflow.dev/api-reference/utils/get-outgoers)/[getIncomers](https://reactflow.dev/api-reference/utils/get-incomers) return only one-hop nodes, scan edges and then nodes each call, and require source/target-shaped edges. They cannot replace transitive traversal or branch/access rules. Native implementation confirms getOutgoers follows source→target and getIncomers target→source, despite potentially confusing prose. Adapting sourceNodeId/targetNodeId plus synthesizing nodes for functions that currently accept dependencies alone adds coupling and repeated scans. Keep shared domain decisions per ADR-0028, reused in server editor.ts:524 and in-memory-persistence.ts:149.

[getConnectedEdges](https://reactflow.dev/api-reference/utils/get-connected-edges) does match incident-edge intent in `in-memory-persistence.ts:102` and `domain/node-visibility.ts:18`, but requires source/target mapping and must preserve original dependency objects. It returns edges with either endpoint present; it cannot replace visibleRoadmapGraph's both-endpoints filter (:72). Existing incident filters are 3 nonblank expression lines; native adapter/filter-back approach ~5–9 plus import, negative savings, high confidence. Adjacency+transitive helpers are 42 nonblank lines (:13–60); equivalent native traversal still needs visited/queue logic, adapters and synthetic nodes, ~42 or more. Net equivalent saving 0 or negative, high confidence.

[addEdge](https://reactflow.dev/api-reference/utils/add-edge) only rejects absent endpoints and duplicates with the same handles. Domain uniqueness ignores handles; `dependency.ts:31–70` also rejects self, missing/hidden endpoints and cycles, and returns teacher-block impact/messages. `RoadmapGraph.tsx:660–672` emits an intent; server/session adapters own creation. addEdge would optimistically diverge from authoritative projection and retain all rule checks anyway. Keep connect normalization/intent (13 nonblank lines→13, saving 0). [reconnectEdge](https://reactflow.dev/api-reference/utils/reconnect-edge) changes an edge array, defaults to replacing IDs and does not implement domain reconnection validation/persistence; no reconnection feature exists to simplify (0 equivalent savings).

#### Already appropriate state utilities; retain defensive snapping

`RoadmapGraph.tsx:778,823` already uses [applyNodeChanges](https://reactflow.dev/api-reference/utils/apply-node-changes) and [applyEdgeChanges](https://reactflow.dev/api-reference/utils/apply-edge-changes), after removal filtering and with cause-specific persistence/appearance handling. Neither replaces immutable domain position intents or selected-node state policies. Recasting :640 position mapping as synthetic NodeChanges adds construction and retains intent freezing; no meaningful saving.

Installed keyboard movement index.js:1722–1756 snaps, and system drag movement uses snapPosition; normalizedChanges :771–775 is defensively redundant for normal native movement. Retain it now: explicit mocks send unsnapped coordinates and assert normalization (:385 and :618), and boundary consistency is cheap. Removing only this map could remove 5 lines, conditional on real-library drag/keyboard integration proving no other emitter needs normalization; it weakens the accepted boundary. Keep creation/layout snapToRoadmapGrid, drag-stop snap and keyboard cause tracking. snapPosition exists in system internals, not the reviewed React public utils API; adding a direct system dependency to replace a six-line helper offers no worthwhile simplification.

[isNode](https://reactflow.dev/api-reference/utils/is-node)/[isEdge](https://reactflow.dev/api-reference/utils/is-edge) check structural key presence, not field types. They cannot replace domain DTO validation such as http-persistence.ts:125–133, whose fields differ and whose runtime types matter. Separate typed node/edge arrays already avoid discrimination. Equivalent validation stays unchanged: saving 0, high confidence.

#### Reject replacing the decorative landing trace solely for reuse

`src/app/_components/landing/CourseRouteComparison.tsx:279–282` calculates two cubic control points at half the positive horizontal separation. [getBezierPath](https://reactflow.dev/api-reference/utils/get-bezier-path) with Right/Left endpoints yields equivalent cubic geometry because :278 guarantees positive dx≥32. It does not remove DOM measurement, responsive suppression, resize observation or animation. Native invocation needs roughly 8–10 formatted lines plus import versus the existing two routing lines, increasing production LOC about 7–9 (high counting confidence, formatting dependent). Keep the concise formula; consider sharing a native helper only if broader path policy grows. Bundle effects are unmeasured and tree shaking may mitigate them; they are not the basis for rejection.

## Complete page inventory

All URLs below were fetched successfully and appear in their assigned agent's complete-read list.


### Components (18)

- [/api-reference](https://reactflow.dev/api-reference)
- [/api-reference/components](https://reactflow.dev/api-reference/components)
- [/api-reference/components/background](https://reactflow.dev/api-reference/components/background)
- [/api-reference/components/base-edge](https://reactflow.dev/api-reference/components/base-edge)
- [/api-reference/components/control-button](https://reactflow.dev/api-reference/components/control-button)
- [/api-reference/components/controls](https://reactflow.dev/api-reference/components/controls)
- [/api-reference/components/edge-label-renderer](https://reactflow.dev/api-reference/components/edge-label-renderer)
- [/api-reference/components/edge-text](https://reactflow.dev/api-reference/components/edge-text)
- [/api-reference/components/edge-toolbar](https://reactflow.dev/api-reference/components/edge-toolbar)
- [/api-reference/components/handle](https://reactflow.dev/api-reference/components/handle)
- [/api-reference/components/minimap](https://reactflow.dev/api-reference/components/minimap)
- [/api-reference/components/node-resize-control](https://reactflow.dev/api-reference/components/node-resize-control)
- [/api-reference/components/node-resizer](https://reactflow.dev/api-reference/components/node-resizer)
- [/api-reference/components/node-toolbar](https://reactflow.dev/api-reference/components/node-toolbar)
- [/api-reference/components/panel](https://reactflow.dev/api-reference/components/panel)
- [/api-reference/components/viewport-portal](https://reactflow.dev/api-reference/components/viewport-portal)
- [/api-reference/react-flow](https://reactflow.dev/api-reference/react-flow)
- [/api-reference/react-flow-provider](https://reactflow.dev/api-reference/react-flow-provider)

### Hooks (20)

- [/api-reference/hooks](https://reactflow.dev/api-reference/hooks)
- [/api-reference/hooks/use-connection](https://reactflow.dev/api-reference/hooks/use-connection)
- [/api-reference/hooks/use-edges](https://reactflow.dev/api-reference/hooks/use-edges)
- [/api-reference/hooks/use-edges-state](https://reactflow.dev/api-reference/hooks/use-edges-state)
- [/api-reference/hooks/use-handle-connections](https://reactflow.dev/api-reference/hooks/use-handle-connections)
- [/api-reference/hooks/use-internal-node](https://reactflow.dev/api-reference/hooks/use-internal-node)
- [/api-reference/hooks/use-key-press](https://reactflow.dev/api-reference/hooks/use-key-press)
- [/api-reference/hooks/use-node-connections](https://reactflow.dev/api-reference/hooks/use-node-connections)
- [/api-reference/hooks/use-node-id](https://reactflow.dev/api-reference/hooks/use-node-id)
- [/api-reference/hooks/use-nodes](https://reactflow.dev/api-reference/hooks/use-nodes)
- [/api-reference/hooks/use-nodes-data](https://reactflow.dev/api-reference/hooks/use-nodes-data)
- [/api-reference/hooks/use-nodes-initialized](https://reactflow.dev/api-reference/hooks/use-nodes-initialized)
- [/api-reference/hooks/use-nodes-state](https://reactflow.dev/api-reference/hooks/use-nodes-state)
- [/api-reference/hooks/use-on-selection-change](https://reactflow.dev/api-reference/hooks/use-on-selection-change)
- [/api-reference/hooks/use-on-viewport-change](https://reactflow.dev/api-reference/hooks/use-on-viewport-change)
- [/api-reference/hooks/use-react-flow](https://reactflow.dev/api-reference/hooks/use-react-flow)
- [/api-reference/hooks/use-store](https://reactflow.dev/api-reference/hooks/use-store)
- [/api-reference/hooks/use-store-api](https://reactflow.dev/api-reference/hooks/use-store-api)
- [/api-reference/hooks/use-update-node-internals](https://reactflow.dev/api-reference/hooks/use-update-node-internals)
- [/api-reference/hooks/use-viewport](https://reactflow.dev/api-reference/hooks/use-viewport)

### Types (65)

- [/api-reference/types](https://reactflow.dev/api-reference/types)
- [/api-reference/types/align](https://reactflow.dev/api-reference/types/align)
- [/api-reference/types/aria-label-config](https://reactflow.dev/api-reference/types/aria-label-config)
- [/api-reference/types/background-variant](https://reactflow.dev/api-reference/types/background-variant)
- [/api-reference/types/color-mode](https://reactflow.dev/api-reference/types/color-mode)
- [/api-reference/types/connection](https://reactflow.dev/api-reference/types/connection)
- [/api-reference/types/connection-line-component](https://reactflow.dev/api-reference/types/connection-line-component)
- [/api-reference/types/connection-line-component-props](https://reactflow.dev/api-reference/types/connection-line-component-props)
- [/api-reference/types/connection-line-type](https://reactflow.dev/api-reference/types/connection-line-type)
- [/api-reference/types/connection-mode](https://reactflow.dev/api-reference/types/connection-mode)
- [/api-reference/types/connection-state](https://reactflow.dev/api-reference/types/connection-state)
- [/api-reference/types/coordinate-extent](https://reactflow.dev/api-reference/types/coordinate-extent)
- [/api-reference/types/default-edge-options](https://reactflow.dev/api-reference/types/default-edge-options)
- [/api-reference/types/delete-elements](https://reactflow.dev/api-reference/types/delete-elements)
- [/api-reference/types/edge](https://reactflow.dev/api-reference/types/edge)
- [/api-reference/types/edge-change](https://reactflow.dev/api-reference/types/edge-change)
- [/api-reference/types/edge-marker](https://reactflow.dev/api-reference/types/edge-marker)
- [/api-reference/types/edge-mouse-handler](https://reactflow.dev/api-reference/types/edge-mouse-handler)
- [/api-reference/types/edge-props](https://reactflow.dev/api-reference/types/edge-props)
- [/api-reference/types/edge-types](https://reactflow.dev/api-reference/types/edge-types)
- [/api-reference/types/fit-view-options](https://reactflow.dev/api-reference/types/fit-view-options)
- [/api-reference/types/handle](https://reactflow.dev/api-reference/types/handle)
- [/api-reference/types/handle-connection](https://reactflow.dev/api-reference/types/handle-connection)
- [/api-reference/types/internal-node](https://reactflow.dev/api-reference/types/internal-node)
- [/api-reference/types/is-valid-connection](https://reactflow.dev/api-reference/types/is-valid-connection)
- [/api-reference/types/key-code](https://reactflow.dev/api-reference/types/key-code)
- [/api-reference/types/marker-type](https://reactflow.dev/api-reference/types/marker-type)
- [/api-reference/types/mini-map-node-props](https://reactflow.dev/api-reference/types/mini-map-node-props)
- [/api-reference/types/node](https://reactflow.dev/api-reference/types/node)
- [/api-reference/types/node-change](https://reactflow.dev/api-reference/types/node-change)
- [/api-reference/types/node-connection](https://reactflow.dev/api-reference/types/node-connection)
- [/api-reference/types/node-handle](https://reactflow.dev/api-reference/types/node-handle)
- [/api-reference/types/node-mouse-handler](https://reactflow.dev/api-reference/types/node-mouse-handler)
- [/api-reference/types/node-origin](https://reactflow.dev/api-reference/types/node-origin)
- [/api-reference/types/node-props](https://reactflow.dev/api-reference/types/node-props)
- [/api-reference/types/node-types](https://reactflow.dev/api-reference/types/node-types)
- [/api-reference/types/on-before-delete](https://reactflow.dev/api-reference/types/on-before-delete)
- [/api-reference/types/on-connect](https://reactflow.dev/api-reference/types/on-connect)
- [/api-reference/types/on-connect-end](https://reactflow.dev/api-reference/types/on-connect-end)
- [/api-reference/types/on-connect-start](https://reactflow.dev/api-reference/types/on-connect-start)
- [/api-reference/types/on-delete](https://reactflow.dev/api-reference/types/on-delete)
- [/api-reference/types/on-edges-change](https://reactflow.dev/api-reference/types/on-edges-change)
- [/api-reference/types/on-edges-delete](https://reactflow.dev/api-reference/types/on-edges-delete)
- [/api-reference/types/on-error](https://reactflow.dev/api-reference/types/on-error)
- [/api-reference/types/on-init](https://reactflow.dev/api-reference/types/on-init)
- [/api-reference/types/on-move](https://reactflow.dev/api-reference/types/on-move)
- [/api-reference/types/on-node-drag](https://reactflow.dev/api-reference/types/on-node-drag)
- [/api-reference/types/on-nodes-change](https://reactflow.dev/api-reference/types/on-nodes-change)
- [/api-reference/types/on-nodes-delete](https://reactflow.dev/api-reference/types/on-nodes-delete)
- [/api-reference/types/on-reconnect](https://reactflow.dev/api-reference/types/on-reconnect)
- [/api-reference/types/on-selection-change-func](https://reactflow.dev/api-reference/types/on-selection-change-func)
- [/api-reference/types/pan-on-scroll-mode](https://reactflow.dev/api-reference/types/pan-on-scroll-mode)
- [/api-reference/types/panel-position](https://reactflow.dev/api-reference/types/panel-position)
- [/api-reference/types/position](https://reactflow.dev/api-reference/types/position)
- [/api-reference/types/pro-options](https://reactflow.dev/api-reference/types/pro-options)
- [/api-reference/types/react-flow-instance](https://reactflow.dev/api-reference/types/react-flow-instance)
- [/api-reference/types/react-flow-json-object](https://reactflow.dev/api-reference/types/react-flow-json-object)
- [/api-reference/types/rect](https://reactflow.dev/api-reference/types/rect)
- [/api-reference/types/resize-params](https://reactflow.dev/api-reference/types/resize-params)
- [/api-reference/types/selection-drag-handler](https://reactflow.dev/api-reference/types/selection-drag-handler)
- [/api-reference/types/selection-mode](https://reactflow.dev/api-reference/types/selection-mode)
- [/api-reference/types/snap-grid](https://reactflow.dev/api-reference/types/snap-grid)
- [/api-reference/types/viewport](https://reactflow.dev/api-reference/types/viewport)
- [/api-reference/types/xy-position](https://reactflow.dev/api-reference/types/xy-position)
- [/api-reference/types/z-index-mode](https://reactflow.dev/api-reference/types/z-index-mode)

### Utils (16)

- [/api-reference/utils](https://reactflow.dev/api-reference/utils)
- [/api-reference/utils/add-edge](https://reactflow.dev/api-reference/utils/add-edge)
- [/api-reference/utils/apply-edge-changes](https://reactflow.dev/api-reference/utils/apply-edge-changes)
- [/api-reference/utils/apply-node-changes](https://reactflow.dev/api-reference/utils/apply-node-changes)
- [/api-reference/utils/get-bezier-path](https://reactflow.dev/api-reference/utils/get-bezier-path)
- [/api-reference/utils/get-connected-edges](https://reactflow.dev/api-reference/utils/get-connected-edges)
- [/api-reference/utils/get-incomers](https://reactflow.dev/api-reference/utils/get-incomers)
- [/api-reference/utils/get-nodes-bounds](https://reactflow.dev/api-reference/utils/get-nodes-bounds)
- [/api-reference/utils/get-outgoers](https://reactflow.dev/api-reference/utils/get-outgoers)
- [/api-reference/utils/get-simple-bezier-path](https://reactflow.dev/api-reference/utils/get-simple-bezier-path)
- [/api-reference/utils/get-smooth-step-path](https://reactflow.dev/api-reference/utils/get-smooth-step-path)
- [/api-reference/utils/get-straight-path](https://reactflow.dev/api-reference/utils/get-straight-path)
- [/api-reference/utils/get-viewport-for-bounds](https://reactflow.dev/api-reference/utils/get-viewport-for-bounds)
- [/api-reference/utils/is-edge](https://reactflow.dev/api-reference/utils/is-edge)
- [/api-reference/utils/is-node](https://reactflow.dev/api-reference/utils/is-node)
- [/api-reference/utils/reconnect-edge](https://reactflow.dev/api-reference/utils/reconnect-edge)
