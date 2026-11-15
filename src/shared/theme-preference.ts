export const themes = ['light', 'dark'] as const;

export type Theme = (typeof themes)[number];

export const themeCookieName = 'theme';
export const defaultTheme: Theme = 'light';

const themeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export function parseThemePreference(value: string | undefined | null): Theme {
  return themes.find((theme) => theme === value) ?? defaultTheme;
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function themeCookie(theme: Theme, secure: boolean) {
  const sameSite = secure ? 'SameSite=None; Secure' : 'SameSite=Lax';
  return `${themeCookieName}=${theme}; Path=/; Max-Age=${themeCookieMaxAgeSeconds}; ${sameSite}`;
}
