import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AmbientEffects from './components/Common/AmbientEffects';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource-variable/figtree/wght-italic.css';
import '@fontsource-variable/sora/wght.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AmbientEffects><App /></AmbientEffects>
  </StrictMode>
);
