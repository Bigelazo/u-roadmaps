'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CircleCheckBig, LockKeyhole } from 'lucide-react';
import type { StudentNodeStatus } from '@/features/roadmap/student/node-status';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

export const unreviewedMaterialHint = 'Revisa el material aunque sea po...';
export const unreviewedMaterialHintDurationMs = 2500;

type Props = {
  status: StudentNodeStatus;
  isReadOnly: boolean;
  hasUnreviewedResources: boolean;
  onComplete: () => void;
};

export function CompleteNodeButton({
  status,
  isReadOnly,
  hasUnreviewedResources,
  onComplete,
}: Props) {
  const [isHintOpen, setIsHintOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  if (status === 'completed')
    return (
      <Button disabled variant="outline">
        <Check data-icon="inline-start" />
        Completado
      </Button>
    );

  const isLocked = status === 'locked';
  const isGated = hasUnreviewedResources && !isLocked && !isReadOnly;
  const hideHint = () => {
    clearTimeout(closeTimer.current);
    setIsHintOpen(false);
  };
  const showHint = () => {
    clearTimeout(closeTimer.current);
    setIsHintOpen(true);
    closeTimer.current = setTimeout(() => setIsHintOpen(false), unreviewedMaterialHintDurationMs);
  };

  return (
    <Tooltip
      open={isGated && isHintOpen}
      onOpenChange={(open, details) => {
        if (!open && details.reason !== 'trigger-press') hideHint();
      }}
    >
      <TooltipTrigger
        render={
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-emerald-600"
            disabled={isLocked || isReadOnly}
            aria-disabled={isGated || undefined}
            onClick={() => (isGated ? showHint() : onComplete())}
            onBlur={hideHint}
          />
        }
      >
        {isLocked ? (
          <LockKeyhole data-icon="inline-start" />
        ) : (
          <CircleCheckBig data-icon="inline-start" />
        )}
        {isLocked ? 'Completa prerrequisitos' : 'Completar'}
      </TooltipTrigger>
      <TooltipContent side="bottom">{unreviewedMaterialHint}</TooltipContent>
      <span role="status" className="sr-only">
        {isGated && isHintOpen ? unreviewedMaterialHint : ''}
      </span>
    </Tooltip>
  );
}
