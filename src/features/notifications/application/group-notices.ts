import { projectDigestNotification } from '../digest-projection';

export type NoticeClass =
  | 'roadmap-available'
  | 'roadmap-node-changed'
  | 'roadmap-path-changed'
  | 'roadmap-resource-changed'
  | 'roadmap-classification-changed';

export type NoticeEffect = Readonly<{
  eventId: string;
  recipientId: string;
  roadmapId: string;
  courseOfferingId: string;
  noticeClass: NoticeClass;
  payload: Readonly<Record<string, unknown>>;
}>;

type Delivery = {
  // Atomically deduplicate the effect and publish it when immediate is true.
  accept: (effect: NoticeEffect, immediate: boolean) => Promise<boolean>;
  publish: (
    effect: NoticeEffect,
    projection: ReturnType<typeof projectDigestNotification>,
  ) => Promise<void>;
  failed: (error: unknown) => void;
};

const WINDOW_MS = 60_000;

/** Process-local windows; accepted effects are deduplicated by the delivery boundary. */
export function createNoticeGrouper(delivery: Delivery) {
  type Group = { first: NoticeEffect; latest: NoticeEffect; count: number; closesAt: number };
  const groups = new Map<string, Group>();
  const pending = new Map<string, Promise<void>>();

  function serialize(key: string, operation: () => Promise<void>) {
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => undefined).then(operation);
    pending.set(key, result);
    void result
      .finally(() => {
        if (pending.get(key) === result) pending.delete(key);
      })
      .catch(() => undefined);
    return result;
  }

  async function close(key: string, group: Group) {
    if (groups.get(key) !== group) return;
    groups.delete(key);
    if (!group.count) return;
    const payload = { ...group.latest.payload, eventCount: group.count, digestKey: key };
    await delivery.publish(
      { ...group.latest, eventId: `summary:${group.first.eventId}` },
      projectDigestNotification(payload, [{ payload }]),
    );
  }

  return {
    deliver(effect: NoticeEffect) {
      const key = JSON.stringify([
        effect.recipientId,
        effect.roadmapId,
        effect.payload.nodeId ?? null,
        effect.noticeClass,
      ]);
      return serialize(key, async () => {
        let group = groups.get(key);
        if (group && Date.now() >= group.closesAt) {
          await close(key, group).catch(delivery.failed);
          group = undefined;
        }
        const accepted = await delivery.accept(effect, !group);
        if (!accepted) return;
        if (group) {
          group.count++;
          if (
            group.count === 1 ||
            Date.parse(String(effect.payload.occurredAt)) >=
              Date.parse(String(group.latest.payload.occurredAt))
          )
            group.latest = effect;
          return;
        }
        const opened: Group = {
          first: effect,
          latest: effect,
          count: 0,
          closesAt: Date.now() + WINDOW_MS,
        };
        groups.set(key, opened);
        const timer = setTimeout(() => {
          void serialize(key, () => close(key, opened)).catch(delivery.failed);
        }, WINDOW_MS);
        timer.unref?.();
      });
    },
  };
}
