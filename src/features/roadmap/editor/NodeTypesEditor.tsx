import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from 'cn';
import { decideNodeTypeChange } from '@/features/roadmap/domain/node-type';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type { RoadmapDto } from '@/features/roadmap/types';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { NodeTypeForm } from './NodeTypeForm';
import type { NodeTypeDraft, NodeTypeInput } from './types';

type NodeType = RoadmapDto['nodeTypes'][number];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeTypes: RoadmapDto['nodeTypes'];
  nodes?: readonly { nodeTypeId: string }[];
  onAdd: (value: NodeTypeInput) => Promise<boolean>;
  onUpdate: (id: string, value: NodeTypeInput) => Promise<boolean>;
  onRequestDelete: (nodeType: NodeType) => void;
};

const emptyDraft: NodeTypeDraft = { name: '' };

export function NodeTypesEditor({
  open,
  onOpenChange,
  nodeTypes,
  nodes = [],
  onAdd,
  onUpdate,
  onRequestDelete,
}: Props) {
  const [value, setValue] = useState<NodeTypeDraft>(emptyDraft);
  const [editing, setEditing] = useState<NodeType | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const savingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const baseline = editing ?? emptyDraft;
  const hasChanges =
    value.name !== baseline.name || value.icon !== baseline.icon || value.color !== baseline.color;
  const decision = decideNodeTypeChange({
    nodeTypes,
    nodes,
    change: editing
      ? { kind: 'update', nodeTypeId: editing.id, name: value.name }
      : { kind: 'create', name: value.name },
  });
  const nameError =
    value.name.trim() &&
    decision.kind === 'REJECTED' &&
    decision.reason === 'NODE_TYPE_NAME_CONFLICT'
      ? decision.message
      : undefined;
  const editingUnavailable = editing !== null && !nodeTypes.some(({ id }) => id === editing.id);
  const usageCounts = new Map<string, number>();
  for (const node of nodes)
    usageCounts.set(node.nodeTypeId, (usageCounts.get(node.nodeTypeId) ?? 0) + 1);
  const editingUsage = editing ? (usageCounts.get(editing.id) ?? 0) : 0;

  function resetEditor() {
    setValue(emptyDraft);
    setEditing(null);
    setError(null);
  }

  function navigate(action: () => void) {
    if (savingRef.current) return;
    if (hasChanges) setPendingNavigation(() => action);
    else action();
  }

  function edit(type: NodeType) {
    if (editing?.id === type.id) {
      nameRef.current?.focus();
      return;
    }
    navigate(() => {
      setEditing(type);
      setValue({ name: type.name, icon: type.icon, color: type.color });
      setError(null);
      setStatus('');
      nameRef.current?.focus();
    });
  }

  async function save() {
    if (
      savingRef.current ||
      !value.icon ||
      !value.color ||
      !value.name.trim() ||
      decision.kind === 'REJECTED'
    )
      return;
    savingRef.current = true;
    setIsPending(true);
    setError(null);
    setStatus('');
    const input: NodeTypeInput = { name: value.name.trim(), icon: value.icon, color: value.color };
    try {
      const saved = editing ? await onUpdate(editing.id, input) : await onAdd(input);
      if (saved) {
        setStatus(
          editing ? `Cambios guardados en «${input.name}».` : `Tipo «${input.name}» creado.`,
        );
        resetEditor();
        nameRef.current?.focus();
      } else setError('No se pudo guardar el tipo. Tus cambios siguen aquí; vuelve a intentarlo.');
    } catch {
      setError('No se pudo guardar el tipo. Tus cambios siguen aquí; vuelve a intentarlo.');
    } finally {
      savingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <TooltipProvider>
      <Dialog
        open={open}
        onOpenChange={(nextOpen, details) => {
          if (nextOpen) onOpenChange(true);
          else {
            details.cancel();
            navigate(() => {
              resetEditor();
              onOpenChange(false);
            });
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-2rem)] gap-6 p-5 sm:max-w-4xl sm:p-6"
        >
          <DialogHeader className="pr-12">
            <DialogTitle className="text-2xl leading-tight font-semibold">
              Tipos de nodo
            </DialogTitle>
            <DialogDescription>Crea y gestiona las categorías de este roadmap.</DialogDescription>
          </DialogHeader>
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3"
                aria-label="Cerrar tipos de nodo"
                disabled={isPending}
              />
            }
          >
            <X aria-hidden="true" />
          </DialogClose>
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-6 sm:gap-8">
            <section
              className="flex min-w-0 flex-col gap-4"
              aria-labelledby="available-node-types-title"
            >
              <div className="flex min-h-11 items-center justify-between gap-3">
                <h3
                  id="available-node-types-title"
                  className="font-heading text-base font-semibold"
                >
                  Tipos disponibles
                </h3>
                {editing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      navigate(() => {
                        resetEditor();
                        nameRef.current?.focus();
                      })
                    }
                  >
                    <Plus data-icon="inline-start" />
                    Nuevo tipo
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Los predefinidos no se pueden editar ni eliminar.
              </p>
              <ul
                className="flex flex-col divide-y divide-border"
                aria-label="Tipos de nodo disponibles"
              >
                {nodeTypes.map((type) => {
                  const usage = usageCounts.get(type.id) ?? 0;
                  const selected = editing?.id === type.id;
                  return (
                    <li
                      key={type.id}
                      className={cn(
                        'flex min-h-16 min-w-0 items-center gap-3 py-2',
                        selected && 'rounded-lg bg-primary/5 px-2',
                      )}
                    >
                      <NodeTypeIcon
                        icon={type.icon}
                        className="size-5 shrink-0"
                        style={{ color: type.color }}
                        aria-hidden="true"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="font-medium wrap-anywhere">{type.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {usage === 0 ? 'Sin nodos' : usage === 1 ? '1 nodo' : `${usage} nodos`}
                          {selected ? ' · Editando' : ''}
                        </span>
                      </div>
                      {type.isPredefined ? (
                        <Badge variant="secondary">Predefinido</Badge>
                      ) : (
                        <div className="flex shrink-0 gap-1">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Editar tipo ${type.name}`}
                                  aria-pressed={selected}
                                  disabled={isPending}
                                  onClick={() => edit(type)}
                                />
                              }
                            >
                              <Pencil aria-hidden="true" />
                            </TooltipTrigger>
                            <TooltipContent>Editar {type.name}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span
                                  tabIndex={usage > 0 ? 0 : undefined}
                                  aria-label={
                                    usage > 0
                                      ? `Para eliminar ${type.name}, cambia primero el tipo de sus nodos.`
                                      : undefined
                                  }
                                />
                              }
                            >
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={`Eliminar tipo ${type.name}`}
                                disabled={isPending || usage > 0}
                                onClick={() =>
                                  navigate(() => {
                                    resetEditor();
                                    onRequestDelete(type);
                                  })
                                }
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {usage > 0
                                ? 'Cambia primero el tipo de los nodos que lo utilizan.'
                                : `Eliminar ${type.name}`}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!nodeTypes.some((type) => !type.isPredefined) ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay tipos personalizados. Crea uno con su nombre, icono y color.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Solo puedes eliminar tipos que no estén en uso.
              </p>
            </section>
            <section
              className="flex min-w-0 flex-col gap-4 border-t border-border pt-6 md:border-t-0 md:pt-0"
              aria-labelledby="node-type-editor-title"
            >
              <h3
                id="node-type-editor-title"
                className="flex min-h-11 items-center font-heading text-base font-semibold"
              >
                {editing ? 'Editar tipo' : 'Crear tipo'}
              </h3>
              {editing ? (
                <p className="text-sm text-muted-foreground">
                  {editingUsage > 0
                    ? `Los cambios se aplicarán a ${editingUsage === 1 ? '1 nodo que usa' : `los ${editingUsage} nodos que usan`} este tipo.`
                    : 'Los cambios se aplicarán a este tipo de nodo.'}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Define una categoría para organizar tus nodos.
                </p>
              )}
              {editingUnavailable ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Este tipo ya no está disponible. Cancela la edición para crear otro.
                  </AlertDescription>
                </Alert>
              ) : null}
              <NodeTypeForm
                value={value}
                isEditing={editing !== null}
                onChange={(draft) => {
                  setValue(draft);
                  setError(null);
                  setStatus('');
                }}
                onSubmit={save}
                onCancel={
                  editing || hasChanges
                    ? () =>
                        navigate(() => {
                          resetEditor();
                          nameRef.current?.focus();
                        })
                    : undefined
                }
                isPending={isPending}
                nameError={nameError || undefined}
                hasChanges={!editingUnavailable && (!editing || hasChanges)}
                inputRef={nameRef}
                reservedIcons={nodeTypes
                  .filter((type) => type.isPredefined)
                  .map((type) => type.icon)}
              />
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <p role="status" className="text-sm text-muted-foreground">
                {status}
              </p>
            </section>
          </div>
          <ConfirmationDialog
            confirmation={
              pendingNavigation
                ? {
                    title: '¿Descartar los cambios sin guardar?',
                    description:
                      'El tipo no se ha guardado. Si continúas, perderás los cambios de este formulario.',
                    intent: 'destructive',
                    cancelLabel: 'Seguir editando',
                    actions: [{ id: 'discard', label: 'Descartar cambios' }],
                  }
                : null
            }
            onCancel={() => setPendingNavigation(null)}
            onAction={() => {
              const action = pendingNavigation;
              setPendingNavigation(null);
              action?.();
            }}
          />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
