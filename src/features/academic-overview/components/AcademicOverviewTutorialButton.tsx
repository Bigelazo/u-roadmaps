'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';

import { CircleHelp } from 'lucide-react';
import { useState } from 'react';
import { TutorialClosingPopover } from '@/shared/client/tutorial/tutorial';
import { TUTORIAL_TRIGGER_ATTRIBUTE } from '@/shared/client/tutorial/tutorial-support';
import { TutorialChoiceDialog } from '@/shared/client/tutorial/tutorial-choice-dialog';
import { useClaimTutorialInvitation } from '@/shared/client/tutorial/tutorial-records';
import { Button } from '@/shared/ui/button';

export function AcademicOverviewTutorialButton({
  invited = false,
}: Readonly<{ invited?: boolean }>) {
  const [open, setOpen] = useState(invited);
  useClaimTutorialInvitation('first-visit', invited);
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              {...{ [TUTORIAL_TRIGGER_ATTRIBUTE]: '' }}
              variant="outline"
              size="icon"
              aria-label="Abrir tutorial"
              onClick={() => setOpen(true)}
            >
              <CircleHelp />
            </Button>
          }
        />
        <TooltipContent>Abrir tutorial</TooltipContent>
      </Tooltip>
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
