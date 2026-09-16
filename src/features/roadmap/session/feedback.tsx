'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { RoadmapSuccessToast } from '@/features/roadmap/RoadmapSuccessToast';

type ErrorFeedback = {
  message: string;
  onDismiss: () => void;
};

type SuccessFeedback = {
  id: number;
  message: string;
};

type RoadmapCanvasFeedbackActions = {
  reportError: (message: string | null, onDismiss: () => void) => void;
  showSuccess: (message: string) => void;
};

type RoadmapCanvasFeedbackState = {
  error: ErrorFeedback | null;
  success: SuccessFeedback | null;
  dismissSuccess: () => void;
};

const feedbackContext = createContext<RoadmapCanvasFeedbackActions | null>(null);
const feedbackStateContext = createContext<RoadmapCanvasFeedbackState | null>(null);

export function RoadmapCanvasFeedbackProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ErrorFeedback | null>(null);
  const [success, setSuccess] = useState<SuccessFeedback | null>(null);
  const successIdRef = useRef(0);

  const reportError = useCallback((message: string | null, onDismiss: () => void) => {
    setError(message ? { message, onDismiss } : null);
  }, []);

  const showSuccess = useCallback((message: string) => {
    setSuccess({ id: ++successIdRef.current, message });
  }, []);
  const feedback = useMemo(() => ({ reportError, showSuccess }), [reportError, showSuccess]);
  const dismissSuccess = useCallback(() => setSuccess(null), []);
  const feedbackState = useMemo(
    () => ({ error, success, dismissSuccess }),
    [dismissSuccess, error, success],
  );

  return (
    <feedbackContext.Provider value={feedback}>
      <feedbackStateContext.Provider value={feedbackState}>
        {children}
      </feedbackStateContext.Provider>
    </feedbackContext.Provider>
  );
}

export function useRoadmapCanvasFeedback() {
  return useContext(feedbackContext);
}

export function RoadmapCanvasFeedback() {
  const feedback = useContext(feedbackStateContext);
  if (!feedback) return null;

  return (
    <div className="pointer-events-none absolute right-5 bottom-[18px] z-5 grid w-[min(23rem,calc(100%-2.5rem))] items-end justify-items-end [&>*]:col-start-1 [&>*]:row-start-1">
      {feedback.error ? (
        <RoadmapErrorToast message={feedback.error.message} onDismiss={feedback.error.onDismiss} />
      ) : null}
      {feedback.success ? (
        <RoadmapSuccessToast
          key={feedback.success.id}
          message={feedback.success.message}
          onDismiss={feedback.dismissSuccess}
        />
      ) : null}
    </div>
  );
}
