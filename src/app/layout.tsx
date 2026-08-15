import './globals.css';
import type { Metadata } from 'next';
import ThemeRegistry from '@/components/ThemeRegistry';
import DevelopmentBar from '@/components/DevelopmentBar';
import { developmentEnvironmentEnabled, developmentPersonas } from '@/lib/development';

export const metadata: Metadata = {
  title: 'Roadmaps Interactivos DCC - Universidad de Chile',
  description: 'Visualizador y gestor de rutas pedagógicas y asignaturas universitarias.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ThemeRegistry>
          {developmentEnvironmentEnabled() && <DevelopmentBar personas={developmentPersonas} />}
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}
