import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';

/** Case- and whitespace-insensitive identity of a Node type name. */
export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('es-CL');
}

/** A change to a Node type; an update without `name` changes only its appearance. */
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

/**
 * Whether a Node type change is allowed. A predefined Node type is immutable, a name is
 * unique among the predefined and Roadmap Node types once normalized, and a Node type is
 * not deleted while a Node uses it.
 *
 * @param nodeTypes the Node types available in the Roadmap: the predefined ones and its own.
 * @param nodes the Nodes to check for use of the Node type; only a deletion reads them.
 */
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
    if (!nodeType)
      return ruleRejection(
        'NODE_TYPE_NOT_FOUND',
        'El tipo no existe o no está disponible en este roadmap.',
      );
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
