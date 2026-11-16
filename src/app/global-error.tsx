'use client';

import './globals.css';
import { Plus_Jakarta_Sans, Poppins } from 'next/font/google';
import { cn } from 'cn';
import { ServerErrorPage, type ErrorBoundaryProps } from '@/app/_components/ServerErrorPage';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const poppins = Poppins({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
});

export default function GlobalError(props: ErrorBoundaryProps) {
  return (
    <html lang="es" className={cn('font-sans', plusJakartaSans.variable, poppins.variable)}>
      <body className="flex min-h-dvh flex-col">
        <title>Error | U-Roadmaps</title>
        <ServerErrorPage {...props} />
      </body>
    </html>
  );
}
