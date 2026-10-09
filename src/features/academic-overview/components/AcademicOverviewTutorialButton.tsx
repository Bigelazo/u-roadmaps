'use client';

import { CircleHelp } from 'lucide-react';
import { useState } from 'react';
import {
  TUTORIAL_TRIGGER_ATTRIBUTE,
  TutorialClosingPopover,
} from '@/shared/client/tutorial/tutorial';
import { TutorialChoiceDialog } from '@/shared/client/tutorial/tutorial-choice-dialog';
import { Button } from '@/shared/ui/button';

/**
 * The Academic overview question-mark icon that lets any User pick a Roadmap tutorial.
 * When `invited`, the same choice opens by itself as the first-visit invitation.
 */
export function AcademicOverviewTutorialButton({
  invited = false,
}: Readonly<{ invited?: boolean }>) {
  const [open, setOpen] = useState(invited);
  return (
    <>
      <Button
        {...{ [TUTORIAL_TRIGGER_ATTRIBUTE]: '' }}
        variant="outline"
        size="icon"
        aria-label="Abrir tutorial"
        title="Abrir tutorial"
        onClick={() => setOpen(true)}
      >
        <CircleHelp />
      </Button>
      <TutorialChoiceDialog
        open={open}
        onOpenChange={setOpen}
        origin="/academic-overview"
        declinable={invited}
      />
      <TutorialClosingPopover />
    </>
  );
}
