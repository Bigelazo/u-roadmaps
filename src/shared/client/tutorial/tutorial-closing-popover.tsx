'use client';

import { useEffect } from 'react';
import {
  clearTutorialClosingPopover,
  readTutorialClosingPopover,
  TUTORIAL_TRIGGER_ATTRIBUTE,
  waitForElement,
} from './tutorial-support';

export function TutorialClosingPopover() {
  useEffect(() => {
    if (!readTutorialClosingPopover()) return;
    const selector = `[${TUTORIAL_TRIGGER_ATTRIBUTE}]`;
    let dismiss: (() => void) | null = null;
    let cancelled = false;
    void Promise.all([import('./tutorial-closing-highlight'), waitForElement(selector)]).then(
      ([{ highlightTutorialTrigger }]) => {
        if (cancelled || !document.querySelector(selector)) return;
        dismiss = highlightTutorialTrigger(selector);
        clearTutorialClosingPopover();
      },
    );
    return () => {
      cancelled = true;
      dismiss?.();
    };
  }, []);
  return null;
}
