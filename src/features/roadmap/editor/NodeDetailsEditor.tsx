import { LockKeyhole, LockKeyholeOpen, Save, Trash2, X } from 'lucide-react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type {
  Resource,
  RoadmapDto,
  RoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
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
  onRequestTeacherBlock: (nodeId: string, operation: TeacherBlockOperation) => void;
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
      <div className="flex min-w-0 items-start gap-3">
        {type ? (
          <NodeTypeIcon
            icon={type.icon}
            className="mt-1 size-5 shrink-0"
            style={{ color: type.color }}
            aria-hidden="true"
          />
        ) : null}
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

function NodeTeacherBlock({
  node,
  onRequestTeacherBlock,
}: Pick<Props, 'node' | 'onRequestTeacherBlock'>) {
  if (!node.isVisible) return null;

  return (
    <section className="border-t border-border py-5">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold">Acceso de estudiantes</h3>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            {node.isTeacherBlocked ? (
              <LockKeyhole aria-hidden="true" />
            ) : (
              <LockKeyholeOpen aria-hidden="true" />
            )}
            {node.isTeacherBlocked ? 'Bloqueado por docencia' : 'Sin bloqueo docente'}
          </p>
        </div>
        {node.isTeacherBlocked ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRequestTeacherBlock(node.id, 'UNBLOCK')}
              >
                <LockKeyholeOpen className="size-6" data-icon="inline-start" />
                Desbloquear este nodo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRequestTeacherBlock(node.id, 'BRANCH_UNLOCK')}
              >
                <LockKeyholeOpen className="size-6" data-icon="inline-start" />
                Desbloquear rama
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Si conserva un prerrequisito con bloqueo docente, no podrá desbloquearse de forma
              individual.
            </p>
          </div>
        ) : (
          <div>
            <Button type="button" size="sm" onClick={() => onRequestTeacherBlock(node.id, 'BLOCK')}>
              <LockKeyhole className="size-6" data-icon="inline-start" />
              Bloquear acceso
            </Button>
          </div>
        )}
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
  onRequestTeacherBlock,
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
      <NodeTeacherBlock node={node} onRequestTeacherBlock={onRequestTeacherBlock} />
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
