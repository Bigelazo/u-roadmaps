'use client';

import { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Handle,
  MarkerType,
  Position,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeDragHandler,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  FileCode2,
  FileText,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
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
import { roadmapUrl, type Resource, type RoadmapDto, type RoadmapNode } from '@/lib/roadmap-types';
import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';
import { err, ok, ResultAsync } from 'neverthrow';

type Props = {
  identifier: CourseOfferingIdentifier;
  canEdit?: boolean;
  title: string;
  subtitle: string;
};
type NodeStatus = 'completed' | 'available' | 'locked' | 'editing';
type CanvasNodeData = { title: string; typeName: string; status: NodeStatus };

function isRoadmapDto(value: unknown): value is RoadmapDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'nodeTypes' in value &&
    Array.isArray(value.nodeTypes)
  );
}

function apiErrorMessage(value: unknown) {
  if (typeof value !== 'object' || value === null || !('error' in value)) return undefined;
  const error = value.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return undefined;
  return typeof error.message === 'string' ? error.message : undefined;
}

function RoadmapCard({ data }: NodeProps<CanvasNodeData>) {
  const completed = data.status === 'completed';
  const locked = data.status === 'locked';
  const accent = completed
    ? '#0347bf'
    : locked
      ? '#9294a2'
      : data.status === 'available'
        ? '#181812'
        : '#0347bf';
  return (
    <Box
      className="roadmap-card"
      sx={{
        minWidth: 170,
        border: '2px solid',
        borderColor: accent,
        borderRadius: '8px',
        bgcolor: locked ? '#fbfaff' : '#fff',
        color: locked ? '#9294a2' : '#171720',
        px: 2,
        py: 1.5,
        boxShadow: locked ? 'none' : '0 4px 10px rgba(22, 29, 58, 0.10)',
        opacity: locked ? 0.88 : 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1.25,
        }}
      >
        {completed ? (
          <CheckCircle2 size={20} color="#0347bf" fill="#0347bf" stroke="#fff" />
        ) : locked ? (
          <LockKeyhole size={18} />
        ) : (
          <Circle size={19} fill="#fff4bd" stroke={accent} />
        )}
        <Box
          sx={{
            borderRadius: 999,
            bgcolor: completed ? '#e1eaff' : locked ? '#eff0f5' : '#f1edfd',
            color: accent,
            px: 1,
            py: 0.15,
            fontSize: 12,
            lineHeight: 1.35,
          }}
        >
          {completed ? 'Completado' : locked ? 'Bloqueado' : data.typeName}
        </Box>
      </Box>
      <Typography sx={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.25 }}>
        {data.title}
      </Typography>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </Box>
  );
}

const nodeTypes = { roadmap: RoadmapCard };

function resourceIcon(type: Resource['type']) {
  if (type === 'VIDEO') return <FileCode2 size={20} />;
  return <FileText size={20} />;
}

export default function RoadmapCanvas({ identifier, canEdit = false, title, subtitle }: Props) {
  const [dto, setDto] = useState<RoadmapDto | null>(null);
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newVisible, setNewVisible] = useState(true);
  const [newTypeId, setNewTypeId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTypeId, setEditTypeId] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState<Resource['type']>('LINK');
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(true);

  function nodeStatus(node: RoadmapNode): NodeStatus {
    if (canEdit) return 'editing';
    if (node.isCompleted) return 'completed';
    return node.canComplete ? 'available' : 'locked';
  }

  function setFlow(roadmap: RoadmapDto) {
    const types = new Map(roadmap.nodeTypes.map((type) => [type.id, type.name]));
    setNodes(
      roadmap.nodes.map((node) => ({
        id: node.id,
        type: 'roadmap',
        data: {
          title: node.title,
          typeName: types.get(node.nodeTypeId) ?? 'Contenido',
          status: nodeStatus(node),
        },
        position: { x: node.positionX, y: node.positionY },
        hidden: !node.isVisible,
        deletable: false,
      })),
    );
    setEdges(
      roadmap.dependencies.map((dependency) => {
        const isSourceCompleted = roadmap.nodes.find(
          (node) => node.id === dependency.sourceNodeId,
        )?.isCompleted;
        const stroke = isSourceCompleted ? '#171720' : '#aeb9d4';
        return {
          id: dependency.id,
          source: dependency.sourceNodeId,
          target: dependency.targetNodeId,
          type: 'smoothstep',
          style: { stroke, strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 },
        };
      }),
    );
  }

  function requestError(response: Response, fallback: string) {
    return ResultAsync.fromPromise(response.json() as Promise<unknown>, () => fallback).andThen(
      (body) => err(apiErrorMessage(body) ?? fallback),
    );
  }

  function load() {
    return ResultAsync.fromPromise(
      fetch(roadmapUrl(identifier)),
      () => 'No se pudo cargar el roadmap.',
    )
      .andThen((response) =>
        response.ok
          ? ResultAsync.fromPromise(
              response.json() as Promise<unknown>,
              () => 'No se pudo cargar el roadmap.',
            ).andThen((body) =>
              isRoadmapDto(body) ? ok(body) : err('No se pudo cargar el roadmap.'),
            )
          : requestError(response, 'No se pudo cargar el roadmap.'),
      )
      .match(
        (body) => {
          setDto(body);
          setFlow(body);
          setNewTypeId(body.nodeTypes[0]?.id ?? '');
          setError(null);
        },
        (message) => {
          setError(message);
          setDto(null);
        },
      );
  }

  useEffect(() => {
    void load();
  }, [identifier.courseCode, identifier.year, identifier.semester]);

  function mutate(url: string, init: RequestInit) {
    return ResultAsync.fromPromise(
      fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      }),
      () => 'La operación no pudo completarse.',
    ).andThen((response) =>
      response.ok ? ok(undefined) : requestError(response, 'La operación no pudo completarse.'),
    );
  }

  function report(message: string, fallback: string) {
    setError(message || fallback);
  }

  async function addNode(event: React.FormEvent) {
    event.preventDefault();
    if (!newTitle.trim() || !newTypeId) return;
    await mutate(roadmapUrl(identifier, '/nodes'), {
      method: 'POST',
      body: JSON.stringify({
        title: newTitle,
        description: newDescription || null,
        nodeTypeId: newTypeId,
        positionX: 160,
        positionY: 160,
        isVisible: newVisible,
      }),
    }).match(
      async () => {
        setNewTitle('');
        setNewDescription('');
        await load();
      },
      (message) => report(message, 'No se pudo crear el nodo.'),
    );
  }

  const persistPosition: NodeDragHandler = async (_event, node) => {
    await mutate(roadmapUrl(identifier, `/nodes/${node.id}`), {
      method: 'PATCH',
      body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y }),
    }).match(
      () => undefined,
      async (message) => {
        report(message, 'No se pudo guardar la posición.');
        await load();
      },
    );
  };

  async function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    await mutate(roadmapUrl(identifier, '/dependencies'), {
      method: 'POST',
      body: JSON.stringify({ sourceNodeId: connection.source, targetNodeId: connection.target }),
    }).match(
      () => load(),
      (message) => report(message, 'No se pudo crear la dependencia.'),
    );
  }

  function selectNode(nodeId: string) {
    const node = dto?.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setEditTitle(node.title);
    setEditDescription(node.description ?? '');
    setEditTypeId(node.nodeTypeId);
  }

  async function updateNode(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedNodeId || !editTitle.trim()) return;
    await mutate(roadmapUrl(identifier, `/nodes/${selectedNodeId}`), {
      method: 'PATCH',
      body: JSON.stringify({
        title: editTitle,
        description: editDescription || null,
        nodeTypeId: editTypeId,
      }),
    }).match(
      () => load(),
      (message) => report(message, 'No se pudo guardar el nodo.'),
    );
  }

  async function toggleVisibility() {
    const node = dto?.nodes.find((item) => item.id === selectedNodeId);
    if (!node) return;
    await mutate(roadmapUrl(identifier, `/nodes/${node.id}`), {
      method: 'PATCH',
      body: JSON.stringify({ isVisible: !node.isVisible }),
    }).match(
      () => load(),
      (message) => report(message, 'No se pudo cambiar la visibilidad.'),
    );
  }

  async function deleteNode() {
    if (!selectedNodeId || !window.confirm('¿Eliminar este nodo y sus dependencias y recursos?'))
      return;
    await mutate(roadmapUrl(identifier, `/nodes/${selectedNodeId}`), {
      method: 'DELETE',
    }).match(
      async () => {
        setSelectedNodeId(null);
        await load();
      },
      (message) => report(message, 'No se pudo eliminar el nodo.'),
    );
  }

  async function addResource(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedNodeId || !resourceTitle.trim() || !resourceUrl.trim()) return;
    await mutate(roadmapUrl(identifier, `/nodes/${selectedNodeId}/resources`), {
      method: 'POST',
      body: JSON.stringify({ title: resourceTitle, url: resourceUrl, type: resourceType }),
    }).match(
      async () => {
        setResourceTitle('');
        setResourceUrl('');
        await load();
      },
      (message) => report(message, 'No se pudo agregar el recurso.'),
    );
  }

  async function completeNode(node: RoadmapNode) {
    if (!node.canComplete) return;
    await mutate(roadmapUrl(identifier, `/nodes/${node.id}/completion`), {
      method: 'POST',
    }).match(
      () => load(),
      async (message) => {
        await load();
        report(message, 'No se pudo completar el nodo.');
      },
    );
  }

  if (error && !dto)
    return (
      <Alert severity="error" sx={{ m: 4 }}>
        {error}
      </Alert>
    );
  if (!dto) return <Paper sx={{ m: 4, p: 4, color: 'text.secondary' }}>Cargando roadmap...</Paper>;

  const selectedNode = dto.nodes.find((node) => node.id === selectedNodeId);
  const selectedStatus = selectedNode ? nodeStatus(selectedNode) : null;
  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 1.25 }}>
          {error}
        </Alert>
      )}
      <Paper
        variant="outlined"
        sx={{
          minHeight: 'calc(100vh - 64px)',
          overflow: 'hidden',
          borderRadius: { xs: 0, sm: 1.5 },
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: canEdit && isEditorOpen ? '318px minmax(0, 1fr)' : 'minmax(0, 1fr)',
          },
          borderColor: '#e5e6ea',
          boxShadow: '0 2px 9px rgba(26,26,26,.05)',
          position: 'relative',
        }}
      >
        {canEdit && isEditorOpen && (
          <Box
            component="aside"
            sx={{
              order: { xs: 2, lg: 0 },
              p: 2.5,
              borderRight: { lg: '1px solid #e5e6ea' },
              borderTop: { xs: '1px solid #e5e6ea', lg: 0 },
              bgcolor: '#fbfbfc',
            }}
          >
            <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
              Edición del roadmap
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 600, mb: 2 }}>Agregar contenido</Typography>
            <Stack component="form" onSubmit={addNode} spacing={1.5}>
              <TextField
                label="Título del nodo"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                required
              />
              <TextField
                label="Descripción"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                multiline
                minRows={2}
              />
              <FormControl size="small">
                <InputLabel id="new-type">Tipo</InputLabel>
                <Select
                  labelId="new-type"
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
              <Button type="submit" variant="contained" startIcon={<Plus size={17} />}>
                Agregar nodo
              </Button>
            </Stack>
            <Divider sx={{ my: 2.5 }} />
            <Typography variant="body2" color="text.secondary">
              Arrastra los nodos para ordenar el mapa. Conecta un nodo con otro para crear una
              dependencia.
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            minHeight: { xs: 540, lg: 'calc(100vh - 64px)' },
            position: 'relative',
            bgcolor: '#fdfdfe',
          }}
        >
          {canEdit && (
            <Button
              aria-label={isEditorOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'}
              title={isEditorOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'}
              onClick={() => setIsEditorOpen((isOpen) => !isOpen)}
              size="small"
              variant="outlined"
              sx={{
                position: 'absolute',
                zIndex: 5,
                top: 18,
                left: 20,
                minWidth: 38,
                width: 38,
                height: 38,
                p: 0,
                borderColor: '#d7dbe6',
                bgcolor: 'rgba(255,255,255,.94)',
                color: 'primary.main',
              }}
            >
              {isEditorOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
            </Button>
          )}
          <Box
            sx={{
              position: 'absolute',
              zIndex: 4,
              top: 24,
              left: canEdit ? 66 : 24,
              pointerEvents: 'none',
            }}
          >
            <Typography
              component="h1"
              sx={{ fontSize: { xs: 23, sm: 30 }, fontWeight: 600, letterSpacing: '-0.045em' }}
            >
              {title}
            </Typography>
            <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 14 }}>
              {subtitle}
            </Typography>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              zIndex: 4,
              bottom: 18,
              left: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'rgba(255,255,255,.92)',
              px: 1.25,
              py: 0.75,
              border: '1px solid #e4e6ed',
              borderRadius: 1,
            }}
          >
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#0347bf' }} />
            <Typography variant="caption">Completado</Typography>
            <Circle size={12} color="#6d7180" fill="#fff" />
            <Typography variant="caption">Disponible</Typography>
            <LockKeyhole size={13} color="#777b8c" />
            <Typography variant="caption">Bloqueado</Typography>
          </Box>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable
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
            fitView
            fitViewOptions={{ padding: 0.28 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e8eaf1" gap={20} size={1} />
          </ReactFlow>
        </Box>
        {!canEdit && (
          <Box
            component="aside"
            sx={{
              position: 'absolute',
              zIndex: 6,
              top: 0,
              right: 0,
              bottom: 0,
              width: { xs: '100%', sm: 426 },
              bgcolor: '#fff',
              borderLeft: '1px solid #e5e6ea',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 24px rgba(24, 31, 54, 0.10)',
              transform: selectedNode ? 'translateX(0)' : 'translateX(100%)',
              opacity: selectedNode ? 1 : 0,
              pointerEvents: selectedNode ? 'auto' : 'none',
              transition: 'transform 260ms ease, opacity 180ms ease',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            {selectedNode ? (
              <>
                <Box sx={{ px: 3, pt: 2.75, pb: 2.5, borderBottom: '1px solid #e5e6ea' }}>
                  <Button
                    aria-label="Cerrar detalle"
                    onClick={() => setSelectedNodeId(null)}
                    size="small"
                    sx={{ position: 'absolute', top: 16, right: 16, minWidth: 36, p: 0 }}
                  >
                    <X size={18} />
                  </Button>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
                    Unidad del roadmap
                  </Typography>
                  <Typography
                    sx={{ mt: 0.5, fontSize: 24, fontWeight: 700, letterSpacing: '-0.035em' }}
                  >
                    {selectedNode.title}
                  </Typography>
                  {selectedStatus === 'completed' ? (
                    <Button
                      disabled
                      variant="contained"
                      sx={{ mt: 2 }}
                      startIcon={<Check size={16} />}
                    >
                      Completado
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      sx={{ mt: 2 }}
                      disabled={selectedStatus === 'locked'}
                      onClick={() => void completeNode(selectedNode)}
                      startIcon={
                        selectedStatus === 'locked' ? (
                          <LockKeyhole size={16} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )
                      }
                    >
                      {selectedStatus === 'locked' ? 'Completa prerrequisitos' : 'Completar'}
                    </Button>
                  )}
                </Box>
                <Box sx={{ px: 3, py: 2.5, overflowY: 'auto' }}>
                  <Typography
                    sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <FileText size={18} /> Descripción
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ mt: 1.25, whiteSpace: 'pre-line', lineHeight: 1.62 }}
                  >
                    {selectedNode.description || 'Esta unidad no tiene una descripción disponible.'}
                  </Typography>
                  <Divider sx={{ my: 3 }} />
                  <Typography
                    sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <Download size={18} /> Recursos
                  </Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                    {selectedNode.resources.length ? (
                      selectedNode.resources.map((resource) => (
                        <MuiLink
                          key={resource.id}
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          underline="none"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            p: 1.25,
                            border: '1px solid #e2e3e8',
                            borderRadius: 1.25,
                            color: 'text.primary',
                            '&:hover': { borderColor: 'primary.main', bgcolor: '#f8faff' },
                          }}
                        >
                          <Box sx={{ color: 'primary.main' }}>{resourceIcon(resource.type)}</Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
                              {resource.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {resource.type === 'FILE'
                                ? 'Archivo descargable'
                                : resource.type === 'VIDEO'
                                  ? 'Video'
                                  : 'Enlace externo'}
                            </Typography>
                          </Box>
                          <ChevronRight size={18} color="#777b8c" />
                        </MuiLink>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No hay recursos adjuntos para esta unidad.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </>
            ) : (
              <Box sx={{ p: 3, mt: { lg: 8 } }}>
                <Typography sx={{ fontSize: 20, fontWeight: 600 }}>
                  Selecciona una unidad
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Revisa su descripción, materiales y estado de avance desde este panel.
                </Typography>
              </Box>
            )}
          </Box>
        )}
        {canEdit && selectedNode && (
          <Box
            component="aside"
            sx={{
              order: { xs: 3, lg: 0 },
              gridColumn: { lg: '1 / -1' },
              p: 2.5,
              borderTop: '1px solid #e5e6ea',
              bgcolor: '#fff',
            }}
          >
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography sx={{ fontWeight: 700 }}>Editar: {selectedNode.title}</Typography>
              <Button
                size="small"
                onClick={() => setSelectedNodeId(null)}
                startIcon={<X size={15} />}
              >
                Cerrar
              </Button>
            </Stack>
            <Stack
              component="form"
              onSubmit={updateNode}
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
            >
              <TextField
                label="Título"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Descripción"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                fullWidth
              />
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel id="edit-type">Tipo</InputLabel>
                <Select
                  labelId="edit-type"
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
              <Button type="submit" variant="contained" startIcon={<Save size={16} />}>
                Guardar
              </Button>
              <Button onClick={() => void toggleVisibility()} variant="outlined">
                {selectedNode.isVisible ? 'Ocultar' : 'Mostrar'}
              </Button>
              <Button
                onClick={() => void deleteNode()}
                color="error"
                variant="outlined"
                aria-label="Eliminar nodo"
              >
                <Trash2 size={17} />
              </Button>
            </Stack>
            <Stack
              component="form"
              onSubmit={addResource}
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{ mt: 1.5 }}
            >
              <TextField
                label="Recurso"
                value={resourceTitle}
                onChange={(event) => setResourceTitle(event.target.value)}
                required
              />
              <TextField
                label="URL"
                value={resourceUrl}
                onChange={(event) => setResourceUrl(event.target.value)}
                required
                fullWidth
              />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="resource-type">Tipo</InputLabel>
                <Select
                  labelId="resource-type"
                  label="Tipo"
                  value={resourceType}
                  onChange={(event) => setResourceType(event.target.value as Resource['type'])}
                >
                  <MenuItem value="FILE">Archivo</MenuItem>
                  <MenuItem value="LINK">Enlace</MenuItem>
                  <MenuItem value="VIDEO">Video</MenuItem>
                </Select>
              </FormControl>
              <Button type="submit" variant="outlined">
                Agregar recurso
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
