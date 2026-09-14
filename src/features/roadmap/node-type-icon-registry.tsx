import { createElement } from 'react';
import type { LucideProps } from 'lucide-react';
import { nodeTypeIcon } from '@/features/roadmap/node-type-icons';

export function NodeTypeIcon({ icon, ...props }: { icon: string } & LucideProps) {
  return createElement(nodeTypeIcon(icon), props);
}
