'use client';

import { BadgeQuestionMark } from 'lucide-react';
import { useState } from 'react';
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BadgeQuestionMark aria-hidden="true" data-icon="inline-start" />
        Tutorial
      </Button>
      <TutorialChoiceDialog
        open={open}
        onOpenChange={setOpen}
        origin="/academic-overview"
        declinable={invited}
      />
    </>
  );
}
