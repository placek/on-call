import React from 'react';
import { createRoot } from 'react-dom/client';
import OnCall from './on_call.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OnCall />
  </React.StrictMode>,
);
