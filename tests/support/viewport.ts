import { vi } from 'vitest';

/** Stubs `innerWidth` and `matchMedia` so the app's breakpoint hooks see `width`. */
export function mockViewport(width: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
    matches:
      (query === '(max-width: 767px)' && width < 768) ||
      (query === '(min-width: 1024px)' && width >= 1024),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }));
}
