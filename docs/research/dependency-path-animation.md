# Dependency path animation research

Investigated 2026-11-05. Research and design guidance only; no application code,
animation prototype, or browser performance test was changed or run. The current
interaction decisions are recorded in
[the connection brief](../design/dependency-connections.md). These findings were
recorded before implementation approval; the brief tracks the current status.

## Recommendation

Use the installed Motion stack to animate one normalized progress value. Derive
both the revealed stroke and a separate open arrowhead from that same value and
the exact rounded orthogonal SVG path. An ordinary SVG `marker-end` cannot travel
with the reveal: it remains attached to the path's geometric endpoint. Prefer a
small deterministic schedule and one shared entry clock over a queue, concurrent
animation manager, or a new animation library.

This is an engineering recommendation based on the APIs below, not a claim that
its final appearance has been validated. Timing and acceleration remain
provisional, as agreed in the connection brief.

## Verified local facts

- `motion` resolves to **14.2.0**. A read-only module import verified callable
  `animate`, `useMotionValue`, `useTransform`, `useMotionValueEvent`, and
  `useAnimate` exports from `motion/react`. Existing visual examples use
  `LazyMotion`, `domAnimation`, and `motion/react-m`; see
  [package.json](../../package.json) and
  [RouteSpecimen.tsx](../../src/features/roadmap/ui/RouteSpecimen.tsx).
- `FloatingEdge` currently computes its SVG `d` using `getSmoothStepPath` and
  automatic facing-side geometry. It ignores persisted handle choices for the
  rendered path. The real canvas does not currently animate these edges. See
  [FloatingEdge.tsx](../../src/features/roadmap/graph/FloatingEdge.tsx) and
  [geometry.ts](../../src/features/roadmap/graph/geometry.ts).
- The specimen already reveals paths over 0.5 seconds with `pathLength`, opacity,
  and depth-based stagger. Its exponential ease-out is a deceleration, unlike the
  requested mild acceleration. See `RouteSpecimen.tsx`, lines 385–403.
- A new Dependency is not added optimistically: impact is read, consequential
  blocking waits for confirmation, persistence runs, and then the Roadmap is
  refreshed. Start its animation when the saved Dependency appears. See
  [commands.ts](../../src/features/roadmap/canvas/commands/commands.ts), lines
  349–387, and [session.tsx](../../src/features/roadmap/session/session.tsx),
  lines 327–348.
- Entry has an explicit identity: `RoadmapCanvasSession` keys its view by session
  and `roadmapEntryKey`, which the course page generates for entry. In-place
  refreshes also happen after commands, live updates, recovery, and retries;
  they must not be treated as new visits. See
  [RoadmapCanvasSession.tsx](../../src/features/roadmap/session/RoadmapCanvasSession.tsx),
  [the course page](../../src/app/courses/[courseCode]/[year]/[semester]/page.tsx),
  and `session.tsx`, lines 146–220.
- Current product policy deliberately ignores `prefers-reduced-motion`, and
  choreographed motion uses Motion. Follow that established policy; this research
  does not reopen it. See [PRODUCT.md](../../PRODUCT.md), line 44, and
  [DESIGN.md](../../DESIGN.md), line 197. Older component CSS is not a replacement
  for those current product decisions.

## Primary-source API evidence

Motion supports normalized `pathLength`, `pathSpacing`, and `pathOffset` for SVG
line drawing. These values control stroke drawing; they do not shorten the path
geometry. The installed `node_modules/motion/dist/motion.dev.js`, function
`buildSVGPath` around line 6446, confirms that Motion sets SVG `pathLength=1` and
generates dash-array and dash-offset values. [Motion SVG animation](https://motion.dev/docs/react-svg-animation).

SVG places `marker-end` at the last vertex of the path. Changing the dash pattern
does not move that vertex. Therefore a traveling arrowhead needs its own element,
or an actually shortened geometry, rather than only a marker on the full path.
The separate element is the simpler fit here. [SVG 2 marker properties](https://www.w3.org/TR/SVG2/painting.html#VertexMarkerProperties).

`getTotalLength()` returns the browser's computed path length in user units, and
`getPointAtLength(distance)` returns a point along that geometry. Neither method
uses the author-supplied `pathLength` normalization. Consequently, sample the tip
at `progress * measuredLength`, not at a distance between zero and one. These
methods may fail for geometry the browser cannot compute while non-rendered;
measure after the actual path exists. [SVG 2 geometry interface](https://www.w3.org/TR/SVG/latest/types.html#InterfaceSVGGeometryElement).

Motion values can be shared, composed, and updated without React renders; their
DOM updates are batched to animation frames. `useTransform` can derive a value
from another value, including arbitrary calculations. These APIs allow one
progress source to synchronize the stroke and tip without `setState` every frame.
[Motion values](https://motion.dev/docs/react-motion-value),
[useTransform](https://motion.dev/docs/react-use-transform).

Hybrid `animate` supports numbers, Motion values, controlled timelines, duration,
easing, and explicit segment positions. It returns playback controls including
`stop()`. Only the hybrid API is relevant to custom value/SVG work here; do not
substitute a mini import based solely on bundle size. [animate](https://motion.dev/docs/animate).

`useAnimate` scopes selectors and cleans up its animations on unmount.
`useMotionValueEvent` cleans up Motion-value subscriptions. The installed
`framer-motion/dist/es/animation/hooks/use-animate.mjs` and
`utils/use-motion-value-event.mjs` confirm those behaviors in 14.2.0. Plain
`animate` still requires explicit owner cleanup. [useAnimate](https://motion.dev/docs/react-use-animate),
[useMotionValueEvent](https://motion.dev/docs/react-use-motion-value-event).

## Proposed drawing algorithm

1. Reuse one generated `d` for the visible stroke and geometry sampling. Measure
   and cache its length after commit; invalidate that cache only when `d` changes.
2. Let `p` be the edge's clamped progress from 0 to 1. Set the Motion path's
   `pathLength` to `p`, with the start offset fixed at zero.
3. Draw an open chevron locally around a tip at `(0, 0)`, with `fill=none`, round
   caps and joins, and the same stroke/color as the path. Move it to the sampled
   point. Compute its heading from samples immediately before and after that
   distance: `atan2(after.y-before.y, after.x-before.x)`. Clamp sample distances
   to the path range. Hide the chevron at `p=0` to avoid an orphan tip or tiny dash.
4. Apply an SVG group `translate(x y) rotate(angle)` from the same progress.
   Keep the same chevron at `p=1`; a second marker is unnecessary. Rounded corners
   allow the heading to turn along the corner rather than snapping at a sharp
   right-angle junction. This tangent estimation is our proposed use of SVG
   sampling, not a built-in Motion arrow feature.

One `useTransform` may produce the complete transform string so sampling is not
repeated independently for x, y, and rotation. If frame ordering causes a visible
one-frame mismatch, use a single Motion-driven update callback to write both
normalized dash attributes and the tip transform together. That fallback still
uses Motion for timing and needs no React update loop. Keep React responsible for
structure and the animation owner responsible for these transient attributes.

A CSS `offset-path`/`offset-distance` solution is possible, but adds motion-path
coordinate and rotation behavior to validate against the React Flow viewport.
It does not remove the need to synchronize stroke reveal. Rebuilding a truncated
SVG `d` each frame would let a marker follow its endpoint but adds unnecessary
path parsing/splitting. Neither is preferred for the first implementation.
[Motion path movement options](https://motion.dev/docs/animate#motion-along-a-path).

## Strict sequence and timing proposal

Compute a stable topological order of Nodes in the initial rendered Dependency
graph. List each Node's outgoing Dependencies in that source order, breaking ties
deterministically. Every prerequisite source appears before its dependent, so all
incoming edges of a Node precede its outgoing edges. This is a proposed scheduling
algorithm justified by the existing acyclic Dependency rule in
[GLOSSARY.md](../../GLOSSARY.md); Motion does not perform graph ordering.

For `N > 0` Dependencies, a practical starting schedule is:

```text
T = min(2.0, N * 0.32) seconds
w[i] = N == 1 ? 1 : 1 - 0.35 * i/(N-1)   # bounded 1 → 0.65
duration[i] = T * w[i] / sum(w)
start[i] = sum(duration[j] for j < i)
```

No gaps or overlaps; the final end time equals `T`. With one edge the duration is
320 ms. With five, the total is 1.6 s, ranging approximately 388→252 ms per edge.
With ten, the total is 2 s, ranging 242→158 ms. The bounded decrease speeds the
cadence without giving the final edges arbitrarily small relative durations.
These are proposed values, not measured usability findings.

For mild acceleration within each edge, begin with a monotonic easing such as
`E(u)=0.85*u+0.15*u*u`: speed increases gently without starting every segment at
zero speed. Motion accepts easing functions and cubic Bézier curves. A custom
curve can be replaced after visual review. Decreasing durations accelerate the
cadence; differing geometric lengths mean this is not constant physical-speed
acceleration across edges. Length-proportional weights could model physical
speed but may make short Dependencies imperceptible, so avoid that complication
unless the visual review demonstrates a need. [Motion easing](https://motion.dev/docs/easing-functions).

Two small implementation choices are viable:

- **Shared clock, preferred:** animate elapsed time linearly from 0 to `T` once;
  each edge derives `p=E(clamp((time-start[i])/duration[i]))`. This fixes the entry
  deadline, has one playback owner, and avoids Promise/timer drift. Edge-local
  derived values only need to sample geometry while their progress changes.
- **Scheduled Motion segments:** animate each edge's progress 0→1 with its
  precomputed start/duration using a sequence. This is declarative, but adds more
  tracks and ownership plumbing; it is reasonable if cleaner in the eventual
  component structure. Do not use a timer chain or await each edge separately
  merely to establish timing. [Motion timeline sequences](https://motion.dev/docs/timeline-sequences).

The two-second cap has a real perceptual limit: 120 edges average 16.7 ms each,
one frame at 60 Hz; above that, individually visible motion for every edge cannot
be guaranteed. A single elapsed-time clock may correctly advance several edges
to completion between rendered frames. Preserve strict scheduling and the agreed
cap; do not silently introduce overlap or extend the duration. This is arithmetic
and a design trade-off, not a performance benchmark.

## Lifecycle, geometry, and cancellation proposals

Keep the entry schedule tied to the visit identity, not the changing Roadmap
object, viewport, selection, or path `d`. Wait for initial Nodes/path geometry to
be measurable before starting; the two-second budget covers playback, not network
loading. Subsequent successful local creation animates only its new saved edge.
Cancellation of confirmation or persistence failure produces no animation.

Ordinary data refreshes preserve existing progress. Tracking new edge IDs can
reuse the new-edge mechanism for remote additions at little cost, but local-only
triggering is preferable if distinguishing them requires new concurrency state.
A remote insertion during entry should not restart/rebuild the initial schedule;
show it complete unless the existing mechanism trivially handles it. No special
remote-event queue is recommended.

The brief's final-review proposal is simpler than maintaining an active drawing
through geometry changes: starting a Node drag during entry settles the entire
sequence immediately to its complete state. Treat this as a proposal awaiting
the user's final confirmation. It avoids resampling moving geometry and preserves
editing responsiveness. Pan and zoom transform the common SVG coordinate space
and do not require replay. A small per-edge delay/duration schedule is also a
reasonable first implementation if a shared clock would add context/registration
plumbing; do not build that plumbing just for this effect.

Stop the clock on unmount/visit replacement, remove subscriptions, and ignore
callbacks from that playback owner. Avoid changing edge keys to replay ordinary
refreshes. Effects must have symmetric setup/cleanup, including React's
development setup-cleanup-setup cycle; do not add a permanent “already played”
flag that prevents the second setup after cleanup. [React useEffect lifecycle](https://react.dev/reference/react/useEffect#connecting-to-an-external-system).

## Validation still required

No browser demo or application implementation was produced. Official API support
and local exports establish feasibility, not smoothness. Visually verify open-tip
orientation around tight corners, origin/end clipping, stroke/tip alignment,
initial measurement/fit-view, short and zero-length paths, zoom, geometry changes,
branch/merge ordering, dense graphs, and single-edge creation after confirmation.
Ensure pointer input is usable throughout playback and no animation blocks editing.
Check cleanup/remount behavior and the absence of React renders on every frame.
Only then approve final easing, stroke weight, tip dimensions, and timing.
