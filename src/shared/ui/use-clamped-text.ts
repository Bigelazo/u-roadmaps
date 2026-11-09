'use client';

import { useLayoutEffect, useRef, useState } from 'react';

export function useClampedText<Element extends HTMLElement>(text: string) {
  const ref = useRef<Element>(null);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setIsClamped(element.scrollHeight > element.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return { ref, isClamped };
}
