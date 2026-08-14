'use client';

import { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Edge,
  type Node,
  type NodeDragHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { roadmapUrl, type RoadmapDto, type RoadmapNode } from '@/lib/roadmap-types';
import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';
import Link from 'next/link';

type ApiErrorBody = { error?: { code?: string; message?: string } };

type Props = { identifier: CourseOfferingIdentifier; canEdit?: boolean };

function toFlowNodes(nodes: RoadmapNode[], colors: Map<string, string>): Node[] {
  return nodes.map((node) => ({
    id: node.id,
    data: { label: node.title },
    position: { x: node.positionX, y: node.positionY },
    hidden: !node.isVisible,
    deletable: false,
    style: {
      background: colors.get(node.nodeTypeId) ?? '#ffffff',
      color: '#1a1a1a',
      border: '1px solid #c2c2c2',
      borderRadius: 8,
      padding: 12,
    },
  }));
}

function toFlowEdges(dto: RoadmapDto): Edge[] {
  return dto.dependencies.map((dependency) => ({
    id: dependency.id,
    source: dependency.sourceNodeId,
    target: dependency.targetNodeId,
  }));
}

export default function RoadmapCanvas({ identifier, canEdit = false }: Props) {
  const [dto, setDto] = useState<RoadmapDto | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newVisible, setNewVisible] = useState(true);
  const [newTypeId, setNewTypeId] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#024AD8');
  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [newResourceType, setNewResourceType] = useState<'FILE' | 'LINK' | 'VIDEO'>('LINK');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTypeId, setEditTypeId] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch(roadmapUrl(identifier));
    const body = (await response.json()) as RoadmapDto | ApiErrorBody;
    if (!response.ok || !('nodes' in body)) {
      const apiError = 'error' in body ? body.error : undefined;
      setError(
        apiError?.code === 'ROADMAP_NOT_FOUND'
          ? 'El profesor todavía no ha creado un roadmap para este curso.'
          : (apiError?.message ?? 'No se pudo cargar el roadmap.'),
      );
      setDto(null);
      return;
    }
    const colors = new Map(body.nodeTypes.map((type) => [type.id, type.color]));
    setDto(body);
    setNodes(toFlowNodes(body.nodes, colors));
    setEdges(toFlowEdges(body));
    setNewTypeId(body.nodeTypes[0]?.id ?? '');
    setError(null);
  }

  useEffect(() => {
    // The request synchronizes this client component with the selected roadmap.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier.courseCode, identifier.year, identifier.semester]);

  async function mutate(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? 'La operación no pudo completarse.');
    }
  }

  async function addNode(event: React.FormEvent) {
    event.preventDefault();
    if (!newTitle.trim() || !newTypeId) return;
    try {
      await mutate(roadmapUrl(identifier, '/nodes'), {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || null,
          nodeTypeId: newTypeId,
          positionX: 120,
          positionY: 120,
          isVisible: newVisible,
        }),
      });
      setNewTitle('');
      setNewDescription('');
      setNewVisible(true);
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : 'No se pudo crear el nodo.',
      );
    }
  }

  const persistPosition: NodeDragHandler = async (_event, node) => {
    try {
      await mutate(roadmapUrl(identifier, `/nodes/${node.id}`), {
        method: 'PATCH',
        body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y }),
      });
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'No se pudo guardar la posición.',
      );
      await load();
    }
  };

  async function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    try {
      await mutate(roadmapUrl(identifier, '/dependencies'), {
        method: 'POST',
        body: JSON.stringify({ sourceNodeId: connection.source, targetNodeId: connection.target }),
      });
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'No se pudo crear la dependencia.',
      );
    }
  }

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    const node = dto?.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    setEditTitle(node.title);
    setEditDescription(node.description ?? '');
    setEditTypeId(node.nodeTypeId);
  }

  async function updateNode(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedNodeId || !editTitle.trim()) return;
    try {
      await mutate(roadmapUrl(identifier, `/nodes/${selectedNodeId}`), {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          nodeTypeId: editTypeId,
        }),
      });
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : 'No se pudo editar el nodo.',
      );
    }
  }

  async function toggleVisibility() {
    if (!selectedNodeId || !dto) return;
    const node = dto.nodes.find((item) => item.id === selectedNodeId);
    if (!node) return;
    try {
      await mutate(roadmapUrl(identifier, `/nodes/${node.id}`), {
        method: 'PATCH',
        body: JSON.stringify({ isVisible: !node.isVisible }),
      });
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'No se pudo cambiar la visibilidad.',
      );
    }
  }

  async function deleteNode() {
    if (!selectedNodeId) return;
    if (!window.confirm('¿Eliminar este nodo y sus dependencias y recursos?')) return;
    try {
      await mutate(roadmapUrl(identifier, `/nodes/${selectedNodeId}`), { method: 'DELETE' });
      setSelectedNodeId(null);
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : 'No se pudo eliminar el nodo.',
      );
    }
  }

  async function addType(event: React.FormEvent) {
    event.preventDefault();
    if (!newTypeName.trim()) return;
    try {
      await mutate(roadmapUrl(identifier, '/node-types'), {
        method: 'POST',
        body: JSON.stringify({ name: newTypeName, color: newTypeColor }),
      });
      setNewTypeName('');
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : 'No se pudo crear el tipo.',
      );
    }
  }

  async function addResource(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedNodeId || !newResourceTitle.trim() || !newResourceUrl.trim()) return;
    try {
      await mutate(roadmapUrl(identifier, `/nodes/${selectedNodeId}/resources`), {
        method: 'POST',
        body: JSON.stringify({
          title: newResourceTitle,
          url: newResourceUrl,
          type: newResourceType,
        }),
      });
      setNewResourceTitle('');
      setNewResourceUrl('');
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : 'No se pudo crear el recurso.',
      );
    }
  }

  async function deleteDependency(dependencyId: string) {
    try {
      await mutate(roadmapUrl(identifier, `/dependencies/${dependencyId}`), { method: 'DELETE' });
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'No se pudo eliminar la dependencia.',
      );
      await load();
    }
  }

  async function editResource(resourceId: string, title: string, url: string) {
    const nextTitle = window.prompt('Título del recurso', title);
    const nextUrl = window.prompt('URL del recurso', url);
    const nextType = window.prompt('Tipo: ARCHIVO, ENLACE o VIDEO', 'ENLACE');
    const resourceType =
      nextType === 'ARCHIVO'
        ? 'FILE'
        : nextType === 'ENLACE'
          ? 'LINK'
          : nextType === 'VIDEO'
            ? 'VIDEO'
            : null;
    if (!nextTitle || !nextUrl || !resourceType) return;
    try {
      await mutate(roadmapUrl(identifier, `/resources/${resourceId}`), {
        method: 'PATCH',
        body: JSON.stringify({ title: nextTitle, url: nextUrl, type: resourceType }),
      });
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : 'No se pudo editar el recurso.',
      );
    }
  }

  async function deleteResource(resourceId: string) {
    try {
      await mutate(roadmapUrl(identifier, `/resources/${resourceId}`), { method: 'DELETE' });
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'No se pudo eliminar el recurso.',
      );
    }
  }

  async function editType(typeId: string, name: string, color: string) {
    const nextName = window.prompt('Nombre del tipo', name);
    const nextColor = window.prompt('Color hexadecimal', color);
    if (!nextName || !nextColor) return;
    try {
      await mutate(roadmapUrl(identifier, `/node-types/${typeId}`), {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName, color: nextColor }),
      });
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : 'No se pudo editar el tipo.',
      );
    }
  }

  async function deleteType(typeId: string) {
    try {
      await mutate(roadmapUrl(identifier, `/node-types/${typeId}`), { method: 'DELETE' });
      await load();
    } catch (operationError) {
      setError(
        operationError instanceof Error ? operationError.message : 'No se pudo eliminar el tipo.',
      );
    }
  }

  if (error && !dto)
    return (
      <div className="rounded-2xl border border-[#f9d4d2] bg-white p-8 text-[#b3262b]">
        {error}
        {error === 'Debes iniciar sesión para continuar.' && (
          <Link href="/auth/signin" className="mt-4 block font-medium text-[#024ad8]">
            Autenticarse
          </Link>
        )}
      </div>
    );
  if (!dto)
    return (
      <div className="rounded-2xl border border-[#e8e8e8] bg-white p-8 text-[#636363]">
        Cargando roadmap...
      </div>
    );

  const selectedNode = dto.nodes.find((node) => node.id === selectedNodeId);
  return (
    <div
      className={`grid min-h-[70vh] grid-cols-1 overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white shadow-[0_2px_8px_rgba(26,26,26,0.08)]${canEdit ? ' lg:grid-cols-[280px_1fr]' : ''}`}
    >
      {canEdit && (
        <>
          <aside className="roadmap-authoring space-y-6 border-b border-[#e8e8e8] bg-[#f7f7f7] p-6 lg:border-b-0 lg:border-r">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#024ad8]">
                Autoría
              </p>
              <h2 className="mt-2 text-xl font-medium text-[#1a1a1a]">Gestionar roadmap</h2>
            </div>
            {error && (
              <p className="rounded-lg border border-[#f9d4d2] bg-white p-3 text-sm text-[#b3262b]">
                {error}
                {error === 'Debes iniciar sesión para continuar.' && (
                  <Link href="/auth/signin" className="mt-2 block font-medium text-[#024ad8]">
                    Autenticarse
                  </Link>
                )}
              </p>
            )}
            <form onSubmit={addNode} className="space-y-3">
              <label className="block text-sm font-medium text-[#1a1a1a]">
                Nuevo nodo
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Título"
                  className="mt-1 w-full rounded border border-[#c2c2c2] bg-white px-3 py-2"
                />
              </label>
              <textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Descripción opcional"
                className="w-full rounded border border-[#c2c2c2] bg-white px-3 py-2"
              />
              <select
                value={newTypeId}
                onChange={(event) => setNewTypeId(event.target.value)}
                className="w-full rounded border border-[#c2c2c2] bg-white px-3 py-2"
              >
                {dto.nodeTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newVisible}
                  onChange={(event) => setNewVisible(event.target.checked)}
                />{' '}
                Visible para estudiantes
              </label>
              <button className="w-full rounded bg-[#024ad8] px-4 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-white">
                Agregar nodo
              </button>
            </form>
            <form onSubmit={addType} className="space-y-3 border-t border-[#e8e8e8] pt-5">
              <label className="block text-sm font-medium text-[#1a1a1a]">
                Tipo personalizado
                <input
                  value={newTypeName}
                  onChange={(event) => setNewTypeName(event.target.value)}
                  placeholder="Nombre"
                  className="mt-1 w-full rounded border border-[#c2c2c2] bg-white px-3 py-2"
                />
              </label>
              <input
                type="color"
                value={newTypeColor}
                onChange={(event) => setNewTypeColor(event.target.value)}
                className="h-10 w-full"
                aria-label="Color del tipo"
              />
              <button className="w-full rounded border border-[#024ad8] bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-[#024ad8]">
                Crear tipo
              </button>
            </form>
            <ul className="space-y-2 border-t border-[#e8e8e8] pt-5 text-xs">
              {dto.nodeTypes
                .filter((type) => !type.isPredefined)
                .map((type) => (
                  <li key={type.id} className="flex items-center justify-between gap-2">
                    <span>{type.name}</span>
                    <span className="flex gap-1">
                      <button
                        onClick={() => void editType(type.id, type.name, type.color)}
                        className="rounded border border-[#c2c2c2] px-2 py-1"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => void deleteType(type.id)}
                        className="rounded border border-[#b3262b] px-2 py-1 text-[#b3262b]"
                      >
                        Eliminar
                      </button>
                    </span>
                  </li>
                ))}
            </ul>
            <ul className="space-y-2 border-t border-[#e8e8e8] pt-5 text-xs">
              <li className="font-medium text-[#1a1a1a]">Nodos del roadmap</li>
              {dto.nodes.map((node) => (
                <li key={node.id} className="flex items-center justify-between gap-2">
                  <span className={node.isVisible ? '' : 'text-[#636363]'}>
                    {node.title}
                    {node.isVisible ? '' : ' (oculto)'}
                  </span>
                  <button
                    onClick={() => selectNode(node.id)}
                    className="rounded border border-[#1a1a1a] px-2 py-1"
                  >
                    Seleccionar
                  </button>
                </li>
              ))}
            </ul>
            {selectedNode && (
              <div className="border-t border-[#e8e8e8] pt-5">
                <form onSubmit={updateNode} className="space-y-2">
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="w-full rounded border border-[#c2c2c2] px-3 py-2 text-sm"
                    aria-label="Título del nodo"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder="Descripción opcional"
                    className="w-full rounded border border-[#c2c2c2] px-3 py-2 text-sm"
                  />
                  <select
                    value={editTypeId}
                    onChange={(event) => setEditTypeId(event.target.value)}
                    className="w-full rounded border border-[#c2c2c2] px-3 py-2 text-sm"
                  >
                    {dto.nodeTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <button className="w-full rounded border border-[#1a1a1a] px-3 py-2 text-xs">
                    Guardar nodo
                  </button>
                </form>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void toggleVisibility()}
                    className="rounded border border-[#1a1a1a] px-3 py-2 text-xs"
                  >
                    {selectedNode.isVisible ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button
                    onClick={() => void deleteNode()}
                    className="rounded bg-[#b3262b] px-3 py-2 text-xs text-white"
                  >
                    Eliminar
                  </button>
                </div>
                <form onSubmit={addResource} className="mt-4 space-y-2">
                  <input
                    value={newResourceTitle}
                    onChange={(event) => setNewResourceTitle(event.target.value)}
                    placeholder="Título del recurso"
                    className="w-full rounded border border-[#c2c2c2] px-3 py-2 text-sm"
                  />
                  <input
                    value={newResourceUrl}
                    onChange={(event) => setNewResourceUrl(event.target.value)}
                    placeholder="https://..."
                    className="w-full rounded border border-[#c2c2c2] px-3 py-2 text-sm"
                  />
                  <select
                    value={newResourceType}
                    onChange={(event) =>
                      setNewResourceType(event.target.value as 'FILE' | 'LINK' | 'VIDEO')
                    }
                    className="w-full rounded border border-[#c2c2c2] px-3 py-2 text-sm"
                  >
                    <option value="FILE">Archivo</option>
                    <option value="LINK">Enlace</option>
                    <option value="VIDEO">Video</option>
                  </select>
                  <button className="w-full rounded border border-[#1a1a1a] px-3 py-2 text-xs">
                    Agregar recurso
                  </button>
                </form>
                <ul className="mt-3 space-y-2 text-xs text-[#636363]">
                  {selectedNode.resources.map((resource) => (
                    <li key={resource.id} className="flex items-center justify-between gap-2">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#024ad8]"
                      >
                        {resource.title}
                      </a>
                      <span className="flex gap-1">
                        <button
                          onClick={() =>
                            void editResource(resource.id, resource.title, resource.url)
                          }
                          className="rounded border border-[#c2c2c2] px-2 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => void deleteResource(resource.id)}
                          className="rounded border border-[#b3262b] px-2 py-1 text-[#b3262b]"
                        >
                          Eliminar
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </>
      )}
      <div className="min-h-[70vh]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          onNodesChange={(changes: NodeChange[]) =>
            setNodes((current) =>
              applyNodeChanges(
                changes.filter((change) => change.type !== 'remove'),
                current,
              ),
            )
          }
          onEdgesChange={(changes: EdgeChange[]) =>
            setEdges((current) =>
              applyEdgeChanges(
                changes.filter((change) => change.type !== 'remove'),
                current,
              ),
            )
          }
          onNodeClick={(_event, node) => selectNode(node.id)}
          onNodeDragStop={canEdit ? persistPosition : undefined}
          onConnect={canEdit ? (connection) => void connect(connection) : undefined}
          onEdgesDelete={
            canEdit
              ? (deletedEdges) => {
                  for (const edge of deletedEdges) void deleteDependency(edge.id);
                }
              : undefined
          }
          fitView
        >
          <Controls />
          <MiniMap />
          <Background color="#e8e8e8" gap={16} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
