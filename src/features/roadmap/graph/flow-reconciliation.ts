type FlowItem = { readonly id: string };
type MeasuredFlowItem = FlowItem & { readonly measured?: unknown };

type Flow<Node extends MeasuredFlowItem, Edge extends FlowItem> = {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function shallowEqual(next: Record<string, unknown>, current: Record<string, unknown>) {
  const keys = Object.keys(next);
  return (
    keys.length === Object.keys(current).length &&
    keys.every((key) => Object.hasOwn(current, key) && Object.is(next[key], current[key]))
  );
}

function sameItem(next: object, current: object) {
  const nextEntries = next as Record<string, unknown>;
  const currentEntries = current as Record<string, unknown>;
  const keys = Object.keys(nextEntries);
  return (
    keys.length === Object.keys(currentEntries).length &&
    keys.every((key) => {
      if (!Object.hasOwn(currentEntries, key)) return false;
      const value = nextEntries[key];
      const previous = currentEntries[key];
      return (
        Object.is(value, previous) ||
        (isPlainObject(value) && isPlainObject(previous) && shallowEqual(value, previous))
      );
    })
  );
}

function reuse<Item extends FlowItem>(
  items: readonly Item[],
  currentItems: readonly Item[],
  prepare: (item: Item, current: Item | undefined) => Item = (item) => item,
) {
  const currentById = new Map(currentItems.map((item) => [item.id, item]));
  return items.map((item) => {
    const current = currentById.get(item.id);
    const prepared = prepare(item, current);
    return current && sameItem(prepared, current) ? current : prepared;
  });
}

function sameList<Item>(items: readonly Item[], currentItems: readonly Item[]) {
  return (
    items.length === currentItems.length &&
    items.every((item, index) => item === currentItems[index])
  );
}

export function reconcileFlow<
  Node extends MeasuredFlowItem,
  Edge extends FlowItem,
  NextFlow extends Flow<Node, Edge>,
>(next: NextFlow, current: NextFlow): NextFlow {
  const nodes = reuse(next.nodes, current.nodes, (node, previous) => ({
    ...node,
    measured: previous?.measured,
  }));
  const edges = reuse(next.edges, current.edges);
  if (sameList(nodes, current.nodes) && sameList(edges, current.edges)) return current;
  return { ...next, nodes, edges };
}
