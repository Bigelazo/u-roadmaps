'use client';

import { useLayoutEffect, useRef, useState } from 'react';

export function useClampedText<Element extends HTMLElement>(text: string) {
  const ref = useRef<Element>(null);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setIsClamped(element.scrollHeight - element.clientHeight > 1);
    measure();
    element.addEventListener('pointerenter', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener('pointerenter', measure);
      observer?.disconnect();
    };
  }, [text]);

  return { ref, isClamped };
}
