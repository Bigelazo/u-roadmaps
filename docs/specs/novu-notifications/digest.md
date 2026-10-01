# Novu change summaries (#147)

## Workflow configuration

Configure each of the five existing workflows with these steps, in order:

1. Add a Digest step with identifier `digest`. Select **Regular**, start **When events repeat**, choose a custom window of **60 seconds**, and group by `payload.digestKey`. Novu already groups by subscriber; the added key scopes that subscriber's Digest.
2. Add the In-App step with identifier `in-app` and switch its content editor to **Custom Code**. Publish the matching handler under `novu/<workflow-identifier>/in-app.step.tsx`.

The workflow identifier separates the five change classes. The trigger adapter generates `roadmap:<roadmapId>:node:<nodeId>` for Node and Resource changes, and `roadmap:<roadmapId>:general` for changes without a Node. Roadmap identity keeps Courses separate; authors are deliberately absent from the key.

| Workflow | Class | Digest key |
| --- | --- | --- |
| `roadmap-available` | Roadmap availability | Roadmap only |
| `roadmap-node-changed` | Node change | Roadmap and Node |
| `roadmap-path-changed` | Path change | Roadmap only |
| `roadmap-resource-changed` | Resource change | Roadmap and Node |
| `roadmap-classification-changed` | Classification change | Roadmap only |

The **When events repeat** mode delivers the first trigger immediately and sends later repeats as a separate notification after the Digest window. The In-App handler uses Novu's `steps.digest.events` only to create that second notification. It selects the event with the latest effective `payload.occurredAt`, sums its `eventCount` values, and takes `actorName`, `changeKind`, and the message detail from that same event. An immediate delivery preserves its original subject, body, and one-event data.

The In-App `data` object contains only `roadmapId`, `courseCode`, `year`, `semester`, `targetKind`, optional `nodeId`, `changeKind`, `occurredAt`, `eventCount`, and `actorName`. The Code Step returns no event list. The existing Inbox acknowledgement reads a summary by its one notification ID; opening a Node reads its summaries with all other eligible Node notices. A summary created after the opening snapshot remains pending.

The workflow inventory and field lists are in [workflows.json](./workflows.json). Runnable projection inputs and expected In-App outputs for all five classes are in [digest-examples.json](./digest-examples.json).

## Publish the Code Steps

Create or update each workflow and its two steps in the Novu test environment first. Keep the step identifiers `digest` and `in-app`, then publish the matching In-App handler with the test environment's secret key:

```sh
npx novu step publish --workflow roadmap-available --step in-app
npx novu step publish --workflow roadmap-node-changed --step in-app
npx novu step publish --workflow roadmap-path-changed --step in-app
npx novu step publish --workflow roadmap-resource-changed --step in-app
npx novu step publish --workflow roadmap-classification-changed --step in-app
```

The CLI reads `NOVU_SECRET_KEY` from the environment or `.env`. Do not publish these handlers to Production; Novu's Code Step CLI publishes to non-production environments. Promote tested changes through the Novu dashboard only after the required review.

The Dashboard's Digest step provides one additional aggregation field, while a Code Step can read the Digest result and return the In-App `subject`, `body`, and scalar `data`. This keeps grouping and summarization in Novu and avoids local notification persistence or consolidation. See Novu's [Digest Step](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest), [Code Steps](https://docs.novu.co/platform/workflow/add-and-configure-steps/code-steps), [Digest output](https://docs.novu.co/framework/typescript/steps/digest), and [In-App data object limits](https://docs.novu.co/platform/inbox/configuration/data-object).

## Deterministic checks

Run these focused suites to verify the grouping key, all five sample projections, the ten-scalar limit, the dialog labels, acknowledgement by notification ID, and late Digest delivery:

```sh
pnpm exec vitest run \
  tests/features/notifications/digest-projection.test.ts \
  tests/features/notifications/novu-digest-grouping.test.ts \
  tests/features/notifications/roadmap-path-change-dialog.test.tsx \
  tests/features/notifications/resource-node-acknowledgement.test.tsx
```

## Novu test-environment rehearsal

**Status: pending.** No Novu test secret, application identifier, or workflow IDs are configured in this checkout; only the example environment file is present. Production remains disabled. `notificationsEnabled()` requires `NOVU_NOTIFICATIONS_ENABLED=true`, and Production additionally requires `NOVU_PRODUCTION_APPROVED=true`.

After test credentials are available, record the Novu environment, workflow run IDs, timestamps, and observed `subject`, `body`, and `data` for this rehearsal:

1. Trigger a Node change for one subscriber, Course `CC1001`, Roadmap `roadmap-a`, Node `node-a`, by Ana. Confirm its In-App notification arrives immediately with `eventCount: 1`.
2. Within 60 seconds, trigger another Node change for the same Node by Luis. Confirm the first notification stays unchanged and one later summary is created. It must report the latest effective `occurredAt`, `actorName: "Luis Soto"`, and the number of repeat events included.
3. Trigger the same workflow for `node-b` in `roadmap-a`; verify it remains a separate group.
4. Trigger the same Node ID in Course `CC2002` / `roadmap-b`; verify it remains separate from `roadmap-a`.
5. Trigger a Resource change for `roadmap-a` / `node-a`; verify the Resource class remains separate from the Node class despite sharing a Digest key.
6. Trigger repeated Path, Classification, and Roadmap availability events for `roadmap-a`; verify each general workflow groups by Roadmap without a `nodeId` in client data.
7. Repeat changes with multiple authors and verify that author changes do not split an otherwise matching group. Verify every summary has no event array, has at most ten scalar data fields, and keeps strings within 256 characters.
8. Open a Node before its Digest window closes. After the summary arrives, verify it remains unread until the Node is opened again. Then verify one summary is acknowledged as one notification.

The local sample projections are deterministic contract checks. They do not stand in for this Novu Cloud rehearsal.
