import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// When deployed on Vercel with VITE_API_URL pointing to Render (or any external backend),
// transparently route any legacy requests from http://localhost:4000 to VITE_API_URL.
const configuredBackendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
if (configuredBackendUrl && configuredBackendUrl !== 'http://localhost:4000') {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string') {
      if (input.startsWith('http://localhost:4000')) {
        input = input.replace('http://localhost:4000', configuredBackendUrl);
      }
    } else if (input instanceof URL) {
      if (input.origin === 'http://localhost:4000') {
        const target = new URL(configuredBackendUrl);
        input.protocol = target.protocol;
        input.host = target.host;
        input.port = target.port;
      }
    } else if (input instanceof Request) {
      if (input.url.startsWith('http://localhost:4000')) {
        const newUrl = input.url.replace('http://localhost:4000', configuredBackendUrl);
        input = new Request(newUrl, input);
      }
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
