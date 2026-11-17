'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import { useInView } from 'motion/react';
import { Button } from '@/shared/ui/button';
import { defaultTheme, parseThemePreference } from '@/shared/theme-preference';
import { cn } from 'cn';

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const documentTheme = () => parseThemePreference(document.documentElement.dataset.theme);
const serverTheme = () => defaultTheme;

export function FeatureClip({
  slug,
  label,
  active = true,
  className,
}: {
  slug: string;
  label: string;
  active?: boolean;
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribeToTheme, documentTheme, serverTheme);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(frameRef, { amount: 0.4 });
  const [paused, setPaused] = useState(false);
  const playing = active && inView && !paused;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) video.play().catch(() => undefined);
    else video.pause();
  }, [playing, theme]);

  return (
    <div
      ref={frameRef}
      className={cn(
        'relative aspect-16/10 overflow-hidden rounded-xl border border-fog bg-muted shadow-[0_18px_50px_rgb(18_33_58/8%)]',
        className,
      )}
    >
      <video
        key={theme}
        ref={videoRef}
        src={`/landing/${slug}-${theme}.webm`}
        aria-label={label}
        muted
        loop
        playsInline
        preload="none"
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
