import { describe, expect, it } from 'vitest';
import {
  drawExtensionPromptThreshold,
  dueExtensionPrompt,
  enterPlatform,
  extensionBrowserOf,
  parseExtensionPromptRecord,
  showExtensionPrompt,
  type ExtensionPromptRecord,
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

describe('drawExtensionPromptThreshold', () => {
  it.each([
    [0, 3],
    [0.34, 4],
    [0.67, 5],
    [0.999, 5],
    [1, 5],
  ])('maps random %d to %d entries', (random, threshold) => {
    expect(drawExtensionPromptThreshold(() => random)).toBe(threshold);
  });
});

describe('extension prompt cadence', () => {
  const lowest = () => 0;
  const highest = () => 0.99;

  function enterTimes(record: ExtensionPromptRecord, times: number) {
    return Array.from({ length: times }).reduce<ExtensionPromptRecord>(
      (current) => enterPlatform(current),
      record,
    );
  }

  it('starts a fresh record with a drawn threshold and no entries', () => {
    expect(parseExtensionPromptRecord(null, highest)).toEqual({
      entries: 0,
      threshold: 5,
      shown: 0,
      optedOut: false,
    });
  });

  it('prompts once the entries reach the drawn threshold', () => {
    const fresh = parseExtensionPromptRecord(null, lowest);
    expect(dueExtensionPrompt(enterTimes(fresh, 2))).toBeNull();
    expect(dueExtensionPrompt(enterTimes(fresh, 3))).toEqual({ offerOptOut: false });
  });

  it('keeps the prompt due on later entries until it is shown', () => {
    const fresh = parseExtensionPromptRecord(null, lowest);
    expect(dueExtensionPrompt(enterTimes(fresh, 7))).toEqual({ offerOptOut: false });
  });

  it('restarts the count with a new threshold after showing', () => {
    const due = enterTimes(parseExtensionPromptRecord(null, lowest), 3);
    const shown = showExtensionPrompt(due, highest);
    expect(shown).toEqual({ entries: 0, threshold: 5, shown: 1, optedOut: false });
    expect(dueExtensionPrompt(enterTimes(shown, 4))).toBeNull();
    expect(dueExtensionPrompt(enterTimes(shown, 5))).toEqual({ offerOptOut: true });
  });

  it('never prompts or counts after opting out', () => {
    const record = { entries: 9, threshold: 3, shown: 2, optedOut: true };
    expect(enterPlatform(record)).toBe(record);
    expect(dueExtensionPrompt(record)).toBeNull();
  });
});

describe('parseExtensionPromptRecord', () => {
  const lowest = () => 0;

  it('reads a stored record', () => {
    const record = { entries: 2, threshold: 4, shown: 1, optedOut: false };
    expect(parseExtensionPromptRecord(JSON.stringify(record), lowest)).toEqual(record);
  });

  it('migrates the interval record keeping its showings and opt-out', () => {
    expect(
      parseExtensionPromptRecord(JSON.stringify({ since: 5, shown: 2, optedOut: true }), lowest),
    ).toEqual({ entries: 0, threshold: 3, shown: 2, optedOut: true });
  });

  it.each([
    null,
    '',
    'nope',
    '{"since":"5"}',
    'null',
    '{"entries":1,"threshold":9,"shown":0,"optedOut":false}',
  ])('starts over from %j', (raw) => {
    expect(parseExtensionPromptRecord(raw, lowest)).toEqual({
      entries: 0,
      threshold: 3,
      shown: 0,
      optedOut: false,
    });
  });
});
