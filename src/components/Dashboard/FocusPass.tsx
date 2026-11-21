import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Send } from 'lucide-react';

const duration = 10 * 60;
type Flight = { end: number | null; remaining: number };
const fresh = (): Flight => ({ end: null, remaining: duration });
function restore(key: string): Flight {
  try {
    const f = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (f && Number.isInteger(f.remaining) && f.remaining >= 0 && f.remaining <= duration && (f.end === null || Number.isFinite(f.end))) return f;
  } catch { /* Storage is optional in an embedded preview. */ }
  return fresh();
}

export default function FocusPass({ uid }: { uid: string }) {
  const key = `acadex.focus-pass.${uid}`;
  const [flight, setFlight] = useState(() => restore(key));
  const [now, setNow] = useState(Date.now);
  const left = flight.end === null ? flight.remaining : Math.max(0, Math.min(duration, Math.ceil((flight.end - now) / 1000)));
  const running = flight.end !== null && left > 0;
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(flight)); } catch { /* In-memory timer still works. */ }
  }, [flight, key]);
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [running]);
  const label = running ? 'Pause focus' : left === 0 ? 'Start again' : left < duration ? 'Resume focus' : 'Start focus';
  function toggle() {
    const time = Date.now(); setNow(time);
    setFlight(running ? { end: null, remaining: Math.max(0,Math.ceil((flight.end! - time)/1000)) } : { end: time + (left || duration)*1000, remaining: left || duration });
  }
  return <section className="focus-pass" aria-label="Ten-minute focus timer">
    <div className="focus-stub" aria-hidden="true"><Send size={18}/><span>PASS</span></div>
    <div className="focus-body"><div className="focus-head"><span>Focus pass</span><strong role="timer" aria-label="Time remaining">{Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</strong></div>
      <p role="status">{running ? 'In session · one chapter' : !left ? 'Session complete. Take a breath.' : left < duration ? 'Paused · ready when you are' : 'Ten minutes. One chapter.'}</p>
      <div className="focus-controls"><button onClick={toggle}>{running ? <Pause size={14}/> : <Play size={14}/>} {label}</button>{(running || left !== duration) && <button aria-label="Reset focus timer" onClick={()=>setFlight(fresh())}><RotateCcw size={15}/></button>}</div>
    </div>
  </section>;
}
