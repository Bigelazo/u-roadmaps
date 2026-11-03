import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';

export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('es-CL');
}

export type NodeTypeChange =
  | { kind: 'create'; name: string }
  | { kind: 'update'; nodeTypeId: string; name?: string }
  | { kind: 'delete'; nodeTypeId: string };

export type NodeTypeRuleFailure =
  | 'NODE_TYPE_NOT_FOUND'
  | 'PREDEFINED_TYPE_IMMUTABLE'
  | 'NODE_TYPE_NAME_CONFLICT'
  | 'NODE_TYPE_IN_USE';

export type NodeTypeDecision = { kind: 'ALLOWED' } | RuleRejection<NodeTypeRuleFailure>;

export function nodeTypeNotFound() {
  return ruleRejection(
    'NODE_TYPE_NOT_FOUND',
    'El tipo no existe o no está disponible en este roadmap.',
  );
}

/** A Node may only take a Node type available in its Roadmap: a predefined one or one of the Roadmap. */
export function decideNodeTypeAssignment({
  nodeTypes,
  nodeTypeId,
}: {
  nodeTypes: readonly { id: string }[];
  nodeTypeId: string;
}): { kind: 'ALLOWED' } | RuleRejection<'NODE_TYPE_NOT_FOUND'> {
  return nodeTypes.some(({ id }) => id === nodeTypeId) ? { kind: 'ALLOWED' } : nodeTypeNotFound();
}

export function decideNodeTypeChange({
  nodeTypes,
  nodes,
  change,
}: {
  nodeTypes: readonly { id: string; name: string; isPredefined: boolean }[];
  nodes: readonly { nodeTypeId: string }[];
  change: NodeTypeChange;
}): NodeTypeDecision {
  const changedId = change.kind === 'create' ? null : change.nodeTypeId;
  if (changedId !== null) {
    const nodeType = nodeTypes.find(({ id }) => id === changedId);
    if (!nodeType) return nodeTypeNotFound();
    if (nodeType.isPredefined)
      return ruleRejection('PREDEFINED_TYPE_IMMUTABLE', 'Los tipos predefinidos son inmutables.');
  }
  if (change.kind === 'delete')
    return nodes.some(({ nodeTypeId }) => nodeTypeId === changedId)
      ? ruleRejection('NODE_TYPE_IN_USE', 'No se puede eliminar un tipo utilizado por nodos.')
      : { kind: 'ALLOWED' };
  const { name } = change;
  if (
    name !== undefined &&
    nodeTypes.some(
      (nodeType) =>
        nodeType.id !== changedId && normalizeName(nodeType.name) === normalizeName(name),
    )
  )
    return ruleRejection('NODE_TYPE_NAME_CONFLICT', 'Ya existe un tipo disponible con ese nombre.');
  return { kind: 'ALLOWED' };
}
