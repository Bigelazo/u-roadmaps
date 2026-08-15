import Link from 'next/link';
import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import { Network } from 'lucide-react';
import SessionButton from '@/components/SessionButton';

export default function GlobalNavigation({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <AppBar
      color="transparent"
      elevation={0}
      position="sticky"
      sx={{ bgcolor: '#fff', borderBottom: '1px solid #e7e7eb' }}
    >
      <Toolbar sx={{ minHeight: '64px !important', px: { xs: 2, sm: 4 } }}>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#0347bf',
            textDecoration: 'none',
          }}
        >
          <Network size={22} strokeWidth={2.5} />
          <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.04em' }}>
            U-Roadmaps
          </Typography>
        </Link>
        <Box sx={{ ml: 'auto' }}>
          <SessionButton isAuthenticated={isAuthenticated} />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
