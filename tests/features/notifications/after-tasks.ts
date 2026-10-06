import { vi } from 'vitest';

export const afterTasks: Array<() => void | Promise<void>> = [];
export const scheduleAfter = vi.fn((task: () => void | Promise<void>) => {
  afterTasks.push(task);
});
export async function finishResponse() {
  for (const task of afterTasks.splice(0)) await task();
}
