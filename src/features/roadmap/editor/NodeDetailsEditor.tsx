import { Eye, EyeOff, LockKeyhole, LockKeyholeOpen, Save, Trash2, X } from 'lucide-react';
import type { RefObject } from 'react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type {
  Resource,
  RoadmapDto,
  RoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Separator } from '@/shared/ui/separator';
import { Switch } from '@/shared/ui/switch';
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
  isResourceComposerOpen: boolean;
  resourceMode: 'file' | 'link';
  selectedResourceFile: File | null;
  isDirty: boolean;
  onNodeChange: (value: NodeUpdate) => void;
  onResourceChange: (value: ResourceInput) => void;
  onResourceComposerOpen: (mode: 'file' | 'link') => void;
  onResourceComposerClose: () => void;
  onResourceModeChange: (mode: 'file' | 'link') => void;
  onSelectedResourceFileChange: (file: File | null) => void;
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
  onPreview: () => void;
  previewButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
};

function NodeHeader({ node, nodeTypes, onClose }: Pick<Props, 'node' | 'nodeTypes' | 'onClose'>) {
  const type = nodeTypes.find((nodeType) => nodeType.id === node.nodeTypeId);

  return (
    <header className="flex items-start justify-between gap-3 border-b border-border pt-8 pb-5">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.12em] text-primary uppercase">
          Nodo seleccionado
        </p>
        <div className="mt-1 flex min-w-0 items-start gap-3">
          {type ? (
            <NodeTypeIcon
              icon={type.icon}
              data-testid="node-type-icon"
              className="mt-1 size-5 shrink-0"
              style={{ color: type.color }}
              aria-hidden="true"
            />
          ) : null}
          <h2 className="min-w-0 font-heading text-2xl font-semibold tracking-[-0.035em] wrap-break-word">
            {node.title}
          </h2>
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
  isDirty,
  onPreview,
  previewButtonRef,
}: Pick<
  Props,
  | 'node'
  | 'nodeTypes'
  | 'nodeValue'
  | 'onNodeChange'
  | 'onUpdateNode'
  | 'isDirty'
  | 'onPreview'
  | 'previewButtonRef'
>) {
  const hasChanges =
    nodeValue.title !== node.title ||
    nodeValue.description !== (node.description ?? '') ||
    nodeValue.nodeTypeId !== node.nodeTypeId;
  const canSave = hasChanges && Boolean(nodeValue.title.trim());

  return (
    <form
      className="flex flex-col gap-4 py-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (canSave) await onUpdateNode(node.id, nodeValue);
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
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" disabled={!canSave}>
          <Save data-icon="inline-start" />
          Guardar cambios
        </Button>
        <Button
          ref={previewButtonRef}
          type="button"
          variant="outline"
          onClick={onPreview}
        >
          <Eye data-icon="inline-start" />
          {isDirty ? 'Previsualizar cambios' : 'Previsualizar'}
        </Button>
      </div>
    </form>
  );
}

function NodeStatus({
  node,
  onToggleVisibility,
  onRequestTeacherBlock,
}: Pick<Props, 'node' | 'onToggleVisibility' | 'onRequestTeacherBlock'>) {
  const accessStatus = node.isTeacherBlocked
    ? 'Acceso restringido por docencia'
    : 'Sin restricciones docentes';

  return (
    <section className="border-t border-border py-5">
      <div className="rounded-xl border border-border bg-cloud/55 p-1">
        <div>
          <h3 className="px-3 pt-3 font-heading text-base font-semibold">Estado del hito</h3>
          <p className="px-3 pt-0.5 text-sm text-muted-foreground">
            Define qué pueden ver y abrir las y los estudiantes.
          </p>
        </div>
        <FieldGroup className="gap-0 pt-3">
          <Field orientation="horizontal" className="rounded-lg px-3 py-3">
            <FieldContent>
              <FieldLabel htmlFor="node-visible">Visible para estudiantes</FieldLabel>
              <FieldDescription>
                {node.isVisible
                  ? 'El hito aparece en el roadmap de estudiantes.'
                  : 'El hito no aparece en el roadmap de estudiantes.'}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="node-visible"
              checked={node.isVisible}
              onCheckedChange={() => void onToggleVisibility(node.id, node.isVisible)}
            />
          </Field>
          <Separator className="mx-3 w-auto" />
          <div className="flex flex-col gap-3 rounded-lg px-3 py-3">
            <div className="flex items-start gap-2">
              {node.isVisible ? (
                node.isTeacherBlocked ? (
                  <LockKeyhole
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <LockKeyholeOpen
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )
              ) : (
                <EyeOff
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div>
                <FieldTitle>Acceso de estudiantes</FieldTitle>
                <FieldDescription>
                  {node.isVisible
                    ? accessStatus
                    : 'El acceso se habilitará cuando el hito sea visible.'}
                </FieldDescription>
              </div>
            </div>
            {node.isVisible &&
              (node.isTeacherBlocked ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRequestTeacherBlock(node.id, 'UNBLOCK')}
                    >
                      <LockKeyholeOpen data-icon="inline-start" />
                      Desbloquear este nodo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRequestTeacherBlock(node.id, 'BRANCH_UNLOCK')}
                    >
                      <LockKeyholeOpen data-icon="inline-start" />
                      Desbloquear rama
                    </Button>
                  </div>
                  <FieldDescription>
                    Si conserva un prerrequisito con bloqueo docente, no podrá desbloquearse de
                    forma individual.
                  </FieldDescription>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRequestTeacherBlock(node.id, 'BLOCK')}
                >
                  <LockKeyhole data-icon="inline-start" />
                  Restringir acceso
                </Button>
              ))}
          </div>
        </FieldGroup>
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
  isResourceComposerOpen,
  resourceMode,
  selectedResourceFile,
  isDirty,
  onNodeChange,
  onResourceChange,
  onResourceComposerOpen,
  onResourceComposerClose,
  onResourceModeChange,
  onSelectedResourceFileChange,
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
  onPreview,
  previewButtonRef,
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
        isDirty={isDirty}
        onPreview={onPreview}
        previewButtonRef={previewButtonRef}
      />
      <NodeStatus
        node={node}
        onToggleVisibility={onToggleVisibility}
        onRequestTeacherBlock={onRequestTeacherBlock}
      />
      <NodeDangerZone node={node} onDeleteNode={onDeleteNode} />
      <NodeResources
        node={node}
        resourceValue={resourceValue}
        editingResourceId={editingResourceId}
        isComposerOpen={isResourceComposerOpen}
        mode={resourceMode}
        selectedFile={selectedResourceFile}
        onResourceChange={onResourceChange}
        onComposerOpen={onResourceComposerOpen}
        onComposerClose={onResourceComposerClose}
        onModeChange={onResourceModeChange}
        onSelectedFileChange={onSelectedResourceFileChange}
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
