import type { Page } from '@playwright/test';

/** A DataTransfer holding one file, to dispatch as a drag-and-drop onto an element. */
export function fileDrop(page: Page, name: string, text: string, type = 'text/markdown') {
  return page.evaluateHandle(
    ({ name, text, type }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([text], name, { type }));
      return dataTransfer;
    },
    { name, text, type },
  );
}
