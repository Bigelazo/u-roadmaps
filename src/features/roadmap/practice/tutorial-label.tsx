import type { LucideIcon } from 'lucide-react';
import { NodeName } from '@/features/roadmap/ui/NodeName';
import { practiceNodeTypes } from './practice-roadmap';

export function TutorialNode({ title, type = 'Contenido' }: { title: string; type?: string }) {
  const nodeType = practiceNodeTypes.find((candidate) => candidate.name === type)!;
  return <NodeName title={title} nodeType={nodeType} />;
}

const actionIconColors = {
  default: 'var(--primary-deep)',
  destructive: 'var(--destructive)',
  success: 'var(--color-emerald-600)',
} as const;

export function TutorialAction({
  icon: Icon,
  children,
  intent = 'default',
}: {
  icon: LucideIcon;
  children: string;
  intent?: keyof typeof actionIconColors;
}) {
  return (
    <span className="font-medium text-foreground">
      <Icon
        aria-hidden="true"
        className="mr-1 inline-block size-[1em] align-[-0.125em]"
        style={{ color: actionIconColors[intent] }}
      />
      {children}
    </span>
  );
}
