import { Eye, EyeOff, LockKeyhole, LockKeyholeOpen, Save, Trash2, X } from 'lucide-react';
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
import { useNodeEditorContext } from './context';
import { NodePanelHeader } from '@/features/roadmap/ui/NodePanelHeader';

function NodeHeader() {
  const { node, nodeTypes, closeNode } = useNodeEditorContext();
  const type = nodeTypes.find((nodeType) => nodeType.id === node.nodeTypeId);

  return (
    <NodePanelHeader
      title={node.title}
      nodeType={type}
      iconTestId="node-type-icon"
      isSidebar
      actions={
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Deseleccionar nodo"
          title="Deseleccionar nodo"
          onClick={closeNode}
        >
          <X />
        </Button>
      }
    />
  );
}

function NodeForm() {
  const {
    nodeTypes,
    nodeDraft,
    isDirty,
    canSaveNode,
    changeNodeDraft,
    saveNode,
    previewNodeInformation,
    previewButtonRef,
  } = useNodeEditorContext();

  return (
    <form
      className="flex flex-col gap-4 py-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSaveNode) saveNode();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="edit-node-title">Título</FieldLabel>
          <Input
            id="edit-node-title"
            className={inputClassName}
            value={nodeDraft.title}
            onChange={(event) => changeNodeDraft({ ...nodeDraft, title: event.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="edit-node-description">
            Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Textarea
            id="edit-node-description"
            value={nodeDraft.description}
            onChange={(event) => changeNodeDraft({ ...nodeDraft, description: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="edit-node-type">Tipo</FieldLabel>
          <NodeTypeSelect
            id="edit-node-type"
            nodeTypes={nodeTypes}
            value={nodeDraft.nodeTypeId}
            onValueChange={(nodeTypeId) => changeNodeDraft({ ...nodeDraft, nodeTypeId })}
          />
        </Field>
      </FieldGroup>
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" disabled={!canSaveNode}>
          <Save data-icon="inline-start" />
          Guardar cambios
        </Button>
        <Button
          ref={previewButtonRef}
          type="button"
          variant="outline"
          onClick={previewNodeInformation}
        >
          <Eye data-icon="inline-start" />
          {isDirty ? 'Previsualizar cambios' : 'Previsualizar'}
        </Button>
      </div>
    </form>
  );
}

function NodeStatus() {
  const { node, isVisibilityPending, toggleVisibility, requestTeacherBlock } =
    useNodeEditorContext();
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
              disabled={isVisibilityPending}
              onCheckedChange={toggleVisibility}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestTeacherBlock('UNBLOCK')}
                >
                  <LockKeyholeOpen data-icon="inline-start" />
                  Desbloquear
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestTeacherBlock('BLOCK')}
                >
                  <LockKeyhole data-icon="inline-start" />
                  Bloquear rama
                </Button>
              ))}
          </div>
        </FieldGroup>
      </div>
    </section>
  );
}

function NodeDangerZone() {
  const { requestNodeDeletion } = useNodeEditorContext();

  return (
    <section className="border-t border-border py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.12em] text-destructive uppercase">
            Zona de peligro
          </p>
          <h3 className="mt-0.5 font-heading text-base font-semibold">Eliminar este nodo</h3>
        </div>
        <Button type="button" variant="destructive" size="sm" onClick={requestNodeDeletion}>
          <Trash2 data-icon="inline-start" />
          Eliminar
        </Button>
      </div>
    </section>
  );
}

export function NodeDetailsEditor() {
  return (
    <div>
      <NodeHeader />
      <div className="px-6">
        <NodeForm />
        <NodeStatus />
        <NodeDangerZone />
        <NodeResources />
      </div>
    </div>
  );
}
