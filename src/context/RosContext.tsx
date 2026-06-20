import { createContext, useContext } from 'react';

export interface RosContextValue {
  serverUrl: string;
}

export const RosContext = createContext<RosContextValue>({
  serverUrl: 'http://localhost:3000',
});

export const useRos = () => useContext(RosContext);
