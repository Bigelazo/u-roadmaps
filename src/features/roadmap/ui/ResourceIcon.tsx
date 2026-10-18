import { FileText, Link2 } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';

export function ResourceIcon({ type }: { type: Resource['type'] }) {
  const Icon = type === 'FILE' ? FileText : Link2;
  return <Icon size={20} aria-hidden="true" />;
}
