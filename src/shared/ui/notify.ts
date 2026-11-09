import { toast } from '@/shared/ui/toast-manager';

type Tone = 'success' | 'error' | 'neutral';

type NotifyOptions = {
  id?: string;
  onClose?: () => void;
};

const AUTO_DISMISS_MS = 6000;

const tones = {
  success: { priority: 'low', timeout: AUTO_DISMISS_MS },
  error: { priority: 'high', timeout: AUTO_DISMISS_MS },
  neutral: { priority: 'low', timeout: 0 },
} as const;

function show(tone: Tone, message: string, { id, onClose }: NotifyOptions = {}) {
  const { priority, timeout } = tones[tone];
  return toast.add({
    id,
    title: message,
    type: tone,
    priority,
    timeout,
    onClose,
  });
}

export const notify = {
  success: (message: string, options?: NotifyOptions) => show('success', message, options),
  error: (message: string, options?: NotifyOptions) => show('error', message, options),
  neutral: (message: string, options?: NotifyOptions) => show('neutral', message, options),
  close: (id: string) => toast.close(id),
};
