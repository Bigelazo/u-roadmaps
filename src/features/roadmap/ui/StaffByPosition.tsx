import type { ReactNode } from 'react';
import { cn } from 'cn';
import {
  POSITION_PRIORITY,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';
import { PositionDot } from '@/shared/ui/position-plate';
import { positionGroupLabel } from '@/shared/ui/position-labels';
import { groupBySections } from './section-groups';

type StaffPosition = InstitutionalCoursePosition | null;

type StaffMember = Readonly<{
  name: string;
  institutionalPosition: StaffPosition;
  sections?: readonly string[];
}>;

const staffPositions: readonly StaffPosition[] = [
  ...POSITION_PRIORITY.filter((position) => position !== 'STUDENT' && position !== 'OBSERVER'),
  null,
];

function groupByPosition<Member extends StaffMember>(staff: readonly Member[]) {
  return staffPositions
    .map((position) => ({
      position,
      members: staff.filter((member) => member.institutionalPosition === position),
    }))
    .filter(({ members }) => members.length > 0);
}

const layouts = {
  card: {
    list: 'overflow-hidden rounded-xl border border-fog bg-card',
    group: 'border-t border-fog first:border-t-0',
    heading: 'border-b border-fog bg-cloud px-4 py-2 sm:px-5',
    members: 'divide-y divide-fog',
    member: 'px-4 py-3 text-sm sm:px-5',
  },
  compact: {
    list: 'grid gap-3',
    group: 'grid gap-1',
    heading: '',
    members: 'grid gap-1 pl-3.5',
    member: '',
  },
} as const;

export function StaffByPosition<Member extends StaffMember>({
  staff,
  memberKey,
  memberDetail,
  layout,
  bySection = false,
}: Readonly<{
  staff: readonly Member[];
  memberKey: (member: Member) => string;
  memberDetail?: (member: Member) => ReactNode;
  layout: keyof typeof layouts;
  bySection?: boolean;
}>) {
  const classes = layouts[layout];
  const sectioned = bySection && staff.some((member) => (member.sections ?? []).length > 0);
  return (
    <ul aria-label="Equipo docente" className={classes.list}>
      {groupByPosition(staff).map(({ position, members }) => {
        const label = positionGroupLabel(position);
        const heading = (
          <>
            <PositionDot position={position} />
            {label}
            {members.length > 1 ? (
              <span className="text-muted-foreground">· {members.length}</span>
            ) : null}
          </>
        );
        const headingClassName = cn(
          'flex items-center gap-1.5 text-sm font-medium text-ink',
          classes.heading,
        );
        const memberItems = (group: readonly Member[]) =>
          group.map((member) => {
            const detail = memberDetail?.(member);
            return (
              <li
                className={cn('flex flex-wrap items-baseline gap-x-2', classes.member)}
                key={memberKey(member)}
              >
                <span className="font-medium break-words text-ink">{member.name}</span>
                {detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
              </li>
            );
          });
        const sections = sectioned
          ? groupBySections(
              members.map((member) => ({ ...member, sections: member.sections ?? [] })),
            )
          : [];
        const memberList =
          sections.length > 1 || sections[0]?.members[0].sections.length ? (
            <ul className={classes.members}>
              {sections.map((section) => (
                <li aria-label={`${label}, ${section.label}`} key={section.key}>
                  <p className="border-b border-fog bg-cloud/50 px-4 py-1.5 text-xs font-medium text-muted-foreground tabular-nums sm:px-5">
                    {section.label}
                    {section.members.length > 1 ? ` · ${section.members.length}` : null}
                  </p>
                  <ul className="divide-y divide-fog">{memberItems(section.members)}</ul>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={classes.members}>{memberItems(members)}</ul>
          );
        return (
          <li aria-label={label} className={classes.group} key={position ?? 'unknown'}>
            <p className={headingClassName}>{heading}</p>
            {memberList}
          </li>
        );
      })}
    </ul>
  );
}
