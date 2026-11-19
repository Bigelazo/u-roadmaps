import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ExtensionInstallPrompt } from '@/app/_components/ExtensionInstallPrompt';
import { extensionPromptIntervalMs, extensionPromptStorageKey } from '@/shared/u-cursos-extension';

const firefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';

function storedRecord() {
  return JSON.parse(localStorage.getItem(extensionPromptStorageKey) ?? 'null');
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('stays hidden on the first visit', () => {
  render(<ExtensionInstallPrompt suppressed={false} />);

  expect(screen.queryByRole('dialog')).toBeNull();
  expect(storedRecord()).toMatchObject({ shown: 0, optedOut: false });
});

test('links the store of the current browser once the interval passes', () => {
  localStorage.setItem(
    extensionPromptStorageKey,
    JSON.stringify({ since: Date.now() - extensionPromptIntervalMs, shown: 0, optedOut: false }),
  );
  render(<ExtensionInstallPrompt suppressed={false} />);

  expect(screen.getByRole('link', { name: /Instalar en Firefox/ })).toHaveProperty(
    'href',
    'https://addons.mozilla.org/en-US/firefox/addon/u-roadmaps-en-u-cursos/',
  );
  expect(screen.queryByRole('checkbox')).toBeNull();
});

test('remembers opting out from the second time onward', async () => {
  localStorage.setItem(
    extensionPromptStorageKey,
    JSON.stringify({ since: Date.now() - extensionPromptIntervalMs, shown: 1, optedOut: false }),
  );
  render(<ExtensionInstallPrompt suppressed={false} />);

  await waitFor(() =>
    expect(screen.getByRole('link', { name: /Instalar en Firefox/ }).matches(':focus')).toBe(true),
  );

  await userEvent.click(screen.getByRole('checkbox', { name: 'No volver a mostrar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

  expect(storedRecord()).toMatchObject({ shown: 2, optedOut: true });
});

test('stays hidden while the tutorial invitation is shown', () => {
  localStorage.setItem(
    extensionPromptStorageKey,
    JSON.stringify({ since: 0, shown: 0, optedOut: false }),
  );
  render(<ExtensionInstallPrompt suppressed />);

  expect(screen.queryByRole('dialog')).toBeNull();
});
