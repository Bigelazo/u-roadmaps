import type { ResourceNoticeState } from '../contracts/resource-state';

/** One Resource target, compared with the version last known by its recipient. */
export function reconcileResourceNotice(
  known: ResourceNoticeState | null,
  current: ResourceNoticeState | null,
) {
  if (
    (!known && !current) ||
    (known && current && known.title === current.title && known.revision === current.revision)
  )
    return null;
  return {
    changeKind: !known
      ? ('resource-added' as const)
      : !current
        ? ('resource-removed' as const)
        : ('resource-updated' as const),
    resourceTitle: known?.title ?? current!.title,
    titleChange:
      known && current && known.title !== current.title
        ? `«${known.title}» ahora se llama «${current.title}».`
        : null,
  };
}
