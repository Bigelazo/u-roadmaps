---
version: alpha
name: u-roadmaps-campus-wayfinding
description: Student-first visual language for U-Roadmaps. Campus wayfinding informs a clear academic interface where FCFM blue structures navigation and action, Jade green marks personal progress and orientation, Poppins gives headings a clear geometric voice, and Plus Jakarta Sans keeps interface text approachable and legible.

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
  blocked: "#40506a"
  error: "#b3262b"
  teaching-assistant: "#933D8A"
  auxiliary-professor: "#f0195c"
  course-professor: "#1d3193"
  coordinating-professor: "#9acc24"
  enrolled-student: "#f4ce62"
  observer: "#6f7a8a"

typography:
  display-lg: { fontFamily: Poppins, fontSize: 56px, fontWeight: 600, lineHeight: 0.98, letterSpacing: -2.8px }
  display-md: { fontFamily: Poppins, fontSize: 40px, fontWeight: 600, lineHeight: 1.0, letterSpacing: -1.6px }
  display-sm: { fontFamily: Poppins, fontSize: 28px, fontWeight: 600, lineHeight: 1.08, letterSpacing: -0.8px }
  heading-sm: { fontFamily: Poppins, fontSize: 22px, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.4px }
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

U-Roadmaps has its own identity. Universidad de Chile establishes provenance in the global footer, but its name, the DCC name, and institutional marks are not part of the U-Roadmaps logo.

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
- **Blocked** (`{colors.blocked}`): blocked roadmap nodes, whether locked by prerequisites or by teaching staff. It replaces the node-type color on the border and type icon, and fills the node at 20% opacity over `{colors.canvas}`. Always pair it with the lock badge; gray alone does not communicate the block.
- **Error** (`{colors.error}`): destructive actions, validation errors, and the Node change mark on the roadmap canvas, a count of changes since the participant last opened that node. Do not use it for other counters.

Do not use green alone to communicate completion or current position. Pair it with a label, icon, shape, or change in fill.

### Institutional course positions

Academic-overview course rows show a position plate: a 4px-radius label tinted with the position color at 16% over the card, a solid position-color dot, and the position name in Ink. The color always pairs with the textual position; it never conveys a position by color alone. Teaching staff whose position U-Campus has not reported show “Equipo docente” with an outlined Graphite dot instead of a color. The colors are exposed as `--position-*` tokens and stay identical in both themes, since they identify each position. Do not mark rows with a colored left border.

- **Teaching assistant** (`{colors.teaching-assistant}`): Ayudante.
- **Auxiliary professor** (`{colors.auxiliary-professor}`): Auxiliar.
- **Course professor** (`{colors.course-professor}`): Profesor de cátedra.
- **Coordinating professor** (`{colors.coordinating-professor}`): Profesor coordinador.
- **Enrolled student** (`{colors.enrolled-student}`): Estudiante.
- **Observer** (`{colors.observer}`): Oyente.

### Dark theme

The dark theme is opt-in: the theme button in the global navigation toggles between light and dark, and light is the default. It does not follow the system preference. The choice is stored in the `theme` cookie so the server renders the right theme and the embedded view inside U-Cursos follows it. The resolved theme is exposed as `data-theme` on `<html>`; write dark overrides with the `dark:` variant or under `[data-theme='dark']`, never with `prefers-color-scheme`.

Dark colors come from the dark role tokens of [dcc-ui-kit](https://dcc-fcfm-uchile.github.io/dcc-ui-kit/site/) (`[data-dcc-theme="dark"]` in its `styles.css`) and from its palette, not from the U-Roadmaps Blue and Jade. The light theme keeps the palette described above. No color outside the kit's stylesheet may appear in the dark theme, with one exception: the twelve `--node-type-*` variants, which are colors chosen by the teaching team rather than theme colors.

The distribution copies the kit's documentation site, not its `.dcc-root` default: the whole page sits on the surface color, cards are told apart by a subtle border instead of a fill, and the global navigation is a Grey/Default brand bar with white content.

| Role | Tokens | Dark value | Kit role |
| --- | --- | --- | --- |
| Page and surfaces | `background`, `cloud`, `card`, `sidebar` | `#19202b` | `--dcc-surface` |
| Raised surface | `popover` | `#222b38` | `--dcc-surface-raised` |
| Soft fill and hover | `muted`, `secondary`, `accent` | `#283243` | `--dcc-surface-muted` |
| Text / headings / secondary text | `foreground` / `ink` / `muted-foreground`, `graphite` | `#e2e9f0` / `#f3f6f9` / `#97abbb` | `--dcc-fg` / `--dcc-fg-strong` / `--dcc-fg-muted` |
| Divider and card border / control border | `border`, `fog` / `input`, `steel` | `#2e3949` / `#65788e` | `--dcc-border-subtle` / `--dcc-border` |
| Accent and its label | `primary` / `primary-foreground` | `#c0cfdd` / `#19202b` | `--dcc-accent` / `--dcc-on-accent` |
| Selected fill | `primary-soft`, `info-soft` | `#1a3448` | `--dcc-info-bg` |
| Focus | `ring` | `#5aaee0` | `--dcc-focus` |
| Error (base / soft / deep) | `destructive` | `#ff8f7a` / `#3b211d` / `#ffb3a4` | `--dcc-danger` |
| Success (base / soft / deep) | `progress` | `#4cc9d4` / `#173a3f` / `#7fdce4` | `--dcc-success` |
| Info (base / soft / deep) | `info` | `#6bbde8` / `#1a3448` / `#9ad2f0` | `--dcc-info` |
| Warning (base / soft / deep) | `warning` | `#e4b565` / `#3a2e18` / `#f0cf8f` | `--dcc-warning` |
| Navigation bar | tokens scoped to `[data-global-navigation]` | `#40506a` with `#fcfdfe` content, 10% white hover | `.dcc-doc-bar`, `.dcc-nav-app` |

The hover of a filled button is the accent with 8% of its label mixed in, the kit's state layer. Course-position dots use the kit's state colors and Blue/Light.

Component references in the kit, where the U-Roadmaps name differs:

- **Toast and inline Alert** follow the kit's _Alerta_ (soft state fill, regular text, state-colored icon), not its _Snackbar_. A toast without a state uses the info fill.
- **Node panel (`Sidebar`)** is a regular surface, not the kit's brand sidebar.
- **Badge** follows _Badge y tag_; the Node change mark and the notification count follow _Indicador_.
- **Segmented Tabs** follow _Botón alternable_; line Tabs follow _Tabs_, including the fixed brand red `#d23118` for the active tab.
- **Tutorial popover and speed-dial labels** follow _Popover_ (raised surface with border), not _Tooltip_ (inverted).
- **Buttons**: filled buttons are light with a dark label; outline buttons take the accent as border and label; destructive buttons are filled.
- **Checkbox, radio, and switch** fill with the control-border color and a white mark when checked.

The landing hero is a brand surface that stays dark in both themes (`brand-surface` tokens: Ink in light, Grey/Default `#40506a` in dark). The U-Cursos excerpt inside it stays light because it depicts an external site.

Switching themes plays a diagonal wipe: a band in the entered theme's `primary` and a thin line in its `progress`, so the sweep only shows colors of the theme being entered. The toggle icon is 20px, like the notification bell: a moon in the light theme and a sun in the dark theme.

Node-type colors are stored once and painted through `nodeTypePaint`: each of the twelve palette colors has a lighter dark-theme variant (`--node-type-*`), and any other stored color is lightened by mixing. Course-position colors that are too dark for dark surfaces also have dark variants.

## Typography

Use **Plus Jakarta Sans** as the primary interface family for body text, controls, navigation, labels, captions, and metadata. Use **Poppins** (weights 500–700) for display titles, page headers, course names, major percentages, and the future wordmark only if the approved logo direction supports it.

Poppins gives headings the clear geometric shapes of campus signage. It is wider than a condensed face, so long Spanish course names must be allowed to wrap. Plus Jakarta Sans provides a more open texture for instructions and operational content. Arial and Arial Narrow are last-resort system fallbacks; production font loading should use self-hosted assets or `next/font`.

Use sentence case for headings, actions, menu items, and descriptive labels. Reserve uppercase for course codes, very short wayfinding labels, and institutional provenance. Do not apply global uppercase transformation to buttons.

Use negative letter spacing only on large Poppins headings. Body copy and controls retain normal tracking. Avoid explanatory text below 12px and preserve user-configured browser font scaling.

## Editorial Voice

Write in clear, direct Spanish from the participant's side of the screen. Prefer active verbs such as “Explora”, “Continúa”, “Guarda cambios”, and “Ver mis cursos”. Use second person when it improves orientation. Explain what is available, what is required, and what can happen next.

Empty and error states provide direction rather than mood. Avoid administrative jargon, artificial enthusiasm, infantilizing language, and claims that students can always proceed “a su propio ritmo”; dependencies and the academic term may constrain progress.

Keep an action's name stable through the whole interaction. A button labeled “Guardar cambios” produces confirmation that the changes were saved, not a generic “Operación exitosa”.

## Layout

Use an 8px grid with 4px subdivisions. Center desktop content at a maximum width between 1320px and 1440px according to the page's information density. Use 24px desktop gutters and `{spacing.section}` between major regions.

Page hierarchy follows wayfinding structure:

1. A short context label identifies the course, term, or current area.
2. A Poppins heading states the destination or task.
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

Use flat surfaces and 1px hairlines by default. Apply restrained shadows such as `0 4px 10px rgb(18 33 58 / 7%)` to draggable nodes and `0 18px 50px rgb(18 33 58 / 8%)` only to major demonstration or floating surfaces. The reusable roadmap-node elevation and its hover/focus treatments are exposed as `--shadow-roadmap-node`, `--shadow-roadmap-node-hover`, and `--shadow-roadmap-node-focus`; use them only for React Flow roadmap nodes. The hover shadow takes the node's own color (its node-type color, or `{colors.blocked}` when blocked) from `--roadmap-node-color`. Hierarchy should come from structure and contrast before elevation.

## Iconography

Use **Lucide** as the only general-purpose interface icon system. Its rounded line caps and joins support the wayfinding language while integrating directly with the shadcn component foundation without an additional icon-font dependency. Use the outlined icons at their default stroke weight unless a specific control needs stronger visual emphasis.

Use a 24px icon for standard controls and a visible label whenever the action is not universally understood. Icon-only controls require an accessible name and a minimum 44px touch target. Because Lucide does not provide a universal filled variant, reinforce active, selected, and completed states with text, shape, container treatment, or another non-color cue.

Do not mix Lucide with Material Symbols, Material Icons, or unrelated pictogram sets in the production interface. Two exceptions apply: a future custom brand symbol, and outbound links to a third-party platform, which may use that platform's official mark unmodified, monochrome in `currentColor`, with an accessible name (the GitHub mark in the global footer).

## Components

- **Primary button**: blue surface, white sentence-case label, minimum 44px height, and a direct verb. Add a Lucide icon only when it clarifies direction or outcome.
- **Secondary button**: white or cloud surface with blue or ink border. It must not compete with the primary action.
- **Landing tutorial entry**: “Probar tutorial” is secondary to institutional sign-in. Explain that practice requires no session and saves no changes, then offer the existing Docente and Estudiante tutorial choices. Leaving practice returns to the landing page.
- **Progress badge**: use the shared `progress` Badge variant for concise completion or current-position labels. It pairs `{colors.progress-soft}` with `{colors.progress-deep}` and must retain a textual state.
- **Course header**: compact context label, Poppins course name, supporting term/code information, and visible progress when applicable. On the roadmap canvas, teaching staff also get a footer row under a Fog hairline with links to the course's other pages ("Versiones", "Integrantes") as Blue ghost links inside a `nav`, never a disclosure menu: they leave the canvas, so they stay visible and separate from the canvas tools in the bottom toolbar.
- **Progress track**: neutral base with Jade completion fill, a numeric value, and a textual completed/total description.
- **Roadmap node**: white 8px-radius card with pedagogical title, node type, status label, and direct resource affordance. The current node uses a Jade border or marker; completed nodes use a filled completion symbol plus text. Blocked nodes use `{colors.blocked}` for border, type icon, and a 20% fill.
- **Dependency**: blue directional structure. It remains distinguishable from Jade progress and from custom node-type colors.
- **Resource card**: compact title, resource type, and Lucide icon with an explicit external or download affordance.
- **Teacher panel**: denser authoring surface that uses Ink and Blue for structure. Jade appears only when teacher actions affect or report participant progress.
- **Route specimen**: a faithful static reproduction of the student canvas (`RouteSpecimen`): production node geometry, predefined types, status and resource badges, ink dependencies and the fog grid. Use it wherever a page must show the product instead of describing it, label its course visibly as an example, and never invent states the product lacks.
- **Cited surface**: when a page compares U-Roadmaps with the platform it replaces, show that platform as quoted sheets in its own system sans, greys, section bands and link color, one sheet per section it really splits content into. Name it only in the panel heading (for example “Hoy, en U-Cursos”), never with its logo, icons, avatars or real people. It sits on Ink as a foreign object; U-Roadmaps type and color stay out of it, except for the Blue cue that links a quoted row to its node.
- **Institutional provenance**: “Universidad de Chile” appears in the global footer, separate from the U-Roadmaps wordmark.
- **Global footer**: one compact footer on every page except full-viewport canvases (roadmap, version viewer, practice roadmap) and framed embeds. Canvas surface and Fog top hairline, matching the global navigation; Graphite caption text that turns Ink on hover, aligned to the global navigation's width. The identity column carries the product name with its promise, then “Creado por Daniel Ramírez López · Universidad de Chile”, with no copyright notice (the author holds it; the license lives in the repository); the action row carries third-party licenses, “Reportar un problema” (a dialog with name, email, subject and description that emails the address in `PROBLEM_REPORT_EMAIL`), the version, and the GitHub mark with its star count. Links keep 44px targets; the star count shows only when GitHub answers, and the mark alone stands in otherwise.

## Logo and Favicon Status

Future logo work must retain the approved brand attributes—orientation, advancement, student-first clarity, Blue/Jade compatibility, and recognition from favicon to primary lockup—but may replace the U-route metaphor entirely. The logo requires a separate visual iteration and explicit approval before this section defines production geometry, clear space, lockups, or monochrome variants.

## Responsive Behavior

All interactive controls require a 44px minimum touch target. On screens below 768px, stack comparison and information regions, collapse secondary editing panels into accessible drawers or sections, and preserve the roadmap as a readable consultation surface.

At 768–1023px, favor a single working column with expandable controls. At 1024px and above, the graph may share the viewport with a persistent teacher or resource panel. Long Poppins headings must wrap naturally without clipping; do not solve narrow layouts by shrinking them below useful reading size.

Route traces may simplify or disappear on mobile when they stop communicating useful structure. Core progress information must remain available as text and icons.

## Accessibility and Motion

Meet WCAG AA contrast for text and interactive states. Preserve visible keyboard focus, semantic heading order, accessible names, and browser zoom. Never rely on color, opacity, or motion alone to communicate state.

Motion may reinforce feedback, spatial continuity, entry hierarchy, state transitions, and occasional moments of delight. Choreographed motion outside shadcn primitives uses Motion (`motion/react`); motion is never reduced for `prefers-reduced-motion`. Keep it purposeful and restrained: do not animate every element by default, add continuous ambient loops, or delay frequent tasks for presentation.

## Reference Implementation

Each visual specimen records two independent facts: its design maturity (`baseline`, `experimental`, or `approved for implementation`) and its production adoption (`not implemented`, `partial`, or `implemented`). Only explicit owner approval can mark a complete specimen and all its required states as approved. These specimen metadata are the canonical status record.

The laboratory uses deterministic static fixtures and local simulated interactions. It must not depend on authentication, backend requests, navigation side effects, or persistent mutations. Relevant desktop and mobile presentations appear in labeled frames, and all specimens remain rendered for panoramic manual review.

Production baselines should render the real production component when practical; tightly coupled UI may use a faithful visual specimen instead. Experimental and approved designs remain laboratory-owned references that production implementations copy and deepen with the functional variables and behavior the product requires. Keep the current approved design and at most one replacement candidate visible; Git retains older iterations.

The laboratory is reviewed manually and has no dedicated unit, integration, end-to-end, or visual-regression tests. It is never a production screen, must not be exposed outside development, and will be removed before the final production delivery. The experimental route symbol remains excluded from approval and must not be promoted to application metadata, navigation, or distributed assets.

## Do and Don't

Do use Blue for platform structure and action, Jade for personal progress and orientation, Poppins for meaningful headings, and Plus Jakarta Sans for readable interaction.

Do make the roadmap the visual protagonist, preserve 4/8/16px radii, use sentence case, and show the participant where they are and what can happen next.

Do not restore the chevron motif, turn Jade into a generic decoration, use node-type colors as brand colors, mix icon systems, use generic student imagery, or treat the preview's U-route symbol as an approved logo.
