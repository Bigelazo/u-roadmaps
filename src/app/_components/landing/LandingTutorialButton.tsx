'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { TutorialChoiceDialog } from '@/shared/client/tutorial/tutorial-choice-dialog';

export function LandingTutorialButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none sticky top-16 z-10 h-0">
        <div className="mx-auto flex max-w-360 justify-end px-4 pt-3 sm:px-6">
          <Button
            variant="secondary"
            className="pointer-events-auto border-fog bg-card text-ink shadow-[0_10px_30px_rgb(18_33_58/22%)] hover:bg-cloud active:translate-y-px dark:border-steel dark:bg-popover dark:hover:bg-muted"
            onClick={() => setOpen(true)}
          >
            <Play
              aria-hidden="true"
              data-icon="inline-start"
              className="fill-primary text-primary"
            />
            Probar tutorial
          </Button>
        </div>
      </div>
      <TutorialChoiceDialog open={open} onOpenChange={setOpen} origin="/" />
    </>
  );
}
