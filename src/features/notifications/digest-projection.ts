export const CHANGE_SUMMARY_SUBJECT_PREFIX = 'Resumen de cambios ·';

type Payload = Readonly<Record<string, unknown>>;

type DigestEvent = Readonly<{
  payload: Payload;
}>;

export type DigestNotificationProjection = Readonly<{
  subject: string;
  body: string;
  data: Readonly<Record<string, string | number>>;
}>;

const MAX_STRING_LENGTH = 256;

export function projectDigestNotification(payload: Payload, events: readonly unknown[]) {
  const digestEvents = events.map(readDigestEvent);
  const sourceEvents = digestEvents.length ? digestEvents : [{ payload }];
  const latest = latestEffectiveEvent(sourceEvents);
  const summary = digestEvents.length > 0;
  const eventCount = sourceEvents.reduce(
    (total, event) => total + requiredPositiveInteger(event.payload.eventCount, 'eventCount'),
    0,
  );

  assertSameDigestGroup(summary ? [...sourceEvents, { payload }] : sourceEvents);

  const roadmapId = requiredString(latest.payload.roadmapId, 'roadmapId');
  const courseCode = requiredString(latest.payload.courseCode, 'courseCode');
  const targetKind = requiredString(latest.payload.targetKind, 'targetKind');
  if (targetKind !== 'roadmap' && targetKind !== 'node') {
    throw new Error('Notification targetKind must be roadmap or node.');
  }
  const changeKind = requiredString(latest.payload.changeKind, 'changeKind');
  const actorName = boundedString(requiredString(latest.payload.actorName, 'actorName'));
  const occurredAt = effectiveTimestamp(latest.payload.occurredAt);
  const nodeId = optionalString(latest.payload.nodeId);
  const nodeTitle = optionalString(latest.payload.nodeTitle);
  const noticeBody = optionalString(latest.payload.noticeBody) ?? defaultBody(latest.payload);
  const scope = nodeId ? `Nodo${nodeTitle ? ` «${nodeTitle}»` : ''}` : `Roadmap de ${courseCode}`;
  const subject = summary
    ? boundedString(`${CHANGE_SUMMARY_SUBJECT_PREFIX} ${scope}`)
    : boundedString(optionalString(latest.payload.noticeTitle) ?? defaultSubject(latest.payload));
  const body = summary
    ? boundedString(
        `Se agruparon ${eventCount} ${eventCount === 1 ? 'cambio' : 'cambios'}. Último cambio: ${summaryDetail(latest.payload, noticeBody)}`,
      )
    : boundedString(noticeBody);

  return {
    subject,
    body,
    data: {
      roadmapId: boundedString(roadmapId),
      courseCode: boundedString(courseCode),
      year: requiredNumber(latest.payload.year, 'year'),
      semester: requiredNumber(latest.payload.semester, 'semester'),
      targetKind,
      ...(nodeId ? { nodeId: boundedString(nodeId) } : {}),
      changeKind: boundedString(changeKind),
      occurredAt,
      eventCount,
      actorName,
    },
  } satisfies DigestNotificationProjection;
}

function readDigestEvent(value: unknown): DigestEvent {
  const event = asRecord(value);
  const payload = asRecord(event?.payload);
  if (!payload) throw new Error('Digest event payload must be an object.');
  return { payload };
}

function latestEffectiveEvent(events: readonly DigestEvent[]) {
  let latest = events[0];
  let latestTime = Date.parse(requiredString(latest.payload.occurredAt, 'occurredAt'));
  if (Number.isNaN(latestTime)) throw new Error('Notification occurredAt must be valid.');

  for (const event of events.slice(1)) {
    const time = Date.parse(requiredString(event.payload.occurredAt, 'occurredAt'));
    if (Number.isNaN(time)) throw new Error('Notification occurredAt must be valid.');
    if (time >= latestTime) {
      latest = event;
      latestTime = time;
    }
  }

  return latest;
}

function assertSameDigestGroup(events: readonly DigestEvent[]) {
  const first = events[0].payload;
  const digestKey = requiredString(first.digestKey, 'digestKey');
  const roadmapId = requiredString(first.roadmapId, 'roadmapId');
  for (const event of events.slice(1)) {
    if (
      event.payload.digestKey !== digestKey ||
      event.payload.roadmapId !== roadmapId ||
      event.payload.courseCode !== first.courseCode ||
      event.payload.year !== first.year ||
      event.payload.semester !== first.semester
    ) {
      throw new Error('Digest events do not belong to the same Roadmap and Course.');
    }
  }
}

function defaultSubject(payload: Payload) {
  const resourceTitle = optionalString(payload.resourceTitle);
  if (resourceTitle) return `Cambio de recurso: ${resourceTitle}`;
  if (payload.changeKind === 'roadmap-available') {
    return `Roadmap disponible: ${requiredString(payload.courseCode, 'courseCode')}`;
  }
  const nodeTitle = optionalString(payload.nodeTitle);
  return nodeTitle ?? `Cambio del Roadmap de ${requiredString(payload.courseCode, 'courseCode')}`;
}

function defaultBody(payload: Payload) {
  const actorName = requiredString(payload.actorName, 'actorName');
  const courseCode = requiredString(payload.courseCode, 'courseCode');
  const resourceTitle = optionalString(payload.resourceTitle);
  if (resourceTitle) return resourceChangeBody(payload);
  if (payload.changeKind === 'roadmap-available') {
    return `${actorName} creó el roadmap de ${courseCode}.`;
  }
  return `${actorName} modificó el Roadmap de ${courseCode}.`;
}

function summaryDetail(payload: Payload, noticeBody: string) {
  if (optionalString(payload.resourceTitle)) return resourceChangeBody(payload);

  const classificationTitle = optionalString(payload.noticeTitle);
  if (payload.changeKind === 'classification-updated' && classificationTitle) {
    const actorName = requiredString(payload.actorName, 'actorName');
    const courseCode = requiredString(payload.courseCode, 'courseCode');
    return `${actorName} actualizó la clasificación del Roadmap de ${courseCode}: ${classificationTitle}.`;
  }

  return noticeBody;
}

function resourceChangeBody(payload: Payload) {
  const resourceTitle = requiredString(payload.resourceTitle, 'resourceTitle');
  const actorName = requiredString(payload.actorName, 'actorName');
  const courseCode = requiredString(payload.courseCode, 'courseCode');
  const nodeTitle = optionalString(payload.nodeTitle);
  return `${actorName} modificó «${resourceTitle}»${nodeTitle ? ` en el Nodo «${nodeTitle}»` : ''} del Roadmap de ${courseCode}.`;
}

function effectiveTimestamp(value: unknown) {
  const timestamp = requiredString(value, 'occurredAt');
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) throw new Error('Notification occurredAt must be valid.');
  return parsed.toISOString();
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Notification ${field} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requiredNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Notification ${field} must be a finite number.`);
  }
  return value;
}

function requiredPositiveInteger(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Notification ${field} must be a positive integer.`);
  }
  return value;
}

function boundedString(value: string) {
  return Array.from(value).slice(0, MAX_STRING_LENGTH).join('');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
