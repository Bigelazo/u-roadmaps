import { notFound } from 'next/navigation';
import { Archivo, Plus_Jakarta_Sans } from 'next/font/google';
import DesignPreviewLab from './DesignPreviewLab';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
});

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
});

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />
      <DesignPreviewLab fontClassName={`${plusJakarta.variable} ${archivo.variable}`} />
    </>
  );
}
