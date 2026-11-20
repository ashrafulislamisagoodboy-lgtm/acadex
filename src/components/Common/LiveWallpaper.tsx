import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
      <svg viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" focusable="false" fill="none">
        <defs>
          <linearGradient id="sky-tide" x2="1" y2="1"><stop stopColor="#b7ecf1"/><stop offset=".48" stopColor="#aab6fa"/><stop offset="1" stopColor="#f1d2ea"/></linearGradient>
          <linearGradient id="aqua-tide" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#6fa8d8"/><stop offset=".42" stopColor="#b9f9ea"/><stop offset=".74" stopColor="#84bbe8"/><stop offset="1" stopColor="#7885df"/></linearGradient>
          <linearGradient id="lilac-tide" x2="1" y2=".4"><stop stopColor="#bd9ff2"/><stop offset=".5" stopColor="#edf2ff"/><stop offset="1" stopColor="#8e9fe5"/></linearGradient>
        </defs>
        <path fill="url(#sky-tide)" d="M0 0h1440v1000H0z"/>
        <path className="tide tide-high" fill="url(#aqua-tide)" d="M-400-210C110 48 330 320 670 253S1160-90 1840-60v360c-520-173-690 249-1050 253S-34 145-400 200z"/>
        <path className="tide tide-mid" fill="url(#lilac-tide)" stroke="#ffffff60" strokeWidth="2" d="M-420 870c603 40 786-420 1124-384s590 401 1120 170v840H-420z"/>
        <path className="tide tide-near" fill="url(#aqua-tide)" stroke="#ffffff80" strokeWidth="2" d="M-420 1010c590-180 765-453 1017-453 310 0 551 400 1260 95v860H-420z"/>
      </svg>
    </div>
    {children}
  </MotionPreference.Provider>;
}
