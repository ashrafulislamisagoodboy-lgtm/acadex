import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BookOpen, CalendarDays, Home, Settings, Mountain, User } from 'lucide-react';

export const sections = [
  { path: '/', label: 'Desk', icon: Home, tint: '#2b7894' },
  { path: '/leaderboard', label: 'Ranks', icon: Mountain, tint: '#31674e' },
  { path: '/quiz', label: 'Quiz', icon: BookOpen, tint: '#5849a7' },
  { path: '/social', label: 'Calendar', icon: CalendarDays, tint: '#a84c64' },
  { path: '/admin', label: 'Admin', icon: Settings, tint: '#386352' },
  { path: '/profile', label: 'Profile', icon: User, tint: '#485b93' },
] as const;

type Section = typeof sections[number];
type Point = { x: number; y: number };
type Turn = { from: Section; to: Section; start: Point; end: Point; id: number };

// Measure the visible navigation, not the hidden duplicate in the mobile dock.
// Coordinates are relative to the centre of the fixed transition layer.
function anchor(section: Section): Point {
  for (const link of document.querySelectorAll(`[data-tab-anchor="${section.path}"]`)) {
    const rect = (link.querySelector('svg, img') ?? link).getBoundingClientRect();
    if (rect.width && rect.height) return {
      x: rect.left + rect.width / 2 - window.innerWidth / 2,
      y: rect.top + rect.height / 2 - window.innerHeight / 2,
    };
  }
  return { x: 0, y: 0 };
}

/** One decorative transition per section change, never on initial load. */
export default function TabTurn({ section }: { section: Section }) {
  const previous = useRef(section);
  const sequence = useRef(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = section;
    if (from === section) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTurn(null); return; }
    setTurn({ from, to: section, start: anchor(from), end: anchor(section), id: ++sequence.current });
    const end = window.setTimeout(() => setTurn(null), 840);
    return () => window.clearTimeout(end);
  }, [section]);
  if (!turn || turn.to !== section) return null;
  const OldIcon = turn.from.icon, NewIcon = turn.to.icon;
  const direction = sections.indexOf(turn.to) > sections.indexOf(turn.from) ? 1 : -1;
  return <div key={turn.id} className="tab-turn" data-direction={direction > 0 ? 'forward' : 'back'} aria-hidden="true"
    style={{ '--turn-direction': direction, '--turn-tint': turn.to.tint,
      '--from-x': `${turn.start.x}px`, '--from-y': `${turn.start.y}px`,
      '--to-x': `${turn.end.x}px`, '--to-y': `${turn.end.y}px`,
    } as CSSProperties}>
    <span className="tab-turn__ripple" />
    <div className="tab-turn__lens">
      <span className="tab-turn__coin">
        <span className="tab-turn__face" style={{color:turn.from.tint}}><OldIcon size={22}/></span>
        <span className="tab-turn__face tab-turn__back"><NewIcon size={22}/></span>
      </span>
      <span className="tab-turn__title">{turn.to.label}</span>
    </div>
  </div>;
}
