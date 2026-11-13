'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { TutorialChoiceDialog } from '@/shared/client/tutorial/tutorial-choice-dialog';

export function LandingTutorialButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="lg" variant="secondary" onClick={() => setOpen(true)}>
        Probar tutorial
      </Button>
      <TutorialChoiceDialog open={open} onOpenChange={setOpen} origin="/" />
    </>
  );
}
