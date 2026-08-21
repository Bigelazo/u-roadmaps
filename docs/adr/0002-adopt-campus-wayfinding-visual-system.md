---
status: superseded by ADR-0003
---

# Adopt a campus-wayfinding visual system

U-Roadmaps will use a student-first campus-wayfinding identity rather than presenting itself as another FCFM administrative interface. The system keeps FCFM Blue (`#024AD8`) and its existing variants for platform structure, navigation, dependencies, and actions; adds Jade (`#35A779`) for personal progress and orientation; pairs Plus Jakarta Sans interface text with Archivo at a semi-condensed width for headings; and uses Material Symbols Rounded as its sole general-purpose icon family. This direction was selected because it preserves university credibility while making routes, current position, and advancement the application's distinctive visual language.

## Considered options

The visual comparison tested Hoja (`#78C66A`) and Jade with Chivo, Archivo SemiCondensed, and IBM Plex Sans Condensed. Jade + Archivo SemiCondensed was selected: Jade feels mature enough for a university product while remaining visibly distinct from Blue, and Archivo gives long Spanish course titles the compact rhythm of campus signage without displacing Plus Jakarta Sans as the readable primary family.

The product name is canonically **U-Roadmaps**. Its primary promise is **“Cada curso, una ruta clara.”** and its supporting description is **“Explora contenidos, requisitos y recursos en una ruta que muestra tu avance.”** The voice is a clear, encouraging guide: student-first, direct, precise, and neither administrative nor childish. Universidad de Chile establishes provenance on sign-in surfaces and in the global footer but is not part of the logo or wordmark.

The previous angular chevron motif is retired in favor of route traces and nodes that encode real connection, sequence, position, or movement. The roadmap itself, rather than stock photography or generic student illustration, is the primary visual subject. The established 4/8/16px radius hierarchy remains, and headings and actions use sentence case rather than global uppercase treatment.

## Consequences

Blue and Jade have stable, separate semantics: Blue represents platform structure and action; Jade represents participant progress and orientation. Jade is expected to carry roughly 20–30% of perceived chromatic emphasis against Blue's approximately 50%, with neutrals forming the remaining field. Jade cannot be used as an unrestricted accent or for custom node types, and state must never be communicated by color alone.

Production UI will replace Lucide and other mixed icon systems with Material Symbols Rounded, outlined by default and filled to reinforce active or completed states.

The logo and favicon remain unresolved. The U-shaped route symbol explored during the visual work was rejected as the production logo and must not be installed in navigation, metadata, or distributed assets. A later design iteration may replace its metaphor entirely, but must preserve the approved orientation-and-advancement personality, Blue/Jade compatibility, and legibility requirements from favicon through primary lockup.
