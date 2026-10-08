import 'server-only';

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
export type { NodeNotificationDescriptor } from '@/features/roadmap/application/node-change-notifications';
export type { NodeTypeClassificationNotification } from '@/features/roadmap/application/node-type-classification-notifications';
export type {
  DependencyNotificationBatch,
  DependencyPathNotificationDescriptor,
} from '@/features/roadmap/application/dependency-change-notifications';
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
export { readCourseOfferingTeachingStaff } from './application/teaching-staff';
