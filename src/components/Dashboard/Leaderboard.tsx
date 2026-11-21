import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Crown, Play, RefreshCw, Search, SkipForward } from 'lucide-react';
import './podium.css';
import { Link } from 'react-router-dom';
import { auth, collection, db, getDocs, limit, orderBy, query, where } from '../../lib/local';

type LeaderboardUser = {
  id: string;
  uid?: string;
  name?: string;
  username?: string;
  grade?: string;
  photoUrl?: string;
  xp?: number;
  totalQuizzesPlayed?: number;
  totalQuestionsAttended?: number;
  achievements?: string[];
  isBanned?: boolean;
};

type SortMode = 'xp' | 'quizzes' | 'name';

const numberFormatter = new Intl.NumberFormat('en-US');

const getDisplayName = (user: LeaderboardUser) => user.name || user.username || 'Acadex learner';

const getInitials = (user: LeaderboardUser) =>
  getDisplayName(user)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const getLevel = (xp = 0) => Math.floor(xp / 100) + 1;

const Avatar = ({ user }: { user: LeaderboardUser }) => <span className="ranks-avatar" aria-hidden="true">
  {user.photoUrl ? <img alt="" src={user.photoUrl} /> : getInitials(user)}
</span>;

const medals = ['Gold', 'Silver', 'Bronze'];

function PodiumShow({ leaders, ranked, answers }: { leaders: LeaderboardUser[]; ranked: number; answers: number }) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const place = Math.min(selected, Math.max(leaders.length - 1, 0));
  const player = leaders[place];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (place > 0) setSelected(place - 1);
      else setPlaying(false);
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [playing, place]);

  function focusPlace(index: number) { setPlaying(false); setSelected(index); }
  function ceremony() {
    if (playing) { focusPlace(0); return; }
    setSelected(leaders.length - 1);
    setPlaying(true);
  }

  return <section className="podium-theatre" aria-labelledby="podium-title" data-spotlight={place + 1} data-playing={playing}>
    <header className="podium-heading"><div><p className="ranks-kicker">Acadex honours · All-time XP</p><h1 id="podium-title">The Podium</h1></div>
      {player && <button type="button" className="ceremony-button" onClick={ceremony}>
        {playing ? <SkipForward size={16}/> : <Play size={15}/>}{playing ? 'Skip reveal' : 'Play ceremony'}
      </button>}
    </header>
    <ol className="podium-stage" aria-label="Top three by experience points">
      {[0, 1, 2].map(i => {
        const user = leaders[i];
        const face = <><span className="podium-rim" aria-hidden="true"/>
          {user && <span className="medal-portrait" aria-hidden="true"><Avatar user={user}/></span>}
          <span className="podium-place" aria-hidden="true">{i === 0 && <Crown size={18}/>} {['I','II','III'][i]}</span>
          <strong className="podium-etch">{user ? getDisplayName(user) : 'Unclaimed'}</strong><small>{user ? `${numberFormatter.format(user.xp || 0)} XP` : 'Open place'}</small></>;
        return <li key={i} className="podium-step" data-place={i+1} data-empty={!user} data-lit={!!user && i === place}>
          {user ? <Link className="podium-crystal" to={`/profile/${user.id}`} aria-label={`Rank ${i+1}: ${getDisplayName(user)}, ${user.xp || 0} XP. View profile.`}>{face}</Link>
            : <div className="podium-crystal" aria-label={`Place ${i+1} unclaimed`}>{face}</div>}
        </li>;
      })}
    </ol>
    {player && <div className="spotlight-strip">
      <div className="spotlight-copy" aria-live="polite" aria-atomic="true"><div key={player.id}>
        <small>{medals[place]} spotlight</small><strong>{getDisplayName(player)}</strong>
        <p>Level {getLevel(player.xp)} · {numberFormatter.format(player.totalQuizzesPlayed || 0)} quizzes · {numberFormatter.format(player.totalQuestionsAttended || 0)} questions answered</p>
      </div></div>
      <div className="spotlight-picker" role="group" aria-label="Spotlight a medallist">{leaders.map((u,i) => <button type="button" key={u.id} aria-pressed={place===i} aria-label={`Spotlight ${medals[i]}: ${getDisplayName(u)}`} onClick={()=>focusPlace(i)}>{['I','II','III'][i]}</button>)}</div>
    </div>}
    <div className="podium-ledger"><span>{numberFormatter.format(ranked)} ranked</span><span>{numberFormatter.format(answers)} answers logged</span></div>
  </section>;
}

export default function Leaderboard() {
  const [overallRanking, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('xp');

  const loadLeaderboard = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const usersQuery = query(collection(db, 'users'), where('isBanned', '==', false), orderBy('xp', 'desc'), orderBy('name'), limit(100));
      const snapshot = await getDocs(usersQuery);
      const nextUsers = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }) as LeaderboardUser);
      setUsers(nextUsers);
    } catch (loadError) {
      console.error('Unable to load leaderboard:', loadError);
      setError('The leaderboard could not be loaded. Try refreshing it.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const rankById = useMemo(
    () => new Map(overallRanking.map((user, index) => [user.id, index + 1])),
    [overallRanking],
  );

  const grades = useMemo(
    () =>
      Array.from(new Set(overallRanking.map((user) => user.grade).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      ),
    [overallRanking],
  );

  const visibleUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = overallRanking.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        getDisplayName(user).toLowerCase().includes(normalizedSearch) ||
        (user.username || '').toLowerCase().includes(normalizedSearch);
      const matchesGrade = grade === 'all' || user.grade === grade;
      return matchesSearch && matchesGrade;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'quizzes') {
        return (b.totalQuizzesPlayed || 0) - (a.totalQuizzesPlayed || 0) || (b.xp || 0) - (a.xp || 0);
      }
      if (sortMode === 'name') {
        return getDisplayName(a).localeCompare(getDisplayName(b));
      }
      return (b.xp || 0) - (a.xp || 0);
    });
  }, [grade, overallRanking, search, sortMode]);

  const topThree = overallRanking.slice(0, 3);
  const totalQuestions = overallRanking.reduce((sum, user) => sum + (user.totalQuestionsAttended || 0), 0);
  const hasFilters = Boolean(search.trim()) || grade !== 'all' || sortMode !== 'xp';
  const currentUserId = auth.currentUser?.uid;

  const clearFilters = () => {
    setSearch('');
    setGrade('all');
    setSortMode('xp');
  };

  const self = overallRanking.find(user => (user.uid || user.id) === currentUserId);
  const myRank = self ? rankById.get(self.id)! : null;
  const ahead = myRank && myRank > 1 ? overallRanking[myRank - 2] : null;
  const num = (value = 0) => numberFormatter.format(value);

  if (loading) return <p className="ranks-status" role="status">Reading the league standings…</p>;

  return <div className="ranks-board">
    {(!error || overallRanking.length > 0) && <PodiumShow leaders={topThree} ranked={overallRanking.length} answers={totalQuestions} />}
    {error && <div className="ranks-status" role="alert">{error} <button disabled={refreshing} onClick={() => void loadLeaderboard(true)}>Retry</button></div>}
    {(!error || overallRanking.length > 0) && <>
      <section className="podium-personal" aria-labelledby="personal-place"><div><h2 id="personal-place" className="ranks-kicker">Your standing</h2><strong>{myRank ? `#${myRank}` : 'Unranked'}</strong></div>
        <div>{self && <b>Level {getLevel(self.xp)} · {num(self.xp)} XP</b>}
          <p>{ahead && self ? `${num((ahead.xp || 0) - (self.xp || 0) + 1)} more XP to beat ${getDisplayName(ahead)}’s score.` : myRank === 1 ? 'You hold first place.' : 'The board lists up to 100 ranked profiles.'}</p></div>
        {self && <Link to={`/profile/${self.id}`} aria-label="Open my record"><ArrowUpRight size={20}/></Link>}
      </section>
      <section className="ranks-register" aria-labelledby="register-title">
        <div className="ranks-register-title"><div><p className="ranks-kicker">League directory</p><h2 id="register-title">All standings</h2></div>
          <button className="ranks-refresh" disabled={refreshing} onClick={() => void loadLeaderboard(true)}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
        <div className="ranks-tools">
          <label className="ranks-search"><Search size={17}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search learners" placeholder="Name or username"/></label>
          <select value={grade} onChange={e=>setGrade(e.target.value)} aria-label="Filter by grade"><option value="all">All grades</option>{grades.map(g=><option key={g} value={g}>Grade {g}</option>)}</select>
          <select value={sortMode} onChange={e=>setSortMode(e.target.value as SortMode)} aria-label="Sort standings"><option value="xp">Highest XP</option><option value="quizzes">Most quizzes</option><option value="name">Name A–Z</option></select>
        </div>
        <div className="ranks-count"><span role="status">Showing {visibleUsers.length} of {overallRanking.length}</span>{hasFilters && <button onClick={clearFilters}>Reset filters</button>}</div>
        {visibleUsers.length ? <table className="ranks-table"><thead><tr><th scope="col">Rank</th><th scope="col">Learner</th><th scope="col" className="ranks-rounds">Quizzes</th><th scope="col">XP</th></tr></thead>
          <tbody>{visibleUsers.map(u=><tr key={u.id} data-self={u.id === self?.id}><td>#{rankById.get(u.id)}</td>
            <td><Link to={`/profile/${u.id}`}><Avatar user={u}/><span className="ranks-identity"><strong>{getDisplayName(u)}{u.id === self?.id && <small> · You</small>}</strong><span>@{u.username || 'learner'}{u.grade ? ` · Grade ${u.grade}` : ''}</span></span></Link></td>
            <td className="ranks-rounds">{num(u.totalQuizzesPlayed)}</td><td>{num(u.xp)}</td></tr>)}</tbody></table> : <p className="ranks-empty">{hasFilters ? 'No learners match these filters.' : 'No standings to display yet.'}</p>}
      </section>
    </>}
  </div>;
}
