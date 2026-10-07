import { expect, test } from 'vitest';
import { reconcileResourceNotice } from '@/features/notifications/application/reconcile-resource';

const original = { title: 'Guía 3', revision: '1' };
const edited = { title: 'Guía 3 resuelta', revision: '2' };

test('a pending new Resource absorbs edits with its current title', () => {
  expect(reconcileResourceNotice(null, edited)).toEqual({
    changeKind: 'resource-added',
    resourceTitle: 'Guía 3 resuelta',
    titleChange: null,
  });
});

test('added then removed withdraws the Resource notice', () => {
  expect(reconcileResourceNotice(null, null)).toBeNull();
});

test('repeated Resource edits retain the known title and detail only a title change', () => {
  expect(reconcileResourceNotice(original, edited)).toEqual({
    changeKind: 'resource-updated',
    resourceTitle: 'Guía 3',
    titleChange: '«Guía 3» ahora se llama «Guía 3 resuelta».',
  });
  expect(reconcileResourceNotice(original, { title: 'Guía 3', revision: '3' })).toEqual({
    changeKind: 'resource-updated',
    resourceTitle: 'Guía 3',
    titleChange: null,
  });
});

test('edited then removed uses the title the recipient knew', () => {
  expect(reconcileResourceNotice(original, null)).toEqual({
    changeKind: 'resource-removed',
    resourceTitle: 'Guía 3',
    titleChange: null,
  });
});

test('an unchanged recognized Resource has no pending notice', () => {
  expect(reconcileResourceNotice(edited, edited)).toBeNull();
});
