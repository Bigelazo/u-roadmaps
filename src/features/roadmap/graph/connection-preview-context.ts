import { createContext } from 'react';
import type { NodeRect } from './geometry';

export const ConnectionTargetContext = createContext<(NodeRect & { id: string }) | null>(null);
export const ConnectionRejectedTargetContext = createContext<NodeRect | null>(null);
