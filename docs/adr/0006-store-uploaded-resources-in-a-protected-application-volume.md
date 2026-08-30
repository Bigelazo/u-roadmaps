---
status: accepted
---

# Store uploaded resources in a protected application volume

A **Resource** remains material attached to one roadmap **Node**. External links and videos continue to store their URL. A newly uploaded `FILE` stores only a UUID `fileKey`, its declared content type, and its filename as the resource title in PostgreSQL; its bytes live outside the database in the application's `uploads/` directory. Docker Compose mounts that directory as the named `roadmap-uploads-v1` volume, while local uploads stay ignored by Git. This is intentionally a single-application-volume design: it provides durable storage for the present Docker deployment without adding an object-storage account or public bucket.

## Access and lifecycle

Only teaching participants can upload through `POST /api/:courseCode/:year/:semester/roadmap/nodes/:nodeId/resources` with multipart form data. The server accepts one non-empty file up to 25 MB, assigns the UUID storage key, and removes the stored bytes if creating the Resource fails. Resource DTOs translate uploaded files into the protected download route `GET /api/:courseCode/:year/:semester/roadmap/resources/:resourceId/file`; neither the storage key nor a public storage URL is sent to the browser. The download route requires an active student or teaching participation and returns `404` to students for a Resource attached to a hidden Node. It serves an attachment with `Cache-Control: private, no-store`.

Deleting an uploaded Resource removes its bytes after the database transaction. Deleting a Node also removes the file keys of its cascading Resources. Both cleanup paths are best-effort after the database commit, so a failed filesystem removal can leave an orphaned file but cannot restore a deleted Resource.

## Interface and current implementation

The node editor presents two explicit creation modes:

- **Archivo** is the default. The person may drag a file onto the drop zone or choose it from their computer; the filename becomes the Resource title.
- **Enlace** preserves the existing title-and-URL flow and creates a `LINK` Resource.

Existing file Resources can have their title edited but do not yet support replacing the file bytes. Existing `VIDEO` Resources remain compatible with the data model and student view, although the new-resource editor deliberately offers only the requested Archivo and Enlace choices.

The schema change is in migration `20260829000000_add_resource_file_storage`; deploy it before using uploads. `Dockerfile` creates `/app/uploads` with the runtime user's ownership so the first named-volume initialization is writable.

## Consequences and continuation

This storage boundary is not suitable for multiple web replicas, ephemeral/serverless filesystems, virus scanning, resumable uploads, or large files. If U-Roadmaps moves to object storage, preserve the Resource ownership and download authorization above; replace only the implementation behind `fileKey` and the protected download route rather than exposing bucket URLs. The next agent should consider adding content-type allowlisting, malware scanning, file replacement, upload progress, storage cleanup/reconciliation, and API/Playwright coverage before broadening the feature.

Typecheck, lint, and focused Vitest coverage for file selection, link creation, and multipart upload pass. A full unit-suite run has three unrelated failures in development-fixture environment tests. One production build completed; later retries were blocked by Turbopack's local process/port permission error, not by a TypeScript or application error.

## Continuation update — 2026-08-29

The file-resource implementation was extended with a direct multipart API E2E case and a browser regression case intended to upload a file from the node editor while asserting that the roadmap still fits its viewport. The direct API E2E case returned `201`; it confirms that the protected route can create and later delete a `FILE` Resource when its database and filesystem prerequisites are available.

Two layout attempts were made to keep the editor from enlarging the document on desktop: first, the canvas grid was given an explicit `minmax(0, 1fr)` row and the editor became a `min-h-0` scroll container. The second attempt moved the desktop course page into the viewport area below the 64px global navigation (`lg:fixed lg:inset-x-0 lg:top-16 lg:bottom-0`), then made `RoadmapCanvas` inherit that height. Focused Vitest coverage, typecheck, and lint pass for the latter shape.

**El problema todavía persiste.** The user supplied a post-change screenshot in which the roadmap and editor still end above the bottom of the browser viewport, leaving a broad blank band below them. Therefore this layout implementation is not accepted as the resolution. A successor must reproduce it in a browser and inspect `window.innerHeight` plus the bounding rectangles and computed heights of the global navigation, course `main`, roadmap wrapper, canvas, and editor before making another CSS change. The browser E2E regression test is in `tests/e2e/roadmap-layout.spec.ts`; it was not runnable from the agent shell because PostgreSQL at `localhost:5432` returned `P1001`, despite the user reporting that they executed the migration command in their environment.

The original upload `500` likewise requires verification against the environment that reproduces it. The new migration is still required before a local database can persist `fileKey` and `fileContentType`; check `prisma migrate status` and the application-server error for the exact failing request. Do not treat a successful E2E multipart request, or a completed migration command alone, as proof that the user's running server has the migration and a writable upload directory. Keep the protected-resource ownership, authorization, and cleanup boundary in this ADR unchanged while diagnosing that environment-specific failure.
