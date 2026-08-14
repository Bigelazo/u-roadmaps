---
version: alpha
name: interactive-roadmap-fcfm-design
description: Institutional design language for the FCFM Academic Roadmap System. A university white-paper environment uses blue (#024ad8) for decisive actions, dark ink (#1a1a1a) for text and indicators, Plus Jakarta Sans for legible UI, and angular decorations that guide progress. Nodes and panels use 8-16px radii, diagrams sit in clean frames, and dense dark sections distinguish teacher authoring and end-of-semester summaries.

colors:
  primary: "#024ad8"
  primary-bright: "#296ef9"
  primary-deep: "#0e3191"
  primary-soft: "#c9e0fc"
  on-primary: "#ffffff"
  ink: "#1a1a1a"
  canvas: "#ffffff"
  cloud: "#f7f7f7"
  fog: "#e8e8e8"
  steel: "#c2c2c2"
  graphite: "#636363"
  error: "#b3262b"

typography:
  display-lg: { fontFamily: Plus Jakarta Sans, fontSize: 44px, fontWeight: 500, lineHeight: 1.0 }
  display-md: { fontFamily: Plus Jakarta Sans, fontSize: 32px, fontWeight: 500, lineHeight: 1.0 }
  display-sm: { fontFamily: Plus Jakarta Sans, fontSize: 24px, fontWeight: 500, lineHeight: 1.17 }
  body-md: { fontFamily: Plus Jakarta Sans, fontSize: 16px, fontWeight: 400, lineHeight: 1.38 }
  caption-md: { fontFamily: Plus Jakarta Sans, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  button-md: { fontFamily: Plus Jakarta Sans, fontSize: 14px, fontWeight: 600, lineHeight: 1.4, letterSpacing: 0.7px, textTransform: uppercase }

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

## Overview

The application is a clear, rigorous educational platform for navigating the relationships among university course topics. A white canvas hosts the graph and its controls. Light gray bands organize supporting information, while FCFM electric blue is reserved for meaningful actions, active dependencies, progress, and primary calls to action. Interface text uses dark ink and Plus Jakarta Sans.

The defining visual gesture is the angular blue chevron. It frames course-roadmap headers and prominent course cards without adding visual noise. Content nodes, resources, and menus use softened 8-16px corners; operational buttons use a strict 4px radius.

## Colors

- **Electric Blue FCFM** (`{colors.primary}`): primary action, active path, progress, and important academic links.
- **Bright Blue** (`{colors.primary-bright}`): high-visibility interactive elements on dark teacher-authoring surfaces.
- **Deep Blue** (`{colors.primary-deep}`): pressed state for map nodes and confirmation controls.
- **Soft Blue** (`{colors.primary-soft}`): selected nodes and active chips.
- **Canvas** (`{colors.canvas}`) and **Cloud** (`{colors.cloud}`): the base surface and secondary information layers.
- **Fog** (`{colors.fog}`) and **Steel** (`{colors.steel}`): dividers, inactive borders, and low-emphasis structure.
- **Ink** (`{colors.ink}`) and **Graphite** (`{colors.graphite}`): primary and supporting text.
- **Error** (`{colors.error}`): destructive actions and validation errors.

## Typography

Use Plus Jakarta Sans throughout the interface, with Arial as a system fallback. Use weight 500 for titles, 400 for explanatory text, and 600 or 700 for operational labels. Reserve display sizes for official course and unit names; use body text for instructional content and captions for resource metadata.

## Layout

Use an 8px grid with 4px subdivisions. The desktop container is centered at up to 1366px. The roadmap canvas is the dominant element; teacher controls and resource details occupy secondary panels. Use 24px gutters and 80px vertical section separation for large page regions.

The graph needs generous empty space so relationships remain readable. Supporting lists may be denser but must preserve useful scanability without unnecessary scrolling.

## Elevation And Shapes

Use flat surfaces for the canvas, 1px hairlines for inputs and compact containers, and a restrained `0 2px 8px rgba(26, 26, 26, 0.08)` shadow for draggable nodes and cards. Avoid heavy diffuse shadows. The visual hierarchy should come from color contrast before elevation.

Buttons and text inputs use `{rounded.md}`. Nodes, expandable rows, and compact containers use `{rounded.lg}`. Cards and side panels use `{rounded.xl}`. Global visibility filters may use `{rounded.pill}`.

## Components

- **Primary button**: blue surface, white uppercase label, 44px height, and 12px by 24px padding. Use for actions such as publishing a roadmap or saving changes.
- **Ink button**: dark surface for teacher-authoring actions and administrative controls.
- **Outline button**: white surface with blue or ink border for secondary actions.
- **Roadmap node**: white, softly elevated card with a topic title, concise status, and direct resource access.
- **Teacher panel**: visually separated authoring surface for creating nodes, node types, dependencies, and resources.
- **Resource card**: compact metadata presentation with clear external-link affordances.
- **Chevron decoration**: blue, square-edged directional geometry for course-level headings only, never inside individual nodes.

## Responsive Behavior

All interactive controls require a 44px minimum touch target. On screens below 768px, collapse secondary panels into accessible drawers or stacked sections and preserve the graph as a readable consultation view. At 768-1023px, use a single-column page with expandable controls. At 1024px and above, show the full graph with its persistent teacher or resource panel.

Reduce or remove chevron decorations on mobile to preserve reading space. Maintain rounded graph bounds at every breakpoint and preserve diagram proportions while adapting viewport coordinates.

## Do And Don't

Do reserve electric blue for meaningful progress and action, preserve 16px radii for information containers and 4px radii for controls, and keep graph labels readable at all viewport sizes.

Do not introduce unrelated course-color schemes, use heavy shadows, over-round operational buttons, reduce explanatory text below 12px, or use opacity as the main hierarchy mechanism. Use the defined color tokens instead.
