'use client';

import { useSearchParams } from 'next/navigation';
import { useSelectedNotification } from './NotificationsInbox';
import { CHANGE_SUMMARY_SUBJECT_PREFIX } from '../digest-projection';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

type Props = Readonly<{
  noticeId: string | null;
  courseCode: string;
  year: number;
  semester: number;
  courseName: string;
}>;

const availabilityDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'long',
  timeStyle: 'short',
});

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function availabilityNotice(
  notification: ReturnType<typeof useSelectedNotification>['notification'],
  { noticeId, courseCode, year, semester }: Props,
) {
  const data = notification?.id === noticeId ? (notification.data ?? {}) : null;
  const noticeMatchesCourse = Boolean(
    data && data.courseCode === courseCode && data.year === year && data.semester === semester,
  );
  const subject = noticeMatchesCourse ? stringValue(notification?.subject) : '';
  const body = noticeMatchesCourse ? stringValue(notification?.body) : '';
  const isSummary = subject.startsWith(CHANGE_SUMMARY_SUBJECT_PREFIX);
  const eventCount = noticeMatchesCourse ? numberValue(data?.eventCount) : null;
  const summaryCount =
    isSummary && eventCount !== null && Number.isSafeInteger(eventCount) && eventCount > 0
      ? `${eventCount} ${eventCount === 1 ? 'cambio' : 'cambios'}`
      : null;
  const occurredAt = noticeMatchesCourse ? stringValue(data?.occurredAt) : '';
  const date = occurredAt ? new Date(occurredAt) : null;
  const effectiveDate =
    date && !Number.isNaN(date.getTime())
      ? availabilityDateFormatter.format(date)
      : 'Fecha no disponible';
  const actorName = noticeMatchesCourse ? stringValue(data?.actorName) : '';
  const open = Boolean(noticeId && notification?.id === noticeId && noticeMatchesCourse);

  return { subject, body, isSummary, summaryCount, effectiveDate, actorName, open };
}

export function RoadmapAvailabilityDialog(props: Props) {
  const searchParams = useSearchParams();
  const { notification } = useSelectedNotification();
  const { subject, body, isSummary, summaryCount, effectiveDate, actorName, open } =
    availabilityNotice(notification, props);

  function close() {
    // Dismissal is URL cleanup, not a new Roadmap entry or recognition snapshot.
    window.history.replaceState(null, '', window.location.pathname);
  }

  return (
    <Dialog
      open={open && searchParams.get('notice') === props.noticeId}
      onOpenChange={(isOpen) => !isOpen && close()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subject}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          {summaryCount ? (
            <div>
              <dt className="font-semibold">Cambios agrupados</dt>
              <dd className="text-muted-foreground">{summaryCount}</dd>
            </div>
          ) : null}
          {actorName ? (
            <div>
              <dt className="font-semibold">{isSummary ? 'Autor del último cambio' : 'Autor'}</dt>
              <dd className="text-muted-foreground">{actorName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-semibold">{isSummary ? 'Último cambio' : 'Fecha y hora'}</dt>
            <dd className="text-muted-foreground">{effectiveDate}</dd>
          </div>
        </dl>
        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" onClick={close}>
                Entendido
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
