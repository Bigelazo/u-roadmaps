'use client';

import 'driver.js/dist/driver.css';
import './tutorial.css';

import { driver, type Driver } from 'driver.js';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import {
  startTutorialSession,
  tutorialDriverConfig,
  type TutorialDescriptionPortal,
} from './tutorial-session';
import {
  clearTutorialClosingPopover,
  readTutorialClosingPopover,
  TUTORIAL_TRIGGER_ATTRIBUTE,
  waitForElement,
  type TutorialActions,
  type TutorialStep,
} from './tutorial-support';

export function RoadmapTutorial<Action = never>({
  steps,
  actions,
}: {
  steps: readonly TutorialStep<Action>[];
  actions?: TutorialActions<Action>;
}) {
  const [descriptionPortal, setDescriptionPortal] = useState<TutorialDescriptionPortal | null>(
    null,
  );
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  const confirmingRef = useRef(false);
  const stopRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    descriptionPortal?.reposition();
  }, [descriptionPortal]);

  useEffect(() => {
    const stop = startTutorialSession({
      steps,
      actions,
      isConfirmingExit: () => confirmingRef.current,
      onExitRequested: () => {
        if (confirmingRef.current) return;
        confirmingRef.current = true;
        setIsConfirmingExit(true);
      },
      onDescriptionChange: setDescriptionPortal,
    });
    stopRef.current = stop;
    return () => {
      stop();
      stopRef.current = null;
    };
  }, [steps, actions]);

  const resume = () => {
    setIsConfirmingExit(false);
    queueMicrotask(() => {
      confirmingRef.current = false;
    });
  };
  const leave = () => {
    stopRef.current?.();
    resume();
  };

  return (
    <>
      {descriptionPortal && createPortal(descriptionPortal.content, descriptionPortal.target)}
      <ConfirmationDialog
        confirmation={
          isConfirmingExit
            ? {
                title: '¿Salir del tutorial?',
                description:
                  'Podrás seguir explorando el mapa de práctica y repetir el tutorial cuando quieras.',
                intent: 'default',
                cancelLabel: 'Seguir con el tutorial',
                actions: [{ id: 'leave', label: 'Salir' }],
              }
            : null
        }
        className="u-roadmaps-tour-exit z-(--tutorial-z-exit-confirmation)"
        onCancel={resume}
        onAction={leave}
      />
    </>
  );
}

export function TutorialClosingPopover() {
  useEffect(() => {
    if (!readTutorialClosingPopover()) return;
    const selector = `[${TUTORIAL_TRIGGER_ATTRIBUTE}]`;
    let tour: Driver | null = null;
    let cancelled = false;
    void waitForElement(selector).then(() => {
      if (cancelled || !document.querySelector(selector)) return;
      tour = driver({
        ...tutorialDriverConfig,
        showButtons: ['next', 'close'],
        doneBtnText: 'Entendido',
      });
      tour.highlight({
        element: selector,
        popover: {
          title: 'Tutorial',
          description: 'Puedes repetir el tutorial cuando quieras desde este ícono.',
          side: 'bottom',
          showButtons: ['next', 'close'],
          nextBtnText: 'Entendido',
          onNextClick: () => tour?.destroy(),
        },
      });
      clearTutorialClosingPopover();
    });
    return () => {
      cancelled = true;
      tour?.destroy();
    };
  }, []);
  return null;
}
