import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';
import { useState, type ComponentType, type ReactNode } from 'react';
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
import { addCalendarDays, chileCalendarDay } from '@/features/roadmap/domain/scheduled-unlock';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Separator } from '@/shared/ui/separator';
import { SidebarHeader } from '@/shared/ui/sidebar';
import { NodeContentFields } from './NodeContentFields';
import { NodeResources } from './NodeResources';
import { useNodeEditorContext } from './context';
import { NodeFullscreenDialog } from '@/features/roadmap/ui/NodeFullscreenDialog';

type NodeStatusChip = { id: string; Icon: ComponentType<{ className?: string }>; label: string };

function nodeStatusChips(node: ReturnType<typeof useNodeEditorContext>['node']) {
  const chips: NodeStatusChip[] = [
    node.isVisible
      ? { id: 'visible', Icon: Eye, label: 'Visible' }
      : { id: 'hidden', Icon: EyeOff, label: 'Oculto' },
  ];
  if (node.isVisible && node.isTeacherBlocked)
    chips.push({ id: 'blocked', Icon: LockKeyhole, label: 'Bloqueado' });
  if (node.isVisible && node.isTeacherBlocked && node.teacherUnlockOn)
    chips.push({
      id: 'scheduled',
      Icon: CalendarClock,
      label: `Desbloqueo ${formatShortCalendarDay(node.teacherUnlockOn)}`,
    });
  return chips;
}

/** The title is edited below, so the header carries the Node's access state instead. */
function NodeHeader() {
  const { node, closeNode } = useNodeEditorContext();

  return (
    <SidebarHeader className="shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-6 py-3">
      <h2 className="sr-only">{node.title}</h2>
      <ul aria-label="Estado del nodo" className="flex min-w-0 flex-wrap gap-1.5">
        {nodeStatusChips(node).map(({ id, Icon, label }) => (
          <li key={id}>
            <Badge
              variant={id === 'visible' ? 'outline' : 'secondary'}
              className="h-7 gap-1.5 px-2.5 text-[13px]"
            >
              <Icon aria-hidden="true" />
              {label}
            </Badge>
          </li>
        ))}
      </ul>
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Acciones del nodo">
        <NodeFullscreenDialog
          key={node.id}
          title="Editar nodo"
          triggerLabel="Editar nodo en pantalla completa"
        >
          <NodeForm isFullscreen />
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
      </div>
    </SidebarHeader>
  );
}

const unsavedFieldLabels = { title: 'título', description: 'descripción', nodeTypeId: 'tipo' };

function listInProse(items: readonly string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0];
}

function NodeForm({ isFullscreen = false }: { isFullscreen?: boolean }) {
  const {
    node,
    nodeTypes,
    nodeDraft,
    isDirty,
    unsavedFields,
    canSaveNode,
    changeNodeDraft,
    saveNode,
    discardNodeDraft,
    previewNodeInformation,
    previewButtonRef,
  } = useNodeEditorContext();
  const idPrefix = isFullscreen ? 'fullscreen-node' : 'edit-node';
  const [titleErrorNodeId, setTitleErrorNodeId] = useState<string | null>(null);
  const titleError =
    titleErrorNodeId === node.id && !nodeDraft.title.trim()
      ? 'Escribe un título para el nodo.'
      : undefined;

  return (
    <form
      noValidate
      className={cn(
        'flex flex-col gap-4 py-5',
        isFullscreen && 'py-0 [&_.markdown-editor_pre]:min-h-[50dvh]',
      )}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSaveNode) return;
        if (!nodeDraft.title.trim()) {
          setTitleErrorNodeId(node.id);
          document.getElementById(`${idPrefix}-title`)?.focus();
          return;
        }
        saveNode();
      }}
    >
      <FieldGroup>
        <NodeContentFields
          idPrefix={idPrefix}
          nodeTypes={nodeTypes}
          value={nodeDraft}
          titleError={titleError}
          onChange={(patch) => changeNodeDraft({ ...nodeDraft, ...patch })}
        />
      </FieldGroup>
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
            onClick={() => {
              setTitleErrorNodeId(null);
              discardNodeDraft();
            }}
          >
            Descartar
          </Button>
        ) : null}
      </div>
      <div
        className={cn(
          'grid gap-2',
          !isFullscreen && 'grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]',
        )}
      >
        <Button type="submit" disabled={!canSaveNode}>
          <Save data-icon="inline-start" />
          Guardar cambios
        </Button>
        {!isFullscreen ? (
          <Button
            ref={previewButtonRef}
            type="button"
            variant="outline"
            onClick={previewNodeInformation}
          >
            <Eye data-icon="inline-start" />
            {isDirty ? 'Previsualizar cambios' : 'Previsualizar'}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function formatShortCalendarDay(day: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(`${day}T12:00:00.000Z`))
    .replace('.', '');
}

function formatCalendarDay(day: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${day}T12:00:00.000Z`));
}

function NodeUnlockSchedule({ scheduledDay }: { scheduledDay: string | null }) {
  const { scheduleTeacherUnlock } = useNodeEditorContext();
  const [draftDay, setDraftDay] = useState(scheduledDay ?? '');
  const minimumDay = addCalendarDays(chileCalendarDay(), 1);
  const canSchedule = draftDay >= minimumDay && draftDay !== scheduledDay;

  return (
    <form
      className="flex flex-col gap-2 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSchedule) scheduleTeacherUnlock(draftDay);
      }}
    >
      <Field>
        <div className="flex items-start gap-2">
          <CalendarClock
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <FieldLabel htmlFor="node-unlock-date">Desbloqueo programado</FieldLabel>
            <FieldDescription>
              {scheduledDay
                ? `Se desbloqueará el ${formatCalendarDay(scheduledDay)}, a las 00:00 (hora de Chile).`
                : 'Elige un día para desbloquear este nodo sin intervención docente.'}{' '}
              Si ese día un prerrequisito sigue bloqueado, esperará a que lo desbloquees.
            </FieldDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            id="node-unlock-date"
            type="date"
            className="w-auto min-w-0 flex-1"
            min={minimumDay}
            value={draftDay}
            onChange={(event) => setDraftDay(event.target.value)}
          />
          <Button type="submit" variant="outline" size="sm" disabled={!canSchedule}>
            {scheduledDay ? 'Cambiar fecha' : 'Programar'}
          </Button>
          {scheduledDay && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => scheduleTeacherUnlock(null)}
            >
              Quitar fecha
            </Button>
          )}
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

function NodeStatus() {
  const { node, isVisibilityPending, toggleVisibility, requestTeacherBlock } =
    useNodeEditorContext();
  const TeacherBlockIcon = node.isTeacherBlocked ? LockKeyholeOpen : LockKeyhole;

  return (
    <section aria-labelledby="node-access-heading" className="border-t border-border pt-5 pb-2">
      <h3 id="node-access-heading" className="font-heading text-base font-semibold">
        Acceso de estudiantes
      </h3>
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
            {node.isVisible ? (
              <EyeOff data-icon="inline-start" />
            ) : (
              <Eye data-icon="inline-start" />
            )}
            {node.isVisible ? 'Ocultar' : 'Mostrar'}
          </Button>
        }
      />
      <Separator />
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
            key={`${node.id}:${node.teacherUnlockOn ?? ''}`}
            scheduledDay={node.teacherUnlockOn ?? null}
          />
        )}
      </AccessRow>
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

export function NodeDetailsEditor() {
  return (
    <div>
      <NodeHeader />
      <div className="px-6">
        <NodeForm />
        <NodeResources />
        <NodeStatus />
        <NodeDangerZone />
      </div>
    </div>
  );
}
