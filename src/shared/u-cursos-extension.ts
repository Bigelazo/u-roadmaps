export const extensionStores = {
  chrome: {
    name: 'Chrome',
    href: 'https://chromewebstore.google.com/detail/hebgfpfigbojefeaedpkelohoejbllhm',
  },
  firefox: {
    name: 'Firefox',
    href: 'https://addons.mozilla.org/en-US/firefox/addon/u-roadmaps-en-u-cursos/',
  },
} as const;

export type ExtensionBrowser = keyof typeof extensionStores;

export function extensionBrowserOf(userAgent: string): ExtensionBrowser | null {
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)) return null;
  if (/Firefox\//.test(userAgent)) return 'firefox';
  if (/Chrome\/|Chromium\//.test(userAgent)) return 'chrome';
  return null;
}

export const extensionPromptStorageKey = 'u-roadmaps:extension-prompt';
export const extensionPromptIntervalMs = 7 * 24 * 60 * 60 * 1000;

export type ExtensionPromptRecord = { since: number; shown: number; optedOut: boolean };

export function parseExtensionPromptRecord(raw: string | null): ExtensionPromptRecord | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { since, shown, optedOut } = value as Record<string, unknown>;
    if (typeof since !== 'number' || typeof shown !== 'number' || typeof optedOut !== 'boolean') {
      return null;
    }
    return { since, shown, optedOut };
  } catch {
    return null;
  }
}

export function visitExtensionPrompt(
  record: ExtensionPromptRecord | null,
  now: number,
): { record: ExtensionPromptRecord; prompt: { offerOptOut: boolean } | null } {
  if (!record) return { record: { since: now, shown: 0, optedOut: false }, prompt: null };
  if (record.optedOut || now - record.since < extensionPromptIntervalMs) {
    return { record, prompt: null };
  }
  return {
    record: { since: now, shown: record.shown + 1, optedOut: false },
    prompt: { offerOptOut: record.shown >= 1 },
  };
}
