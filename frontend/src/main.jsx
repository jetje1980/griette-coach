import React from 'react';
import ReactDOM from 'react-dom/client';
import './secureRuntime';
import './planningGuard';
import App from './App';
import AuthGate from './AuthGate';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthGate>
    <App />
  </AuthGate>
);
