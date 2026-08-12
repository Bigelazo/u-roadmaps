import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roadmaps Interactivos DCC - Universidad de Chile',
  description: 'Visualizador y gestor de rutas pedagógicas y asignaturas universitarias.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
