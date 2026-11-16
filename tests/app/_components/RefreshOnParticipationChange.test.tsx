import { render } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { RefreshOnParticipationChange } from '@/app/_components/RefreshOnParticipationChange';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => refresh.mockClear());

test('a Participation that U-Campus changed refreshes the page once', async () => {
  render(<RefreshOnParticipationChange changed={Promise.resolve(true)} />);
  await settle();
  expect(refresh).toHaveBeenCalledOnce();
});

test('a Participation that U-Campus confirmed leaves the page as it is', async () => {
  render(<RefreshOnParticipationChange changed={Promise.resolve(false)} />);
  await settle();
  expect(refresh).not.toHaveBeenCalled();
});

test('a change streamed as a bare thenable still refreshes the page', async () => {
  const streamed = {
    then(resolve: (changed: boolean) => void) {
      resolve(true);
    },
  } as unknown as Promise<boolean>;
  render(<RefreshOnParticipationChange changed={streamed} />);
  await settle();
  expect(refresh).toHaveBeenCalledOnce();
});

test('leaving the page before U-Campus answers does not refresh it', async () => {
  let answer: (changed: boolean) => void = () => undefined;
  const changed = new Promise<boolean>((resolve) => {
    answer = resolve;
  });
  const { unmount } = render(<RefreshOnParticipationChange changed={changed} />);
  unmount();
  answer(true);
  await settle();
  expect(refresh).not.toHaveBeenCalled();
});
