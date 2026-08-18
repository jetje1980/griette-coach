import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AuthGate from './components/AuthGate';
import './index.css';

// Zonder geldige sessie komt er geen coach-data in beeld.
ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthGate>
    <App />
  </AuthGate>
);
