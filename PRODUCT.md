# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Teaching staff (primary).** Course professors, coordinating professors, auxiliary professors and teaching assistants of Universidad de Chile course offerings. They build and maintain a course's roadmap (nodes, dependencies, types, resources, locks, scheduled unlocks, versions) and follow how their students advance through it. When their needs conflict with students', teaching staff win: adoption depends on staff authoring and keeping roadmaps current. They mostly work on desktop.
- **Students.** Enrolled students who consult their course's route, open available nodes and resources, and record their own completion while respecting prerequisites and staff locks. They often check routes on their phones, between classes.
- **Observers.** Participants with read access whose completion rate is tracked alongside students'. Secondary audience.

One person can hold different Participation roles in different course offerings. The domain vocabulary is defined in `GLOSSARY.md`.

## Product Purpose

U-Roadmaps lets the teaching staff of a university course offering organise its contents, evaluations and resources as one visual learning route, and lets each participant move through that route while seeing their progress. Every course offering (course code + year + semester) has at most one shared roadmap.

Success means teaching staff choose U-Roadmaps as the place where a course lives, keep its roadmap current through the semester, and use student progress tracking to see where students are; students consult it as their route through the course.

## Positioning

U-Roadmaps aims to replace course pages as the main place where a course's content and resources live, not to sit beside them. What it offers that a course page or a list of files cannot is a prerequisite-aware route: dependencies between nodes, staff locks and scheduled unlocks govern what each student can open, completion is persistent per student, and staff see completion across the whole U-Campus roster. It is built on Universidad de Chile institutional identity (U-Pasaporte) and academic data (U-Campus), so courses, roles and rosters come from the institution instead of being re-entered.

## Operating Context

- Sign-in through U-Pasaporte (VTI); courses, sections, institutional course positions and rosters come from U-Campus via the MUFASA bridge, with local Participations as fallback.
- The academic overview groups a person's current and past course offerings by semester; each offering opens its roadmap or explains that none exists yet.
- Teaching staff author on an interactive canvas (React Flow + Dagre layout) with a resizable side panel, confirmations that state the impact of hiding, deleting, connecting or locking, and a student-rules preview with simulated progress.
- The semester calendar matters: roadmaps close after the official final-exam date (Chile time), become read-only history, and can be versioned into later offerings.
- Roadmap notices tell participants what changed since their last visit (Inbox, Change summary on entry).
- Practice roadmaps and tutorials teach the editor and the student experience on an in-memory roadmap.
- Interface language is Spanish; repository documentation for agents and the issue tracker is English.

## Capabilities and Constraints

- Capabilities and current limitations are listed in `README.md` ("Funcionalidades actuales", "Estado y limitaciones"); domain rules, including ones not yet implemented, live in `GLOSSARY.md`; decisions in `docs/adr/`.
- Node states: pending, completed, blocked; hidden nodes are absent for students. Completion cannot be reverted by the student.
- Node-type colors (20-color palette, 80-icon catalog) are user-defined pedagogical data, distinct from platform progress colors.
- File resources up to 25 MB, stored on local disk (`uploads/`); links and videos as external URLs.
- Single persistent Node process (SSE notices, scheduled unlocks, roadmap closure); PostgreSQL; Next.js 16 App Router, Tailwind 4, shadcn/ui on Base UI.
- `prefers-reduced-motion` is deliberately ignored (ADR-0022); animations stay on.
- Undecided / incomplete: coordinated sections, full roster reconciliation, teaching-assistant edit permissions, roadmap copy across versions, complete closure enforcement on every server mutation.

## Brand Commitments

- Canonical name **U-Roadmaps** (capital U, hyphen). Never "U-roadmaps", "U Roadmaps" or "Roadmaps universitarios".
- Promise: **"Cada curso, una ruta clara."** Supporting line: **"Explora contenidos, requisitos y recursos en una ruta que muestra tu avance."**
- U-Roadmaps has its own identity. Universidad de Chile appears only as provenance in the global footer; its name, the DCC name and institutional marks are not part of the U-Roadmaps logo.
- Voice: clear, direct Spanish, from the participant's side of the screen, with active verbs ("Explora", "Continúa", "Guarda cambios") and second person when it helps orientation. Encouraging and precise, never childish; a capable guide, not another administrative portal.
- The incumbent visual system is recorded in `DESIGN.md`. Note: its brand foundation says "student-first", while this product record makes teaching staff the primary user. Reconcile that wording the next time DESIGN.md is revised.

## Evidence on Hand

- Development fixtures (`src/development/`, `pnpm dev:data:reset`): fictional profiles and demo roadmaps for programming, calculus and FI1001 physics versions, with progress and lock scenarios. They are fictional and must not be presented as real courses, users or usage data.
- No real usage metrics, testimonials, adoption figures or institutional endorsements exist in the repository. Do not invent them.

## Product Principles

1. **Staff authoring decides adoption.** Prefer changes that make building and maintaining a roadmap faster and safer for teaching staff; the student experience depends on roadmaps that exist and stay current.
2. **The route is the course.** The roadmap is where course content lives, not a summary of content kept elsewhere; nodes, resources and dependencies must be complete enough to replace a course page.
3. **Access rules are always explained.** Locks, prerequisites, hidden nodes, closure and notices must say what is available, what is required and what happens next, for both the student and the staff member who caused it.
4. **Institutional truth, not re-entry.** Identities, roles, courses and rosters come from U-Pasaporte and U-Campus; when those sources fail, degrade explicitly rather than ask people to retype them.
5. **Phone for consulting, desk for authoring.** Students' consultation flows must work on a phone; dense authoring and tracking may assume a desktop.

## Accessibility & Inclusion

WCAG AA contrast for text and interactive states, visible keyboard focus, semantic headings, accessible names, browser zoom, 44px touch targets, and never color, opacity or motion alone to convey state (see `DESIGN.md`). Motion is not reduced for `prefers-reduced-motion` (ADR-0022).
