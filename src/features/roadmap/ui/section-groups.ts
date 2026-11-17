type SectionMember = Readonly<{ sections: readonly string[] }>;

const compareSection = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });

export function sectionsLabel(sections: readonly string[]) {
  if (sections.length === 0) return 'Sin sección';
  return `${sections.length === 1 ? 'Sección' : 'Secciones'} ${sections.join(', ')}`;
}

export function groupBySections<Member extends SectionMember>(members: readonly Member[]) {
  const groups = new Map<string, { sections: readonly string[]; members: Member[] }>();
  for (const member of members) {
    const key = member.sections.join(',');
    const group = groups.get(key) ?? { sections: member.sections, members: [] };
    group.members.push(member);
    groups.set(key, group);
  }
  return [...groups]
    .sort(
      ([, a], [, b]) =>
        Number(a.sections.length === 0) - Number(b.sections.length === 0) ||
        b.sections.length - a.sections.length ||
        a.sections.reduce(
          (order, section, index) => order || compareSection(section, b.sections[index]),
          0,
        ),
    )
    .map(([key, { sections, members }]) => ({ key, label: sectionsLabel(sections), members }));
}
