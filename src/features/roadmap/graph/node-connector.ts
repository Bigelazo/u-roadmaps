import { createContext } from 'react';

export type NodeConnector = {
  start: (nodeId: string) => void;
};

export const NodeConnectorContext = createContext<NodeConnector>({ start: () => {} });
