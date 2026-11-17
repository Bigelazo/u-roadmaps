import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { UnlockDateTimePicker } from '@/features/roadmap/ui/UnlockScheduleField';

function Picker({ onValueChange }: { onValueChange: (value: Date | null) => void }) {
  const [value, setValue] = useState<Date | null>(null);
  return (
    <UnlockDateTimePicker
      id="unlock"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
    />
  );
}

beforeAll(() => import('@/shared/ui/date-time-picker'));
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-07T15:00:00.000Z') }));
afterEach(() => vi.useRealTimers());

test('picks a day and time in Chilean time and refuses past days', async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<Picker onValueChange={onValueChange} />);

  await user.click(await screen.findByRole('button', { name: 'Día del desbloqueo' }));
  expect(screen.getByText('Noviembre 2026')).toBeTruthy();
  const pastDay = screen.getByRole('button', { name: /, 6 de noviembre de 2026/ });
  expect((pastDay as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: /21 de noviembre de 2026/ }));
  await user.click(screen.getByRole('combobox', { name: 'Hora del desbloqueo' }));
  await user.click(await screen.findByRole('option', { name: '14:30' }));
  expect(onValueChange).toHaveBeenLastCalledWith(new Date('2026-11-21T17:30:00.000Z'));
});

test('defaults the unlock time to 23:59, listed right after 23:45', async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<Picker onValueChange={onValueChange} />);

  await user.click(await screen.findByRole('button', { name: 'Día del desbloqueo' }));
  await user.click(screen.getByRole('button', { name: /21 de noviembre de 2026/ }));
  const time = screen.getByRole('combobox', { name: 'Hora del desbloqueo' });
  expect(within(time).getByText('23:59')).toBeTruthy();
  expect(onValueChange).toHaveBeenLastCalledWith(new Date('2026-11-22T02:59:00.000Z'));
  await user.click(time);
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
  expect(options.slice(-2)).toEqual(['23:45', '23:59']);
});

test('keeps 23:59 available on the current Chilean day after 23:45 has passed', async () => {
  vi.setSystemTime(new Date('2026-11-08T02:50:00.000Z'));
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(<Picker onValueChange={onValueChange} />);

  await user.click(await screen.findByRole('button', { name: 'Día del desbloqueo' }));
  await user.click(screen.getByRole('button', { name: /, 7 de noviembre de 2026/ }));
  await user.click(screen.getByRole('combobox', { name: 'Hora del desbloqueo' }));
  expect((await screen.findByRole('option', { name: '23:45' })).getAttribute('aria-disabled')).toBe(
    'true',
  );
  expect(screen.getByRole('option', { name: '23:59' }).getAttribute('aria-disabled')).not.toBe(
    'true',
  );
  expect(onValueChange).toHaveBeenLastCalledWith(new Date('2026-11-08T02:59:00.000Z'));
});

test('offers only future times on the current Chilean day', async () => {
  const user = userEvent.setup();
  render(<Picker onValueChange={vi.fn()} />);

  await user.click(await screen.findByRole('button', { name: 'Día del desbloqueo' }));
  await user.click(screen.getByRole('button', { name: /, 7 de noviembre de 2026/ }));
  await user.click(screen.getByRole('combobox', { name: 'Hora del desbloqueo' }));
  expect((await screen.findByRole('option', { name: '12:00' })).getAttribute('aria-disabled')).toBe(
    'true',
  );
  expect(screen.getByRole('option', { name: '12:15' }).getAttribute('aria-disabled')).not.toBe(
    'true',
  );
});
