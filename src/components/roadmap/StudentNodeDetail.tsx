'use client';

import { useMediaQuery, useTheme } from '@mui/material';
import { Box, Button, Dialog, Divider, Link as MuiLink, Stack, Typography } from '@mui/material';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  LockKeyhole,
  X,
} from 'lucide-react';
import type { Resource, RoadmapNode } from '@/lib/roadmap-types';
import type { StudentNodeStatus } from '@/components/roadmap/node-status';

function resourceIcon(type: Resource['type']) {
  return type === 'VIDEO' ? <FileCode2 size={20} /> : <FileText size={20} />;
}

function resourceTypeLabel(type: Resource['type']) {
  return type === 'FILE' ? 'Archivo descargable' : type === 'VIDEO' ? 'Video' : 'Enlace externo';
}

type ContentProps = {
  node: RoadmapNode;
  status: StudentNodeStatus;
  onClose: () => void;
  onComplete: (node: RoadmapNode) => void;
};

function StudentNodeDetailContent({ node, status, onClose, onComplete }: ContentProps) {
  return (
    <>
      <Box sx={{ px: 3, pt: 2.75, pb: 2.5, borderBottom: '1px solid #e5e6ea' }}>
        <Button
          aria-label="Cerrar detalle"
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 16, right: 16, minWidth: 36, p: 0 }}
        >
          <X size={18} />
        </Button>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
          Nodo del roadmap
        </Typography>
        <Typography
          id="student-node-detail-title"
          sx={{ mt: 0.5, fontSize: 24, fontWeight: 700, letterSpacing: '-0.035em' }}
        >
          {node.title}
        </Typography>
        {status === 'completed' ? (
          <Button disabled variant="contained" sx={{ mt: 2 }} startIcon={<Check size={16} />}>
            Completado
          </Button>
        ) : (
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            disabled={status === 'locked'}
            onClick={() => onComplete(node)}
            startIcon={status === 'locked' ? <LockKeyhole size={16} /> : <CheckCircle2 size={16} />}
          >
            {status === 'locked' ? 'Completa prerrequisitos' : 'Completar'}
          </Button>
        )}
      </Box>
      <Box sx={{ px: 3, py: 2.5, overflowY: 'auto' }}>
        <Typography sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileText size={18} /> Descripción
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 1.25, whiteSpace: 'pre-line', lineHeight: 1.62 }}
        >
          {node.description || 'Este nodo no tiene una descripción disponible.'}
        </Typography>
        <Divider sx={{ my: 3 }} />
        <Typography sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Download size={18} /> Recursos
        </Typography>
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
          {node.resources.length ? (
            node.resources.map((resource) => (
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
                    {resourceTypeLabel(resource.type)}
                  </Typography>
                </Box>
                <ChevronRight size={18} color="#777b8c" />
              </MuiLink>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No hay recursos adjuntos para este nodo.
            </Typography>
          )}
        </Stack>
      </Box>
    </>
  );
}

type Props = Omit<ContentProps, 'node' | 'status'> & {
  node: RoadmapNode | undefined;
  status: StudentNodeStatus | null;
};

export function StudentNodeDetail({ node, status, onClose, onComplete }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  if (!node || !status) {
    if (isMobile) return null;
    return (
      <Box
        component="aside"
        sx={{
          position: 'absolute',
          zIndex: 6,
          top: 0,
          right: 0,
          bottom: 0,
          width: 426,
          bgcolor: '#fff',
          borderLeft: '1px solid #e5e6ea',
          boxShadow: '-8px 0 24px rgba(24, 31, 54, 0.10)',
        }}
      >
        <Box sx={{ p: 3, mt: { lg: 8 } }}>
          <Typography sx={{ fontSize: 20, fontWeight: 600 }}>Selecciona un nodo</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Revisa su descripción, materiales y estado de avance desde este panel.
          </Typography>
        </Box>
      </Box>
    );
  }
  const content = (
    <StudentNodeDetailContent
      node={node}
      status={status}
      onClose={onClose}
      onComplete={onComplete}
    />
  );

  if (isMobile) {
    return (
      <Dialog
        open
        aria-labelledby="student-node-detail-title"
        onClose={onClose}
        fullScreen
        scroll="paper"
      >
        {content}
      </Dialog>
    );
  }

  return (
    <Box
      component="aside"
      aria-labelledby="student-node-detail-title"
      sx={{
        position: 'absolute',
        zIndex: 6,
        top: 0,
        right: 0,
        bottom: 0,
        width: 426,
        bgcolor: '#fff',
        borderLeft: '1px solid #e5e6ea',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 24px rgba(24, 31, 54, 0.10)',
      }}
    >
      {content}
    </Box>
  );
}
