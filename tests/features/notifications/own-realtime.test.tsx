import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { OwnInboxRealtime } from '@/features/notifications/components/own-realtime';
import {
  ROADMAP_CHANGE_RECEIVED_EVENT,
  subscribeToRoadmapRecovery,
} from '@/shared/client/roadmap-events';

class BrowserStream extends EventTarget {
  static instances: BrowserStream[] = [];
  closed = false;
  constructor(readonly url: string) {
    super();
    BrowserStream.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  receive(kind: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(kind, { data: JSON.stringify(data) }));
  }
}

const change = { courseCode: 'CC1002', year: 2026, semester: 2 };

beforeEach(() => {
  vi.stubGlobal('EventSource', BrowserStream);
});
afterEach(() => {
  vi.unstubAllGlobals();
  BrowserStream.instances = [];
});

test('the stream relays its own Roadmap signals and ignores another User', () => {
  const changed = vi.fn();
  window.addEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
  const { unmount } = render(<OwnInboxRealtime userId="student" />);
  const [stream] = BrowserStream.instances;
  expect(stream.url).toBe('/api/notifications/stream');
  act(() => stream.receive('roadmap', { ...change, userId: 'other' }));
  expect(changed).not.toHaveBeenCalled();
  act(() => stream.receive('roadmap', { ...change, userId: 'student', accessLost: true }));
  expect(changed.mock.calls[0][0].detail).toEqual({ ...change, accessLost: true });
  unmount();
  expect(stream.closed).toBe(true);
  window.removeEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
});

test('a ready stream requests Roadmap recovery and an inbox frame changes nothing', () => {
  const recovered = vi.fn();
  const changed = vi.fn();
  const stopRecovery = subscribeToRoadmapRecovery(recovered);
  const dispatched = vi.spyOn(window, 'dispatchEvent');
  window.addEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
  render(<OwnInboxRealtime userId="student" />);
  const [stream] = BrowserStream.instances;
  act(() => stream.receive('ready', { userId: 'student' }));
  expect(recovered).toHaveBeenCalledTimes(1);
  dispatched.mockClear();
  act(() => stream.receive('inbox', { userId: 'student' }));
  expect(dispatched).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  stopRecovery();
  window.removeEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
});

test('switching User closes the old stream and ignores its queued events', () => {
  const changed = vi.fn();
  window.addEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
  const { rerender } = render(<OwnInboxRealtime userId="first" />);
  const old = BrowserStream.instances[0];
  rerender(<OwnInboxRealtime userId="second" />);
  expect(old.closed).toBe(true);
  act(() => old.receive('roadmap', { ...change, userId: 'first' }));
  expect(changed).not.toHaveBeenCalled();
  act(() => BrowserStream.instances[1].receive('roadmap', { ...change, userId: 'second' }));
  expect(changed.mock.calls[0][0].detail).toEqual(change);
  window.removeEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
});

test('a closed SSE connection retries and its retry is cancelled on unmount', async () => {
  const { unmount } = render(<OwnInboxRealtime userId="student" />);
  const first = BrowserStream.instances[0];
  Object.defineProperty(first, 'readyState', { value: 2 });
  act(() => first.dispatchEvent(new Event('error')));
  await waitFor(() => expect(BrowserStream.instances).toHaveLength(2), { timeout: 2500 });
  expect(first.closed).toBe(true);
  const second = BrowserStream.instances[1];
  Object.defineProperty(second, 'readyState', { value: 2 });
  act(() => second.dispatchEvent(new Event('error')));
  unmount();
  expect(second.closed).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  expect(BrowserStream.instances).toHaveLength(2);
});

test('going offline closes the tab stream and returning online opens a real replacement', () => {
  render(<OwnInboxRealtime userId="student" />);
  const first = BrowserStream.instances[0];
  act(() => window.dispatchEvent(new Event('offline')));
  expect(first.closed).toBe(true);
  act(() => window.dispatchEvent(new Event('online')));
  expect(BrowserStream.instances).toHaveLength(2);
});
