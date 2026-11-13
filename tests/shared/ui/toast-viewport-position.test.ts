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

it('moves feedback above a guided-tour popover that covers its usual placement', () => {
  const popover = { left: 924, top: 409, right: 1264, bottom: 591 };
  expect(clearOfAvoidedAreas({ right: 91, bottom: 205 }, size, [popover], viewport)).toEqual({
    right: 91,
    bottom: 403,
  });
});

it('moves feedback beside the popover when there is no room above it', () => {
  const popover = { left: 924, top: 40, right: 1264, bottom: 780 };
  expect(clearOfAvoidedAreas({ right: 20, bottom: 20 }, size, [popover], viewport)).toEqual({
    right: 368,
    bottom: 20,
  });
});
