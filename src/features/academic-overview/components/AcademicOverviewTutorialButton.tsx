'use client';

import { CircleHelp } from 'lucide-react';
import { useState } from 'react';
import {
  TUTORIAL_TRIGGER_ATTRIBUTE,
  TutorialClosingPopover,
} from '@/shared/client/tutorial/tutorial';
import { TutorialChoiceDialog } from '@/shared/client/tutorial/tutorial-choice-dialog';
import { Button } from '@/shared/ui/button';

/** The Academic overview question-mark icon that lets any User pick a Roadmap tutorial. */
export function AcademicOverviewTutorialButton() {
  const [open, setOpen] = useState(false);
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
      <TutorialChoiceDialog open={open} onOpenChange={setOpen} origin="/academic-overview" />
      <TutorialClosingPopover />
    </>
  );
}
