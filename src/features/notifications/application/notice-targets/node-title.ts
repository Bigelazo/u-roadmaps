import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import {
  isNodeViewer,
  nodeViewers,
  nodeVisibleBefore,
  nodeVisibleThroughout,
  type NoticeTargetDescriptor,
} from './descriptor';

export const nodeTitleRef = (nodeId: string) => ({
  noticeTarget: NOTICE_TARGET.nodeTitle,
  targetKey: `node:${nodeId}:title`,
  nodeId,
});

type NodeTitleFact = Extract<RoadmapChangeFact, { kind: 'node-title' }>;

/**
 * Node title: whoever sees the Node is told, accessible or blocked (ADR-0014 decision 10);
 * teaching staff see hidden Nodes too (decision 10, «Equipo docente»).
 */
export const nodeTitleTarget: NoticeTargetDescriptor<NodeTitleFact> = {
  noticeTarget: NOTICE_TARGET.nodeTitle,
  noticeClass: 'roadmap-node-changed',
  shownTo: 'node-viewers',
  matches: (fact): fact is NodeTitleFact => fact.kind === 'node-title',
  target: (fact) => nodeTitleRef(fact.nodeId),
  previousValue: (fact) => fact.previous,
  knowers: async (fact, changes, roadmap) =>
    nodeViewers(await nodeVisibleBefore(fact.nodeId, changes, roadmap), roadmap),
  // Revealing a renamed Node is not a title change to students: none saw the previous title.
  audience: async (fact, changes, roadmap) =>
    nodeViewers(await nodeVisibleThroughout(fact.nodeId, changes, roadmap), roadmap),
  async current(target, roadmap, recipientId) {
    const node = await (target.nodeId ? roadmap.node(target.nodeId) : null);
    if (!node) return null;
    return { value: node.title, visible: await isNodeViewer(node.isVisible, recipientId, roadmap) };
  },
  entryValues: async (roadmap) =>
    (await roadmap.nodes()).map((node) => ({
      target: nodeTitleRef(node.id),
      currentValue: node.title,
    })),
  wording: ({ knownValue, currentValue }) => ({
    subject: currentValue,
    body: `«${knownValue}» pasó a llamarse «${currentValue}».`,
    summaryGroup: 'node',
  }),
  apiData: ({ knownValue, currentValue }) => ({
    nodeTitle: currentValue,
    knownTitle: knownValue,
    currentTitle: currentValue,
  }),
};
