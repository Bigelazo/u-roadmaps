import {
  enterPlatform,
  extensionBrowserOf,
  extensionPromptStorageKey,
  parseExtensionPromptRecord,
  type ExtensionPromptRecord,
} from '@/shared/u-cursos-extension';

let countedDocumentOrigin: number | null = null;

export function extensionPromptAvailable() {
  return window.self === window.top && extensionBrowserOf(navigator.userAgent) !== null;
}

export function readExtensionPromptRecord(): ExtensionPromptRecord | null {
  try {
    return parseExtensionPromptRecord(localStorage.getItem(extensionPromptStorageKey), Math.random);
  } catch {
    return null;
  }
}

export function storeExtensionPromptRecord(record: ExtensionPromptRecord) {
  try {
    localStorage.setItem(extensionPromptStorageKey, JSON.stringify(record));
  } catch {
    return;
  }
}

export function countPlatformEntry() {
  if (countedDocumentOrigin === performance.timeOrigin || !extensionPromptAvailable()) return;
  countedDocumentOrigin = performance.timeOrigin;
  const record = readExtensionPromptRecord();
  if (record) storeExtensionPromptRecord(enterPlatform(record));
}
