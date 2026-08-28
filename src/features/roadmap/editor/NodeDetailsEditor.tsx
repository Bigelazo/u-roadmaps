import { ExternalLink, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Resource, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { EditorSection, inputClassName, NodeTypeSelect } from './primitives';
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
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  onStartEditingResource: (resource: Resource) => void;
  onCancelResource: () => void;
  onDeleteNode: (node: RoadmapNode) => void;
  onDeleteResource: (resource: Resource) => void;
  onClose: () => void;
};

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
  onUpdateResource,
  onStartEditingResource,
  onCancelResource,
  onDeleteNode,
  onDeleteResource,
  onClose,
}: Props) {
  const [isResourceComposerOpen, setIsResourceComposerOpen] = useState(false);
  const type = nodeTypes.find((nodeType) => nodeType.id === node.nodeTypeId);
  const isEditingResource = Boolean(editingResourceId);
  const closeResourceComposer = () => {
    setIsResourceComposerOpen(false);
    onCancelResource();
  };

  return (
    <div className="flex flex-col gap-4">
      <EditorSection
        eyebrow="Nodo seleccionado"
        title={node.title}
        description={type ? `Tipo: ${type.name}` : 'Configura este hito del mapa.'}
      >
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-cloud px-3 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <span
              className={`size-2.5 shrink-0 rounded-full ${node.isVisible ? 'bg-progress' : 'bg-steel'}`}
            />
            {node.isVisible ? 'Visible para estudiantes' : 'Oculto para estudiantes'}
          </span>
          <Button type="button" size="xs" variant="ghost" onClick={onClose}>
            <X data-icon="inline-start" />
            Deseleccionar
          </Button>
        </div>
        <form
          className="flex flex-col gap-4"
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
                onChange={(event) =>
                  onNodeChange({ ...nodeValue, description: event.target.value })
                }
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
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onToggleVisibility(node.id, node.isVisible)}
          >
            {node.isVisible ? 'Ocultar a estudiantes' : 'Mostrar a estudiantes'}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => onDeleteNode(node)}>
            <Trash2 data-icon="inline-start" />
            Eliminar nodo
          </Button>
        </div>
      </EditorSection>

      <section className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex items-center gap-3 border-b border-border bg-cloud/70 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[0.12em] text-primary uppercase">
              Material de apoyo
            </p>
            <h3 className="font-heading text-lg font-semibold tracking-[-0.02em]">
              Recursos <span className="text-muted-foreground">({node.resources.length})</span>
            </h3>
          </div>
          {!isResourceComposerOpen && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onCancelResource();
                setIsResourceComposerOpen(true);
              }}
            >
              <Plus data-icon="inline-start" />
              Recurso
            </Button>
          )}
        </div>
        <div className="p-4">
          {isResourceComposerOpen && (
            <form
              className="mb-4 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-cloud/60 p-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  resourceValue.title.trim() &&
                  resourceValue.url.trim() &&
                  (isEditingResource
                    ? await onUpdateResource(editingResourceId!, resourceValue)
                    : await onAddResource(node.id, resourceValue))
                )
                  closeResourceComposer();
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {isEditingResource ? 'Editar recurso' : 'Nuevo recurso'}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Cerrar editor de recurso"
                  onClick={closeResourceComposer}
                >
                  <X />
                </Button>
              </div>
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel htmlFor="resource-title">Nombre</FieldLabel>
                  <Input
                    id="resource-title"
                    className={inputClassName}
                    placeholder="Ej. Guía de ejercicios"
                    value={resourceValue.title}
                    onChange={(event) =>
                      onResourceChange({ ...resourceValue, title: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="resource-url">Enlace</FieldLabel>
                  <Input
                    id="resource-url"
                    className={inputClassName}
                    type="url"
                    placeholder="https://"
                    value={resourceValue.url}
                    onChange={(event) =>
                      onResourceChange({ ...resourceValue, url: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="resource-type">Formato</FieldLabel>
                  <Select
                    value={resourceValue.type}
                    onValueChange={(itemType) =>
                      itemType &&
                      onResourceChange({ ...resourceValue, type: itemType as Resource['type'] })
                    }
                  >
                    <SelectTrigger id="resource-type" className={inputClassName}>
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
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  <Save data-icon="inline-start" />
                  {isEditingResource ? 'Guardar recurso' : 'Agregar recurso'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={closeResourceComposer}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
          {node.resources.length === 0 ? (
            <p className="rounded-lg bg-cloud px-3 py-3 text-sm leading-snug text-muted-foreground">
              Aún no hay recursos. Agrega lecturas, videos o archivos para este hito.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border" aria-label="Recursos del nodo">
              {node.resources.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.type === 'FILE'
                        ? 'Archivo'
                        : item.type === 'VIDEO'
                          ? 'Video'
                          : 'Enlace'}
                    </span>
                  </span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir recurso ${item.title}`}
                    className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Editar recurso ${item.title}`}
                    onClick={() => {
                      onStartEditingResource(item);
                      setIsResourceComposerOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Eliminar recurso ${item.title}`}
                    onClick={() => onDeleteResource(item)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
