'use client';

import dynamic from 'next/dynamic';

export const NodeDescription = dynamic(
  () => import('./NodeDescription').then(({ NodeDescription }) => NodeDescription),
  { loading: () => null },
);
