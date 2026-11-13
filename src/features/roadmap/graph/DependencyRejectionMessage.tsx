import { NodeName } from '@/features/roadmap/ui/NodeName';
import type { ConnectionRejection } from '@/features/roadmap/graph/use-whole-node-connection';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';

function FlowNodeName({ node }: { node: RoadmapFlowNode }) {
  return (
    <NodeName
      title={node.data.title}
      nodeType={{ name: node.data.typeName, icon: node.data.typeIcon, color: node.data.typeColor }}
      className="wrap-break-word"
    />
  );
}

export function DependencyRejectionMessage({ reason, source, target }: ConnectionRejection) {
  switch (reason) {
    case 'DEPENDENCY_CYCLE':
      return (
        <>
          <FlowNodeName node={target} /> ya es prerrequisito de <FlowNodeName node={source} /> y se
          formaría un ciclo.
        </>
      );
    case 'DEPENDENCY_CONFLICT':
      return (
        <>
          <FlowNodeName node={source} /> ya es prerrequisito de <FlowNodeName node={target} />.
        </>
      );
    case 'HIDDEN_NODE_DEPENDENCY_FORBIDDEN':
      return (
        <>
          <FlowNodeName node={source.data.isHidden ? source : target} /> está oculto para
          estudiantes. Muéstralo para conectarlo.
        </>
      );
  }
}
