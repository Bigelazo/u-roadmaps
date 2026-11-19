import { describe, expect, it } from 'vitest';
import {
  extensionBrowserOf,
  extensionPromptIntervalMs,
  parseExtensionPromptRecord,
  visitExtensionPrompt,
} from '@/shared/u-cursos-extension';

const userAgents = {
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  opera:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  safari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  iosFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
  androidEdge:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 EdgA/131.0.0.0',
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

describe('extensionBrowserOf', () => {
  it.each([
    ['chrome', 'chrome'],
    ['edge', 'chrome'],
    ['opera', 'chrome'],
    ['firefox', 'firefox'],
    ['safari', null],
    ['androidChrome', null],
    ['androidFirefox', null],
    ['iosChrome', null],
    ['iosFirefox', null],
    ['androidEdge', null],
    ['samsungInternet', null],
    ['androidTablet', null],
  ] as const)('maps %s to %s', (agent, browser) => {
    expect(extensionBrowserOf(userAgents[agent])).toBe(browser);
  });
});

describe('visitExtensionPrompt', () => {
  const start = 1_000_000;
  const later = start + extensionPromptIntervalMs;

  it('never prompts on the first visit and starts the interval', () => {
    expect(visitExtensionPrompt(null, start)).toEqual({
      record: { since: start, shown: 0, optedOut: false },
      prompt: null,
    });
  });

  it('waits a full interval since the last visit that started one', () => {
    const record = { since: start, shown: 0, optedOut: false };
    expect(visitExtensionPrompt(record, later - 1)).toEqual({ record, prompt: null });
  });

  it('prompts without the opt-out the first time it is shown', () => {
    expect(visitExtensionPrompt({ since: start, shown: 0, optedOut: false }, later)).toEqual({
      record: { since: later, shown: 1, optedOut: false },
      prompt: { offerOptOut: false },
    });
  });

  it('offers the opt-out from the second time onward', () => {
    expect(visitExtensionPrompt({ since: start, shown: 1, optedOut: false }, later).prompt).toEqual(
      { offerOptOut: true },
    );
  });

  it('never prompts after opting out', () => {
    const record = { since: start, shown: 2, optedOut: true };
    expect(visitExtensionPrompt(record, later * 10)).toEqual({ record, prompt: null });
  });
});

describe('parseExtensionPromptRecord', () => {
  it('reads a stored record', () => {
    const record = { since: 5, shown: 1, optedOut: false };
    expect(parseExtensionPromptRecord(JSON.stringify(record))).toEqual(record);
  });

  it.each([null, '', 'nope', '{"since":"5"}', 'null'])('ignores %j', (raw) => {
    expect(parseExtensionPromptRecord(raw)).toBeNull();
  });
});
