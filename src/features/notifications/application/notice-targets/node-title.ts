import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import { nodeVisibleBefore, type NoticeTargetDescriptor } from './descriptor';

type NodeTitleFact = Extract<RoadmapChangeFact, { kind: 'node-title' }>;

/** Node title: whoever sees the Node is told, accessible or blocked (ADR-0014 decision 10). */
export const nodeTitleTarget: NoticeTargetDescriptor<NodeTitleFact> = {
  noticeTarget: 'node-title',
  noticeClass: 'roadmap-node-changed',
  readSide: { changeKind: 'node-updated', changedFields: ['title'], targetKind: 'node' },
  matches: (fact): fact is NodeTitleFact => fact.kind === 'node-title',
  target: (fact) => ({ targetKey: `node:${fact.nodeId}:title`, nodeId: fact.nodeId }),
  previousValue: (fact) => fact.previous,
  async knowers(fact, changes, roadmap) {
    if (!(await nodeVisibleBefore(fact.nodeId, changes, roadmap))) return [];
    return (await roadmap.participants()).map(({ userId }) => userId);
  },
  async audience(fact, changes, roadmap) {
    // Revealing a renamed Node is not a title change: nobody saw the previous title.
    if (!(await nodeVisibleBefore(fact.nodeId, changes, roadmap))) return [];
    if (!(await roadmap.node(fact.nodeId))?.isVisible) return [];
    return (await roadmap.participants()).map(({ userId }) => userId);
  },
  async current(target, roadmap) {
    const node = target.nodeId ? await roadmap.node(target.nodeId) : null;
    return node ? { value: node.title, visible: node.isVisible } : null;
  },
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
