import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  switchTheme,
  themeSwitchingAttribute,
  themeWipeDurationMs,
  themeWipeEasing,
  themeWipeGeometry,
  themeWipeStyles,
} from '@/shared/client/theme/theme-transition';

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function stubEnvironment({ reducedMotion = false, gradientCalc = true } = {}) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') && reducedMotion,
    })),
  );
  vi.stubGlobal('CSS', { supports: vi.fn(() => gradientCalc) });
}

function stubViewTransitions() {
  const finished = deferred();
  const startViewTransition = vi.fn((update: () => void) => {
    update();
    return { ready: Promise.resolve(), finished: finished.promise };
  });
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }) as unknown as Animation);
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: startViewTransition,
  });
  document.documentElement.animate = animate;
  return { startViewTransition, animate, cancel, finish: finished.resolve };
}

const root = document.documentElement;

beforeEach(() => {
  root.dataset.theme = 'light';
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'startViewTransition');
  Reflect.deleteProperty(root, 'animate');
  root.removeAttribute(themeSwitchingAttribute);
  document.head.querySelectorAll('style').forEach((style) => style.remove());
});

it('plays the wipe through a view transition when the theme changes', async () => {
  stubEnvironment();
  const { startViewTransition, animate, cancel, finish } = stubViewTransitions();

  const { animated, finished } = switchTheme('dark');

  expect(animated).toBe(true);
  expect(startViewTransition).toHaveBeenCalledTimes(1);
  expect(root.dataset.theme).toBe('dark');
  expect(root.hasAttribute(themeSwitchingAttribute)).toBe(true);
  expect(document.head.querySelector('style')?.textContent).toContain(
    '::view-transition-new(root)',
  );

  await Promise.resolve();
  expect(animate).toHaveBeenCalledWith(
    { '--theme-wipe-lead': [expect.any(String), expect.any(String)] },
    {
      duration: themeWipeDurationMs,
      easing: themeWipeEasing,
      fill: 'both',
      pseudoElement: '::view-transition-group(root)',
    },
  );

  finish();
  await finished;
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(root.hasAttribute(themeSwitchingAttribute)).toBe(false);
  expect(document.head.querySelector('style')).toBeNull();
});

it('does not start a transition when the resolved theme is unchanged', () => {
  stubEnvironment();
  const { startViewTransition } = stubViewTransitions();

  const { animated } = switchTheme('light');

  expect(animated).toBe(false);
  expect(startViewTransition).not.toHaveBeenCalled();
  expect(root.dataset.theme).toBe('light');
  expect(root.hasAttribute(themeSwitchingAttribute)).toBe(false);
});

it('switches instantly when the View Transitions API is missing', () => {
  stubEnvironment();
  const nextFrame = vi.fn<(callback: FrameRequestCallback) => number>(() => 0);
  vi.stubGlobal('requestAnimationFrame', nextFrame);

  const { animated } = switchTheme('dark');

  expect(animated).toBe(false);
  expect(root.dataset.theme).toBe('dark');
  expect(root.hasAttribute(themeSwitchingAttribute)).toBe(true);
  nextFrame.mock.calls[0][0](0);
  expect(root.hasAttribute(themeSwitchingAttribute)).toBe(false);
});

it('switches instantly when reduced motion is requested', () => {
  stubEnvironment({ reducedMotion: true });
  const { startViewTransition } = stubViewTransitions();

  const { animated } = switchTheme('dark');

  expect(animated).toBe(false);
  expect(startViewTransition).not.toHaveBeenCalled();
  expect(root.dataset.theme).toBe('dark');
});

it('switches instantly when gradients cannot use calc stops', () => {
  stubEnvironment({ gradientCalc: false });
  const { startViewTransition } = stubViewTransitions();

  expect(switchTheme('dark').animated).toBe(false);
  expect(startViewTransition).not.toHaveBeenCalled();
  expect(root.dataset.theme).toBe('dark');
});

it('applies a theme chosen mid-wipe without starting a second transition', async () => {
  stubEnvironment();
  const { startViewTransition, finish } = stubViewTransitions();

  const first = switchTheme('dark');
  const second = switchTheme('light');

  expect(second.animated).toBe(false);
  expect(startViewTransition).toHaveBeenCalledTimes(1);
  expect(root.dataset.theme).toBe('light');

  finish();
  await first.finished;
});

it('sweeps toward the lower left for dark and the upper right for light', () => {
  const dark = themeWipeGeometry('dark', 1000, 600);
  const light = themeWipeGeometry('light', 1000, 600);
  const span = 1600 * Math.SQRT1_2;

  expect(dark.direction).toEqual({ x: -Math.SQRT1_2, y: Math.SQRT1_2 });
  expect(light.direction).toEqual({ x: Math.SQRT1_2, y: -Math.SQRT1_2 });
  expect(dark.span).toBeCloseTo(span);
  expect(dark.from).toBeCloseTo(-span / 2);
  expect(dark.to).toBeCloseTo(span / 2 + span * (0.16 + 0.012 + 0.018));
});

it('clips both snapshots against the animated wipe lead', () => {
  const styles = themeWipeStyles(themeWipeGeometry('dark', 1000, 600));

  expect(styles).toContain(`:root[${themeSwitchingAttribute}]::view-transition-old(root)`);
  expect(styles).toContain(`:root[${themeSwitchingAttribute}]::view-transition-new(root)`);
  expect(styles).toContain('--theme-wipe-lead: -565.69px');
});

it('paints the band and the line with the identity tokens of the theme being entered', () => {
  const styles = themeWipeStyles(themeWipeGeometry('light', 1000, 600));
  const colors = new Set(styles.match(/var\(--(?!theme-wipe-lead)[a-z-]+\)/g));

  expect(colors).toEqual(new Set(['var(--primary)', 'var(--progress)']));
});
