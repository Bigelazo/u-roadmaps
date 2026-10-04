# Own Inbox and Roadmap live updates

`GET /api/notifications/stream` authenticates the current application User and
streams invalidations through SSE. The application provider opens one EventSource
per tab, shared by the Inbox, counters and Roadmap canvas session. Switching User
or removing the authenticated provider closes it and discards the old state.

The migration `20261003000000_own_notification_sse` installs transactional
PostgreSQL triggers. Notice insertion and seen/acknowledged changes invalidate
only the recipient's Inbox. Changes to Nodes, Dependencies, Resources, Node types,
Roadmaps, Participations and Completions invalidate the relevant authorized
projection. Participation and Completion signals are scoped to their User.
Inactive or removed Participations receive their access invalidation so that the
subsequent authorized HTTP request can remove protected content.

The payload contains only User/Course offering identifiers, never pedagogical
content. Every projection/feed/count reload goes through existing authenticated
HTTP endpoints. Signals and reloads do not recognize notices. Opening an
accessible Node or entering the Roadmap retains the existing recognition rules;
Canvas preview retains its independent simulation and never recognizes real
notices. Existing canvas reconciliation preserves selection, drafts and version
checks, and removes protected content on authoritative access loss.

## Node and Docker deployment

Deploy the database migration before starting the new application version.
All Node workers/containers must use the same `DATABASE_URL`. Each process shares
one dedicated PostgreSQL LISTEN connection across its connected tabs, in addition
to the existing Prisma pool. Use a direct PostgreSQL connection or a pooler with
session pooling: transaction pooling does not preserve LISTEN subscriptions.
No external notification service is required for this transport.

The endpoint sets `text/event-stream`, `Cache-Control: private, no-cache, no-store,
no-transform` and `X-Accel-Buffering: no`. A reverse proxy must preserve streaming,
disable response buffering/caching for this path, and allow an idle interval
longer than the 15-second heartbeat. Node's normal streaming response is used.
The stream closes after five minutes to reauthenticate on its next connection.
Disconnecting the last tab releases that process's dedicated database connection.
A database listener failure closes affected SSE streams; EventSource reconnects.
If an HTTP failure permanently closes EventSource, the provider recreates it with
backoff, keeping only one active connection and cancelling retries on teardown.
Going offline closes the tab's connection and cancels pending connection retries;
returning online opens a replacement connection.

There is no replay log or permanent data polling. On a successful subscription,
reconnection, network recovery or return to the foreground, the application
reloads saved Inbox/counts and the open Roadmap. Missed signals are repaired by
reading current state. Transient HTTP refresh failures retain prior state and
retry with exponential delays from one to thirty seconds, cancelled when the
consumer unmounts. Slow stream consumers are disconnected to bound buffering.

## Verification

`pnpm test:e2e tests/e2e/own-sse-notifications.spec.ts` covers a teacher browser
edit, real SSE reception, authorized student detail, pending notices, cross-tab
recognition/counters and offline recovery in Chromium and Firefox. Reconnection
is verified after the student browser goes offline and its real stream closes;
the provider closes its native EventSource on offline and opens a replacement
on online. The fault is limited to that browser, so other sessions and database
connections remain running. No transport mock or client signal is used. The
converted `roadmap-realtime-prototype.spec.ts` exercises real SSE for blocking, hiding,
deletion and teaching draft conflicts. Existing canvas-session unit tests remain
complementary coverage for reconciliation and stale responses.

The focused Chromium and Firefox run on 2026-10-04 included both files above:
**8 passed, 0 failed, 0 skipped**, in **30.5 seconds**, exit code 0. Unit validation
and existing full-suite limitations are recorded in `docs/agents/testing.md`.

The full Chromium and Firefox E2E suite then passed: **124 passed, 0 failed,
2 optional Cloud tests skipped**, in **2.4 minutes**, exit code 0. The E2E server
released its port after completion.
