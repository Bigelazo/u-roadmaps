'use client';

import { useEffect, useState } from 'react';
import {
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Box,
  Button,
  Checkbox,
  Divider,
  Stack,
} from '@mui/material';
import { PanelRightClose, PanelRightOpen, Plus, Save, Trash2, X } from 'lucide-react';
import type { Resource, RoadmapDependency, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';

type Props = {
  roadmap: RoadmapDto;
  selectedNode: RoadmapNode | undefined;
  selectedDependency: RoadmapDependency | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAddNode: (node: {
    title: string;
    description: string;
    nodeTypeId: string;
    isVisible: boolean;
  }) => Promise<boolean>;
  onUpdateNode: (
    nodeId: string,
    node: { title: string; description: string; nodeTypeId: string },
  ) => Promise<boolean>;
  onToggleVisibility: (nodeId: string, isVisible: boolean) => Promise<boolean>;
  onDeleteNode: (nodeId: string) => Promise<boolean>;
  onAddDependency: (sourceNodeId: string, targetNodeId: string) => Promise<boolean>;
  onDeleteDependency: (dependencyId: string) => Promise<boolean>;
  onCloseDependency: () => void;
  onAddResource: (
    nodeId: string,
    resource: { title: string; url: string; type: Resource['type'] },
  ) => Promise<boolean>;
};

export function RoadmapEditor({
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
}: Props) {
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newVisible, setNewVisible] = useState(true);
  const [newTypeId, setNewTypeId] = useState(roadmap.nodeTypes[0]?.id ?? '');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTypeId, setEditTypeId] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState<Resource['type']>('LINK');
  const [dependencySourceId, setDependencySourceId] = useState('');
  const [dependencyTargetId, setDependencyTargetId] = useState('');

  useEffect(() => setNewTypeId(roadmap.nodeTypes[0]?.id ?? ''), [roadmap]);
  useEffect(() => {
    setEditTitle(selectedNode?.title ?? '');
    setEditDescription(selectedNode?.description ?? '');
    setEditTypeId(selectedNode?.nodeTypeId ?? '');
  }, [selectedNode]);
  useEffect(() => {
    const firstNodeId = roadmap.nodes[0]?.id ?? '';
    setDependencySourceId((current) =>
      roadmap.nodes.some((node) => node.id === current) ? current : firstNodeId,
    );
    setDependencyTargetId((current) =>
      roadmap.nodes.some((node) => node.id === current) ? current : firstNodeId,
    );
  }, [roadmap.nodes]);

  const sourceNode = selectedDependency
    ? roadmap.nodes.find((node) => node.id === selectedDependency.sourceNodeId)
    : undefined;
  const targetNode = selectedDependency
    ? roadmap.nodes.find((node) => node.id === selectedDependency.targetNodeId)
    : undefined;

  return (
    <>
      {isOpen ? (
        <Box
          component="aside"
          aria-label="Panel de edición del roadmap"
          sx={{
            order: { xs: 2, lg: 0 },
            minWidth: 0,
            height: { lg: 'calc(100vh - 64px)' },
            overflowY: { lg: 'auto' },
            p: 2.5,
            borderTop: { xs: '1px solid #dce1e8', lg: 0 },
            borderLeft: { lg: '1px solid #dce1e8' },
            borderRight: { lg: '4px solid #024ad8' },
            bgcolor: '#f3f5f7',
          }}
        >
          <Stack
            direction="row"
            sx={{ alignItems: 'start', justifyContent: 'space-between', mb: 2 }}
          >
            <Box>
              <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
                Edición del roadmap
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 600 }}>Agregar contenido</Typography>
            </Box>
            <Button
              aria-label="Ocultar panel de edición"
              title="Ocultar panel de edición"
              onClick={onToggle}
              size="small"
              variant="outlined"
              sx={{ minWidth: 44, width: 44, height: 44, p: 0, borderColor: '#aeb7c3' }}
            >
              <PanelRightClose size={19} />
            </Button>
          </Stack>
          <Stack
            component="form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                newTitle.trim() &&
                newTypeId &&
                (await onAddNode({
                  title: newTitle,
                  description: newDescription,
                  nodeTypeId: newTypeId,
                  isVisible: newVisible,
                }))
              ) {
                setNewTitle('');
                setNewDescription('');
              }
            }}
            spacing={1.5}
          >
            <TextField
              label="Título del nodo"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              required
              fullWidth
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
                {roadmap.nodeTypes.map((type) => (
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
            Arrastra los nodos para ordenar el mapa. Arrastra desde el punto azul de un nodo al
            punto blanco de otro para crear una dependencia. Selecciona una flecha para ver su
            detalle o eliminarla.
          </Typography>
          <Stack
            component="form"
            spacing={1.25}
            sx={{ mt: 2 }}
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                dependencySourceId &&
                dependencyTargetId &&
                dependencySourceId !== dependencyTargetId
              )
                await onAddDependency(dependencySourceId, dependencyTargetId);
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Agregar dependencia</Typography>
            <FormControl size="small">
              <InputLabel id="dependency-source">Desde</InputLabel>
              <Select
                labelId="dependency-source"
                label="Desde"
                value={dependencySourceId}
                onChange={(event) => setDependencySourceId(event.target.value)}
              >
                {roadmap.nodes.map((node) => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel id="dependency-target">Hacia</InputLabel>
              <Select
                labelId="dependency-target"
                label="Hacia"
                value={dependencyTargetId}
                onChange={(event) => setDependencyTargetId(event.target.value)}
              >
                {roadmap.nodes.map((node) => (
                  <MenuItem key={node.id} value={node.id} disabled={node.id === dependencySourceId}>
                    {node.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              type="submit"
              variant="outlined"
              disabled={
                !dependencySourceId ||
                !dependencyTargetId ||
                dependencySourceId === dependencyTargetId
              }
            >
              Crear dependencia
            </Button>
          </Stack>
          {selectedDependency ? (
            <>
              <Divider sx={{ my: 2.5 }} />
              <Box component="section" aria-labelledby="selected-dependency-heading">
                <Stack
                  direction="row"
                  sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
                >
                  <Typography id="selected-dependency-heading" sx={{ fontWeight: 700, pr: 1 }}>
                    Dependencia seleccionada
                  </Typography>
                  <Button size="small" onClick={onCloseDependency} startIcon={<X size={15} />}>
                    Cerrar
                  </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Desde
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {sourceNode?.title ?? 'Nodo eliminado'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  Hacia
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {targetNode?.title ?? 'Nodo eliminado'}
                </Typography>
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<Trash2 size={16} />}
                  sx={{ mt: 2 }}
                  onClick={() =>
                    void onDeleteDependency(selectedDependency.id).then((deleted) => {
                      if (deleted) onCloseDependency();
                    })
                  }
                >
                  Eliminar dependencia
                </Button>
              </Box>
            </>
          ) : selectedNode ? (
            <>
              <Divider sx={{ my: 2.5 }} />
              <Box component="section" aria-labelledby="selected-node-heading">
                <Stack
                  direction="row"
                  sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
                >
                  <Typography id="selected-node-heading" sx={{ fontWeight: 700, pr: 1 }}>
                    Editar: {selectedNode.title}
                  </Typography>
                  <Button size="small" onClick={onClose} startIcon={<X size={15} />}>
                    Cerrar
                  </Button>
                </Stack>
                <Stack
                  component="form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (editTitle.trim())
                      await onUpdateNode(selectedNode.id, {
                        title: editTitle,
                        description: editDescription,
                        nodeTypeId: editTypeId,
                      });
                  }}
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
                      {roadmap.nodeTypes.map((type) => (
                        <MenuItem key={type.id} value={type.id}>
                          {type.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Stack direction="row" spacing={1}>
                    <Button type="submit" variant="contained" startIcon={<Save size={16} />}>
                      Guardar cambios
                    </Button>
                    <Button
                      onClick={() =>
                        void onToggleVisibility(selectedNode.id, selectedNode.isVisible)
                      }
                      variant="outlined"
                    >
                      {selectedNode.isVisible ? 'Ocultar' : 'Mostrar'}
                    </Button>
                    <Button
                      onClick={() => {
                        if (window.confirm('¿Eliminar este nodo y sus dependencias y recursos?'))
                          void onDeleteNode(selectedNode.id).then((deleted) => {
                            if (deleted) onClose();
                          });
                      }}
                      color="error"
                      variant="outlined"
                      aria-label="Eliminar nodo"
                    >
                      <Trash2 size={17} />
                    </Button>
                  </Stack>
                </Stack>
                <Stack
                  component="form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                      resourceTitle.trim() &&
                      resourceUrl.trim() &&
                      (await onAddResource(selectedNode.id, {
                        title: resourceTitle,
                        url: resourceUrl,
                        type: resourceType,
                      }))
                    ) {
                      setResourceTitle('');
                      setResourceUrl('');
                    }
                  }}
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
                  <Button type="submit" variant="outlined" fullWidth>
                    Agregar recurso
                  </Button>
                </Stack>
              </Box>
            </>
          ) : null}
        </Box>
      ) : (
        <Button
          aria-label="Mostrar panel de edición"
          title="Mostrar panel de edición"
          onClick={onToggle}
          size="small"
          variant="outlined"
          sx={{
            position: 'absolute',
            zIndex: 5,
            top: 18,
            right: 20,
            minWidth: 44,
            width: 44,
            height: 44,
            p: 0,
            borderColor: '#aeb7c3',
            bgcolor: 'rgba(255,255,255,.94)',
            color: 'primary.main',
          }}
        >
          <PanelRightOpen size={19} />
        </Button>
      )}
    </>
  );
}
