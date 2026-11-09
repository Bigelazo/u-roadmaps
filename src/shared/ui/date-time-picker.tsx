'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown, Clock } from 'lucide-react';
import { es } from 'react-day-picker/locale';
import { cn } from 'cn';
import { formatCalendarDay, formatMonthCaption } from '@/shared/calendar-day-format';
import {
  END_OF_DAY_TIME,
  zonedInstant,
  zonedWallClock,
  type ZonedWallClock,
} from '@/shared/zoned-time';
import { Button } from '@/shared/ui/button';
import { Calendar } from '@/shared/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

export type DateTimePickerProps = {
  value: Date | null;
  onValueChange: (value: Date) => void;
  timeZone: string;
  defaultTime: string;
  id?: string;
  dayLabel: string;
  timeLabel: string;
  disabled?: boolean;
};

function dayOfDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateOfDay(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year!, month! - 1, date);
}

const TIME_SLOTS = [
  ...Array.from({ length: 96 }, (_, index) => {
    const hour = String(Math.floor(index / 4)).padStart(2, '0');
    const minute = String((index % 4) * 15).padStart(2, '0');
    return `${hour}:${minute}`;
  }),
  END_OF_DAY_TIME,
];

export function DateTimePicker({
  value,
  onValueChange,
  timeZone,
  defaultTime,
  id,
  dayLabel,
  timeLabel,
  disabled = false,
}: DateTimePickerProps) {
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(defaultTime);
  const minimum = new Date();
  const selected = value ? zonedWallClock(value, timeZone) : null;
  const time = selected?.time ?? draftTime;
  const minimumDay = zonedWallClock(minimum, timeZone).day;
  const isAvailable = (wallClock: ZonedWallClock) =>
    zonedInstant(wallClock, timeZone).getTime() > minimum.getTime();
  const firstAvailableSlot = (day: string) =>
    TIME_SLOTS.find((slot) => isAvailable({ day, time: slot }));

  function selectDay(date: Date | undefined) {
    if (!date) return;
    const day = dayOfDate(date);
    const chosenTime = isAvailable({ day, time }) ? time : firstAvailableSlot(day);
    if (!chosenTime) return;
    setDraftTime(chosenTime);
    setCalendarOpen(false);
    onValueChange(zonedInstant({ day, time: chosenTime }, timeZone));
  }

  function selectTime(nextTime: string | null) {
    if (!nextTime) return;
    setDraftTime(nextTime);
    if (selected) onValueChange(zonedInstant({ day: selected.day, time: nextTime }, timeZone));
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={selected ? `${dayLabel}: ${formatCalendarDay(selected.day)}` : dayLabel}
              className={cn(
                'min-w-fit flex-1 justify-start font-normal tabular-nums',
                !selected && 'text-muted-foreground',
              )}
            />
          }
        >
          <CalendarDays
            data-icon="inline-start"
            className="text-muted-foreground"
            aria-hidden="true"
          />
          {selected ? formatCalendarDay(selected.day) : 'Elige un día'}
          <ChevronDown data-icon="inline-end" className="ml-auto" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={es}
            formatters={{ formatCaption: formatMonthCaption }}
            selected={selected ? dateOfDay(selected.day) : undefined}
            defaultMonth={dateOfDay(selected?.day ?? minimumDay)}
            startMonth={dateOfDay(minimumDay)}
            disabled={(date) => {
              const day = dayOfDate(date);
              return day < minimumDay || (day === minimumDay && !firstAvailableSlot(day));
            }}
            onSelect={selectDay}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Select value={time} onValueChange={selectTime} disabled={disabled}>
        <SelectTrigger
          aria-label={timeLabel}
          className="w-28 shrink-0 rounded-(--radius-md) border-border bg-background tabular-nums hover:bg-muted aria-expanded:bg-muted data-[size=default]:h-11"
        >
          <Clock className="text-muted-foreground" aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="end"
          className="max-h-[min(18rem,var(--available-height))]"
        >
          <SelectGroup>
            {TIME_SLOTS.map((slot) => (
              <SelectItem
                key={slot}
                value={slot}
                className="tabular-nums"
                disabled={selected ? !isAvailable({ day: selected.day, time: slot }) : false}
              >
                {slot}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
