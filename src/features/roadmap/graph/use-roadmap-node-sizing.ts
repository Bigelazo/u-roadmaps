'use client';

import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { roadmapNodeSizeForTitle, type RoadmapNodeSizer } from './geometry';

export const roadmapNodeTitleStyle = {
  fontSize: 15.5,
  fontWeight: 500,
  lineHeight: 1.25,
} satisfies CSSProperties;

export function useRoadmapNodeSizing(containerRef: RefObject<HTMLElement | null>) {
  const [sizeForTitle, setSizeForTitle] = useState<RoadmapNodeSizer>(() => roadmapNodeSizeForTitle);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !document.fonts) return;
    const family = getComputedStyle(container).fontFamily;
    const font = `${roadmapNodeTitleStyle.fontWeight} ${roadmapNodeTitleStyle.fontSize}px ${family}`;
    let active = true;
    const measure = () => {
      if (!active) return;
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return;
      context.font = font;
      const sizes = new Map<string, ReturnType<RoadmapNodeSizer>>();
      setSizeForTitle(() => (title: string) => {
        const text = title.replace(/[\t\n\f\r ]+/g, ' ').trim();
        const cached = sizes.get(text);
        if (cached) return cached;
        const size = roadmapNodeSizeForTitle(text, context.measureText(text).width);
        if (sizes.size >= 1000) sizes.clear();
        sizes.set(text, size);
        return size;
      });
    };
    document.fonts.addEventListener('loadingdone', measure);
    void document.fonts.load(font).then(measure, measure);
    return () => {
      active = false;
      document.fonts.removeEventListener('loadingdone', measure);
    };
  }, [containerRef]);
  return sizeForTitle;
}
