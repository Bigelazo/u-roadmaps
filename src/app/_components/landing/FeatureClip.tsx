'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import { useInView } from 'motion/react';
import { Button } from '@/shared/ui/button';
import { parseThemePreference } from '@/shared/theme-preference';
import { cn } from 'cn';

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const documentTheme = () => parseThemePreference(document.documentElement.dataset.theme);
const serverTheme = () => null;

export function FeatureClip({
  slug,
  label,
  className,
}: {
  slug: string;
  label: string;
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribeToTheme, documentTheme, serverTheme);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const near = useInView(frameRef, { once: true, margin: '150% 0px' });
  const inView = useInView(frameRef, { amount: 0.25 });
  const [paused, setPaused] = useState(false);
  const playing = inView && !paused;
  const src = theme && near ? `/landing/${slug}-${theme}.webm#t=0.001` : undefined;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (playing) video.play().catch((error: Error) => setPaused(error.name === 'NotAllowedError'));
    else video.pause();
  }, [playing, src]);

  return (
    <div
      ref={frameRef}
      className={cn(
        'relative aspect-16/10 overflow-hidden rounded-xl border border-fog bg-muted shadow-[0_18px_50px_rgb(18_33_58/8%)]',
        className,
      )}
    >
      <video
        key={src}
        ref={videoRef}
        src={src}
        aria-label={label}
        muted
        loop
        playsInline
        preload="auto"
        className="size-full object-cover"
      />
      <Button
        variant="secondary"
        size="icon"
        aria-label={paused ? 'Reproducir demostración' : 'Pausar demostración'}
        className="absolute right-2 bottom-2 border-fog bg-card/90 text-ink hover:bg-card"
        onClick={() => setPaused(!paused)}
      >
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </Button>
    </div>
  );
}
