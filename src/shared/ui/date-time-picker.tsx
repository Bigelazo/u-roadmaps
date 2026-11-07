'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown, Clock } from 'lucide-react';
import { es } from 'react-day-picker/locale';
import { cn } from 'cn';
import { zonedInstant, zonedWallClock, type ZonedWallClock } from '@/shared/zoned-time';
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
  min?: Date;
  minuteStep?: number;
  defaultTime?: string;
  id?: string;
  dayLabel?: string;
  timeLabel?: string;
  dayPlaceholder?: string;
  disabled?: boolean;
  className?: string;
};

const dayFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDay(day: string) {
  return dayFormatter.format(new Date(`${day}T12:00:00.000Z`));
}

function dayOfDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateOfDay(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year!, month! - 1, date);
}

function timeSlots(minuteStep: number) {
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += minuteStep) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
    const minute = String(minutes % 60).padStart(2, '0');
    slots.push(`${hour}:${minute}`);
  }
  return slots;
}

export function DateTimePicker({
  value,
  onValueChange,
  timeZone,
  min,
  minuteStep = 15,
  defaultTime = '08:00',
  id,
  dayLabel = 'Día',
  timeLabel = 'Hora',
  dayPlaceholder = 'Elige un día',
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(defaultTime);
  const minimum = min ?? new Date();
  const selected = value ? zonedWallClock(value, timeZone) : null;
  const time = selected?.time ?? draftTime;
  const minimumDay = zonedWallClock(minimum, timeZone).day;
  const slots = timeSlots(minuteStep);
  const isAvailable = (wallClock: ZonedWallClock) =>
    zonedInstant(wallClock, timeZone).getTime() > minimum.getTime();
  const firstAvailableSlot = (day: string) =>
    slots.find((slot) => isAvailable({ day, time: slot }));

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
    <div className={cn('flex min-w-0 flex-wrap gap-2', className)}>
      <Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={selected ? `${dayLabel}: ${formatDay(selected.day)}` : dayLabel}
              className={cn(
                'min-w-0 flex-1 basis-40 justify-start font-normal tabular-nums',
                !selected && 'text-muted-foreground',
              )}
            />
          }
        >
          <CalendarDays data-icon="inline-start" aria-hidden="true" />
          <span className="truncate">{selected ? formatDay(selected.day) : dayPlaceholder}</span>
          <ChevronDown data-icon="inline-end" className="ml-auto" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={es}
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
          className="w-28 shrink-0 tabular-nums data-[size=default]:h-11"
        >
          <Clock className="text-muted-foreground" aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectGroup>
            {slots.map((slot) => (
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
