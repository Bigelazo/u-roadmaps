# MUI to shadcn migration

## Objective

Replace Material UI and Emotion with locally owned shadcn components, Base UI primitives, semantic HTML, and Tailwind CSS without interrupting working product flows. `DESIGN.md` is the visual authority for the global foundation and every migrated surface. Existing MUI surfaces are not restyled as an intermediate step.

The migration is complete only when production and development code have no MUI, Emotion, Motion, or Material Symbols consumers; the MUI providers and theme are gone; and the full verification gate passes.

## Invariants

- Freeze MUI after the visual foundation lands. Existing MUI code may receive essential fixes, but new UI must not add MUI imports. This is enforced in review rather than by an automated allowlist.
- Migrate complete vertical flows or surfaces. Do not replace one MUI primitive across unrelated screens.
- Preserve behavior, accessible names, keyboard interaction, semantic heading order, and product flows unless a separate decision explicitly changes them.
- Treat generated shadcn files as editable local code. Review their tokens, radii, touch targets, icon usage, and responsive behavior before adoption.
- Use Base UI consistently for behavior-rich primitives. Do not mix Base UI and Radix without a demonstrated gap and a new decision.
- Use semantic HTML and Tailwind for layout, typography, and simple surfaces. Use product components for courses, progress, roadmap nodes, dependencies, and resources.
- Use Lucide as the only general-purpose icon family. Do not communicate state through icon or color alone.
- Use `tw-animate-css` for keyframe and enter/exit animation. Use Tailwind transition utilities for ordinary hover and focus transitions. Do not add Motion or custom `@keyframes`.
- Retain React Flow. It is independent of MUI and remains the roadmap graph engine.

## Global token contract

The initial foundation must encode every stable token from `DESIGN.md` in `src/app/globals.css` and expose it through Tailwind's CSS-first theme:

- Preserve the exact Blue, Jade, neutral, and error values from `DESIGN.md`.
- Map shadcn's semantic tokens to the design system. `primary` maps to Blue; background, foreground, card, popover, secondary, muted, border, input, and ring map to the appropriate Canvas, Cloud, Fog, Ink, Graphite, and Blue values.
- Keep Jade in an explicit `progress` token family. Do not map it to generic `accent` because Jade is reserved for participant progress and orientation.
- Retain the generated `chart-*` and `sidebar-*` tokens for compatibility, but treat them as reserved infrastructure. Their presence does not approve a product use absent a corresponding rule in `DESIGN.md`.
- Remove the unapproved `.dark` palette and dark custom variant. Dark mode may return only after a complete palette and behavior are designed and documented.
- Load Plus Jakarta Sans and variable-width Archivo through `next/font/google` in the root layout. Plus Jakarta Sans is the interface family; Archivo at `wdth` 87.5 is the heading family. Remove Geist from the global font path.
- Expose the complete typography, spacing, shadow, focus, and radius tokens. Keep radii strictly within 4px, 8px, 16px, and pill; aliases required by shadcn must resolve to one of those values rather than introducing intermediate radii.
- Keep product compositions out of global selectors. Buttons, course headers, progress tracks, nodes, and teacher panels belong in components.
- Tokenize the remaining React Flow overrides. Replace the custom roadmap glow keyframe with a Tailwind transition; later keyframe animation uses `tw-animate-css`.

## Migration phases

### Phase 0: Align the contracts

- Update `DESIGN.md` to establish Lucide as the sole icon family and define how it communicates active and completed states.
- Supersede ADR-0002 with ADR-0003, recording the owned shadcn architecture, Lucide rationale, and vertical migration strategy.
- Keep `CONTEXT.md` unchanged. UI libraries and migration phases are implementation concerns, not learning-roadmap domain language.

### Phase 1: Establish the atomic visual foundation

- Rebuild `globals.css` around the global token contract above.
- Load Archivo and Plus Jakarta Sans in the root layout and remove Geist.
- Remove Material Symbols loading and replace its remaining usages with Lucide.
- Adapt the local shadcn Button to `DESIGN.md`, including semantic variants, a 44px minimum touch target, 4px control radius, sentence case, focus visibility, disabled behavior, and loading behavior.
- Remove the unused Motion dependency. Use Tailwind transition utilities in the foundation; later slices may add keyframe and enter/exit animation with `tw-animate-css`.
- Remove `motion` and the unused direct `@mui/material-pigment-css` dependency after confirming zero consumers and a clean install/build.
- Do not modify `ThemeRegistry` to imitate the new visual system. Legacy MUI remains unchanged until each surface is migrated.

Gate: inspect the foundation and Button on desktop; verify exact token values, both fonts, Lucide-only iconography, 44px targets, and keyboard focus; run lint, typecheck, relevant unit checks, and a production build because the root layout and dependencies changed.

### Phase 2: Migrate the shared shell

- Migrate `GlobalNavigation` and `SessionButton` as the public shell.
- Add shadcn/Base UI Button, Dropdown Menu, and Tooltip primitives only as needed.
- Preserve session actions, development-only visibility, keyboard navigation, menu dismissal, and responsive spacing.

Gate: no MUI import remains in the public shell slice; manually review authenticated, unauthenticated, desktop, and keyboard states; capture approved Firefox 1440px visual references for anonymous, authentication-error, and authenticated states; run targeted unit/E2E flows plus lint and typecheck.

### Phase 3: Migrate entry and authentication

- Migrate the landing page as a complete surface and remove `/auth/signin`.
- Route sign-in controls and protected-route redirects to `/api/plogin/start`; send VTI failures to `/?error=Authentication`.
- Show authentication failures in a persistent, dismissible global alert below the navigation; dismissal removes the error query parameter without reloading.
- Preserve content hierarchy and existing accessible labels.
- Use the roadmap rather than generic imagery as the primary visual subject.

Gate: no MUI import remains in this slice; review normal and error states on desktop; capture approved Firefox 1440px visual references for anonymous, authentication-error, and authenticated states; run landing and authentication E2E coverage.

### Phase 4: Migrate academic overview and institutional information

- Migrate the academic overview, course cards, VTI information, development persona surface, and `DevelopmentBar`.
- Add Card, Alert, or other local primitives only when the slice needs them.
- Preserve current-versus-historical emphasis, no-roadmap messaging, links, and information semantics.

Gate: no MUI import remains in this slice; review populated, empty, loading, and error states where applicable; run affected tests.

### Phase 5: Migrate roadmap consultation

- Migrate the course page shell, `RoadmapCanvas`, and the node rendering portion of `RoadmapGraph` without replacing React Flow.
- Preserve node identity, handles, dependencies, selection, drag/connect callbacks, loading/error states, and graph readability.
- Keep Blue for dependencies and platform structure, Jade for progress/orientation, and user-defined node-type colors as pedagogical data.

Gate: no MUI import remains in the consultation slice; review representative desktop graphs; run roadmap consultation E2E flows and a build if graph CSS boundaries changed.

### Phase 6: Migrate student node detail

- Replace MUI's responsive aside/dialog implementation with a Base UI-backed shadcn primitive appropriate to each breakpoint.
- Preserve `role=dialog` where modal, accessible naming, Escape behavior, close affordance, focus management, resources, prerequisites, and completion actions.
- Do not adopt the experimental position-oriented panel until its full state set is explicitly approved.

Gate: no MUI import or `useTheme`/`useMediaQuery` remains in the slice; the existing dialog semantics test passes or is deepened without weakening its assertions; review mobile and desktop behavior manually.

### Phase 7: Migrate teacher editing

- Migrate `RoadmapEditor` as a complete authoring workflow using Base UI-backed Input, Select, Checkbox, Dialog/Alert Dialog, and related primitives.
- Preserve validation, labels, destructive confirmation, node-type editing, responsive panel behavior, and all graph mutations.
- Keep the dense teacher surface visually distinct without using Jade as a generic authoring accent.

Gate: no MUI import remains in the editor slice; review create, edit, delete, validation, cancellation, keyboard, mobile, and desktop states; run editor unit, integration, and E2E coverage.

### Phase 8: Close the migration

- Search all source, tests, and development tooling for MUI, Emotion, Motion, and Material Symbols consumers.
- Perform the final panoramic review.
- Remove `ThemeRegistry`, `CssBaseline`, and `AppRouterCacheProvider` from the root layout.
- Remove `@mui/material`, `@mui/material-nextjs`, `@emotion/cache`, `@emotion/react`, and `@emotion/styled`; regenerate the lockfile and verify that transitive MUI/Emotion packages are gone when no retained dependency requires them.
- Keep shadcn as development tooling, Base UI and its support packages as runtime dependencies with real consumers, Lucide as the icon library, `tw-animate-css` as the animation utility, and React Flow as the graph engine.
- Remove any newly orphaned package instead of retaining it speculatively.

Final gate: run `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, and `pnpm run format:check`; confirm zero forbidden imports, no MUI/Emotion providers, a clean dependency graph, and manual desktop/mobile review of every production flow.

## Slice completion gate

A vertical slice is complete only when all of the following are true:

- The slice contains no MUI or Emotion import and does not depend indirectly on a MUI wrapper.
- Its behavior, accessible names, keyboard operation, semantic structure, and responsive states are preserved or deliberately revised in an approved design decision.
- All generated primitives used by the slice comply with the token, radius, icon, and touch-target rules.
- Relevant unit, integration, and E2E checks pass, with lint and typecheck run for every cut.
- Desktop states are reviewed manually, including loading, error, empty, disabled, and focus states that apply. Mobile adaptation is a later initiative.
- The specimen adoption metadata is updated, and no experimental candidate is represented as production-approved without explicit owner approval.

## Dependency removal gates

| Dependency | Earliest removal | Required evidence |
| --- | --- | --- |
| `motion` and its transitive Motion packages | Phase 1 | Zero `motion` imports; foundation interactions work with Tailwind transitions |
| `@mui/material-pigment-css` | Phase 1 | No source/config consumer; clean install and build without it |
| `@mui/material` | Phase 8 | Zero MUI component/theme imports in source and tests |
| `@mui/material-nextjs` | Phase 8 | `AppRouterCacheProvider` removed from the root layout; build passes |
| `@emotion/cache`, `@emotion/react`, `@emotion/styled` | Phase 8 | No direct consumer and no retained package requires them |
| Material Symbols web font | Phase 1 | `DESIGN.md` uses Lucide exclusively |

Dependency removal is incremental: a package leaves in the first phase where its last consumer and integration requirement are demonstrably gone. Package presence alone is not a compatibility strategy.
