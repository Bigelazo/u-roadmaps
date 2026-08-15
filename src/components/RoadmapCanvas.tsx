'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Paper, Typography } from '@mui/material';
import { Circle, LockKeyhole } from 'lucide-react';
import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';
import { RoadmapEditor } from '@/components/roadmap/RoadmapEditor';
import { RoadmapGraph } from '@/components/roadmap/RoadmapGraph';
import { StudentNodeDetail } from '@/components/roadmap/StudentNodeDetail';
import { studentNodeStatus } from '@/components/roadmap/node-status';
import { useRoadmap } from '@/components/roadmap/useRoadmap';

type Props = {
  identifier: CourseOfferingIdentifier;
  canEdit?: boolean;
  title: string;
  subtitle: string;
};

export default function RoadmapCanvas({ identifier, canEdit = false, title, subtitle }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const selectedNodeTriggerRef = useRef<HTMLElement | null>(null);
  const {
    roadmap,
    error,
    addNode,
    updateNode,
    moveNode,
    connectNodes,
    toggleVisibility,
    deleteNode,
    addResource,
    completeNode,
  } = useRoadmap(identifier);

  useEffect(() => {
    setSelectedNodeId(null);
  }, [identifier.courseCode, identifier.year, identifier.semester]);

  function closeSelectedNode() {
    setSelectedNodeId(null);
    requestAnimationFrame(() => selectedNodeTriggerRef.current?.focus());
  }

  if (error && !roadmap)
    return (
      <Alert severity="error" sx={{ m: 4 }}>
        {error}
      </Alert>
    );
  if (!roadmap)
    return <Paper sx={{ m: 4, p: 4, color: 'text.secondary' }}>Cargando roadmap...</Paper>;

  const selectedNode = roadmap.nodes.find((node) => node.id === selectedNodeId);
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
        {canEdit && (
          <RoadmapEditor
            roadmap={roadmap}
            selectedNode={selectedNode}
            isOpen={isEditorOpen}
            onToggle={() => setIsEditorOpen((isOpen) => !isOpen)}
            onClose={closeSelectedNode}
            onAddNode={addNode}
            onUpdateNode={updateNode}
            onToggleVisibility={toggleVisibility}
            onDeleteNode={deleteNode}
            onAddResource={addResource}
          />
        )}
        <Box
          sx={{
            minHeight: { xs: 540, lg: 'calc(100vh - 64px)' },
            position: 'relative',
            bgcolor: '#fdfdfe',
          }}
        >
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
          <RoadmapGraph
            roadmap={roadmap}
            canEdit={canEdit}
            onSelectNode={(nodeId, trigger) => {
              selectedNodeTriggerRef.current = trigger;
              setSelectedNodeId(nodeId);
            }}
            onMoveNode={(_event, node) => void moveNode(node.id, node.position)}
            onConnectNodes={(connection) => {
              if (connection.source && connection.target)
                void connectNodes(connection.source, connection.target);
            }}
          />
        </Box>
        {!canEdit && (
          <StudentNodeDetail
            node={selectedNode}
            status={selectedNode ? studentNodeStatus(selectedNode) : null}
            onClose={closeSelectedNode}
            onComplete={(node) => void completeNode(node.id)}
          />
        )}
      </Paper>
    </Box>
  );
}
