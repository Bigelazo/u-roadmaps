# Graph Report - memoria  (2026-08-27)

## Corpus Check
- 264 files · ~135,667 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1167 nodes · 1888 edges · 177 communities (71 shown, 106 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0e834a42`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- roadmap-editor.ts
- RoadmapGraph.tsx
- Issue tracker: GitHub
- RoadmapCanvas.tsx
- start/route.ts
- academic-overview/page.tsx
- cn
- compilerOptions
- StudentNodeDetail.tsx
- next-devtools
- field.tsx
- plogin/route.ts
- components.json
- scripts
- dependencies
- utils.ts
- U-Roadmaps Domain Model
- Commands
- 5. Re-render Optimization
- devDependencies
- Codebase Design
- Prototype Skill
- package.json
- next-auth.d.ts
- Customization & Theming
- hitl-loop.template.sh
- seed.ts
- logout/route.ts
- Domain Modeling
- Triage
- Promise.all() for Independent Operations
- Dynamic Imports for Heavy Components
- Graphify Pipeline
- Architecture HTML Report Format
- Deduplicate Global Event Listeners
- Cache Repeated Function Calls
- Combine Multiple Array Iterations
- Build Index Maps for Repeated Lookups
- Prevent Hydration Mismatch Without Flickering
- Use useTransition Over Manual Loading States
- Calculate Derived State During Rendering
- Extract to Memoized Components
- shadcn Logo
- Cross-Request LRU Cache
- RSC Prop Deduplication
- Module-Level Static I O
- Parallel Component Fetching
- Skill Design Glossary
- dotenv-cli
- Local Test Environment
- eslint
- @eslint/compat
- eslint.config.mts
- eslint-config-next
- eslint-config-prettier
- @eslint/css
- eslint-plugin-neverthrow
- eslint-plugin-playwright
- eslint-plugin-testing-library
- jose
- jsdom
- next-auth
- next.config.mjs
- next-env.d.ts
- next
- @prisma/adapter-pg
- react
- tailwind-merge
- @playwright/test
- postcss
- prettier
- prettier-plugin-tailwindcss
- prisma
- shadcn
- tailwindcss
- @testing-library/react
- @testing-library/user-event
- tsx
- tw-animate-css
- @types/node
- @types/react
- @types/react-dom
- typescript
- typescript-eslint
- vitest
- @vitest/eslint-plugin
- prettier.config.mjs
- RESOURCES.md Format
- Strategic Suspense Boundaries
- Defer Non-Critical Third-Party Libraries
- Use useDeferredValue for Expensive Derived Renders
- Vercel React Best Practices
- Transient Values in useRef
- Non-Blocking after Operations
- Server Action Authentication
- Wayfinder Map
- GitHub Issue Workflow
- 7. JavaScript Performance
- Prompt para refactorizar un archivo con shadcn
- class-variance-authority
- Tools
- 6. Rendering Performance
- 3. Server-Side Performance
- React Best Practices
- Sections
- RoadmapEditor.tsx
- graphify reference: extra exports and benchmark
- Learning Record Format
- Frontend Design
- 1. Eliminating Waterfalls
- 2. Bundle Size Optimization
- React Best Practices
- graphify reference: query, path, explain
- dotenv
- Icons
- 8. Advanced Patterns
- GLOSSARY.md Format
- MISSION.md Format
- async-cheap-condition-before-await.md
- Prefer Statically Analyzable Paths
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- advanced-effect-event-deps.md
- advanced-event-handler-refs.md
- advanced-init-once.md
- advanced-use-latest.md
- bundle-barrel-imports.md
- client-localstorage-schema.md
- client-swr-dedup.md
- js-batch-dom-css.md
- js-cache-storage.md
- js-early-exit.md
- js-hoist-regexp.md
- js-length-check-first.md
- js-min-max-loop.md
- js-request-idle-callback.md
- js-tosorted-immutable.md
- rendering-activity.md
- rendering-animate-svg-wrapper.md
- rendering-conditional-render.md
- rendering-content-visibility.md
- rendering-hoist-jsx.md
- rendering-resource-hints.md
- rendering-script-defer-async.md
- rendering-svg-precision.md
- rerender-defer-reads.md
- rerender-dependencies.md
- rerender-functional-setstate.md
- rerender-lazy-state-init.md
- rerender-move-effect-to-event.md
- rerender-no-inline-components.md
- rerender-simple-expression-in-memo.md
- rerender-split-combined-hooks.md
- _template.md
- extraction-spec.md
- visual-references/README.md
- globals

## God Nodes (most connected - your core abstractions)
1. `cn()` - 121 edges
2. `handleApiResult()` - 37 edges
3. `throwApiError()` - 30 edges
4. `requireAuthenticatedUser()` - 28 edges
5. `parseCourseOfferingIdentifier()` - 28 edges
6. `apiResult()` - 26 edges
7. `parseJson()` - 19 edges
8. `scripts` - 18 edges
9. `requireUuid()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Authenticated Academic Overview Reference` --implements--> `U-Roadmaps Domain Model`  [INFERRED]
  docs/visual-references/authenticated-navigation-firefox-1440.png → CONTEXT.md
- `Anonymous Landing Reference` --implements--> `Campus Wayfinding Visual System`  [INFERRED]
  docs/visual-references/anonymous-landing-firefox-1440.png → DESIGN.md
- `Authenticated Academic Overview Reference` --implements--> `Campus Wayfinding Visual System`  [INFERRED]
  docs/visual-references/authenticated-navigation-firefox-1440.png → DESIGN.md
- `authenticateAs()` --indirect_call--> `sessionCookieName()`  [INFERRED]
  tests/e2e/helpers.ts → src/app/api/plogin/route.ts
- `Mufasa Academic Integration` --implements--> `U-Roadmaps Domain Model`  [INFERRED]
  docs/MUFASA_INTEGRATION.md → CONTEXT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **shadcn Component Guidance** — _agents_skills_shadcn_skill, _agents_skills_shadcn_rules_composition, _agents_skills_shadcn_rules_forms, _agents_skills_shadcn_rules_styling [EXTRACTED 1.00]
- **Async Concurrency Patterns** — _agents_skills_vercel_react_best_practices_rules_async_api_routes_prevent_waterfall_chains_in_api_routes, _agents_skills_vercel_react_best_practices_rules_async_dependencies_dependency_based_parallelization, _agents_skills_vercel_react_best_practices_rules_async_parallel_promise_all_for_independent_operations [INFERRED 0.85]
- **Bundle Loading Patterns** — _agents_skills_vercel_react_best_practices_rules_bundle_conditional_conditional_module_loading, _agents_skills_vercel_react_best_practices_rules_bundle_dynamic_imports_dynamic_imports_for_heavy_components, _agents_skills_vercel_react_best_practices_rules_bundle_preload_preload_based_on_user_intent [INFERRED 0.85]
- **Owned UI System** — design_campus_wayfinding_visual_system, docs_shadcn_migration_owned_shadcn_migration, docs_adr_0002_adopt_campus_wayfinding_visual_system_wayfinding_adr, docs_adr_0003_adopt_owned_shadcn_ui_owned_shadcn_adr [INFERRED 0.85]
- **React Render Responsiveness** — _agents_skills_vercel_react_best_practices_rules_rendering_usetransition_loading_use_usetransition_over_manual_loading_states, _agents_skills_vercel_react_best_practices_rules_rerender_transitions_use_transitions_for_non_urgent_updates, _agents_skills_vercel_react_best_practices_rules_rerender_use_deferred_value_use_usedeferredvalue_for_expensive_derived_renders [INFERRED 0.85]
- **U-Roadmaps Product Contract** — context_u_roadmaps_domain_model, docs_mufasa_integration_mufasa_academic_integration, docs_adr_0001_freeze_roadmaps_from_academic_calendar_academic_calendar_freeze [INFERRED 0.85]

## Communities (177 total, 106 thin omitted)

### Community 0 - "roadmap-editor.ts"
Cohesion: 0.05
Nodes (115): GET(), handler, Context, DELETE(), Context, POST(), Context, GET() (+107 more)

### Community 1 - "RoadmapGraph.tsx"
Cohesion: 0.05
Nodes (49): FloatingEdge, nodeRect(), sameRect(), studentNodeStatus, RoadmapDependencyEdgeData, roadmapEdgeTypes, RoadmapFlowEdge, mapRoadmapGraph() (+41 more)

### Community 2 - "Issue tracker: GitHub"
Cohesion: 0.06
Nodes (30): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, Pull requests as a triage surface (+22 more)

### Community 3 - "RoadmapCanvas.tsx"
Cohesion: 0.14
Nodes (22): Props, RoadmapErrorToast(), Props, SessionButton(), Alert(), AlertAction(), AlertDescription(), AlertTitle() (+14 more)

### Community 5 - "academic-overview/page.tsx"
Cohesion: 0.05
Nodes (51): fixtureOfferingIds, ids, main(), nodeId(), predefinedNodeTypes, prisma, resetDevelopmentData(), studentId() (+43 more)

### Community 6 - "cn"
Cohesion: 0.08
Nodes (41): Input(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle() (+33 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, .next-e2e/dev/types/**/*.ts, .next-e2e/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts (+21 more)

### Community 8 - "StudentNodeDetail.tsx"
Cohesion: 0.09
Nodes (32): ContentProps, getMobileLayoutSnapshot(), Props, resourceActionIcon(), resourceIcon(), resourceTypeLabel(), StudentNodeDetail(), StudentNodeDetailContent() (+24 more)

### Community 9 - "next-devtools"
Cohesion: 0.08
Nodes (24): mcp, next-devtools, playwright, shadcn, command, enabled, environment, type (+16 more)

### Community 10 - "field.tsx"
Cohesion: 0.16
Nodes (12): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+4 more)

### Community 11 - "plogin/route.ts"
Cohesion: 0.16
Nodes (16): authenticationErrorResponse(), dynamic, GET(), isHttps(), sessionCookieName(), vtiSecret(), apiErrorResponse(), invalidVtiClaims (+8 more)

### Community 12 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, dev, dev:data:reset, format, format:check, lint, lint:fix (+10 more)

### Community 14 - "dependencies"
Cohesion: 0.13
Nodes (15): @base-ui/react, clsx, lucide-react, neverthrow, dependencies, @base-ui/react, clsx, lucide-react (+7 more)

### Community 15 - "utils.ts"
Cohesion: 0.20
Nodes (11): courseBenefits, sampleRoute, Badge(), badgeVariants, Card(), CardAction(), CardContent(), CardDescription() (+3 more)

### Community 16 - "U-Roadmaps Domain Model"
Cohesion: 0.15
Nodes (13): U-Roadmaps Domain Model, Campus Wayfinding Visual System, Academic Calendar Roadmap Freeze, Campus Wayfinding ADR, Owned shadcn ADR, Deferred Institutional SSO Logout, Domain Documentation Policy, Mufasa Academic Integration (+5 more)

### Community 17 - "Commands"
Cohesion: 0.07
Nodes (26): `add` — Add components, `apply` — Apply a preset to an existing project, `build` — Build a custom registry, Commands, Contents, `diff` — Check for updates, `docs` — Get component documentation URLs, Dry-Run Mode (+18 more)

### Community 18 - "5. Re-render Optimization"
Cohesion: 0.12
Nodes (16): 5.10 Subscribe to Derived State, 5.11 Use Functional setState Updates, 5.12 Use Lazy State Initialization, 5.13 Use Transitions for Non-Urgent Updates, 5.14 Use useDeferredValue for Expensive Derived Renders, 5.15 Use useRef for Transient Values, 5.1 Calculate Derived State During Rendering, 5.2 Defer State Reads to Usage Point (+8 more)

### Community 19 - "devDependencies"
Cohesion: 0.22
Nodes (9): @eslint/js, devDependencies, @eslint/js, @playwright/mcp, @tailwindcss/postcss, @typescript-eslint/parser, @playwright/mcp, @tailwindcss/postcss (+1 more)

### Community 20 - "Codebase Design"
Cohesion: 0.15
Nodes (13): Ask Matt Skill Router, Two-Axis Code Review, Module Deepening Guidance, Codebase Design, Bug Diagnosis Loop, Mocking Guidance, Test-Driven Development, Good and Bad Tests (+5 more)

### Community 21 - "Prototype Skill"
Cohesion: 0.40
Nodes (5): Logic Prototype, Prototype Skill, UI Prototype, Conversation to Specification, Specification to Tickets

### Community 22 - "package.json"
Cohesion: 0.40
Nodes (4): name, packageManager, private, version

### Community 23 - "next-auth.d.ts"
Cohesion: 0.40
Nodes (4): JWT, next-auth, next-auth/jwt, Session

### Community 24 - "Customization & Theming"
Cohesion: 0.05
Nodes (36): Component Composition Rules, Forms and Inputs Rules, Styling and Customization Rules, shadcn UI Skill, 1. Built-in variants, 2. Tailwind classes via `className`, 3. Add a new variant, 4. Wrapper components (+28 more)

### Community 25 - "hitl-loop.template.sh"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 28 - "Domain Modeling"
Cohesion: 0.67
Nodes (3): ADR Format, CONTEXT.md Format, Domain Modeling

### Community 29 - "Triage"
Cohesion: 0.67
Nodes (3): Writing Agent Briefs, Out-of-Scope Knowledge Base, Triage

### Community 30 - "Promise.all() for Independent Operations"
Cohesion: 0.67
Nodes (3): Prevent Waterfall Chains in API Routes, Dependency-Based Parallelization, Promise.all() for Independent Operations

### Community 31 - "Dynamic Imports for Heavy Components"
Cohesion: 0.67
Nodes (3): Conditional Module Loading, Dynamic Imports for Heavy Components, Preload Based on User Intent

### Community 32 - "Graphify Pipeline"
Cohesion: 0.67
Nodes (3): Project Graphify Policy, Incremental Graph Update, Graphify Pipeline

### Community 90 - "RESOURCES.md Format"
Cohesion: 0.40
Nodes (4): Teaching Workspace, RESOURCES.md Format, Rules, Structure

### Community 111 - "7. JavaScript Performance"
Cohesion: 0.13
Nodes (15): 7.10 Hoist RegExp Creation, 7.11 Use flatMap to Map and Filter in One Pass, 7.12 Use Loop for Min/Max Instead of Sort, 7.13 Use Set/Map for O(1) Lookups, 7.14 Use toSorted() Instead of sort() for Immutability, 7.1 Avoid Layout Thrashing, 7.2 Build Index Maps for Repeated Lookups, 7.3 Cache Property Access in Loops (+7 more)

### Community 112 - "Prompt para refactorizar un archivo con shadcn"
Cohesion: 0.14
Nodes (13): Alcance, Autoridad y herramientas obligatorias, Condiciones de exito, Contrato funcional y de datos, Diseño, responsive y accesibilidad, Estilos y propiedad de decisiones, Flujo obligatorio, Informe final (+5 more)

### Community 116 - "Tools"
Cohesion: 0.17
Nodes (11): Configuring Registries, Setup, `shadcn:get_add_command_for_items`, `shadcn:get_audit_checklist`, `shadcn:get_item_examples_from_registries`, `shadcn:get_project_registries`, `shadcn:list_items_in_registries`, shadcn MCP Server (+3 more)

### Community 117 - "6. Rendering Performance"
Cohesion: 0.17
Nodes (12): 6.10 Use React DOM Resource Hints, 6.11 Use useTransition Over Manual Loading States, 6.1 Animate SVG Wrapper Instead of SVG Element, 6.2 CSS content-visibility for Long Lists, 6.3 Hoist Static JSX Elements, 6.4 Optimize SVG Precision, 6.5 Prevent Hydration Mismatch Without Flickering, 6.6 Suppress Expected Hydration Mismatches (+4 more)

### Community 118 - "3. Server-Side Performance"
Cohesion: 0.18
Nodes (10): 3.10 Use after() for Non-Blocking Operations, 3.1 Authenticate Server Actions Like API Routes, 3.2 Avoid Duplicate Serialization in RSC Props, 3.3 Avoid Shared Module State for Request Data, 3.4 Cross-Request LRU Caching, 3.5 Hoist Static I/O to Module Level, 3.6 Minimize Serialization at RSC Boundaries, 3.7 Parallel Data Fetching with Component Composition (+2 more)

### Community 119 - "React Best Practices"
Cohesion: 0.20
Nodes (9): 4.1 Deduplicate Global Event Listeners, 4.2 Use Passive Event Listeners for Scrolling Performance, 4.3 Use SWR for Automatic Deduplication, 4.4 Version and Minimize localStorage Data, 4. Client-Side Data Fetching, Abstract, React Best Practices, References (+1 more)

### Community 120 - "Sections"
Cohesion: 0.20
Nodes (9): 1. Eliminating Waterfalls (async), 2. Bundle Size Optimization (bundle), 3. Server-Side Performance (server), 4. Client-Side Data Fetching (client), 5. Re-render Optimization (rerender), 6. Rendering Performance (rendering), 7. JavaScript Performance (js), 8. Advanced Patterns (advanced) (+1 more)

### Community 121 - "RoadmapEditor.tsx"
Cohesion: 0.11
Nodes (18): NodeInput, NodeTypeInput, NodeUpdate, PendingDeletion, Props, ResourceInput, RoadmapEditor, Checkbox() (+10 more)

### Community 122 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 123 - "Learning Record Format"
Cohesion: 0.25
Nodes (7): Learning Record Format, Numbering, Optional sections, Supersession, Template, What does _not_ qualify, When to write a learning record

### Community 124 - "Frontend Design"
Cohesion: 0.29
Nodes (6): Design principles, Frontend Design, Ground it in the subject, More on writing in design, Process: brainstorm, explore, plan, critique, build, critique again, Restraint and self-critique

### Community 125 - "1. Eliminating Waterfalls"
Cohesion: 0.29
Nodes (7): 1.1 Check Cheap Conditions Before Async Flags, 1.2 Defer Await Until Needed, 1.3 Dependency-Based Parallelization, 1.4 Prevent Waterfall Chains in API Routes, 1.5 Promise.all() for Independent Operations, 1.6 Strategic Suspense Boundaries, 1. Eliminating Waterfalls

### Community 126 - "2. Bundle Size Optimization"
Cohesion: 0.29
Nodes (7): 2.1 Avoid Barrel File Imports, 2.2 Conditional Module Loading, 2.3 Defer Non-Critical Third-Party Libraries, 2.4 Dynamic Imports for Heavy Components, 2.5 Prefer Statically Analyzable Paths, 2.6 Preload Based on User Intent, 2. Bundle Size Optimization

### Community 127 - "React Best Practices"
Cohesion: 0.33
Nodes (5): Creating a New Rule, Getting Started, React Best Practices, Rule File Structure, Structure

### Community 128 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 130 - "Icons"
Cohesion: 0.40
Nodes (4): Icons, Icons in Button use data-icon attribute, No sizing classes on icons inside components, Pass icons as component objects, not string keys

### Community 131 - "8. Advanced Patterns"
Cohesion: 0.40
Nodes (5): 8.1 Do Not Put Effect Events in Dependency Arrays, 8.2 Initialize App Once, Not Per Mount, 8.3 Store Event Handlers in Refs, 8.4 useEffectEvent for Stable Callback Refs, 8. Advanced Patterns

### Community 132 - "GLOSSARY.md Format"
Cohesion: 0.50
Nodes (3): GLOSSARY.md Format, Rules, Structure

### Community 133 - "MISSION.md Format"
Cohesion: 0.50
Nodes (3): MISSION.md Format, Rules, Template

### Community 135 - "Prefer Statically Analyzable Paths"
Cohesion: 0.50
Nodes (3): File-System Paths, Import Paths, Prefer Statically Analyzable Paths

### Community 136 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 137 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

## Knowledge Gaps
- **530 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+525 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **106 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `RoadmapGraph.tsx`, `RoadmapCanvas.tsx`, `academic-overview/page.tsx`, `StudentNodeDetail.tsx`, `field.tsx`, `utils.ts`, `RoadmapEditor.tsx`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `dotenv`, `package.json`, `globals`, `dotenv-cli`, `eslint`, `@eslint/compat`, `eslint-config-next`, `eslint-config-prettier`, `@eslint/css`, `eslint-plugin-neverthrow`, `eslint-plugin-playwright`, `eslint-plugin-testing-library`, `jsdom`, `@playwright/test`, `postcss`, `prettier`, `prettier-plugin-tailwindcss`, `prisma`, `shadcn`, `tailwindcss`, `@testing-library/react`, `@testing-library/user-event`, `tsx`, `tw-animate-css`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript`, `typescript-eslint`, `vitest`, `@vitest/eslint-plugin`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `throwApiError()` (e.g. with `GET()` and `DELETE()`) actually correct?**
  _`throwApiError()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _530 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `roadmap-editor.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05403050108932462 - nodes in this community are weakly interconnected._
- **Should `RoadmapGraph.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.051360842844600525 - nodes in this community are weakly interconnected._
- **Should `Issue tracker: GitHub` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._