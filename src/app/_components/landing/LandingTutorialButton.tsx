'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { TutorialChoiceDialog } from '@/shared/client/tutorial/tutorial-choice-dialog';

export function LandingTutorialButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="lg"
        variant="secondary"
        className="dark:border-brand-surface-foreground dark:bg-transparent dark:text-brand-surface-foreground dark:hover:bg-brand-surface-foreground/10"
        onClick={() => setOpen(true)}
      >
        Probar tutorial
      </Button>
      <TutorialChoiceDialog open={open} onOpenChange={setOpen} origin="/" />
    </>
  );
}
