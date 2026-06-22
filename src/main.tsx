import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Override Number.prototype.toLocaleString to force English (Western) numerals globally
const originalNumberToLocaleString = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function(locales?: string | string[], options?: Intl.NumberFormatOptions) {
  return originalNumberToLocaleString.call(this, 'en-US', options);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
