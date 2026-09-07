import type { TeacherBlockOperation } from '@/features/roadmap/types';

export type NodeAccessActionOperation = Extract<TeacherBlockOperation, 'BLOCK' | 'UNBLOCK'>;
