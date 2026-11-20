import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LiveWallpaper from './components/Common/LiveWallpaper';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource-variable/figtree/wght-italic.css';
import '@fontsource-variable/sora/wght.css';
import './index.css';
import './glass.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2 }}><LiveWallpaper><App /></LiveWallpaper></MotionConfig>
  </StrictMode>
);
