'use client';

import { useEffect, useState } from 'react';
import { PanelRightClose, PanelRightOpen, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { Resource, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
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
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAddNode: (node: NodeInput) => Promise<boolean>;
  onUpdateNode: (nodeId: string, node: NodeUpdate) => Promise<boolean>;
  onToggleVisibility: (nodeId: string, isVisible: boolean) => Promise<boolean>;
  onDeleteNode: (nodeId: string) => Promise<boolean>;
  onAddResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  onDeleteResource: (resourceId: string) => Promise<boolean>;
  onAddNodeType: (nodeType: NodeTypeInput) => Promise<boolean>;
  onUpdateNodeType: (nodeTypeId: string, nodeType: NodeTypeInput) => Promise<boolean>;
  onDeleteNodeType: (nodeTypeId: string) => Promise<boolean>;
};

const inputClassName = 'h-11';

function NodeTypeSelect({
  id,
  nodeTypes,
  value,
  onValueChange,
}: {
  id: string;
  nodeTypes: RoadmapDto['nodeTypes'];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
      <SelectTrigger id={id} className="h-11 w-full">
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
    isOpen,
    onToggle,
    onClose,
    onAddNode,
    onUpdateNode,
    onToggleVisibility,
    onDeleteNode,
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
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsMobileEditorExpanded(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

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
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-node-title">Título del nodo</FieldLabel>
                <Input
                  id="new-node-title"
                  className={inputClassName}
                  value={newNode.title}
                  onChange={(event) => setNewNode({ ...newNode, title: event.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-node-description">Descripción</FieldLabel>
                <Textarea
                  id="new-node-description"
                  value={newNode.description}
                  onChange={(event) => setNewNode({ ...newNode, description: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-node-type">Tipo</FieldLabel>
                <NodeTypeSelect
                  id="new-node-type"
                  nodeTypes={roadmap.nodeTypes}
                  value={newNode.nodeTypeId}
                  onValueChange={(nodeTypeId) => setNewNode({ ...newNode, nodeTypeId })}
                />
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="new-node-visible"
                  checked={newNode.isVisible}
                  onCheckedChange={(checked) => setNewNode({ ...newNode, isVisible: checked })}
                />
                <FieldLabel htmlFor="new-node-visible">Visible para estudiantes</FieldLabel>
              </Field>
            </FieldGroup>
            <Button type="submit">
              <Plus data-icon="inline-start" />
              Agregar nodo
            </Button>
          </form>

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
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="node-type-name">Nombre</FieldLabel>
                  <Input
                    id="node-type-name"
                    className={inputClassName}
                    value={nodeType.name}
                    onChange={(event) => setNodeType({ ...nodeType, name: event.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="node-type-color">Color</FieldLabel>
                  <Input
                    id="node-type-color"
                    className={inputClassName}
                    type="color"
                    value={nodeType.color}
                    onChange={(event) => setNodeType({ ...nodeType, color: event.target.value })}
                    required
                  />
                </Field>
              </FieldGroup>
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
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="edit-node-title">Título</FieldLabel>
                      <Input
                        id="edit-node-title"
                        className={inputClassName}
                        value={editNode.title}
                        onChange={(event) =>
                          setEditNode({ ...editNode, title: event.target.value })
                        }
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="edit-node-description">Descripción</FieldLabel>
                      <Textarea
                        id="edit-node-description"
                        value={editNode.description}
                        onChange={(event) =>
                          setEditNode({ ...editNode, description: event.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="edit-node-type">Tipo</FieldLabel>
                      <NodeTypeSelect
                        id="edit-node-type"
                        nodeTypes={roadmap.nodeTypes}
                        value={editNode.nodeTypeId}
                        onValueChange={(nodeTypeId) => setEditNode({ ...editNode, nodeTypeId })}
                      />
                    </Field>
                  </FieldGroup>
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
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="resource-title">Recurso</FieldLabel>
                      <Input
                        id="resource-title"
                        className={inputClassName}
                        value={resource.title}
                        onChange={(event) =>
                          setResource({ ...resource, title: event.target.value })
                        }
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="resource-url">URL</FieldLabel>
                      <Input
                        id="resource-url"
                        className={inputClassName}
                        type="url"
                        value={resource.url}
                        onChange={(event) => setResource({ ...resource, url: event.target.value })}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="resource-type">Tipo</FieldLabel>
                      <Select
                        value={resource.type}
                        onValueChange={(type) =>
                          type && setResource({ ...resource, type: type as Resource['type'] })
                        }
                      >
                        <SelectTrigger id="resource-type" className="h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="FILE">Archivo</SelectItem>
                            <SelectItem value="LINK">Enlace</SelectItem>
                            <SelectItem value="VIDEO">Video</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
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

      <AlertDialog
        open={Boolean(pendingDeletion)}
        onOpenChange={(open) => !open && setPendingDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">
              Confirmar eliminación
            </AlertDialogTitle>
            <AlertDialogDescription>
              Eliminarás {pendingDeletion?.label}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
