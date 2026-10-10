# Own Inbox and role-scoped Roadmap live updates

> Implemented model: [ADR-0014](adr/0014-target-based-notice-grouping.md).
> Notice targets group durably, recognition occurs on Roadmap entry, and only
> teaching sessions reload pedagogical content live.

`GET /api/notifications/stream` authenticates the current application User and
streams invalidations through SSE. The application provider opens one EventSource
per tab, shared by the Inbox, counters and Roadmap canvas session. Switching User
or removing the authenticated provider closes it and discards the old state.

The migration `20261003000000_own_notification_sse` installs transactional
PostgreSQL triggers. Notice insertion, update, withdrawal and recognition invalidate
only the recipient's Inbox. Changes to Nodes, Dependencies, Resources, Node types,
Roadmaps, Participations and Completions invalidate the relevant authorized
projection. Participation and Completion signals are scoped to their User.
Inactive or removed Participations receive their access invalidation so that the
subsequent authorized HTTP request can remove protected content.

Only `RoadmapNotice` rows drive Inbox signals. The notice lifecycle module
([ADR-0024](adr/0024-notice-target-lifecycle-module.md)) also writes Known values
(`NoticeKnownValue`) and opening snapshots (`NoticeAcknowledgement.snapshots`);
those writes emit no signal of their own. A delivery that creates, updates or
withdraws a notice signals through the notice row, and a delivery that only
advances a Known value changes nothing the Inbox shows.

The payload contains User/Course offering identifiers and an optional access-loss
flag, never pedagogical content. Every projection/feed/count reload goes through existing authenticated
HTTP endpoints. A tab coalesces Inbox signals arriving within 100 ms into one
reload, including bursts of delivery and recognition. Each
stream remembers the Course offerings already confirmed for its User, so Roadmap
signals only query the Participation once per stream and Course offering.
Signals and reloads do not recognize notices. Entering the Roadmap recognizes
all captured pending notices; opening a Node or the Inbox has no state effect.
Canvas preview retains its independent simulation and never recognizes real
notices. Only current teaching sessions reload the open Roadmap after content signals.
Student and observer sessions retain their loaded canvas until they enter the
Roadmap again, including refresh and clicking a notice for the same Roadmap.
Inbox and counters remain live for every role; arrivals do not open a dialog
mid-session. Each server-prepared entry has a fresh opening identifier, which
starts a new canvas session even when client navigation keeps the same route.
The Change summary appears once after recognition, except on first entry or
without pending changes. Dismissing it has no state or navigation effect.
Teaching canvas reconciliation preserves selection, drafts and version checks
([ADR-0015](adr/0015-teacher-edit-concurrency-relies-on-realtime.md)); Canvas
preview keeps its existing independent simulation behavior.

User-scoped Participation/Completion signals check whether the Participation is
still active. When it is lost, the stream adds `accessLost: true` to the
identifier-only invalidation. Every current session, including student sessions,
then verifies access through the authorized Roadmap HTTP endpoint; an
authoritative denial removes protected content. An ordinary content signal does
not perform this student reload.

## Node deployment

Deploy the database migration before starting the new application version.
The supported deployment runs one persistent Node process. It uses the same
`DATABASE_URL` for Prisma and live signals, and shares
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
reloads saved Inbox/counts for everyone and the open Roadmap only for current
teaching sessions. Students and observers retain their canvas across recovery;
re-entering reads its current state. Missed Inbox signals are repaired by reading
current state. Transient HTTP refresh failures retain prior state and
retry with exponential delays from one to thirty seconds, cancelled when the
consumer unmounts. Slow stream consumers are disconnected to bound buffering.

## Verification

`pnpm test:e2e tests/e2e/own-sse-notifications.spec.ts` covers a teacher browser
edit, real SSE reception, stable student detail, live pending notices and counters,
cross-tab recognition, offline recovery, same-Roadmap notice navigation, refresh
and authorized HTTP denial after access revocation. Reconnection
is verified after the student browser goes offline and its real stream closes;
the provider closes its native EventSource on offline and opens a replacement
on online. The fault is limited to that browser, so other sessions and database
connections remain running. No transport mock or client signal is used. The
converted `roadmap-realtime-prototype.spec.ts` exercises real SSE for teaching live reloads, transient projection failures,
reconnection and teaching draft conflicts including deletion. Existing canvas-session unit tests remain
complementary coverage for reconciliation and stale responses.

Notice grouping has no real-time deadline. E2E assertions wait for persisted
state or authorized HTTP projections, rather than sleeping for grouping windows.
Unit transport tests use simulated time for debounce/retry behavior. Current
configured browser scope belongs in `playwright.config.ts`, operational guidance
in `docs/agents/testing.md`, and dated suite results in
`docs/testing-validation-history.md`. Historical runs are not evidence for the
current implementation.
