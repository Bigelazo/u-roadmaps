import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';
import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { cn } from 'cn';
import {
  CalendarClock,
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
  PencilLine,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Separator } from '@/shared/ui/separator';
import { NodeDescriptionField, NodeTitleField, NodeTypeField } from './NodeContentFields';
import { NodeResources } from './NodeResources';
import { useNodeEditorContext } from './context';
import { NodePanelHeader } from '@/features/roadmap/ui/NodePanelHeader';
import { NodeFullscreenDialog } from '@/features/roadmap/ui/NodeFullscreenDialog';
import {
  scheduledUnlockPrerequisiteHint,
  UnlockDateTimePicker,
} from '@/features/roadmap/ui/UnlockScheduleField';

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
        <>
          <NodeFullscreenDialog
            key={node.id}
            title="Editar nodo"
            triggerLabel="Editar nodo en pantalla completa"
          >
            <NodeForm />
          </NodeFullscreenDialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Deseleccionar nodo"
                  onClick={closeNode}
                >
                  <X />
                </Button>
              }
            />
            <TooltipContent>Deseleccionar nodo</TooltipContent>
          </Tooltip>
        </>
      }
    />
  );
}

const unsavedFieldLabels = { title: 'título', description: 'contenido', nodeTypeId: 'tipo' };

function listInProse(items: readonly string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0];
}

function useNodeSubmission(idPrefix: string) {
  const { node, nodeDraft, canSaveNode, saveNode, discardNodeDraft } = useNodeEditorContext();
  const [titleErrorNodeId, setTitleErrorNodeId] = useState<string | null>(null);
  const titleError =
    titleErrorNodeId === node.id && !nodeDraft.title.trim()
      ? 'Escribe un título para el nodo.'
      : undefined;

  return {
    titleError,
    submit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSaveNode) return;
      if (!nodeDraft.title.trim()) {
        setTitleErrorNodeId(node.id);
        document.getElementById(`${idPrefix}-title`)?.focus();
        return;
      }
      saveNode();
    },
    discard: () => {
      setTitleErrorNodeId(null);
      discardNodeDraft();
    },
  };
}

function useNodeFieldProps(idPrefix: string) {
  const { nodeDraft, changeNodeDraft } = useNodeEditorContext();
  return {
    idPrefix,
    value: nodeDraft,
    onChange: (patch: Partial<typeof nodeDraft>) => changeNodeDraft({ ...nodeDraft, ...patch }),
  };
}

function UnsavedChanges({ onDiscard }: { onDiscard: () => void }) {
  const { unsavedFields } = useNodeEditorContext();

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg bg-primary-soft/45 py-1 pr-1 pl-3 text-sm text-primary-deep',
        unsavedFields.length === 0 && 'hidden',
      )}
    >
      <p aria-live="polite" className="flex min-w-0 items-center gap-2">
        {unsavedFields.length > 0 ? (
          <>
            <PencilLine aria-hidden="true" className="size-4 shrink-0" />
            <span>
              <span className="font-semibold">Sin guardar:</span>{' '}
              {listInProse(unsavedFields.map((field) => unsavedFieldLabels[field]))}
            </span>
          </>
        ) : null}
      </p>
      {unsavedFields.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-primary-deep hover:bg-primary-soft"
          onClick={onDiscard}
        >
          Descartar
        </Button>
      ) : null}
    </div>
  );
}

function SaveButton() {
  const { canSaveNode } = useNodeEditorContext();
  return (
    <Button type="submit" disabled={!canSaveNode}>
      <Save data-icon="inline-start" />
      Guardar cambios
    </Button>
  );
}

function NodeForm() {
  const { nodeTypes } = useNodeEditorContext();
  const idPrefix = 'fullscreen-node';
  const field = useNodeFieldProps(idPrefix);
  const { titleError, submit, discard } = useNodeSubmission(idPrefix);

  return (
    <form
      noValidate
      className="flex flex-col gap-4 [--markdown-editor-min-height:50dvh]"
      onSubmit={submit}
    >
      <FieldGroup>
        <NodeTitleField {...field} error={titleError} />
        <NodeTypeField {...field} nodeTypes={nodeTypes} />
        <NodeDescriptionField {...field} />
      </FieldGroup>
      <UnsavedChanges onDiscard={discard} />
      <SaveButton />
    </form>
  );
}

function NodeUnlockSchedule({ scheduledAt }: { scheduledAt: string | null }) {
  const { blockedPrerequisites, scheduleTeacherUnlock } = useNodeEditorContext();
  const [draft, setDraft] = useState(scheduledAt ? new Date(scheduledAt) : null);
  const canSchedule = draft !== null && draft.toISOString() !== scheduledAt;

  return (
    <form
      className="flex flex-col gap-2 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSchedule && draft.getTime() > Date.now()) scheduleTeacherUnlock(draft.toISOString());
      }}
    >
      <Field>
        <div className="flex items-center gap-2.5">
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <FieldLabel htmlFor="node-unlock-date" className="font-semibold">
            Desbloqueo programado
          </FieldLabel>
        </div>
        <UnlockDateTimePicker id="node-unlock-date" value={draft} onValueChange={setDraft} />
        <FieldDescription>{scheduledUnlockPrerequisiteHint(blockedPrerequisites)}</FieldDescription>
        <div className="flex flex-wrap justify-end gap-2">
          {scheduledAt && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => scheduleTeacherUnlock(null)}
            >
              Quitar programación
            </Button>
          )}
          <Button type="submit" variant="outline" size="sm" disabled={!canSchedule}>
            {scheduledAt ? 'Reprogramar' : 'Programar'}
          </Button>
        </div>
      </Field>
    </form>
  );
}

function AccessRow({
  Icon,
  label,
  description,
  action,
  children,
}: {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 py-3">
      <Icon className="size-4 text-muted-foreground" />
      <p className="text-sm font-semibold">{label}</p>
      {action ?? <span />}
      <p className="col-span-2 col-start-2 text-sm text-muted-foreground">{description}</p>
      {children ? <div className="col-span-3 pt-2">{children}</div> : null}
    </div>
  );
}

function NodeVisibility() {
  const { node, isVisibilityPending, toggleVisibility } = useNodeEditorContext();

  return (
    <AccessRow
      Icon={node.isVisible ? Eye : EyeOff}
      label={node.isVisible ? 'Visible para estudiantes' : 'Oculto para estudiantes'}
      description={
        node.isVisible
          ? 'Al ocultarlo se eliminarán sus conexiones con otros nodos.'
          : 'Al mostrarlo aparecerá sin conexiones ni bloqueo docente.'
      }
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={isVisibilityPending}
          onClick={toggleVisibility}
        >
          {node.isVisible ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
          {node.isVisible ? 'Ocultar' : 'Mostrar'}
        </Button>
      }
    />
  );
}

function NodeTeacherBlock() {
  const { node, requestTeacherBlock } = useNodeEditorContext();
  const TeacherBlockIcon = node.isTeacherBlocked ? LockKeyholeOpen : LockKeyhole;

  return (
    <AccessRow
      Icon={node.isVisible && node.isTeacherBlocked ? LockKeyhole : LockKeyholeOpen}
      label={
        !node.isVisible
          ? 'Sin acceso mientras esté oculto'
          : node.isTeacherBlocked
            ? 'Bloqueado por docencia'
            : 'Sin bloqueo docente'
      }
      description={
        !node.isVisible
          ? 'Podrás bloquearlo cuando sea visible.'
          : node.isTeacherBlocked
            ? 'Los estudiantes no pueden abrirlo, ni tampoco los nodos que dependen de él.'
            : 'Al bloquearlo, también se bloquearán los nodos que dependen de él.'
      }
      action={
        node.isVisible ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => requestTeacherBlock(node.isTeacherBlocked ? 'UNBLOCK' : 'BLOCK')}
          >
            <TeacherBlockIcon data-icon="inline-start" />
            {node.isTeacherBlocked ? 'Desbloquear' : 'Bloquear nodo'}
          </Button>
        ) : undefined
      }
    >
      {node.isVisible && node.isTeacherBlocked && (
        <NodeUnlockSchedule
          key={`${node.id}:${node.teacherUnlockAt ?? ''}`}
          scheduledAt={node.teacherUnlockAt ?? null}
        />
      )}
    </AccessRow>
  );
}

function NodeStatus() {
  return (
    <section aria-labelledby="node-access-heading" className="border-t border-border pt-5 pb-2">
      <h3 id="node-access-heading" className="font-heading text-base font-semibold">
        Acceso de estudiantes
      </h3>
      <NodeVisibility />
      <Separator />
      <NodeTeacherBlock />
    </section>
  );
}

function NodeDangerZone() {
  const { node, requestNodeDeletion } = useNodeEditorContext();
  const resourceCount = node.resources.length;

  return (
    <section className="border-t border-border py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold">Eliminar nodo</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {resourceCount === 1
              ? 'Se eliminará con su recurso y sus conexiones.'
              : resourceCount > 1
                ? `Se eliminará con sus ${resourceCount} recursos y sus conexiones.`
                : 'Se eliminará con sus conexiones.'}
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={requestNodeDeletion}
        >
          <Trash2 data-icon="inline-start" />
          Eliminar
        </Button>
      </div>
    </section>
  );
}

const panelFormId = 'edit-node-form';

export function NodeDetailsEditor() {
  const { nodeTypes, isDirty, previewNodeInformation, previewButtonRef } = useNodeEditorContext();
  const idPrefix = 'edit-node';
  const field = useNodeFieldProps(idPrefix);
  const { titleError, submit, discard } = useNodeSubmission(idPrefix);

  return (
    <div className="flex flex-1 flex-col">
      <NodeHeader />
      <div className="flex-1 px-6">
        <FieldGroup className="py-5">
          <NodeTitleField {...field} error={titleError} form={panelFormId} />
          <NodeTypeField {...field} nodeTypes={nodeTypes} />
        </FieldGroup>
        <NodeResources />
        <NodeStatus />
        <NodeDangerZone />
        <section className="border-t border-border pt-5 pb-6">
          <NodeDescriptionField {...field} />
        </section>
      </div>
      <form
        id={panelFormId}
        noValidate
        aria-label="Guardar nodo"
        onSubmit={submit}
        className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-card px-6 py-3 shadow-[0_-6px_12px_-10px_rgb(0_0_0/0.25)]"
      >
        <UnsavedChanges onDiscard={discard} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-2">
          <SaveButton />
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
    </div>
  );
}
