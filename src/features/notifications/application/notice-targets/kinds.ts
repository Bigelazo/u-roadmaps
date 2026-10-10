/**
 * Every Notice target kind, spelled once: stored as `data.noticeTarget` and
 * `NoticeKnownValue.noticeTarget`, shared by each kind's descriptor and target refs.
 */
export const NOTICE_TARGET = {
  nodeTitle: 'node-title',
  nodeDescription: 'node-description',
  nodeType: 'node-type',
  resource: 'resource',
  dependency: 'dependency',
  nodeTypeName: 'node-type-name',
  nodeAccess: 'node-access',
  nodeCreation: 'node-creation',
  nodeDeletion: 'node-deletion',
  roadmapAvailability: 'roadmap-availability',
} as const;
