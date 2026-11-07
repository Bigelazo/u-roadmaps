'use client';

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { cn } from 'cn';

type Props = {
  isOpen: boolean;
  width: number;
  scene: string;
  children: ReactNode;
};

export function RoadmapPanelColumn({ isOpen, width, scene, children }: Props) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [lastOpenContent, setLastOpenContent] = useState({ width, children });
  const [isExiting, setIsExiting] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [settledScene, setSettledScene] = useState(scene);
  const isSceneChanging = scene !== settledScene;

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    setIsExiting(!isOpen && !isSceneChanging);
  } else if (isExiting && isSceneChanging) {
    setIsExiting(false);
  }
  if (isOpen && (lastOpenContent.width !== width || lastOpenContent.children !== children)) {
    setLastOpenContent({ width, children });
  }

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!isSceneChanging || !column) return;
    void getComputedStyle(column).width;
    setSettledScene(scene);
  }, [isSceneChanging, scene]);

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!isExiting || !column) return;
    const transitions = column.getAnimations();
    if (transitions.length === 0) {
      setIsExiting(false);
      return;
    }
    let isCurrent = true;
    void Promise.allSettled(transitions.map((transition) => transition.finished)).then(() => {
      if (isCurrent) setIsExiting(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [isExiting]);

  const content = isExiting ? lastOpenContent : { width, children };

  return (
    <div
      ref={columnRef}
      data-slot="roadmap-panel-column"
      inert={isExiting}
      style={{ '--sidebar-width': `${content.width}px` } as CSSProperties}
      className={cn(
        'contents has-data-[resizing=true]:transition-none lg:block lg:h-full lg:min-h-0 lg:min-w-0 lg:overflow-clip motion-safe:lg:transition-[width] motion-safe:lg:duration-200 motion-safe:lg:ease-out',
        isOpen ? 'lg:w-(--sidebar-width)' : 'lg:w-0',
        isSceneChanging && 'transition-none!',
      )}
    >
      {content.children}
    </div>
  );
}
