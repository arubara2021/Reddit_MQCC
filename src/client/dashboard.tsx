// src/client/dashboard.tsx

import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './components/Dashboard';
import './index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
