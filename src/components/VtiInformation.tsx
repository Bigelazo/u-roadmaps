'use client';

import { useEffect } from 'react';
import { Paper, Stack, Typography } from '@mui/material';

type VtiClaimValue =
  | string
  | number
  | boolean
  | null
  | VtiClaimValue[]
  | { [key: string]: VtiClaimValue };

type Props = { claims: Record<string, VtiClaimValue> };

function formatClaim(value: VtiClaimValue) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export default function VtiInformation({ claims }: Props) {
  useEffect(() => {
    console.log('Información recibida desde VTI SSO:', claims);
  }, [claims]);

  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
      <Stack spacing={2}>
        <Typography variant="h3">Información institucional</Typography>
        <Typography color="text.secondary">
          Datos recibidos desde el inicio de sesión institucional.
        </Typography>
        <Stack component="dl" spacing={1.5} sx={{ m: 0 }}>
          {Object.entries(claims).map(([key, value]) => (
            <Stack component="div" key={key} spacing={0.25}>
              <Typography
                component="dt"
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700 }}
              >
                {key}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                {formatClaim(value)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
