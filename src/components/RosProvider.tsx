import type { ReactNode } from 'react';
import { RosContext } from '../context/RosContext';

interface RosProviderProps {
  url?: string;
  children: ReactNode;
}

export function RosProvider({ url = 'http://localhost:3000', children }: RosProviderProps) {
  return (
    <RosContext.Provider value={{ serverUrl: url }}>
      {children}
    </RosContext.Provider>
  );
}
