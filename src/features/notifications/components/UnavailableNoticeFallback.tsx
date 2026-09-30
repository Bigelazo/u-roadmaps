'use client';

import { useEffect, useRef } from 'react';
import { useSelectedNotification } from './NotificationsInbox';

export function UnavailableNoticeFallback({
  noticeId,
  reason,
}: {
  noticeId: string;
  reason: 'course-unavailable' | 'roadmap-unavailable';
}) {
  const { notification } = useSelectedNotification();
  const acknowledged = useRef(false);

  useEffect(() => {
    if (notification?.id !== noticeId || acknowledged.current) return;
    acknowledged.current = true;
    void notification.read().catch(() => {
      acknowledged.current = false;
    });
  }, [noticeId, notification]);

  return (
    <div className="mx-auto mt-6 w-full max-w-3xl rounded-lg border bg-card p-4" role="status">
      <p className="font-semibold">No se puede abrir este Roadmap</p>
      <p className="text-sm text-muted-foreground">
        {reason === 'course-unavailable'
          ? 'Tu Participación ya no tiene acceso a este Curso. Puedes revisar tus Cursos en el Resumen académico.'
          : 'Este Roadmap ya no está disponible. Puedes revisar tus Cursos en el Resumen académico.'}
      </p>
    </div>
  );
}
