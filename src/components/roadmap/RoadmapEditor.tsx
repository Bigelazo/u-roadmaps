'use client';

import { useEffect, useState } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { PanelRightClose, PanelRightOpen, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { Resource, RoadmapDependency, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

type NodeInput = { title: string; description: string; nodeTypeId: string; isVisible: boolean };
type NodeUpdate = Omit<NodeInput, 'isVisible'>;
type ResourceInput = { title: string; url: string; type: Resource['type'] };
type NodeTypeInput = { name: string; color: string };
type PendingDeletion = { label: string; onConfirm: () => Promise<boolean> } | null;

type Props = {
  roadmap: RoadmapDto;
  selectedNode: RoadmapNode | undefined;
  selectedDependency: RoadmapDependency | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAddNode: (node: NodeInput) => Promise<boolean>;
  onUpdateNode: (nodeId: string, node: NodeUpdate) => Promise<boolean>;
  onToggleVisibility: (nodeId: string, isVisible: boolean) => Promise<boolean>;
  onDeleteNode: (nodeId: string) => Promise<boolean>;
  onAddDependency: (sourceNodeId: string, targetNodeId: string) => Promise<boolean>;
  onDeleteDependency: (dependencyId: string) => Promise<boolean>;
  onCloseDependency: () => void;
  onAddResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  onDeleteResource: (resourceId: string) => Promise<boolean>;
  onAddNodeType: (nodeType: NodeTypeInput) => Promise<boolean>;
  onUpdateNodeType: (nodeTypeId: string, nodeType: NodeTypeInput) => Promise<boolean>;
  onDeleteNodeType: (nodeTypeId: string) => Promise<boolean>;
};

const inputClassName = 'h-11';
const selectClassName =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}

function NodeTypeSelect({
  nodeTypes,
  value,
  onValueChange,
}: {
  nodeTypes: RoadmapDto['nodeTypes'];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
      <SelectTrigger className="h-11 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {nodeTypes.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              {type.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function RoadmapEditor(props: Props) {
  const {
    roadmap,
    selectedNode,
    selectedDependency,
    isOpen,
    onToggle,
    onClose,
    onAddNode,
    onUpdateNode,
    onToggleVisibility,
    onDeleteNode,
    onAddDependency,
    onDeleteDependency,
    onCloseDependency,
    onAddResource,
    onUpdateResource,
    onDeleteResource,
    onAddNodeType,
    onUpdateNodeType,
    onDeleteNodeType,
  } = props;
  const [newNode, setNewNode] = useState<NodeInput>({
    title: '',
    description: '',
    nodeTypeId: roadmap.nodeTypes[0]?.id ?? '',
    isVisible: true,
  });
  const [editNode, setEditNode] = useState<NodeUpdate>({
    title: '',
    description: '',
    nodeTypeId: '',
  });
  const [resource, setResource] = useState<ResourceInput>({ title: '', url: '', type: 'LINK' });
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [nodeType, setNodeType] = useState<NodeTypeInput>({ name: '', color: '#024ad8' });
  const [editingNodeTypeId, setEditingNodeTypeId] = useState<string | null>(null);
  const [dependency, setDependency] = useState({
    sourceNodeId: roadmap.nodes[0]?.id ?? '',
    targetNodeId: roadmap.nodes[0]?.id ?? '',
  });
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
  const [isMobileEditorExpanded, setIsMobileEditorExpanded] = useState(false);

  useEffect(() => {
    setNewNode((current) => ({
      ...current,
      nodeTypeId: roadmap.nodeTypes.some((type) => type.id === current.nodeTypeId)
        ? current.nodeTypeId
        : (roadmap.nodeTypes[0]?.id ?? ''),
    }));
  }, [roadmap.nodeTypes]);
  useEffect(() => {
    setEditNode({
      title: selectedNode?.title ?? '',
      description: selectedNode?.description ?? '',
      nodeTypeId: selectedNode?.nodeTypeId ?? '',
    });
    setResource({ title: '', url: '', type: 'LINK' });
    setEditingResourceId(null);
  }, [selectedNode]);
  useEffect(() => {
    const firstNodeId = roadmap.nodes[0]?.id ?? '';
    setDependency((current) => ({
      sourceNodeId: roadmap.nodes.some((node) => node.id === current.sourceNodeId)
        ? current.sourceNodeId
        : firstNodeId,
      targetNodeId: roadmap.nodes.some((node) => node.id === current.targetNodeId)
        ? current.targetNodeId
        : firstNodeId,
    }));
  }, [roadmap.nodes]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsMobileEditorExpanded(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const sourceNode = roadmap.nodes.find((node) => node.id === selectedDependency?.sourceNodeId);
  const targetNode = roadmap.nodes.find((node) => node.id === selectedDependency?.targetNodeId);
  const closeNodeTypeEditor = () => {
    setNodeType({ name: '', color: '#024ad8' });
    setEditingNodeTypeId(null);
  };

  if (!isOpen) {
    return (
      <Button
        aria-label="Mostrar panel de edición"
        title="Mostrar panel de edición"
        onClick={onToggle}
        size="icon"
        variant="outline"
        className="absolute top-[18px] right-5 z-[5] bg-white/95 text-primary"
      >
        <PanelRightOpen />
      </Button>
    );
  }

  return (
    <aside
      aria-label="Panel de edición del roadmap"
      className="order-2 min-w-0 border-t border-border bg-cloud lg:order-none lg:h-[calc(100vh-64px)] lg:overflow-y-auto lg:border-t-0 lg:border-r-4 lg:border-l lg:border-r-primary lg:border-l-border"
    >
      <details
        open={isMobileEditorExpanded}
        onToggle={(event) => setIsMobileEditorExpanded(event.currentTarget.open)}
      >
        <summary className="min-h-11 cursor-pointer px-5 py-3 text-sm font-bold text-primary lg:hidden">
          Herramientas de edición
        </summary>
        <div className="flex flex-col gap-6 p-5">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[1.2px] text-primary uppercase">
                Edición del roadmap
              </p>
              <h2 className="mt-1 font-heading text-xl font-semibold tracking-[-0.03em]">
                Agregar contenido
              </h2>
            </div>
            <Button
              aria-label="Ocultar panel de edición"
              title="Ocultar panel de edición"
              onClick={onToggle}
              size="icon"
              variant="outline"
            >
              <PanelRightClose />
            </Button>
          </header>

          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (newNode.title.trim() && newNode.nodeTypeId && (await onAddNode(newNode)))
                setNewNode((current) => ({ ...current, title: '', description: '' }));
            }}
          >
            <h3 className="font-semibold">Nuevo nodo</h3>
            <Field label="Título del nodo">
              <Input
                className={inputClassName}
                value={newNode.title}
                onChange={(event) => setNewNode({ ...newNode, title: event.target.value })}
                required
              />
            </Field>
            <Field label="Descripción">
              <Textarea
                value={newNode.description}
                onChange={(event) => setNewNode({ ...newNode, description: event.target.value })}
              />
            </Field>
            <Field label="Tipo">
              <NodeTypeSelect
                nodeTypes={roadmap.nodeTypes}
                value={newNode.nodeTypeId}
                onValueChange={(nodeTypeId) => setNewNode({ ...newNode, nodeTypeId })}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={newNode.isVisible}
                onCheckedChange={(checked) => setNewNode({ ...newNode, isVisible: checked })}
              />
              Visible para estudiantes
            </label>
            <Button type="submit">
              <Plus data-icon="inline-start" />
              Agregar nodo
            </Button>
          </form>

          <Separator />
          <section className="flex flex-col gap-4" aria-labelledby="dependency-heading">
            <div>
              <h3 id="dependency-heading" className="font-semibold">
                Dependencias
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Conecta el orden pedagógico desde el mapa o define una relación aquí.
              </p>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  dependency.sourceNodeId &&
                  dependency.targetNodeId &&
                  dependency.sourceNodeId !== dependency.targetNodeId
                )
                  await onAddDependency(dependency.sourceNodeId, dependency.targetNodeId);
              }}
            >
              <Field label="Desde">
                <select
                  className={selectClassName}
                  value={dependency.sourceNodeId}
                  onChange={(event) =>
                    setDependency({ ...dependency, sourceNodeId: event.target.value })
                  }
                >
                  {roadmap.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hacia">
                <select
                  className={selectClassName}
                  value={dependency.targetNodeId}
                  onChange={(event) =>
                    setDependency({ ...dependency, targetNodeId: event.target.value })
                  }
                >
                  {roadmap.nodes.map((node) => (
                    <option
                      key={node.id}
                      value={node.id}
                      disabled={node.id === dependency.sourceNodeId}
                    >
                      {node.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="submit"
                variant="outline"
                disabled={
                  !dependency.sourceNodeId ||
                  !dependency.targetNodeId ||
                  dependency.sourceNodeId === dependency.targetNodeId
                }
              >
                Crear dependencia
              </Button>
            </form>
          </section>

          <Separator />
          <section className="flex flex-col gap-4" aria-labelledby="node-type-heading">
            <div>
              <h3 id="node-type-heading" className="font-semibold">
                Tipos de nodo
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Los tipos predefinidos no se pueden modificar.
              </p>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  nodeType.name.trim() &&
                  (editingNodeTypeId
                    ? await onUpdateNodeType(editingNodeTypeId, nodeType)
                    : await onAddNodeType(nodeType))
                )
                  closeNodeTypeEditor();
              }}
            >
              <Field label="Nombre">
                <Input
                  className={inputClassName}
                  value={nodeType.name}
                  onChange={(event) => setNodeType({ ...nodeType, name: event.target.value })}
                  required
                />
              </Field>
              <Field label="Color">
                <Input
                  className={inputClassName}
                  type="color"
                  value={nodeType.color}
                  onChange={(event) => setNodeType({ ...nodeType, color: event.target.value })}
                  required
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">
                  {editingNodeTypeId ? (
                    <Save data-icon="inline-start" />
                  ) : (
                    <Plus data-icon="inline-start" />
                  )}
                  {editingNodeTypeId ? 'Guardar tipo' : 'Crear tipo'}
                </Button>
                {editingNodeTypeId && (
                  <Button type="button" variant="outline" onClick={closeNodeTypeEditor}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
            <ul className="flex flex-col gap-2" aria-label="Tipos de nodo disponibles">
              {roadmap.nodeTypes.map((type) => (
                <li
                  key={type.id}
                  className="flex items-center gap-2 rounded-lg border bg-background p-2.5 text-sm"
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: type.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{type.name}</span>
                  {!type.isPredefined && (
                    <>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Editar tipo ${type.name}`}
                        onClick={() => {
                          setEditingNodeTypeId(type.id);
                          setNodeType({ name: type.name, color: type.color });
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Eliminar tipo ${type.name}`}
                        onClick={() =>
                          setPendingDeletion({
                            label: `el tipo ${type.name}`,
                            onConfirm: () => onDeleteNodeType(type.id),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {selectedDependency && (
            <>
              <Separator />
              <section
                className="flex flex-col gap-3"
                aria-labelledby="selected-dependency-heading"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 id="selected-dependency-heading" className="font-semibold">
                    Dependencia seleccionada
                  </h3>
                  <Button type="button" size="sm" variant="ghost" onClick={onCloseDependency}>
                    <X data-icon="inline-start" />
                    Cerrar
                  </Button>
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">Desde: </span>
                  {sourceNode?.title ?? 'Nodo eliminado'}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Hacia: </span>
                  {targetNode?.title ?? 'Nodo eliminado'}
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    setPendingDeletion({
                      label: 'esta dependencia',
                      onConfirm: async () => {
                        const deleted = await onDeleteDependency(selectedDependency.id);
                        if (deleted) onCloseDependency();
                        return deleted;
                      },
                    })
                  }
                >
                  <Trash2 data-icon="inline-start" />
                  Eliminar dependencia
                </Button>
              </section>
            </>
          )}

          {selectedNode && (
            <>
              <Separator />
              <section className="flex flex-col gap-4" aria-labelledby="selected-node-heading">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="selected-node-heading" className="font-semibold">
                    Editar: {selectedNode.title}
                  </h3>
                  <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                    <X data-icon="inline-start" />
                    Cerrar
                  </Button>
                </div>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (editNode.title.trim()) await onUpdateNode(selectedNode.id, editNode);
                  }}
                >
                  <Field label="Título">
                    <Input
                      className={inputClassName}
                      value={editNode.title}
                      onChange={(event) => setEditNode({ ...editNode, title: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Descripción">
                    <Textarea
                      value={editNode.description}
                      onChange={(event) =>
                        setEditNode({ ...editNode, description: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Tipo">
                    <select
                      className={selectClassName}
                      value={editNode.nodeTypeId}
                      onChange={(event) =>
                        setEditNode({ ...editNode, nodeTypeId: event.target.value })
                      }
                    >
                      {roadmap.nodeTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button type="submit">
                    <Save data-icon="inline-start" />
                    Guardar cambios
                  </Button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onToggleVisibility(selectedNode.id, selectedNode.isVisible)}
                  >
                    {selectedNode.isVisible ? 'Ocultar para estudiantes' : 'Mostrar a estudiantes'}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() =>
                      setPendingDeletion({
                        label: `el nodo ${selectedNode.title} y sus dependencias y recursos`,
                        onConfirm: async () => {
                          const deleted = await onDeleteNode(selectedNode.id);
                          if (deleted) onClose();
                          return deleted;
                        },
                      })
                    }
                  >
                    <Trash2 data-icon="inline-start" />
                    Eliminar nodo
                  </Button>
                </div>
                <Separator />
                <form
                  className="flex flex-col gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                      resource.title.trim() &&
                      resource.url.trim() &&
                      (editingResourceId
                        ? await onUpdateResource(editingResourceId, resource)
                        : await onAddResource(selectedNode.id, resource))
                    ) {
                      setResource({ title: '', url: '', type: 'LINK' });
                      setEditingResourceId(null);
                    }
                  }}
                >
                  <h3 className="font-semibold">
                    {editingResourceId ? 'Editar recurso' : 'Agregar recurso'}
                  </h3>
                  <Field label="Recurso">
                    <Input
                      className={inputClassName}
                      value={resource.title}
                      onChange={(event) => setResource({ ...resource, title: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="URL">
                    <Input
                      className={inputClassName}
                      type="url"
                      value={resource.url}
                      onChange={(event) => setResource({ ...resource, url: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Tipo">
                    <select
                      className={selectClassName}
                      value={resource.type}
                      onChange={(event) =>
                        setResource({ ...resource, type: event.target.value as Resource['type'] })
                      }
                    >
                      <option value="FILE">Archivo</option>
                      <option value="LINK">Enlace</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">
                      {editingResourceId ? (
                        <Save data-icon="inline-start" />
                      ) : (
                        <Plus data-icon="inline-start" />
                      )}
                      {editingResourceId ? 'Guardar recurso' : 'Agregar recurso'}
                    </Button>
                    {editingResourceId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingResourceId(null);
                          setResource({ title: '', url: '', type: 'LINK' });
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
                <ul className="flex flex-col gap-2" aria-label="Recursos del nodo">
                  {selectedNode.resources.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border bg-background p-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Editar recurso ${item.title}`}
                        onClick={() => {
                          setEditingResourceId(item.id);
                          setResource({ title: item.title, url: item.url, type: item.type });
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Eliminar recurso ${item.title}`}
                        onClick={() =>
                          setPendingDeletion({
                            label: `el recurso ${item.title}`,
                            onConfirm: () => onDeleteResource(item.id),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </details>

      <AlertDialog.Root
        open={Boolean(pendingDeletion)}
        onOpenChange={(open) => !open && setPendingDeletion(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-ink/30" />
          <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <AlertDialog.Popup className="w-full max-w-md rounded-xl bg-card p-6 shadow-[0_18px_50px_rgb(18_33_58_/_18%)]">
              <AlertDialog.Title className="font-heading text-xl font-semibold">
                Confirmar eliminación
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
                Eliminarás {pendingDeletion?.label}. Esta acción no se puede deshacer.
              </AlertDialog.Description>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setPendingDeletion(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() =>
                    void pendingDeletion?.onConfirm().then((deleted) => {
                      if (deleted) setPendingDeletion(null);
                    })
                  }
                >
                  <Trash2 data-icon="inline-start" />
                  Eliminar
                </Button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </aside>
  );
}
