import React from 'react';
import ReactDOM from 'react-dom/client';
import { RosProvider } from './components/RosProvider';
import { RosControlPanel } from './components/RosControlPanel';

const SERVER_URL = import.meta.env.VITE_ROS_SERVER_URL ?? 'http://localhost:3000';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RosProvider url={SERVER_URL}>
      <RosControlPanel style={{ height: '100vh' }} />
    </RosProvider>
  </React.StrictMode>,
);