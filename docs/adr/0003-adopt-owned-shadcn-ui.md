---
status: accepted
---

# Adopt an owned shadcn UI

This decision supersedes ADR-0002. U-Roadmaps retains the student-first campus-wayfinding visual system defined in `DESIGN.md`, but implements it with locally owned shadcn components built consistently on Base UI, semantic HTML, and Tailwind CSS. Lucide replaces Material Symbols Rounded as the sole general-purpose icon family because it integrates with the selected shadcn configuration and avoids an additional icon-font dependency. Active and completed states must therefore use text, shape, container treatment, or another non-color cue rather than relying on a filled icon variant.

The MUI-to-shadcn transition will proceed through complete vertical product slices rather than repository-wide primitive substitutions. `DESIGN.md` governs the global foundation and every migrated slice, while existing MUI surfaces remain visually unchanged until their slice is migrated. New MUI usage is frozen; generated shadcn code is an editable local starting point, not an upstream contract. Behavior-rich primitives use Base UI, layout and typography use semantic HTML with Tailwind, and roadmap-specific concepts remain product components.

The development-only `/design-preview` laboratory remains a temporary migration reference. Experimental specimens require explicit approval before production adoption, migrated slices are reviewed there on desktop and mobile, and the route is removed when the migration closes. Motion is removed during the initial foundation work: keyframe and enter/exit animation use `tw-animate-css`, ordinary hover and focus transitions use Tailwind utilities, and reduced-motion behavior remains mandatory.
