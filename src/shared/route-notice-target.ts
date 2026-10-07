/** The ordered pair survives removal and replacement of a Dependency. */
export function dependencyTarget(sourceNodeId: string, targetNodeId: string) {
  return `dependency:${sourceNodeId}:${targetNodeId}`;
}

export function nodeTypeNameTarget(nodeTypeId: string) {
  return `node-type:${nodeTypeId}:name`;
}
