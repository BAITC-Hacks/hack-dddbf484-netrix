import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import SearchPage from './pages/SearchPage';
import './styles/tokens.css';
import './styles/global.css';

const Page = import.meta.env.DEV && window.location.pathname === '/preview'
  ? lazy(() => import('./pages/PreviewPage'))
  : SearchPage;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p>Загружаем предпросмотр…</p>}>
      <Page />
    </Suspense>
  </StrictMode>,
);
