import { vi } from 'vitest';
import { compactCanvasLayoutQuery } from '@/features/roadmap/ui/compact-canvas-layout';

export function mockViewport(width: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
    matches:
      (query === compactCanvasLayoutQuery && width < 1024) ||
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
