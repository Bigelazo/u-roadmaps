import type { RoadmapChangeFact } from '@/shared/roadmap-changes';
import type { NoticeTargetDescriptor, RoadmapView, TargetValues } from './descriptor';

type ResourceFact = Extract<RoadmapChangeFact, { kind: 'resource' }>;
type ResourceState = Readonly<{ title: string; revision: string }>;

/** A Resource is one unit: absent, or present with its title and opaque content revision. */
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

/** Description and Resources reach only who has the Node accessible (ADR-0014 decision 10). */
async function accessibleRecipients(nodeId: string, roadmap: RoadmapView) {
  const recipients: string[] = [];
  for (const { userId } of await roadmap.participants())
    if ((await roadmap.accessibleNodeIds(userId)).has(nodeId)) recipients.push(userId);
  return recipients;
}

/**
 * The Resource lifecycle composes while pending (ADR-0014 decision 1): added then
 * edited is new with its current title, added then removed returns to absent, and
 * an edit details only a title change.
 */
function lifecycle({ knownValue, currentValue, context }: TargetValues) {
  const known = decode(knownValue);
  const current = decode(currentValue);
  const changeKind = !known ? 'resource-added' : !current ? 'resource-removed' : 'resource-updated';
  const resourceTitle = (known ?? current)!.title;
  const titleChange =
    known && current && known.title !== current.title
      ? `«${known.title}» ahora se llama «${current.title}».`
      : null;
  const nodeTitle = typeof context.nodeTitle === 'string' ? context.nodeTitle : '';
  return { known, current, changeKind, resourceTitle, titleChange, nodeTitle } as const;
}

export const resourceTarget: NoticeTargetDescriptor<ResourceFact> = {
  noticeTarget: 'resource',
  noticeClass: 'roadmap-resource-changed',
  readSide: { changeKind: 'resource-updated', changedFields: [], targetKind: 'node' },
  valueReadSide: (values) => ({ changeKind: lifecycle(values).changeKind }),
  matches: (fact): fact is ResourceFact => fact.kind === 'resource',
  target: (fact) => ({ targetKey: `resource:${fact.resourceId}`, nodeId: fact.nodeId }),
  previousValue: (fact) => resourceValue(fact.previous),
  knowers: (fact, _changes, roadmap) => accessibleRecipients(fact.nodeId, roadmap),
  audience: (fact, _changes, roadmap) => accessibleRecipients(fact.nodeId, roadmap),
  async current(target, roadmap) {
    const node = target.nodeId ? await roadmap.node(target.nodeId) : null;
    if (!node) return null;
    const resourceId = target.targetKey.slice('resource:'.length);
    const resource = await roadmap.resource(resourceId);
    return {
      value: resourceValue(resource?.nodeId === node.id ? resource : null),
      visible: node.isVisible,
      context: { resourceId, nodeTitle: node.title },
    };
  },
  wording(values) {
    const { changeKind, resourceTitle, titleChange, nodeTitle } = lifecycle(values);
    return {
      subject: resourceTitle,
      body:
        changeKind === 'resource-added'
          ? `Nuevo recurso «${resourceTitle}» en «${nodeTitle}».`
          : changeKind === 'resource-removed'
            ? `Se eliminó el recurso «${resourceTitle}» de «${nodeTitle}».`
            : `Se actualizó el recurso «${resourceTitle}» en «${nodeTitle}».${titleChange ? ` ${titleChange}` : ''}`,
      summaryGroup: 'node',
    };
  },
  apiData(values) {
    const { known, current, changeKind, resourceTitle, titleChange, nodeTitle } = lifecycle(values);
    return {
      changeKind,
      resourceId: values.context.resourceId,
      resourceTitle,
      titleChange,
      nodeTitle,
      knownResource: known,
      currentResource: current,
    };
  },
};
