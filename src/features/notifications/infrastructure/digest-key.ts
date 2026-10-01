export function buildNotificationDigestKey(roadmapId: string, nodeId?: string) {
  return nodeId ? `roadmap:${roadmapId}:node:${nodeId}` : `roadmap:${roadmapId}:general`;
}
