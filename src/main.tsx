/** Mount the browser application and its bundled translations. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import './styles/app.css';

// Do not silently create a second mount point: the HTML shell must supply the one application root.
const root = document.getElementById('root');
if (!root) throw new Error('Application root element is missing.');

// Strict Mode enables React's development-only checks without changing the production application.
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
