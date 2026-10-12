import { toast } from '@/shared/ui/toast';

type Tone = 'success' | 'error' | 'neutral';

export type NotifyOptions = {
  /** Reusing an id updates the open toast instead of stacking a new one. */
  id?: string;
  /** Keeps the toast open until it is closed. */
  persistent?: boolean;
  action?: { label: string; onClick: () => void };
  /** Fires on auto-dismiss, the close button, swipe and `notify.close`. */
  onClose?: () => void;
};

const AUTO_DISMISS_MS = 6000;

const tones = {
  success: { priority: 'low', timeout: AUTO_DISMISS_MS },
  error: { priority: 'high', timeout: AUTO_DISMISS_MS },
  neutral: { priority: 'low', timeout: 0 },
} as const;

function show(
  tone: Tone,
  message: string,
  { id, persistent, action, onClose }: NotifyOptions = {},
) {
  const { priority, timeout } = tones[tone];
  return toast.add({
    id,
    title: message,
    type: tone,
    priority,
    timeout: persistent ? 0 : timeout,
    onClose,
    actionProps: action && { children: action.label, onClick: action.onClick },
  });
}

/** The app's only toast API; the root layout mounts the `Toaster` that renders it. */
export const notify = {
  success: (message: string, options?: NotifyOptions) => show('success', message, options),
  error: (message: string, options?: NotifyOptions) => show('error', message, options),
  neutral: (message: string, options?: NotifyOptions) => show('neutral', message, options),
  close: (id: string) => toast.close(id),
};
