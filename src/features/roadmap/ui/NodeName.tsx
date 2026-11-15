import { nodeTypePaint } from '@/shared/node-type';
import type { ComponentProps } from 'react';

import { cn } from 'cn';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import { IconLabel } from '@/shared/ui/icon-label';

export type NodeNameType = {
  name: string;
  icon: string;
  color: string;
};

type NodeNameProps = {
  title: string;
  nodeType: NodeNameType;
} & Omit<ComponentProps<'span'>, 'children' | 'title'>;

export function NodeName({ title, nodeType, className, ...props }: NodeNameProps) {
  return (
    <span data-slot="node-name" className={cn('font-medium text-foreground', className)} {...props}>
      <IconLabel
        icon={
          <NodeTypeIcon
            icon={nodeType.icon}
            aria-hidden="true"
            data-slot="node-name-icon"
            className="mr-1 inline-block size-[1em] shrink-0 align-[-0.125em]"
            style={{ color: nodeTypePaint(nodeType.color) }}
          />
        }
        text={title}
      />
    </span>
  );
}
