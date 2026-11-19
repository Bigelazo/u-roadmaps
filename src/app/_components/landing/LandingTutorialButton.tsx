'use client';

import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { TutorialChoiceDialog } from '@/shared/client/tutorial/tutorial-choice-dialog';
import { cn } from 'cn';

const heroTutorialSelector = '[data-hero-tutorial]';

function TutorialButton({ className, hero = false }: { className?: string; hero?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        data-hero-tutorial={hero || undefined}
        className={cn(
          'border-fog bg-card text-ink shadow-[0_10px_30px_rgb(18_33_58/22%)] hover:bg-cloud active:translate-y-px dark:border-steel dark:bg-popover dark:hover:bg-muted',
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <Play aria-hidden="true" data-icon="inline-start" className="fill-primary text-primary" />
        Probar tutorial
      </Button>
      <TutorialChoiceDialog open={open} onOpenChange={setOpen} origin="/" />
    </>
  );
}

export function HeroTutorialButton() {
  return <TutorialButton hero />;
}

export function LandingTutorialButton() {
  const [heroActionVisible, setHeroActionVisible] = useState(true);

  useEffect(() => {
    const heroAction = document.querySelector(heroTutorialSelector);
    if (!heroAction) return setHeroActionVisible(false);
    const observer = new IntersectionObserver(([entry]) =>
      setHeroActionVisible(entry.isIntersecting),
    );
    observer.observe(heroAction);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pointer-events-none sticky top-16 z-10 h-0">
      <div
        inert={heroActionVisible}
        data-hidden={heroActionVisible || undefined}
        className="mx-auto flex max-w-360 justify-end px-4 pt-3 transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-hidden:-translate-y-2 data-hidden:opacity-0 sm:px-6"
      >
        <TutorialButton className="pointer-events-auto" />
      </div>
    </div>
  );
}
