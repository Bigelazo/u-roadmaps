const units = ['B', 'KB', 'MB', 'GB'] as const;
const sizeNumber = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

export function formatFileSize(bytes: number) {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? Math.round(value) : value;
  return `${sizeNumber.format(rounded)} ${units[unit]}`;
}
