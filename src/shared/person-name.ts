/** Formats known name parts without guessing surname boundaries from a full name. */
export function rosterPersonName(parts: {
  firstName?: string | null;
  secondName?: string | null;
  firstSurname?: string | null;
  secondSurname?: string | null;
}) {
  const join = (values: (string | null | undefined)[]) =>
    values
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(' ');
  const surnames = join([parts.firstSurname, parts.secondSurname]);
  const givenNames = join([parts.firstName, parts.secondName]);
  return [surnames, givenNames].filter(Boolean).join(', ');
}
