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
import { PanelLeftClose, PanelLeftOpen, Plus, Save, Trash2, X } from 'lucide-react';
import type { Resource, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';

type Props = {
  roadmap: RoadmapDto;
  selectedNode: RoadmapNode | undefined;
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
  onAddResource: (
    nodeId: string,
    resource: { title: string; url: string; type: Resource['type'] },
  ) => Promise<boolean>;
};

export function RoadmapEditor({
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

  useEffect(() => setNewTypeId(roadmap.nodeTypes[0]?.id ?? ''), [roadmap]);
  useEffect(() => {
    setEditTitle(selectedNode?.title ?? '');
    setEditDescription(selectedNode?.description ?? '');
    setEditTypeId(selectedNode?.nodeTypeId ?? '');
  }, [selectedNode]);

  return (
    <>
      {isOpen && (
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
            Arrastra los nodos para ordenar el mapa. Conecta un nodo con otro para crear una
            dependencia.
          </Typography>
        </Box>
      )}
      <Button
        aria-label={isOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'}
        title={isOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'}
        onClick={onToggle}
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
        {isOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
      </Button>
      {selectedNode && (
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
                {roadmap.nodeTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button type="submit" variant="contained" startIcon={<Save size={16} />}>
              Guardar
            </Button>
            <Button
              onClick={() => void onToggleVisibility(selectedNode.id, selectedNode.isVisible)}
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
    </>
  );
}
