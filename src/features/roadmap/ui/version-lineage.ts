type LineageOrigin = { kind: 'COPY'; year: number; semester: number } | { kind: 'EMPTY' };

export type LineageEdition = Readonly<{ year: number; semester: number; origin: LineageOrigin }>;

export type LineageRow = Readonly<{
  lane: number;
  incoming: readonly number[];
  passing: readonly number[];
  continues: boolean;
}>;

const editionKey = ({ year, semester }: { year: number; semester: number }) =>
  `${year}-${semester}`;

export function lineageLanes(editions: readonly LineageEdition[]) {
  const awaiting: (string | null)[] = [];
  const rows = editions.map((edition, index): LineageRow => {
    const key = editionKey(edition);
    const incoming = awaiting.flatMap((awaited, lane) => (awaited === key ? [lane] : []));
    const free = awaiting.indexOf(null);
    const lane = incoming[0] ?? (free === -1 ? awaiting.length : free);
    const passing = awaiting.flatMap((awaited, other) =>
      awaited !== null && awaited !== key && other !== lane ? [other] : [],
    );
    for (const merged of incoming) awaiting[merged] = null;
    const { origin } = edition;
    const source =
      origin.kind === 'COPY' &&
      editions.slice(index + 1).some((older) => editionKey(older) === editionKey(origin))
        ? editionKey(origin)
        : null;
    awaiting[lane] = source;
    return { lane, incoming, passing, continues: source !== null };
  });
  return { rows, laneCount: Math.max(1, awaiting.length) };
}
