import { expect, it } from 'vitest';
import { clearOfAvoidedAreas } from '@/shared/ui/use-toast-viewport-position';

const viewport = { width: 1280, height: 800 };
const size = { width: 384, height: 66 };

it('keeps the usual placement when nothing is avoided', () => {
  expect(clearOfAvoidedAreas({ right: 91, bottom: 205 }, size, [], viewport)).toEqual({
    right: 91,
    bottom: 205,
  });
});

it('moves feedback beside a guided-tour popover that covers its usual placement', () => {
  const popover = { left: 924, top: 409, right: 1264, bottom: 591 };
  expect(clearOfAvoidedAreas({ right: 91, bottom: 205 }, size, [popover], viewport)).toEqual({
    right: 368,
    bottom: 205,
  });
});

it('moves feedback below the popover when there is no room beside it', () => {
  const popover = { left: 40, top: 409, right: 1264, bottom: 591 };
  expect(clearOfAvoidedAreas({ right: 91, bottom: 205 }, size, [popover], viewport)).toEqual({
    right: 91,
    bottom: 131,
  });
});

it('moves feedback above the popover when there is no room beside or below it', () => {
  const popover = { left: 40, top: 409, right: 1264, bottom: 780 };
  expect(clearOfAvoidedAreas({ right: 91, bottom: 205 }, size, [popover], viewport)).toEqual({
    right: 91,
    bottom: 403,
  });
});

it('moves feedback below the tour exit instead of stacking it on the popover', () => {
  const exit = { left: 290, top: 80, right: 374, bottom: 124 };
  const popover = { left: 34, top: 437, right: 374, bottom: 641 };
  const speedDial = { left: 198, top: 650, right: 375, bottom: 760 };
  expect(
    clearOfAvoidedAreas(
      { right: 20, bottom: 230 },
      { width: 285, height: 66 },
      [popover, speedDial, exit],
      {
        width: 390,
        height: 844,
      },
    ),
  ).toEqual({ right: 20, bottom: 642 });
});

it('moves feedback beside a popover that spans the whole height', () => {
  const popover = { left: 924, top: 40, right: 1264, bottom: 780 };
  expect(clearOfAvoidedAreas({ right: 20, bottom: 20 }, size, [popover], viewport)).toEqual({
    right: 368,
    bottom: 20,
  });
});
