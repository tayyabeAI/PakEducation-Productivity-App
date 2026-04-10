import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler for debugging
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', message, error);
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Something went wrong</h1>
      <pre>${message}</pre>
      <p>Please check the console for more details.</p>
    </div>`;
  }
};

console.log('App initializing...');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
