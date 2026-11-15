import { useEffect, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { MotionConfig } from 'motion/react';

/** Shared decorative motion for web and desktop. Preferences survive reloads. */
export default function AmbientEffects({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem('acadex-ambient-paused') === 'true'; }
    catch { return false; }
  });
  const [hidden, setHidden] = useState(document.hidden);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const toggleEffects = () => setPaused(previous => {
    const next = !previous;
    try { localStorage.setItem('acadex-ambient-paused', String(next)); } catch { /* Storage is optional. */ }
    return next;
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className="experience" data-ambient-paused={paused || hidden}>
        <div className="ambient-lights" aria-hidden="true">
          <i className="ambient-light ambient-light--mint" />
          <i className="ambient-light ambient-light--gold" />
        </div>
        {children}
        <button
          type="button"
          className="effects-toggle"
          onClick={toggleEffects}
          aria-label={paused ? 'Resume ambient effects' : 'Pause ambient effects'}
          title={paused ? 'Resume ambient effects' : 'Pause ambient effects'}
        >
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          <span>Effects {paused ? 'off' : 'on'}</span>
        </button>
      </div>
    </MotionConfig>
  );
}
