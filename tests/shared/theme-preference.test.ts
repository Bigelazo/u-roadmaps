import { expect, test } from 'vitest';
import { oppositeTheme, parseThemePreference, themeCookie } from '@/shared/theme-preference';

test.each([
  ['dark', 'dark'],
  ['light', 'light'],
  ['system', 'light'],
  ['sepia', 'light'],
  [undefined, 'light'],
  [null, 'light'],
])('reads the stored preference %s as %s', (stored, theme) => {
  expect(parseThemePreference(stored)).toBe(theme);
});

test('alternates between the light and the dark theme', () => {
  expect(oppositeTheme('light')).toBe('dark');
  expect(oppositeTheme('dark')).toBe('light');
});

test('stores the preference where the embedded view can read it over HTTPS', () => {
  expect(themeCookie('dark', true)).toBe(
    'theme=dark; Path=/; Max-Age=31536000; SameSite=None; Secure',
  );
  expect(themeCookie('light', false)).toBe('theme=light; Path=/; Max-Age=31536000; SameSite=Lax');
});
