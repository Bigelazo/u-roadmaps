'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';

type Persona = { id: string; label: string };

export default function DevelopmentBar({ personas }: { personas: Persona[] }) {
  const [userId, setUserId] = useState(personas[0]?.id ?? '');
  async function assumePersona() {
    const response = await fetch('/api/development/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (response.ok) window.location.assign('/academic-overview');
  }
  return (
    <Paper
      square
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1300,
        px: 2,
        py: 1,
        bgcolor: '#1a1a1a',
        color: 'common.white',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          DESARROLLO
        </Typography>
        <Select
          size="small"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          sx={{ bgcolor: 'common.white', minWidth: 260 }}
        >
          {personas.map((persona) => (
            <MenuItem key={persona.id} value={persona.id}>
              {persona.label}
            </MenuItem>
          ))}
        </Select>
        <Button size="small" variant="contained" onClick={() => void assumePersona()}>
          Cambiar identidad
        </Button>
        <Button component={Link} href="/development/personas" size="small" color="inherit">
          Ver personas
        </Button>
      </Stack>
    </Paper>
  );
}
