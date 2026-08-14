'use client';

import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import type { ReactNode } from 'react';

const theme = createTheme({
  palette: {
    primary: { main: '#024ad8', light: '#296ef9', dark: '#0e3191', contrastText: '#ffffff' },
    error: { main: '#b3262b' },
    text: { primary: '#1a1a1a', secondary: '#636363' },
    background: { default: '#f7f7f7', paper: '#ffffff' },
    divider: '#e8e8e8',
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", Arial, sans-serif',
    h1: { fontSize: '2.75rem', fontWeight: 500, lineHeight: 1 },
    h2: { fontSize: '2rem', fontWeight: 500, lineHeight: 1 },
    h3: { fontSize: '1.5rem', fontWeight: 500, lineHeight: 1.17 },
    body1: { fontSize: '1rem', lineHeight: 1.38 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.7px' },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 44, borderRadius: 4 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
  },
});

export default function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
