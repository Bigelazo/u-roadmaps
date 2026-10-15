import { FileCode2, FileText } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';

export function ResourceIcon({ type }: { type: Resource['type'] }) {
  const Icon = type === 'VIDEO' ? FileCode2 : FileText;
  return <Icon size={20} aria-hidden="true" />;
}
