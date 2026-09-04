---
status: proposed
---

# Adopt React Flow canvas primitives where they replace Roadmap canvas mechanics

## Context

The Roadmap canvas uses `@xyflow/react` 12.11.3. A review of React Flow's
[components](https://reactflow.dev/api-reference/components),
[hooks](https://reactflow.dev/api-reference/hooks),
[types](https://reactflow.dev/api-reference/types), and
[utilities](https://reactflow.dev/api-reference/utils) identified canvas
mechanics implemented locally even though React Flow exposes a supported
equivalent. The detailed audit is recorded in
[the research note](../research/react-flow-api-audit.md).

This ADR distinguishes those mechanics from the product rules of a **Roadmap**.
React Flow owns rendering and interaction state; it must not become the
authority for **Dependencies**, their acyclicity, **Teacher blocks**,
**Prerequisite blocks**, student-access effects, confirmations, or persistence.

## Decision

Use React Flow's public primitives when they replace a canvas-only concern. Keep
the Roadmap's domain and layout policy outside React Flow.

| Finding | Local implementation | React Flow implementation | Decision |
| --- | --- | --- | --- |
| Selected-edge delete control | [`FloatingEdge`](../../src/features/roadmap/graph/FloatingEdge.tsx) manually renders a selected-only `EdgeLabelRenderer`, applies a translate transform from `labelX`/`labelY`, and prevents the control from panning or dragging (lines 73–99). | [`<EdgeToolbar />`](https://reactflow.dev/api-reference/components/edge-toolbar) takes `edgeId`, `x`, and `y`; it is selected-only by default and renders without viewport scaling. | Replace the manual renderer/transform/selection gating with `EdgeToolbar`. Keep the existing destructive button and the Roadmap Dependency deletion callback. |
| Drag-stop grid rounding | [`snapToRoadmapGrid`](../../src/features/roadmap/graph/geometry.ts) rounds a node position, and [`RoadmapCanvas`](../../src/features/roadmap/RoadmapCanvas.tsx) applies it again before saving a dragged node (line 332). | [`snapToGrid` and `snapGrid`](https://reactflow.dev/api-reference/react-flow#viewport-props) snap dragged nodes; `RoadmapGraph` already enables both with the same 20px grid (lines 103–104). | Add/retain an interaction test that proves `onNodeDragStop` receives the snapped position, then persist `node.position` directly. Retain rounding for Dagre-generated positions, for which React Flow exposes no public generic snapping utility. |
| Direct internal-store lookup | [`FloatingEdge`](../../src/features/roadmap/graph/FloatingEdge.tsx) reads `nodeLookup`, `measured`, and `internals.positionAbsolute` through a bespoke `useStore` selector (lines 16–50). | [`useInternalNode()`](https://reactflow.dev/api-reference/hooks/use-internal-node) is the public API for an id's internal node, including its absolute position. | Prefer the public hook when its render behavior is acceptable, retaining only the conversion from an internal node to the rectangle needed for the floating-edge policy. The current selector may remain if profiling shows its narrowed equality comparison is materially necessary; this is an API-boundary cleanup, not a reason to discard the custom endpoint policy. |
| Viewport-fixed overlays | [`RoadmapCanvas`](../../src/features/roadmap/RoadmapCanvas.tsx) positions the metadata header, editing hint, and legend with independent absolute-position classes (lines 108–143 and 298–321). | [`<Panel />`](https://reactflow.dev/api-reference/components/panel) positions arbitrary content above a React Flow viewport at the same named corners. The project already uses it for the top-right action bar. | Move these overlays into `RoadmapGraph` as `Panel` children when that component is next reshaped. Preserve their visual design and `pointer-events` behavior; this is a low-risk consolidation rather than a user-visible feature. |

The following areas are deliberately not replacements:

- `floatingEdgeGeometry`, `nearestSide`, and `sideAnchor` remain custom. The
  official [Floating Edges example](https://reactflow.dev/examples/edges/floating-edges)
  demonstrates an application-supplied dynamic-endpoint calculation; React
  Flow's `getSmoothStepPath()` only creates a path after that policy has chosen
  endpoints. The project already uses that path utility.
- `layoutRoadmapGraph` remains Dagre-backed. React Flow documents layout
  integrations, not a built-in layout engine. Title-derived node size and
  Roadmap grid alignment are application visual policy.
- The controlled-flow state remains deliberately composed with the documented
  [`applyNodeChanges`](https://reactflow.dev/api-reference/utils/apply-node-changes)
  and [`applyEdgeChanges`](https://reactflow.dev/api-reference/utils/apply-edge-changes)
  utilities. Replacing it wholesale with `useNodesState`/`useEdgesState` would
  lose the required deletion filtering and edge-appearance rules.
- React Flow's connection and traversal facilities—such as
  [`IsValidConnection`](https://reactflow.dev/api-reference/types/is-valid-connection),
  [`getIncomers`](https://reactflow.dev/api-reference/utils/get-incomers), and
  [`getOutgoers`](https://reactflow.dev/api-reference/utils/get-outgoers)—may
  improve immediate editor feedback, but cannot replace server-authoritative
  Dependency validation or access calculations.

## Consequences

The canvas will depend less on React Flow's private store shape and will remove
duplicated selection, placement, and drag-grid behavior. The Roadmap retains
its authoritative domain behavior on the server, so adopting these primitives
does not change the meaning or lifecycle of Nodes or Dependencies.

The detailed review also records facilities that were evaluated but have no
current duplicate: `Controls`, `MiniMap`, node-resizing components,
`ViewportPortal`, `useConnection`, `useReactFlow`, bounds/viewport utilities,
`addEdge`, `reconnectEdge`, and `OnBeforeDelete`.
