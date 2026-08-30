import { ExternalLink, FileUp, Link2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Resource, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { inputClassName, NodeTypeSelect } from './primitives';
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
  const [isResourceComposerOpen, setIsResourceComposerOpen] = useState(false);
  const [resourceMode, setResourceMode] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const type = nodeTypes.find((nodeType) => nodeType.id === node.nodeTypeId);
  const isEditingResource = Boolean(editingResourceId);
  const closeResourceComposer = () => {
    setIsResourceComposerOpen(false);
    setSelectedFile(null);
    onCancelResource();
  };

  return (
    <div>
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

      <section className="border-t border-border pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-primary uppercase">
              Material de apoyo
            </p>
            <h3 className="mt-0.5 font-heading text-lg font-semibold tracking-[-0.02em]">
              Recursos <span className="text-muted-foreground">({node.resources.length})</span>
            </h3>
          </div>
          {!isResourceComposerOpen && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onCancelResource();
                setResourceMode('file');
                setIsResourceComposerOpen(true);
              }}
            >
              <Plus data-icon="inline-start" />
              Recurso
            </Button>
          )}
        </div>
        <div className="pt-4 pb-6">
          {isResourceComposerOpen && (
            <form
              className="mb-4 flex flex-col gap-3 border-y border-dashed border-border py-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const saved =
                  resourceMode === 'file' && !isEditingResource
                    ? selectedFile && (await onUploadResource(node.id, selectedFile))
                    : resourceValue.title.trim() &&
                      resourceValue.url.trim() &&
                      (isEditingResource
                        ? await onUpdateResource(editingResourceId!, resourceValue)
                        : await onAddResource(node.id, { ...resourceValue, type: 'LINK' }));
                if (saved) {
                  closeResourceComposer();
                }
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
              {!isEditingResource && (
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-cloud p-1" role="tablist">
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={resourceMode === 'file'}
                    variant={resourceMode === 'file' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setResourceMode('file')}
                  >
                    <FileUp data-icon="inline-start" />
                    Archivo
                  </Button>
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={resourceMode === 'link'}
                    variant={resourceMode === 'link' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setResourceMode('link')}
                  >
                    <Link2 data-icon="inline-start" />
                    Enlace
                  </Button>
                </div>
              )}
              {resourceMode === 'file' && !isEditingResource ? (
                <Field>
                  <FieldLabel htmlFor="resource-file">Archivo</FieldLabel>
                  <label
                    htmlFor="resource-file"
                    className="mt-1 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-5 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:bg-primary/10"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      setSelectedFile(event.dataTransfer.files.item(0));
                    }}
                  >
                    <FileUp className="mb-2 size-5 text-primary" />
                    <span className="text-sm font-semibold">
                      {selectedFile ? selectedFile.name : 'Arrastra un archivo aquí'}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {selectedFile ? 'Listo para subir' : 'o selecciónalo desde tu computador'}
                    </span>
                    <input
                      id="resource-file"
                      className="sr-only"
                      type="file"
                      onChange={(event) => setSelectedFile(event.target.files?.item(0) ?? null)}
                    />
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">Máximo 25 MB.</p>
                </Field>
              ) : (
                <FieldGroup className="gap-3">
                  <Field>
                    <FieldLabel htmlFor="resource-title">Título</FieldLabel>
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
                  {resourceMode === 'link' && (
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
                  )}
                </FieldGroup>
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={resourceMode === 'file' && !isEditingResource && !selectedFile}
                >
                  <Save data-icon="inline-start" />
                  {isEditingResource
                    ? 'Guardar recurso'
                    : resourceMode === 'file'
                      ? 'Subir archivo'
                      : 'Agregar enlace'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={closeResourceComposer}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
          {node.resources.length === 0 ? (
            <p className="border-l-2 border-border pl-3 text-sm leading-snug text-muted-foreground">
              Aún no hay recursos. Sube archivos o agrega enlaces para este hito.
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
                      setResourceMode(item.type === 'FILE' ? 'file' : 'link');
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
