import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BookOpen, CalendarDays, Home, Settings, Trophy, User } from 'lucide-react';

export const sections = [
  { path: '/', label: 'Desk', icon: Home, tint: '#2b7894' },
  { path: '/leaderboard', label: 'Ranks', icon: Trophy, tint: '#95631a' },
  { path: '/quiz', label: 'Quiz', icon: BookOpen, tint: '#5849a7' },
  { path: '/social', label: 'Calendar', icon: CalendarDays, tint: '#a84c64' },
  { path: '/admin', label: 'Admin', icon: Settings, tint: '#386352' },
  { path: '/profile', label: 'Profile', icon: User, tint: '#485b93' },
] as const;

type Section = typeof sections[number];
type Turn = { from: Section; to: Section; id: number };

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
    setTurn({ from, to: section, id: ++sequence.current });
    const end = window.setTimeout(() => setTurn(null), 780);
    return () => window.clearTimeout(end);
  }, [section]);
  if (!turn || turn.to !== section) return null;
  const OldIcon = turn.from.icon, NewIcon = turn.to.icon;
  const direction = sections.indexOf(turn.to) > sections.indexOf(turn.from) ? 1 : -1;
  return <div key={turn.id} className="tab-turn" data-direction={direction > 0 ? 'forward' : 'back'} aria-hidden="true"
    style={{ '--turn-direction': direction, '--turn-tint': turn.to.tint } as CSSProperties}>
    <div className="tab-turn__lens">
      <span className="tab-turn__coin">
        <span className="tab-turn__face" style={{color:turn.from.tint}}><OldIcon size={22}/></span>
        <span className="tab-turn__face tab-turn__back"><NewIcon size={22}/></span>
      </span>
      <span className="tab-turn__title">{turn.to.label}</span>
    </div>
  </div>;
}
