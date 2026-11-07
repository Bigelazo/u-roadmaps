export type NodeTypeAppearance = Readonly<{ name: string; icon: string; color: string }>;

export const unknownNodeType = {
  name: 'Sin tipo',
  icon: 'Shapes',
  color: 'currentColor',
} as const satisfies NodeTypeAppearance;
