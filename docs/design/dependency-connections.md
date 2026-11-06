# Dependency connection interaction

Status: shared design confirmed on 2026-11-05 and revised by the user on
2026-11-06. Implemented and verified: diffuse body-first hover, mobile Arrow mode,
Bézier velocity, coordinated Node entry, and obstacle-aware routing. This revision
replaces the earlier visible semicircle handles.

Teaching staff need to create Dependencies reliably without precise pointer
placement, while keeping Node content readable and the connection visuals
consistent with U-Roadmaps.

## Connection gestures

- On a device with a mouse or other fine pointer, hovering the actual Node body
  first reveals a diffuse exterior shadow and enables its launch surface.
  Hovering the idle exterior alone does nothing. Moving from the body into the
  exterior retains activation; leaving both clears it. Dragging from that surface
  starts a Dependency; the body continues to move/select the Node. There are no
  visible handles, and launch surfaces yield to neighboring Node controls.
- On touch input, holding a visible editable Node for 450 ms activates Arrow
  mode. Show "Modo flecha: toca un nodo de destino" and a Cancelar control,
  highlight the source, and announce the mode through a live status region.
- After activation, release and tap a destination, or continue holding and drag
  to the destination. Moving more than 8 px before the dwell completes cancels
  arming and preserves the ordinary gesture. A short tap retains Node selection;
  pressing action/resource controls never arms a Dependency.
- Releasing/tapping any part of a valid destination Node, including its title or
  icons, selects it as the target. Invalid touch targets keep Arrow mode active
  with guidance; cancel, Escape, an outside tap, or touch cancellation ends it.
- While Arrow mode is active, Node dragging and canvas panning are suspended.
  Target selection must not also open a Node or invoke one of its controls.
- Invisible exterior React Flow anchors remain as an internal implementation
  detail, restricted to fine-pointer gestures; they are not visible handles.

## Routes and appearance

- The drag preview and saved Dependencies share straight segments, rounded
  corners, and an open arrowhead consistent with Lucide iconography.
- Resting Dependencies in editing mode use the same black/Ink color as the
  student view. Hover, selection, and active connection previews retain Blue.
- Before reaching a valid target, the source side follows the current cursor
  position on all four sides and is not locked to the launch side. Once a valid
  target is hovered, desktop and touch previews use the exact native route the
  saved Dependency will have, including obstacle avoidance and outgoing slots.
  Moving the pointer within that same target does not change its planned path.
  Speculative routing must not mutate the live saved-router scene. All preview
  SVG layers and their arrowheads remain transparent to pointer hit-testing,
  including during the interactive tutorial.
- Source and target sides continue to adjust automatically when Nodes move.
  A whole-Node drop does not introduce a fixed attachment point.
- The slightly enlarged open arrowhead ends at the actual Node border, with no
  gap for the shadow. Highlight the prospective valid target while dragging and preserve existing duplicate,
  hidden-Node, self-reference, cycle, and impact-confirmation rules.
- Use libavoid-js 0.4.5 for saved Dependencies, retaining route validation, rounded
  paths, stable control footprints, loading/retry behavior, and vendored WASM.
  Dependencies leaving the same Node side use separate attachment points at 5px
  intervals, centered around the side midpoint. Dependencies arriving at the
  same side converge on a common attachment point; do not offset arrowheads.
  Keep almost-aligned opposing ports on a common lane where possible so tiny
  endpoint differences do not create cosmetic bends. The stroke and animated tip
  use the exact resulting path, avoiding intermediate Nodes.

The tiny S-bend regression reproduces when fixed side midpoints differ by 3px.
A lone outgoing port may align with the fixed incoming midpoint within a 5px
tolerance. Multiple outgoing ports retain their assigned slots. Absolute native
pin offsets avoid floating-point differences that can introduce extra corners.

Native incremental routing can also retain earlier side choices after Nodes
move. Discovery and final routing now use canonical scenes ordered by Node and
source/target identity, so a temporary preview ID and the persisted ID produce
the same route. Preview routing owns and disposes a separate native scene.

## Motion

- Use Motion to reveal the stroke while its open tip travels along the same
  path; leave the complete arrow visible afterward.
- On Roadmap entry or browser reload, animate all Dependencies strictly one at a
  time, from prerequisites toward dependents. Keep the complete playback within
  approximately two seconds, prioritizing that cap on large Roadmaps.
- Define the complete entry clock's velocity with a cubic Bézier curve and
  integrate it into normalized displacement for Motion. Use linear progress
  inside each scheduled interval so speed does not restart at each Node. A newly
  saved Dependency uses the same velocity profile by itself.
- Expand each Node from its center with Motion. Root and isolated Nodes reveal
  at entry; other Nodes reveal when their final incoming Dependency arrives.
  New Nodes expand on creation. Keep React Flow measurement and routing geometry
  stable throughout the visual transform, and exclude waiting Nodes from input
  and focus. Settling playback also completes Node entry.
- Initial timing is `min(2 seconds, dependency count * 0.32 seconds)`, with gently
  decreasing scheduled intervals. Easing and cadence remain adjustable after
  owner visual review.
- Animate a new Dependency only after successful persistence and any necessary
  impact confirmation. Ordinary data refreshes, zoom, selection, and edits do
  not replay the entry sequence. Moving Nodes or applying automatic layout
  settles playback immediately; leaving the Roadmap cancels it.
- Do not add dedicated concurrency management for remote additions; include them
  only when the same new-edge mechanism supports them without extra machinery.
- Follow the existing product motion policy; do not add a new preference setting.

## Research and validation

The following results describe the earlier connection-gesture revision, before
the side-port, coordinated Node-entry, and toast-placement changes above.

See [the Motion/SVG research](../research/dependency-path-animation.md) for path
synchronization techniques and dense-graph timing limits.

- The final complete suites passed: 894 unit tests and 220 browser tests. Types,
  formatting, lint, and whitespace checks passed. A contended unit run had three
  timeouts; repeating with a single worker passed without changing test limits.
- A real browser regression against the prior compiled implementation failed
  because its path crossed the intermediate Node. The same regression passes
  with the restored router, alongside movement, reload, student-view, and WASM
  load/retry coverage.
- Native touch at 360 and 390 px covers long press, release-and-tap, continuous
  hold-and-drag, cancellation, pre-dwell movement, and action-control exclusion.
  Desktop coverage checks body-first activation, idle perimeter rejection,
  transfer to the launch surface, deactivation, and actual persistence.
- Reviewed diffuse-hover, routed desktop, and mobile captures. Native SVG
  sampling found zero intermediate-body intersections, and the rendered open
  tip met the target border with zero screen-pixel distance in the manual scene.
- In that revision, the original three router modules and vendored WASM were retained unchanged;
  only their integration with current Graph and Motion rendering was adapted.
  Graphify was updated after the source changes.

This brief records reversible interaction decisions. No architectural decision
or new domain definition is introduced.

The later pointer-following preview revision passed five focused unit regressions
and a native browser gesture covering right, top, left, and bottom within one
continuous drag, followed by successful Dependency creation.

## Toast placement

- Feedback enters upward from the lower-right canvas area, in a column to the
  left of the floating creation button. It follows the actual button as a
  desktop sidebar resizes the canvas.
- On compact canvases the editor is a bottom sheet over the canvas. Stack feedback
  above that sheet, preserve a readable column, and account for viewport safe
  areas. With the sheet closed, align feedback with the button's baseline. When
  the creation menu opens, lift the feedback above the menu while keeping its
  right edge left of the button.
- Without a visible floating control, use the viewport's lower-right safe area.
  Stack additional notifications upward and retain accessible dismissal. Empty
  space in the notification column must never intercept canvas input, including
  when the tutorial enables interactions with portals.

## Validation of the current revision

- Full unit suite: 921 tests in 94 files passed. The final decorative-pointer
  changes also passed the 8 focused preview/path component tests.
- Full integration suite: 143 tests in 25 files passed.
- Full Chromium browser suite: 224 tests passed, including the complete teaching
  tutorial, desktop preview/saved-path equality around an obstacle with source
  fanout, and touch preview/saved-path equality at 360 and 390px.
- Toast geometry and screenshots cover 320, 390, 1024, and 1440px, with an open
  editor and with the floating menu closed/open. Mobile checks open the folded
  editor through its actual control and pan the canvas through pointer input.
- Type checking, formatting, and lint passed without errors; existing test lint
  warnings remain. No physical Safari or Android device was used.
- Real-WASM regressions reproduce the 3px bend and routing-history mismatch on
  the prior implementation. Restoring destination separation makes eight
  incoming/mixed-side cases fail; restoring the source-only fix returns them to
  green.
- Tutorial regression coverage confirms that neither the empty toast column
  nor any layer of the provisional SVG intercepts the underlying canvas input.
