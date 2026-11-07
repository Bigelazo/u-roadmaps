import 'server-only';
import { after } from 'next/server';
import { noticesPort } from './notice-change-port';

export { scheduledRoadmapChangePort } from './notice-change-port';

export const roadmapChangePort = noticesPort(after);
