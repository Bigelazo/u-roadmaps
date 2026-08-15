'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Fab, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { UsersRound } from 'lucide-react';

type Persona = { id: string; label: string };

export default function DevelopmentBar({
  personas,
  hideOnPersonaPage = false,
}: {
  personas: Persona[];
  hideOnPersonaPage?: boolean;
}) {
  const pathname = usePathname();
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

  async function assumePersona(userId: string) {
    const response = await fetch('/api/development/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (response.ok) window.location.assign('/academic-overview');
  }

  if (hideOnPersonaPage && pathname === '/development/personas') return null;

  return (
    <>
      <Tooltip title="Cambiar perfil de desarrollo" placement="right">
        <Fab
          aria-label="Cambiar perfil de desarrollo"
          color="primary"
          onClick={(event) => setAnchorElement(event.currentTarget)}
          size="medium"
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 24 },
            left: { xs: 16, sm: 24 },
            zIndex: 1300,
          }}
        >
          <UsersRound />
        </Fab>
      </Tooltip>
      <Menu
        anchorEl={anchorElement}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClose={() => setAnchorElement(null)}
        open={Boolean(anchorElement)}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Typography
          sx={{ px: 2, pt: 1.5, pb: 0.5, fontSize: 12, fontWeight: 700, color: 'text.secondary' }}
        >
          CAMBIAR PERFIL
        </Typography>
        {personas.map((persona) => (
          <MenuItem
            key={persona.id}
            onClick={() => {
              setAnchorElement(null);
              void assumePersona(persona.id);
            }}
          >
            {persona.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
