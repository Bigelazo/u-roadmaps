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
export const extensionPromptMinimumEntries = 3;
export const extensionPromptMaximumEntries = 5;

export type ExtensionPromptRecord = {
  entries: number;
  threshold: number;
  shown: number;
  optedOut: boolean;
};

type Random = () => number;

export function drawExtensionPromptThreshold(random: Random): number {
  const span = extensionPromptMaximumEntries - extensionPromptMinimumEntries + 1;
  return extensionPromptMinimumEntries + Math.min(span - 1, Math.floor(random() * span));
}

function freshRecord(random: Random, shown = 0, optedOut = false): ExtensionPromptRecord {
  return { entries: 0, threshold: drawExtensionPromptThreshold(random), shown, optedOut };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function parseExtensionPromptRecord(
  raw: string | null,
  random: Random,
): ExtensionPromptRecord {
  if (!raw) return freshRecord(random);
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return freshRecord(random);
    const { entries, threshold, shown, optedOut } = value as Record<string, unknown>;
    const knownShown = isCount(shown) ? shown : 0;
    const knownOptedOut = optedOut === true;
    if (
      !isCount(entries) ||
      !isCount(threshold) ||
      threshold < extensionPromptMinimumEntries ||
      threshold > extensionPromptMaximumEntries
    ) {
      return freshRecord(random, knownShown, knownOptedOut);
    }
    return { entries, threshold, shown: knownShown, optedOut: knownOptedOut };
  } catch {
    return freshRecord(random);
  }
}

export function enterPlatform(record: ExtensionPromptRecord): ExtensionPromptRecord {
  if (record.optedOut) return record;
  return { ...record, entries: record.entries + 1 };
}

export function dueExtensionPrompt(record: ExtensionPromptRecord): { offerOptOut: boolean } | null {
  if (record.optedOut || record.entries < record.threshold) return null;
  return { offerOptOut: record.shown >= 1 };
}

export function showExtensionPrompt(
  record: ExtensionPromptRecord,
  random: Random,
): ExtensionPromptRecord {
  return freshRecord(random, record.shown + 1, false);
}
