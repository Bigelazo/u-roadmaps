import { CircleCheck, CloudDownload } from 'lucide-react';
import { cn } from 'cn';
import type { Resource } from '@/features/roadmap/types';
import { formatFileSize } from '@/shared/file-size-format';

export function accessCountLabel(count: number) {
  return count === 1 ? '1 acceso' : `${count} accesos`;
}

export function ResourceMetadata({
  resource,
  isReviewed,
  className,
}: {
  resource: Pick<Resource, 'type' | 'fileSize' | 'accessCount'>;
  isReviewed?: boolean;
  className?: string;
}) {
  const showsSize = resource.type === 'FILE' && resource.fileSize !== null;
  if (resource.accessCount === undefined && !showsSize && !isReviewed) return null;
  return (
    <span
      data-slot="resource-metadata"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-snug font-normal text-muted-foreground tabular-nums',
        className,
      )}
    >
      {resource.accessCount !== undefined ? (
        <span className="inline-flex items-center gap-1">
          <CloudDownload aria-hidden="true" className="size-3.5" />
          <span aria-hidden="true">{resource.accessCount}</span>
          <span className="sr-only">{accessCountLabel(resource.accessCount)}</span>
        </span>
      ) : null}
      {showsSize ? <span>{formatFileSize(resource.fileSize!)}</span> : null}
      {isReviewed ? (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          <span className="sr-only">Ya lo revisaste</span>
        </span>
      ) : null}
    </span>
  );
}
