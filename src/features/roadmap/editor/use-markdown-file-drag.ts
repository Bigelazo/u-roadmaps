import { useEffect, useState } from 'react';

const markdownMediaTypes = ['text/markdown', 'text/x-markdown'];
const dragSilenceLimitMs = 1000;

function isFileDrag(dataTransfer: DataTransfer | null): dataTransfer is DataTransfer {
  return Boolean(dataTransfer?.types.includes('Files'));
}

export function mayHoldSingleMarkdownFile(dataTransfer: DataTransfer | null) {
  if (!isFileDrag(dataTransfer)) return false;
  const files = Array.from(dataTransfer.items ?? []).filter((item) => item.kind === 'file');
  if (files.length > 1) return false;
  const mediaType = files[0]?.type;
  return !mediaType || markdownMediaTypes.includes(mediaType);
}

function leavesWindow(event: DragEvent) {
  return (
    event.relatedTarget === null &&
    (event.clientX <= 0 ||
      event.clientY <= 0 ||
      event.clientX >= window.innerWidth ||
      event.clientY >= window.innerHeight)
  );
}

function rejectStrayDrop(event: DragEvent) {
  if (event.defaultPrevented || !isFileDrag(event.dataTransfer)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'none';
}

export function useMarkdownFileDrag(isEnabled: boolean) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isEnabled) return;
    let silenceTimer: number | undefined;
    const stop = () => {
      window.clearTimeout(silenceTimer);
      setIsDragging(false);
    };
    const track = (event: DragEvent) => {
      if (!mayHoldSingleMarkdownFile(event.dataTransfer)) return;
      setIsDragging(true);
      window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(stop, dragSilenceLimitMs);
    };
    const leave = (event: DragEvent) => {
      if (leavesWindow(event)) stop();
    };

    window.addEventListener('dragenter', track, true);
    window.addEventListener('dragover', track, true);
    window.addEventListener('dragleave', leave, true);
    window.addEventListener('drop', stop, true);
    window.addEventListener('dragover', rejectStrayDrop);
    window.addEventListener('drop', rejectStrayDrop);
    return () => {
      window.removeEventListener('dragenter', track, true);
      window.removeEventListener('dragover', track, true);
      window.removeEventListener('dragleave', leave, true);
      window.removeEventListener('drop', stop, true);
      window.removeEventListener('dragover', rejectStrayDrop);
      window.removeEventListener('drop', rejectStrayDrop);
      stop();
    };
  }, [isEnabled]);

  return isEnabled && isDragging;
}
