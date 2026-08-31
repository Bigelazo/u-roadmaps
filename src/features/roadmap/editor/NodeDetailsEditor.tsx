import { Save, Trash2, X } from 'lucide-react';
import type { Resource, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { inputClassName, NodeTypeSelect } from './primitives';
import { NodeResources } from './NodeResources';
import type { NodeUpdate, ResourceInput } from './types';

type Props = {
  node: RoadmapNode;
  nodeTypes: RoadmapDto['nodeTypes'];
  nodeValue: NodeUpdate;
  resourceValue: ResourceInput;
  editingResourceId: string | null;
  onNodeChange: (value: NodeUpdate) => void;
  onResourceChange: (value: ResourceInput) => void;
  onUpdateNode: (nodeId: string, node: NodeUpdate) => Promise<boolean>;
  onToggleVisibility: (nodeId: string, isVisible: boolean) => Promise<boolean>;
  onAddResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  onUploadResource: (nodeId: string, file: File) => Promise<boolean>;
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  onStartEditingResource: (resource: Resource) => void;
  onCancelResource: () => void;
  onDeleteNode: (node: RoadmapNode) => void;
  onDeleteResource: (resource: Resource) => void;
  onClose: () => void;
};

function NodeHeader({ node, nodeTypes, onClose }: Pick<Props, 'node' | 'nodeTypes' | 'onClose'>) {
  const type = nodeTypes.find((nodeType) => nodeType.id === node.nodeTypeId);

  return (
    <header className="flex items-start justify-between gap-3 border-b border-border pb-5">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.12em] text-primary uppercase">
          Nodo seleccionado
        </p>
        <h2 className="mt-1 truncate font-heading text-2xl font-semibold tracking-[-0.035em]">
          {node.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {type ? type.name : 'Configura este hito del mapa.'}
        </p>
      </div>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label="Deseleccionar nodo"
        title="Deseleccionar nodo"
        onClick={onClose}
      >
        <X />
      </Button>
    </header>
  );
}

function NodeForm({
  node,
  nodeTypes,
  nodeValue,
  onNodeChange,
  onUpdateNode,
}: Pick<Props, 'node' | 'nodeTypes' | 'nodeValue' | 'onNodeChange' | 'onUpdateNode'>) {
  return (
    <form
      className="flex flex-col gap-4 py-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (nodeValue.title.trim()) await onUpdateNode(node.id, nodeValue);
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="edit-node-title">Título</FieldLabel>
          <Input
            id="edit-node-title"
            className={inputClassName}
            value={nodeValue.title}
            onChange={(event) => onNodeChange({ ...nodeValue, title: event.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="edit-node-description">
            Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Textarea
            id="edit-node-description"
            value={nodeValue.description}
            onChange={(event) => onNodeChange({ ...nodeValue, description: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="edit-node-type">Tipo</FieldLabel>
          <NodeTypeSelect
            id="edit-node-type"
            nodeTypes={nodeTypes}
            value={nodeValue.nodeTypeId}
            onValueChange={(nodeTypeId) => onNodeChange({ ...nodeValue, nodeTypeId })}
          />
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-full">
        <Save data-icon="inline-start" />
        Guardar cambios
      </Button>
    </form>
  );
}

function NodeAvailability({
  node,
  onToggleVisibility,
}: Pick<Props, 'node' | 'onToggleVisibility'>) {
  return (
    <section className="border-t border-border py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold">Disponibilidad</h3>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`size-2 shrink-0 rounded-full ${node.isVisible ? 'bg-progress' : 'bg-steel'}`}
            />
            {node.isVisible ? 'Visible para estudiantes' : 'Oculto para estudiantes'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onToggleVisibility(node.id, node.isVisible)}
        >
          {node.isVisible ? 'Ocultar' : 'Mostrar'}
        </Button>
      </div>
    </section>
  );
}

function NodeDangerZone({ node, onDeleteNode }: Pick<Props, 'node' | 'onDeleteNode'>) {
  return (
    <section className="border-t border-border py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.12em] text-destructive uppercase">
            Zona de peligro
          </p>
          <h3 className="mt-0.5 font-heading text-base font-semibold">Eliminar este nodo</h3>
        </div>
        <Button type="button" variant="destructive" size="sm" onClick={() => onDeleteNode(node)}>
          <Trash2 data-icon="inline-start" />
          Eliminar
        </Button>
      </div>
    </section>
  );
}

export function NodeDetailsEditor({
  node,
  nodeTypes,
  nodeValue,
  resourceValue,
  editingResourceId,
  onNodeChange,
  onResourceChange,
  onUpdateNode,
  onToggleVisibility,
  onAddResource,
  onUploadResource,
  onUpdateResource,
  onStartEditingResource,
  onCancelResource,
  onDeleteNode,
  onDeleteResource,
  onClose,
}: Props) {
  return (
    <div>
      <NodeHeader node={node} nodeTypes={nodeTypes} onClose={onClose} />
      <NodeForm
        node={node}
        nodeTypes={nodeTypes}
        nodeValue={nodeValue}
        onNodeChange={onNodeChange}
        onUpdateNode={onUpdateNode}
      />
      <NodeAvailability node={node} onToggleVisibility={onToggleVisibility} />
      <NodeDangerZone node={node} onDeleteNode={onDeleteNode} />
      <NodeResources
        node={node}
        resourceValue={resourceValue}
        editingResourceId={editingResourceId}
        onResourceChange={onResourceChange}
        onAddResource={onAddResource}
        onUploadResource={onUploadResource}
        onUpdateResource={onUpdateResource}
        onStartEditingResource={onStartEditingResource}
        onCancelResource={onCancelResource}
        onDeleteResource={onDeleteResource}
      />
    </div>
  );
}
