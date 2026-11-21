import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarDays, Crown, Fingerprint, LibraryBig, Settings, Telescope, TrendingUp } from 'lucide-react';
import { auth, db, doc, onSnapshot } from '../../lib/local';
import FieldAtlas from '../Common/FieldAtlas';
import DailySpark from './DailySpark';
import FocusPass from './FocusPass';
import './studio.css';

type RecordData = { name?: string; xp?: number; totalQuizzesPlayed?: number; totalQuestionsAttended?: number; role?: string };
const stops = [
  {path:'/leaderboard', title:'The podium', note:'See where you stand', icon:Crown},
  {path:'/social', title:'Calendar', note:'Plan your school week', icon:CalendarDays},
  {path:'/admin', title:'School office', note:'Manage school records', icon:Settings},
];

export default function Home() {
  const [profile, setProfile] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  const uid = auth.currentUser?.uid;
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), snap => { setProfile(snap.data()); setError(''); }, e => setError(e.message));
  }, [uid]);
  const xp = profile?.xp ?? 0, level = Math.floor(xp/100)+1;
  const today = new Date();
  const name = (profile?.name || auth.currentUser?.displayName || 'learner').trim().split(/\s+/)[0];
  return <div className="desk flight-studio">
    <div className="studio-mast"><span><i/> Student studio</span><time>{today.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'})}</time></div>
    <section className="flight-hero" aria-labelledby="flight-title">
      <img src="/study-flight.jpg" fetchPriority="high" alt="" />
      <div className="flight-copy"><p className="flight-edition"><span/> Acadex study sessions</p>
        <h1 id="flight-title">Let curiosity<br/><em>take flight.</em></h1>
        <p className="flight-deck">Hi {name}. Pick a chapter you’re curious about. Start with one question and see where it takes you.</p>
        <div className="flight-actions"><Link to="/quiz"><LibraryBig size={18}/> Start a quiz <ArrowRight size={17}/></Link><a href="#daily-spark">Try the warm-up ↓</a></div>
      </div>
      {uid && <FocusPass key={uid} uid={uid} />}
    </section>
    <div className="studio-pair"><DailySpark key={today.toDateString()} day={today.getDay()}/>
      <section className="studio-panel momentum"><div className="studio-label"><TrendingUp size={17}/> Your momentum</div>
        <h2>Practice adds up.</h2>
        {error ? <p role="alert">{error}</p> : !profile ? <p role="status">Reading your record…</p> : <><div className="momentum-track"><label htmlFor="studio-xp">Level {level}</label><span>{100 - xp%100} XP to level {level+1}</span></div>
          <progress id="studio-xp" max={100} value={xp%100}/>
          <dl>{[['Total XP',xp],['Quizzes finished',profile.totalQuizzesPlayed || 0],['Questions tried',profile.totalQuestionsAttended || 0]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>)}</dl></>}
        {uid && <Link className="passport-jump" to={`/profile/${uid}`}><Fingerprint size={17}/> Open my learner passport <ArrowUpRight size={16}/></Link>}
      </section>
    </div>
    <div className="studio-lower"><section className="studio-panel studio-links"><div className="studio-label"><LibraryBig size={16}/> Campus guide</div><h2>Beyond the library</h2>
      {stops.filter(stop=>stop.path!=='/admin'||profile?.role==='admin').map(({path,title,note,icon:Icon})=><Link key={path} to={path}><Icon size={21}/><span><strong>{title}</strong><small>{note}</small></span><ArrowUpRight size={17}/></Link>)}
    </section><section className="studio-panel studio-atlas"><div className="studio-label"><Telescope size={16}/> Curiosity corner</div><FieldAtlas/></section></div>
  </div>;
}
