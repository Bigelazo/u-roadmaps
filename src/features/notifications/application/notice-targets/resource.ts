import { NOTICE_TARGET } from './kinds';
import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import {
  isNodeViewer,
  nodeOpeners,
  type NoticeTargetDescriptor,
  type TargetValues,
} from './descriptor';

export const resourceRef = (resourceId: string, nodeId: string) => ({
  noticeTarget: NOTICE_TARGET.resource,
  targetKey: `resource:${resourceId}`,
  nodeId,
});

type ResourceFact = Extract<RoadmapChangeFact, { kind: 'resource' }>;
type ResourceState = Readonly<{ title: string; revision: string }>;

export function resourceValue(state: ResourceState | null) {
  return JSON.stringify(state && { title: state.title, revision: state.revision });
}

function decode(value: string): ResourceState | null {
  const state: unknown = JSON.parse(value);
  if (state === null) return null;
  if (
    !state ||
    typeof state !== 'object' ||
    typeof (state as ResourceState).title !== 'string' ||
    typeof (state as ResourceState).revision !== 'string'
  )
    throw new Error('Invalid Resource Known value.');
  return state as ResourceState;
}

function lifecycle({ knownValue, currentValue, context }: TargetValues) {
  const known = decode(knownValue);
  const current = decode(currentValue);
  const change = !known ? 'added' : !current ? 'removed' : 'updated';
  const resourceTitle = (known ?? current)!.title;
  const titleChange =
    known && current && known.title !== current.title
      ? `«${known.title}» ahora se llama «${current.title}».`
      : null;
  const nodeTitle = typeof context.nodeTitle === 'string' ? context.nodeTitle : '';
  return { known, current, change, resourceTitle, titleChange, nodeTitle } as const;
}

export const resourceTarget: NoticeTargetDescriptor<ResourceFact> = {
  noticeTarget: NOTICE_TARGET.resource,
  noticeClass: 'roadmap-resource-changed',
  shownTo: 'node-openers',
  matches: (fact): fact is ResourceFact => fact.kind === 'resource',
  target: (fact) => resourceRef(fact.resourceId, fact.nodeId),
  previousValue: (fact) => resourceValue(fact.previous),
  knowers: (fact, _changes, roadmap) => nodeOpeners(true, fact.nodeId, roadmap),
  audience: (fact, _changes, roadmap) => nodeOpeners(true, fact.nodeId, roadmap),
  async current(target, roadmap, recipientId) {
    const node = await (target.nodeId ? roadmap.node(target.nodeId) : null);
    if (!node) return null;
    const resourceId = target.targetKey.slice('resource:'.length);
    const resource = await roadmap.resource(resourceId);
    return {
      value: resourceValue(resource?.nodeId === node.id ? resource : null),
      visible: await isNodeViewer(node.isVisible, recipientId, roadmap),
      context: { resourceId, nodeTitle: node.title },
    };
  },
  async entryValues(roadmap, recipientId, known) {
    const [accessible, nodes, resources] = await Promise.all([
      roadmap.accessibleNodeIds(recipientId),
      roadmap.nodes(),
      roadmap.resources(),
    ]);
    const nodeIds = new Set(nodes.map(({ id }) => id));
    const knownKeys = new Set(known.map(({ targetKey }) => targetKey));
    const shown = resources.flatMap((resource) => {
      const target = resourceRef(resource.id, resource.nodeId);
      if (!accessible.has(resource.nodeId) && !knownKeys.has(target.targetKey)) return [];
      return [{ target, currentValue: resourceValue(resource) }];
    });
    const present = new Set(
      resources.map((resource) => resourceRef(resource.id, resource.nodeId).targetKey),
    );
    const removed = known
      .filter(({ targetKey, nodeId }) => nodeId && nodeIds.has(nodeId) && !present.has(targetKey))
      .map((target) => ({ target, currentValue: resourceValue(null) }));
    return [...shown, ...removed];
  },
  wording(values) {
    const { change, resourceTitle, titleChange, nodeTitle } = lifecycle(values);
    const inNode = (preposition: string, withNode: boolean) =>
      withNode ? ` ${preposition} «${nodeTitle}»` : '';
    const sentence = (withNode: boolean) =>
      change === 'added'
        ? `Nuevo recurso «${resourceTitle}»${inNode('en', withNode)}.`
        : change === 'removed'
          ? `Se eliminó el recurso «${resourceTitle}»${inNode('de', withNode)}.`
          : `Se actualizó el recurso «${resourceTitle}»${inNode('en', withNode)}.${titleChange ? ` ${titleChange}` : ''}`;
    return {
      subject: resourceTitle,
      body: sentence(true),
      summaryGroup: 'node',
      summary: sentence(false),
    };
  },
  apiData(values) {
    const { known, current, resourceTitle, titleChange, nodeTitle } = lifecycle(values);
    return {
      resourceId: values.context.resourceId,
      resourceTitle,
      titleChange,
      nodeTitle,
      knownResource: known,
      currentResource: current,
    };
  },
};
