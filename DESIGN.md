---
version: alpha
name: u-roadmaps-campus-wayfinding
description: Student-first visual language for U-Roadmaps. Campus wayfinding informs a clear academic interface where FCFM blue structures navigation and action, Jade green marks personal progress and orientation, Archivo SemiCondensed gives headings a compact institutional voice, and Plus Jakarta Sans keeps interface text approachable and legible.

colors:
  primary: "#024ad8"
  primary-bright: "#296ef9"
  primary-deep: "#0e3191"
  primary-soft: "#c9e0fc"
  on-primary: "#ffffff"
  progress: "#35a779"
  progress-deep: "#176245"
  progress-soft: "#ddf2e9"
  on-progress: "#12213a"
  ink: "#12213a"
  canvas: "#ffffff"
  cloud: "#f3f5f7"
  fog: "#dce1e8"
  steel: "#aeb7c3"
  graphite: "#5a6474"
  error: "#b3262b"

typography:
  display-lg: { fontFamily: Archivo SemiCondensed, fontSize: 56px, fontWeight: 650, lineHeight: 0.98, letterSpacing: -2.8px }
  display-md: { fontFamily: Archivo SemiCondensed, fontSize: 40px, fontWeight: 650, lineHeight: 1.0, letterSpacing: -1.6px }
  display-sm: { fontFamily: Archivo SemiCondensed, fontSize: 28px, fontWeight: 650, lineHeight: 1.08, letterSpacing: -0.8px }
  heading-sm: { fontFamily: Archivo SemiCondensed, fontSize: 22px, fontWeight: 650, lineHeight: 1.15, letterSpacing: -0.4px }
  body-lg: { fontFamily: Plus Jakarta Sans, fontSize: 18px, fontWeight: 400, lineHeight: 1.55 }
  body-md: { fontFamily: Plus Jakarta Sans, fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }
  caption-md: { fontFamily: Plus Jakarta Sans, fontSize: 14px, fontWeight: 500, lineHeight: 1.5 }
  label-sm: { fontFamily: Plus Jakarta Sans, fontSize: 12px, fontWeight: 700, lineHeight: 1.4, letterSpacing: 1.2px, textTransform: uppercase }
  button-md: { fontFamily: Plus Jakarta Sans, fontSize: 14px, fontWeight: 700, lineHeight: 1.4, textTransform: none }

rounded:
  md: 4px
  lg: 8px
  xl: 16px
  pill: 9999px

spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 80px
---

## Brand Foundation

The canonical product name is **U-Roadmaps**. Its primary promise is **“Cada curso, una ruta clara.”** The supporting description is **“Explora contenidos, requisitos y recursos en una ruta que muestra tu avance.”** Do not substitute alternate capitalization, remove the hyphen, or use “Roadmaps universitarios” as the product name.

The brand is student-first and gives teaching staff a denser authoring mode within the same visual system. Its personality is orientation and advancement: clear, encouraging, precise, and never childish. U-Roadmaps should feel like a capable guide through university learning rather than another administrative portal.

U-Roadmaps has its own identity. Universidad de Chile establishes provenance on sign-in surfaces and in the global footer, but its name, the DCC name, and institutional marks are not part of the U-Roadmaps logo.

## Visual Thesis

The interface borrows from **campus wayfinding**: visible routes, current-position markers, concise labels, structured bands, and compact headings. White and cool-gray surfaces keep academic information readable. Blue establishes the system and its actions; Jade identifies the participant's progress through it.

The roadmap itself is the primary image of the product. Use real nodes, dependencies, resources, and progress states in prominent compositions instead of generic student illustrations, stock photography, or decorative dashboard graphics.

Route traces and nodes can organize headers, transitions, and progress surfaces. They replace the previous angular chevron motif. A trace must communicate actual sequence, connection, position, or movement; it is not a generic decoration.

## Color

### Blue: structure and action

- **Primary** (`{colors.primary}`): navigation, primary actions, active dependencies, focus, and product structure.
- **Primary Bright** (`{colors.primary-bright}`): high-visibility interaction on dark surfaces and restrained hover emphasis.
- **Primary Deep** (`{colors.primary-deep}`): pressed actions, strong headings, and dark blue structural areas.
- **Primary Soft** (`{colors.primary-soft}`): selected structural controls and low-emphasis blue surfaces.

### Jade: progress and orientation

- **Progress** (`{colors.progress}`): completion tracks, current-position borders, progress indicators, and orientation details.
- **Progress Deep** (`{colors.progress-deep}`): text and icons on progress-soft surfaces and strong progress labels.
- **Progress Soft** (`{colors.progress-soft}`): progress regions, current-node context, and surfaces that explain how to continue.

Jade is a secondary structural color, not an unrestricted accent. Blue carries approximately half of the chromatic weight and Jade approximately 20–30%; neutrals provide the remaining visual field. These proportions describe perceived chromatic emphasis, not a requirement to paint a fixed percentage of every screen.

Never place white body text on `{colors.progress}`; the contrast is insufficient. Use `{colors.ink}` or `{colors.progress-deep}`. Do not use Jade to color node types: node-type colors remain user-defined pedagogical data and must not be confused with platform progress.

### Neutrals and feedback

- **Canvas** (`{colors.canvas}`) and **Cloud** (`{colors.cloud}`): primary and supporting surfaces.
- **Fog** (`{colors.fog}`) and **Steel** (`{colors.steel}`): dividers, inactive borders, and low-emphasis structure.
- **Ink** (`{colors.ink}`) and **Graphite** (`{colors.graphite}`): primary and supporting text.
- **Error** (`{colors.error}`): destructive actions and validation errors only.

Do not use green alone to communicate completion or current position. Pair it with a label, icon, shape, or change in fill.

## Typography

Use **Plus Jakarta Sans** as the primary interface family for body text, controls, navigation, labels, captions, and metadata. Use **Archivo** with its width axis set to a semi-condensed proportion (`font-variation-settings: "wdth" 87.5`) for display titles, page headers, course names, major percentages, and the future wordmark only if the approved logo direction supports it.

Archivo creates the compact rhythm of campus signage and keeps long Spanish course names useful at display scale. Plus Jakarta Sans provides a more open texture for instructions and operational content. Arial and Arial Narrow are last-resort system fallbacks; production font loading should use self-hosted assets or `next/font`.

Use sentence case for headings, actions, menu items, and descriptive labels. Reserve uppercase for course codes, very short wayfinding labels, and institutional provenance. Do not apply global uppercase transformation to buttons.

Use negative letter spacing only on large Archivo headings. Body copy and controls retain normal tracking. Avoid explanatory text below 12px and preserve user-configured browser font scaling.

## Editorial Voice

Write in clear, direct Spanish from the participant's side of the screen. Prefer active verbs such as “Explora”, “Continúa”, “Guarda cambios”, and “Ver mis cursos”. Use second person when it improves orientation. Explain what is available, what is required, and what can happen next.

Empty and error states provide direction rather than mood. Avoid administrative jargon, artificial enthusiasm, infantilizing language, and claims that students can always proceed “a su propio ritmo”; dependencies and the academic term may constrain progress.

Keep an action's name stable through the whole interaction. A button labeled “Guardar cambios” produces confirmation that the changes were saved, not a generic “Operación exitosa”.

## Layout

Use an 8px grid with 4px subdivisions. Center desktop content at a maximum width between 1320px and 1440px according to the page's information density. Use 24px desktop gutters and `{spacing.section}` between major regions.

Page hierarchy follows wayfinding structure:

1. A short context label identifies the course, term, or current area.
2. An Archivo heading states the destination or task.
3. Plus Jakarta Sans explains requirements and next steps.
4. The roadmap, course list, or authoring workspace becomes the dominant working surface.

The graph needs generous empty space so dependencies remain readable. Dense authoring controls belong in a visually distinct panel and must not reduce the roadmap to a decorative preview. Supporting information can be compact but must remain scannable.

Use cool-gray grid lines, dots, route traces, and dividers only when they encode alignment or connection. Do not fill empty space with arbitrary gradients, blobs, or repeated decorative icons.

## Elevation and Shape

Preserve the established radius hierarchy:

- `{rounded.md}` for buttons, inputs, compact operational controls, and small status plates.
- `{rounded.lg}` for roadmap nodes, expandable rows, menus, and compact containers.
- `{rounded.xl}` for cards, page sections, side panels, and major framed canvases.
- `{rounded.pill}` only for progress tracks, global filters, or values whose shape encodes continuity.

Use flat surfaces and 1px hairlines by default. Apply restrained shadows such as `0 4px 10px rgb(18 33 58 / 7%)` to draggable nodes and `0 18px 50px rgb(18 33 58 / 8%)` only to major demonstration or floating surfaces. Hierarchy should come from structure and contrast before elevation.

## Iconography

Use **Material Symbols Rounded** as the only general-purpose interface icon system. Use outlined symbols by default and the `FILL` axis for active, selected, or completed states. A change from outline to fill must reinforce a real state change.

Use optical size 24 for standard controls, weight around 500, grade 0, and a visible label whenever the action is not universally understood. Icon-only controls require an accessible name and a minimum 44px touch target.

Do not mix Material Symbols Rounded with Lucide, Material Icons, or unrelated pictogram sets in the production interface. A future custom brand symbol is the only planned exception.

## Components

- **Primary button**: blue surface, white sentence-case label, minimum 44px height, and a direct verb. Add a rounded Material Symbol only when it clarifies direction or outcome.
- **Secondary button**: white or cloud surface with blue or ink border. It must not compete with the primary action.
- **Course header**: compact context label, Archivo course name, supporting term/code information, and visible progress when applicable.
- **Progress track**: neutral base with Jade completion fill, a numeric value, and a textual completed/total description.
- **Roadmap node**: white 8px-radius card with pedagogical title, node type, status label, and direct resource affordance. The current node uses a Jade border or marker; completed nodes use a filled completion symbol plus text.
- **Dependency**: blue directional structure. It remains distinguishable from Jade progress and from custom node-type colors.
- **Resource card**: compact title, resource type, and Material Symbol with an explicit external or download affordance.
- **Teacher panel**: denser authoring surface that uses Ink and Blue for structure. Jade appears only when teacher actions affect or report participant progress.
- **Institutional provenance**: “Universidad de Chile” appears on sign-in surfaces and in the global footer, separate from the U-Roadmaps wordmark.

## Logo and Favicon Status

The production logo and favicon are **not approved**. The U-shaped route symbol shown in `/design-preview` is an exploration and must not be promoted to application metadata, navigation, or distributed assets.

Future logo work must retain the approved brand attributes—orientation, advancement, student-first clarity, Blue/Jade compatibility, and recognition from favicon to primary lockup—but may replace the U-route metaphor entirely. The logo requires a separate visual iteration and explicit approval before this section defines production geometry, clear space, lockups, or monochrome variants.

## Responsive Behavior

All interactive controls require a 44px minimum touch target. On screens below 768px, stack comparison and information regions, collapse secondary editing panels into accessible drawers or sections, and preserve the roadmap as a readable consultation surface.

At 768–1023px, favor a single working column with expandable controls. At 1024px and above, the graph may share the viewport with a persistent teacher or resource panel. Long Archivo headings must wrap naturally without clipping; do not solve narrow layouts by shrinking them below useful reading size.

Route traces may simplify or disappear on mobile when they stop communicating useful structure. Core progress information must remain available as text and icons.

## Accessibility and Motion

Meet WCAG AA contrast for text and interactive states. Preserve visible keyboard focus, semantic heading order, accessible names, and browser zoom. Never rely on color, opacity, or motion alone to communicate state.

Motion may reinforce feedback, spatial continuity, entry hierarchy, state transitions, and occasional moments of delight. Keep it purposeful and restrained: do not animate every element by default, add continuous ambient loops, or delay frequent tasks for presentation. Respect `prefers-reduced-motion`; content, status, and interaction must remain understandable with motion reduced or disabled.

## Reference Implementation

The temporary, development-only `/design-preview` route is the visual laboratory for the interface. It presents reusable visual units and their relevant states on one page, including pieces that remain embedded in production pages. It is not a catalog of every React wrapper or of complete application pages.

Each visual specimen records two independent facts: its design maturity (`baseline`, `experimental`, or `approved for implementation`) and its production adoption (`not implemented`, `partial`, or `implemented`). Only explicit owner approval can mark a complete specimen and all its required states as approved. These specimen metadata are the canonical status record.

The laboratory uses deterministic static fixtures and local simulated interactions. It must not depend on authentication, backend requests, navigation side effects, or persistent mutations. Relevant desktop and mobile presentations appear in labeled frames, and all specimens remain rendered for panoramic manual review.

Production baselines should render the real production component when practical; tightly coupled UI may use a faithful visual specimen instead. Experimental and approved designs remain laboratory-owned references that production implementations copy and deepen with the functional variables and behavior the product requires. Keep the current approved design and at most one replacement candidate visible; Git retains older iterations.

The laboratory is reviewed manually and has no dedicated unit, integration, end-to-end, or visual-regression tests. It is never a production screen, must not be exposed outside development, and will be removed before the final production delivery. The experimental route symbol remains excluded from approval and must not be promoted to application metadata, navigation, or distributed assets.

## Do and Don't

Do use Blue for platform structure and action, Jade for personal progress and orientation, Archivo SemiCondensed for meaningful headings, and Plus Jakarta Sans for readable interaction.

Do make the roadmap the visual protagonist, preserve 4/8/16px radii, use sentence case, and show the participant where they are and what can happen next.

Do not restore the chevron motif, turn Jade into a generic decoration, use node-type colors as brand colors, mix icon systems, use generic student imagery, or treat the preview's U-route symbol as an approved logo.
