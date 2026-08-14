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
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

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
      <Alert severity="error">
        {error}
        {error === 'Debes iniciar sesión para continuar.' && (
          <MuiLink component={Link} href="/auth/signin" sx={{ display: 'block', mt: 1 }}>
            Autenticarse
          </MuiLink>
        )}
      </Alert>
    );
  if (!dto) return <Paper sx={{ p: 4, color: 'text.secondary' }}>Cargando roadmap...</Paper>;

  const selectedNode = dto.nodes.find((node) => node.id === selectedNodeId);
  return (
    <Paper
      variant="outlined"
      sx={{
        minHeight: '70vh',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: canEdit ? '280px 1fr' : '1fr' },
        boxShadow: '0 2px 8px rgba(26, 26, 26, 0.08)',
      }}
    >
      {canEdit && (
        <Box
          component="aside"
          sx={{
            p: 3,
            bgcolor: 'background.default',
            borderBottom: { xs: 1, lg: 0 },
            borderRight: { lg: 1 },
            borderColor: 'divider',
          }}
        >
          <Stack spacing={2.5}>
            <Box>
              <Typography
                variant="overline"
                color="primary"
                sx={{ fontWeight: 700, letterSpacing: '0.14em' }}
              >
                Autoría
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                Gestionar roadmap
              </Typography>
            </Box>
            {error && (
              <Alert severity="error">
                {error}
                {error === 'Debes iniciar sesión para continuar.' && (
                  <MuiLink component={Link} href="/auth/signin" sx={{ display: 'block', mt: 1 }}>
                    Autenticarse
                  </MuiLink>
                )}
              </Alert>
            )}
            <Stack component="form" onSubmit={addNode} spacing={1.5}>
              <Typography variant="subtitle2">Nuevo nodo</Typography>
              <TextField
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                label="Título"
                required
              />
              <TextField
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                label="Descripción opcional"
                multiline
                minRows={2}
              />
              <FormControl size="small" fullWidth>
                <InputLabel id="new-node-type-label">Tipo</InputLabel>
                <Select
                  labelId="new-node-type-label"
                  label="Tipo"
                  value={newTypeId}
                  onChange={(event) => setNewTypeId(event.target.value)}
                >
                  {dto.nodeTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newVisible}
                    onChange={(event) => setNewVisible(event.target.checked)}
                  />
                }
                label="Visible para estudiantes"
              />
              <Button type="submit" variant="contained" fullWidth>
                Agregar nodo
              </Button>
            </Stack>
            <Divider />
            <Stack component="form" onSubmit={addType} spacing={1.5}>
              <Typography variant="subtitle2">Tipo personalizado</Typography>
              <TextField
                value={newTypeName}
                onChange={(event) => setNewTypeName(event.target.value)}
                label="Nombre"
                required
              />
              <TextField
                type="color"
                value={newTypeColor}
                onChange={(event) => setNewTypeColor(event.target.value)}
                label="Color del tipo"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Button type="submit" variant="outlined" fullWidth>
                Crear tipo
              </Button>
            </Stack>
            <Divider />
            <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {dto.nodeTypes
                .filter((type) => !type.isPredefined)
                .map((type) => (
                  <Box
                    component="li"
                    key={type.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <Typography variant="caption" sx={{ flexGrow: 1 }}>
                      {type.name}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => void editType(type.id, type.name, type.color)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => void deleteType(type.id)}
                    >
                      Eliminar
                    </Button>
                  </Box>
                ))}
            </Stack>
            <Divider />
            <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
              <Typography component="li" variant="subtitle2">
                Nodos del roadmap
              </Typography>
              {dto.nodes.map((node) => (
                <Box
                  component="li"
                  key={node.id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Typography
                    variant="caption"
                    color={node.isVisible ? 'text.primary' : 'text.secondary'}
                    sx={{ flexGrow: 1 }}
                  >
                    {node.title}
                    {node.isVisible ? '' : ' (oculto)'}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={() => selectNode(node.id)}
                  >
                    Seleccionar
                  </Button>
                </Box>
              ))}
            </Stack>
            {selectedNode && (
              <>
                <Divider />
                <Stack component="section" spacing={1.5}>
                  <Stack component="form" onSubmit={updateNode} spacing={1.5}>
                    <TextField
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      label="Título del nodo"
                      required
                    />
                    <TextField
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      label="Descripción opcional"
                      multiline
                      minRows={2}
                    />
                    <FormControl size="small" fullWidth>
                      <InputLabel id="edit-node-type-label">Tipo</InputLabel>
                      <Select
                        labelId="edit-node-type-label"
                        label="Tipo"
                        value={editTypeId}
                        onChange={(event) => setEditTypeId(event.target.value)}
                      >
                        {dto.nodeTypes.map((type) => (
                          <MenuItem key={type.id} value={type.id}>
                            {type.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button type="submit" variant="outlined" color="inherit" fullWidth>
                      Guardar nodo
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="inherit"
                      onClick={() => void toggleVisibility()}
                    >
                      {selectedNode.isVisible ? 'Ocultar' : 'Mostrar'}
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      color="error"
                      onClick={() => void deleteNode()}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                  <Stack component="form" onSubmit={addResource} spacing={1.5} sx={{ pt: 1 }}>
                    <TextField
                      value={newResourceTitle}
                      onChange={(event) => setNewResourceTitle(event.target.value)}
                      label="Título del recurso"
                      required
                    />
                    <TextField
                      value={newResourceUrl}
                      onChange={(event) => setNewResourceUrl(event.target.value)}
                      label="URL del recurso"
                      placeholder="https://..."
                      required
                    />
                    <FormControl size="small" fullWidth>
                      <InputLabel id="resource-type-label">Tipo</InputLabel>
                      <Select
                        labelId="resource-type-label"
                        label="Tipo"
                        value={newResourceType}
                        onChange={(event) =>
                          setNewResourceType(event.target.value as 'FILE' | 'LINK' | 'VIDEO')
                        }
                      >
                        <MenuItem value="FILE">Archivo</MenuItem>
                        <MenuItem value="LINK">Enlace</MenuItem>
                        <MenuItem value="VIDEO">Video</MenuItem>
                      </Select>
                    </FormControl>
                    <Button type="submit" variant="outlined" color="inherit" fullWidth>
                      Agregar recurso
                    </Button>
                  </Stack>
                  <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                    {selectedNode.resources.map((resource) => (
                      <Box
                        component="li"
                        key={resource.id}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <MuiLink
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          variant="caption"
                          sx={{ flexGrow: 1 }}
                        >
                          {resource.title}
                        </MuiLink>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            void editResource(resource.id, resource.title, resource.url)
                          }
                        >
                          Editar
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => void deleteResource(resource.id)}
                        >
                          Eliminar
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </>
            )}
          </Stack>
        </Box>
      )}
      <Box sx={{ minHeight: '70vh' }}>
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
      </Box>
    </Paper>
  );
}
