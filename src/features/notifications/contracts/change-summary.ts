import type { NodeTypeAppearance } from '@/shared/node-type';

export type ChangeSummaryNode = Readonly<{ title: string; nodeType: NodeTypeAppearance }>;

export type ChangeSummaryPart = string | Readonly<{ node: ChangeSummaryNode }>;

export type ChangeSummaryItem = string | readonly ChangeSummaryPart[];

export type ChangeSummaryGroup = {
  title: string;
  node?: ChangeSummaryNode;
  items: ChangeSummaryItem[];
};

export type ChangeSummary = {
  courseCode: string;
  groups: ChangeSummaryGroup[];
};
