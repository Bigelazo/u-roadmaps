import type { Theme } from '@/shared/theme-preference';

export const themeSwitchingAttribute = 'data-theme-switching';
export const themeWipeDurationMs = 1100;
export const themeWipeEasing = 'cubic-bezier(0.65, 0, 0.35, 1)';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const wipeLead = 'var(--theme-wipe-lead)';
const bandShareOfSpan = 0.16;
const gapShareOfSpan = 0.012;
const inkShareOfSpan = 0.018;
const incomingBandColor = 'var(--primary)';
const incomingLineColor = 'var(--progress)';

let wipeInProgress = false;

type Point = { x: number; y: number };

export type ThemeWipeGeometry = {
  direction: Point;
  center: Point;
  span: number;
  from: number;
  to: number;
  band: number;
  gap: number;
  ink: number;
  far: number;
};

export type ThemeSwitch = { animated: boolean; finished: Promise<void> };

export function themeWipeGeometry(theme: Theme, width: number, height: number): ThemeWipeGeometry {
  const span = (width + height) * Math.SQRT1_2;
  const band = span * bandShareOfSpan;
  const gap = span * gapShareOfSpan;
  const ink = span * inkShareOfSpan;
  const sign = theme === 'dark' ? -1 : 1;
  return {
    direction: { x: sign * Math.SQRT1_2, y: -sign * Math.SQRT1_2 },
    center: { x: width / 2, y: height / 2 },
    span,
    from: -span / 2,
    to: span / 2 + band + gap + ink,
    band,
    gap,
    ink,
    far: span * 4,
  };
}

function pixels(value: number) {
  return `${Math.round(value * 100) / 100}px`;
}

function wipePoint(
  { direction, center }: ThemeWipeGeometry,
  along: number,
  across: number,
  followsLead: boolean,
) {
  const coordinate = (origin: number, alongFactor: number, acrossFactor: number) => {
    const fixed = pixels(origin + alongFactor * along + acrossFactor * across);
    return followsLead ? `calc(${fixed} + ${alongFactor} * ${wipeLead})` : fixed;
  };
  return `${coordinate(center.x, direction.x, -direction.y)} ${coordinate(center.y, direction.y, direction.x)}`;
}

function outgoingClipPath(geometry: ThemeWipeGeometry) {
  const { far } = geometry;
  const points = [
    wipePoint(geometry, 0, -far, true),
    wipePoint(geometry, far, -far, false),
    wipePoint(geometry, far, far, false),
    wipePoint(geometry, 0, far, true),
  ];
  return `polygon(${points.join(', ')})`;
}

function incomingClipPath(geometry: ThemeWipeGeometry) {
  const { band, gap, ink, far } = geometry;
  const inkStart = -(band + gap + ink);
  const inkEnd = -(band + gap);
  const bandStart = -band;
  const points = [
    wipePoint(geometry, -far, -far, false),
    wipePoint(geometry, inkStart, -far, true),
    wipePoint(geometry, inkStart, far, true),
    wipePoint(geometry, inkEnd, far, true),
    wipePoint(geometry, inkEnd, -far, true),
    wipePoint(geometry, bandStart, -far, true),
    wipePoint(geometry, bandStart, far * 1.01, true),
    wipePoint(geometry, -far, far * 1.01, false),
  ];
  return `polygon(${points.join(', ')})`;
}

function wipeBackground(geometry: ThemeWipeGeometry) {
  const { direction, span, band, gap, ink } = geometry;
  const angle = Math.atan2(direction.x, -direction.y);
  const stop = (offset: number) => `calc(${pixels(span / 2 + offset)} + ${wipeLead})`;
  const inkStart = stop(-(band + gap + ink));
  const inkEnd = stop(-(band + gap));
  const bandStart = stop(-band);
  const bandEnd = stop(0);
  return `linear-gradient(${angle}rad, transparent ${inkStart}, ${incomingLineColor} ${inkStart} ${inkEnd}, transparent ${inkEnd} ${bandStart}, ${incomingBandColor} ${bandStart} ${bandEnd}, transparent ${bandEnd})`;
}

export function themeWipeStyles(geometry: ThemeWipeGeometry) {
  const root = `:root[${themeSwitchingAttribute}]`;
  return `${root}::view-transition-group(root) { --theme-wipe-lead: ${pixels(geometry.from)}; background: ${wipeBackground(geometry)}; }
${root}::view-transition-old(root) { clip-path: ${outgoingClipPath(geometry)}; }
${root}::view-transition-new(root) { clip-path: ${incomingClipPath(geometry)}; }`;
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function canPlayWipe() {
  return (
    typeof document.startViewTransition === 'function' &&
    typeof CSS !== 'undefined' &&
    CSS.supports('background', 'linear-gradient(red calc(1px + 1px), blue)') &&
    !window.matchMedia(reducedMotionQuery).matches
  );
}

function playWipe(theme: Theme) {
  const root = document.documentElement;
  const geometry = themeWipeGeometry(theme, window.innerWidth, window.innerHeight);
  wipeInProgress = true;

  const styles = document.createElement('style');
  styles.textContent = themeWipeStyles(geometry);
  document.head.append(styles);
  root.setAttribute(themeSwitchingAttribute, '');

  const transition = document.startViewTransition(() => {
    root.dataset.theme = theme;
  });
  let leadAnimation: Animation | undefined;
  transition.ready
    .then(() => {
      leadAnimation = root.animate(
        { '--theme-wipe-lead': [pixels(geometry.from), pixels(geometry.to)] },
        {
          duration: themeWipeDurationMs,
          easing: themeWipeEasing,
          fill: 'both',
          pseudoElement: '::view-transition-group(root)',
        },
      );
    })
    .catch(() => undefined);
  return transition.finished
    .catch(() => undefined)
    .finally(() => {
      leadAnimation?.cancel();
      styles.remove();
      root.removeAttribute(themeSwitchingAttribute);
      wipeInProgress = false;
    });
}

function switchInstantly(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute(themeSwitchingAttribute, '');
  root.dataset.theme = theme;
  window.requestAnimationFrame(() => root.removeAttribute(themeSwitchingAttribute));
}

export function switchTheme(theme: Theme): ThemeSwitch {
  const root = document.documentElement;
  if (theme === currentTheme() || wipeInProgress) {
    root.dataset.theme = theme;
    return { animated: false, finished: Promise.resolve() };
  }
  if (canPlayWipe()) return { animated: true, finished: playWipe(theme) };
  switchInstantly(theme);
  return { animated: false, finished: Promise.resolve() };
}
