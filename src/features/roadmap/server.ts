import 'server-only';

export { closeDueRoadmaps, readRoadmapClosureCalendar } from './application/closure';

export {
  changeTeacherBlock,
  createRoadmapDependency,
  createRoadmapNode,
  createRoadmapNodeType,
  deleteRoadmapDependency,
  deleteRoadmapNode,
  deleteRoadmapNodeType,
  previewNodeDeletion,
  previewNodeVisibility,
  previewRoadmapDependency,
  previewTeacherBlock,
  releaseScheduledTeacherUnlocks,
  scheduleTeacherUnlock,
  SCHEDULED_UNLOCK_ACTOR_ID,
  updateRoadmapNode,
  updateRoadmapNodeType,
} from '@/features/roadmap/application/editor';
export {
  createRoadmapResource,
  downloadRoadmapResource,
  getRoadmapNodeResources,
  removeRoadmapResource,
  updateRoadmapResource,
  uploadRoadmapResource,
} from '@/features/roadmap/application/resources';
export {
  completeNode,
  completeSimulatedNode,
  readRoadmapForParticipant,
  readSimulatedRoadmap,
  resetSimulatedCompletions,
} from '@/features/roadmap/application/completion';
export {
  createRoadmapForActor,
  getNodeTypesForActor,
  getRoadmapNodesForActor,
} from '@/features/roadmap/application/queries';
export {
  requireCourseOfferingParticipation,
  synchronizeParticipation,
  type RoadmapActor,
} from '@/features/roadmap/application/participation';

export { synchronizeAcademicParticipations } from './application/academic-participation';
export {
  downloadRoadmapVersionResource,
  readRoadmapVersion,
  readRoadmapVersionHistory,
  type RoadmapVersion,
  type RoadmapVersionHistory,
} from './application/version-history';

export type {
  RoadmapChangePort,
  RoadmapChanges,
  RoadmapChangeFact,
} from './application/change-port';
export { readPracticeRoadmapCalendar } from './application/practice';
export {
  claimPostCreationInvitation,
  recordTeachingTutorialOpened,
} from './application/tutorial-invitation';
