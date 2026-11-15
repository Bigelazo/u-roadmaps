import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { Calendar } from '@/shared/ui/calendar';

function calendarDayIdentifiers(month: Date) {
  return [
    ...renderToString(<Calendar mode="single" month={month} />).matchAll(
      /<button[^>]+data-day="([^"]+)"/g,
    ),
  ].map((match) => match[1]);
}

it('keeps server and browser day identifiers equal across default locales', () => {
  const month = new Date(2026, 10, 14);
  const native = Date.prototype.toLocaleDateString;
  const locale = vi.spyOn(Date.prototype, 'toLocaleDateString');
  try {
    locale.mockImplementation(function (this: Date, options, format) {
      return native.call(this, options ?? 'en-US', format);
    });
    const serverIdentifiers = calendarDayIdentifiers(month);
    locale.mockImplementation(function (this: Date, options, format) {
      return native.call(this, options ?? 'es-CL', format);
    });
    const browserIdentifiers = calendarDayIdentifiers(month);
    expect(browserIdentifiers).toEqual(serverIdentifiers);
    expect(serverIdentifiers).toContain('2026-11-14');
  } finally {
    locale.mockRestore();
  }
});

it('keeps day identifiers and selection in the configured civil calendar', () => {
  const selected = new Date('2026-11-13T12:30:00Z');
  const onSelect = vi.fn();
  render(
    <Calendar
      mode="single"
      month={selected}
      selected={selected}
      timeZone="Pacific/Kiritimati"
      onSelect={onSelect}
    />,
  );
  const button = screen.getByRole('button', { name: /November 14th, 2026/ });
  expect(button.getAttribute('data-day')).toBe('2026-11-14');
  expect(button.getAttribute('data-selected-single')).toBe('true');
  const nextDay = screen.getByRole('button', { name: /November 15th, 2026/ });
  expect(nextDay.getAttribute('data-day')).toBe('2026-11-15');
  fireEvent.click(nextDay);
  const chosen = onSelect.mock.calls[0]?.[0] as Date;
  expect(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Kiritimati',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(chosen),
  ).toBe('2026-11-15');
});
