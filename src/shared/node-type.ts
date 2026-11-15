export type NodeTypeAppearance = Readonly<{ name: string; icon: string; color: string }>;

export const unknownNodeType = {
  name: 'Sin tipo',
  icon: 'Shapes',
  color: 'currentColor',
} as const satisfies NodeTypeAppearance;

const hexColor = /^#[0-9a-f]{6}$/i;

export function nodeTypePaint(color: string) {
  if (!hexColor.test(color)) return color;
  return `var(--node-type-${color.slice(1).toLowerCase()}, color-mix(in srgb, ${color} var(--node-type-strength, 100%), white))`;
}
