import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarDays, Crown, Fingerprint, Settings } from 'lucide-react';
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

function StudyNote({ uid }: { uid: string }) {
  const day = new Date();
  const key = `acadex.desk-note.${uid}.${day.getFullYear()}-${day.getMonth()+1}-${day.getDate()}`;
  const [note, setNote] = useState(() => { try { return localStorage.getItem(key) || ''; } catch { return ''; } });
  return <label className="notebook-note"><span>Today I’m working on</span>
    <input value={note} maxLength={100} placeholder="A chapter, a question, an idea…" onChange={e => {
      setNote(e.target.value); try { localStorage.setItem(key,e.target.value); } catch { /* Keep the draft in memory. */ }
    }}/></label>;
}

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
  return <div className="desk notebook-desk">
    <div className="notebook-mast"><span>Acadex &nbsp; / &nbsp; Desk</span><time>{today.toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'})}</time></div>
    <div className="notebook-spread">
      <section className="notebook-entry"><p className="notebook-kicker">Study notebook</p>
        <h1>Hi, {name}.</h1><p className="notebook-intro">What would you like to work on today?</p>
        {uid && <StudyNote key={`${uid}-${today.toDateString()}`} uid={uid} />}
        <div className="notebook-actions"><Link to="/quiz">Start a quiz <ArrowRight size={17}/></Link><a href="#daily-spark">Try the warm-up ↓</a></div>
      </section>
      <DailySpark key={today.toDateString()} day={today.getDay()}/>
    </div>
    <div className="notebook-tools">{uid && <FocusPass key={uid} uid={uid} />}
      <section className="momentum"><h2>Practice record</h2>
        {error ? <p role="alert">{error}</p> : !profile ? <p role="status">Reading your record…</p> : <><div className="momentum-track"><label htmlFor="studio-xp">Level {level}</label><span>{100 - xp%100} XP to level {level+1}</span></div>
          <progress id="studio-xp" max={100} value={xp%100}/>
          <dl>{[['Total XP',xp],['Quizzes finished',profile.totalQuizzesPlayed || 0],['Questions tried',profile.totalQuestionsAttended || 0]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>)}</dl></>}
        {uid && <Link className="passport-jump" to={`/profile/${uid}`}><Fingerprint size={17}/> Open my learner passport <ArrowUpRight size={16}/></Link>}
      </section>
    </div>
    <div className="notebook-lower"><section className="studio-links"><h2>Elsewhere on campus</h2>
      {stops.filter(stop=>stop.path!=='/admin'||profile?.role==='admin').map(({path,title,note,icon:Icon})=><Link key={path} to={path}><Icon size={21}/><span><strong>{title}</strong><small>{note}</small></span><ArrowUpRight size={17}/></Link>)}
    </section><div className="studio-atlas"><FieldAtlas/></div></div>
  </div>;
}
