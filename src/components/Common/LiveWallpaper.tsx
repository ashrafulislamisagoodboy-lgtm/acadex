import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';

const preferenceKey = 'acadex.wallpaper.paused';
const MotionPreference = createContext({ paused: false, toggle: () => {} });

export function WallpaperControl() {
  const { paused, toggle } = useContext(MotionPreference);
  const label = paused ? 'Resume background motion' : 'Pause background motion';
  return <button type="button" className="wallpaper-control" aria-label={label} title={label} onClick={toggle}>
    {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
  </button>;
}

/** The clip contains only the lower half of the photograph. Decode it once,
 * not on each route change, and never fetch it for a still wallpaper. */
function MeadowWind({ paused }: { paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const field = video.current!;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (paused || motion.matches) { field.pause(); return; }
      if (!field.hasAttribute('src')) field.src = '/meadow-wind.webm';
      // The still photograph and CSS blades remain if playback is unavailable.
      void field.play().catch(() => {});
    };
    sync();
    motion.addEventListener('change', sync);
    return () => { motion.removeEventListener('change', sync); field.pause(); };
  }, [paused]);
  return <div className="meadow-photo-plane"><video className="meadow-wind" ref={video} muted loop playsInline preload="none" /></div>;
}

export default function LiveWallpaper({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem(preferenceKey) === 'true'; } catch { return false; }
  });
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  function toggle() {
    setPaused(!paused);
    try { localStorage.setItem(preferenceKey, String(!paused)); } catch { /* Optional preference. */ }
  }
  return <MotionPreference.Provider value={{ paused, toggle }}>
    <div className="live-wallpaper" aria-hidden="true" data-paused={paused || hidden}>
      <div className="meadow-scene">
        <MeadowWind paused={paused || hidden} />
        <span className="meadow-cloud meadow-cloud--wisp" />
        <span className="meadow-cloud meadow-cloud--horizon" />
        <span className="meadow-cloud meadow-cloud--puff" />
        <span className="meadow-cloud meadow-cloud--far" />
        <span className="meadow-cloud meadow-cloud--near" />
        <span className="meadow-grass meadow-grass--far" />
        <span className="meadow-grass meadow-grass--near" />
      </div>
    </div>
    {children}
  </MotionPreference.Provider>;
}
