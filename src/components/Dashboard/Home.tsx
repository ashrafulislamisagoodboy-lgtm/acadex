import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Crown, Settings } from 'lucide-react';
import { auth, db, doc, onSnapshot } from '../../lib/local';

import FieldAtlas from '../Common/FieldAtlas';

const index = [
  { path: '/quiz', title: 'Practice library', note: 'Questions by book and chapter', icon: BookOpen },
  { path: '/leaderboard', title: 'The Podium', note: 'Scores and school standings', icon: Crown },
  { path: '/social', title: 'Term calendar', note: 'Dates from the school office', icon: CalendarDays },
  { path: '/admin', title: 'School office', note: 'Students, books and records', icon: Settings },
];

export default function Home() {
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!auth.currentUser) return;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), snap => { setProfile(snap.data()); setError(''); }, e => setError(e.message));
  }, []);
  const xp = profile?.xp ?? 0;
  const date = new Date().toLocaleDateString('en', {weekday:'long', month:'long', day:'numeric'});
  return <div className="desk">
    <div className="folio-line"><span>Acadex &nbsp; / &nbsp; Field notes</span><time>{date}</time></div>
    <section className="desk-cover">
      <div className="desk-intro"><p className="folio-kicker"><i /> Student handbook</p>
        <h1>The study <em>desk.</em></h1>
        <p>Welcome back, {profile?.name || auth.currentUser?.displayName || 'learner'}. Your practice library and school records are here.</p>
        <Link viewTransition className="desk-cta" to="/quiz">Start a quiz <ArrowRight size={18}/></Link>
      </div>
      <FieldAtlas />
    </section>
    <div className="desk-columns"><section><div className="desk-title"><span>01 / Index</span><h2>On your desk</h2></div>
      <div>{index.filter(item => item.path !== '/admin' || profile?.role === 'admin').map(({path,title,note,icon:Icon}, i) => <Link viewTransition key={path} className="desk-row" to={path}>
        <span className="desk-row-icon"><Icon size={20}/></span><div><h3>{title}</h3><p>{note}</p></div><span className="folio-number">0{i+1}</span><ArrowUpRight size={18}/>
      </Link>)}</div>
    </section><section className="record"><div className="desk-title"><span>02 / Record</span><h2>Practice log</h2></div>
      {error ? <p role="alert">{error}</p> : !profile ? <p role="status">Reading your record…</p> : <><dl>{[['Experience', `${xp.toLocaleString()} XP`], ['Quizzes finished', profile.totalQuizzesPlayed || 0], ['Achievements', profile.achievements?.length || 0]].map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <label htmlFor="desk-progress">Level {Math.floor(xp/100)+1} <span>{100-xp%100} XP to next level</span></label><progress id="desk-progress" value={xp%100} max={100}/></>}
    </section></div>
  </div>;
}
