import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ExtensionInstallPrompt } from '@/app/_components/ExtensionInstallPrompt';
import { PlatformEntryCounter } from '@/app/_components/PlatformEntryCounter';
import { extensionPromptStorageKey } from '@/shared/u-cursos-extension';

const firefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
const safari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
let documentOrigin = 0;

function storedRecord() {
  return JSON.parse(localStorage.getItem(extensionPromptStorageKey) ?? 'null');
}

function storeRecord(record: object) {
  localStorage.setItem(extensionPromptStorageKey, JSON.stringify(record));
}

function loadNewDocument() {
  documentOrigin += 1;
  vi.spyOn(performance, 'timeOrigin', 'get').mockReturnValue(documentOrigin);
}

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(firefox);
  loadNewDocument();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('counts each document load as one platform entry', () => {
  const { unmount } = render(<PlatformEntryCounter />);
  unmount();
  render(<PlatformEntryCounter />);
  expect(storedRecord()).toMatchObject({ entries: 1, shown: 0, optedOut: false });

  loadNewDocument();
  render(<PlatformEntryCounter />);
  expect(storedRecord()).toMatchObject({ entries: 2 });
});

test('does not count entries in browsers without the extension', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(safari);
  render(<PlatformEntryCounter />);

  expect(storedRecord()).toBeNull();
});

test('stays hidden before the entry threshold', () => {
  storeRecord({ entries: 1, threshold: 3, shown: 0, optedOut: false });
  render(<PlatformEntryCounter />);
  render(<ExtensionInstallPrompt suppressed={false} />);

  expect(screen.queryByRole('dialog')).toBeNull();
  expect(storedRecord()).toMatchObject({ entries: 2, threshold: 3 });
});

test('links the store of the current browser on the entry that reaches the threshold', () => {
  storeRecord({ entries: 2, threshold: 3, shown: 0, optedOut: false });
  render(<PlatformEntryCounter />);
  render(<ExtensionInstallPrompt suppressed={false} />);

  expect(screen.getByRole('link', { name: /Instalar en Firefox/ })).toHaveProperty(
    'href',
    'https://addons.mozilla.org/en-US/firefox/addon/u-roadmaps-en-u-cursos/',
  );
  expect(screen.queryByRole('checkbox')).toBeNull();
  const record = storedRecord();
  expect(record).toMatchObject({ entries: 0, shown: 1, optedOut: false });
  expect(record.threshold).toBeGreaterThanOrEqual(3);
  expect(record.threshold).toBeLessThanOrEqual(5);
});

test('starts counting from the old interval record', () => {
  storeRecord({ since: 0, shown: 1, optedOut: false });
  render(<ExtensionInstallPrompt suppressed={false} />);

  expect(screen.queryByRole('dialog')).toBeNull();
  expect(storedRecord()).toMatchObject({ entries: 1, shown: 1, optedOut: false });
});

test('remembers opting out from the second time onward', async () => {
  storeRecord({ entries: 2, threshold: 3, shown: 1, optedOut: false });
  render(<ExtensionInstallPrompt suppressed={false} />);

  await waitFor(() =>
    expect(screen.getByRole('link', { name: /Instalar en Firefox/ }).matches(':focus')).toBe(true),
  );

  await userEvent.click(screen.getByRole('checkbox', { name: 'No volver a mostrar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

  expect(storedRecord()).toMatchObject({ shown: 2, optedOut: true });
});

test('keeps a due prompt for a later entry while the tutorial invitation is shown', () => {
  storeRecord({ entries: 3, threshold: 3, shown: 0, optedOut: false });
  render(<ExtensionInstallPrompt suppressed />);

  expect(screen.queryByRole('dialog')).toBeNull();
  expect(storedRecord()).toMatchObject({ entries: 3, shown: 0 });
});

test('keeps a due prompt for a later entry while another dialog is open', () => {
  storeRecord({ entries: 2, threshold: 3, shown: 0, optedOut: false });
  render(
    <>
      <div role="dialog" aria-label="Cambios recientes" />
      <ExtensionInstallPrompt suppressed={false} />
    </>,
  );

  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(storedRecord()).toMatchObject({ entries: 3, shown: 0 });
});
