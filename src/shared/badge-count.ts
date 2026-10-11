/** Caps a count badge at "99+" so it keeps a fixed width. */
export function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : count;
}
