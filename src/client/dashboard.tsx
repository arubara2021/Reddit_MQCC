// src/client/dashboard.tsx
import { createRoot } from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import './index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Dashboard />);
}
