import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Flag, Mountain, RefreshCw, Search } from 'lucide-react';
import './summit.css';
import { Link } from 'react-router-dom';
import { auth, collection, db, getDocs, limit, orderBy, query } from '../../lib/local';

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

const Avatar = ({ user }: { user: LeaderboardUser }) => <span className="summit-avatar" aria-hidden="true">
  {user.photoUrl ? <img alt="" src={user.photoUrl} /> : getInitials(user)}
</span>;

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
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
      const usersQuery = query(collection(db, 'users'), orderBy('xp', 'desc'), limit(100));
      const snapshot = await getDocs(usersQuery);
      const nextUsers = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }) as LeaderboardUser)
        .filter((user) => !user.isBanned);
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

  const overallRanking = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          (b.xp || 0) - (a.xp || 0) ||
          getDisplayName(a).localeCompare(getDisplayName(b)),
      ),
    [users],
  );

  const rankById = useMemo(
    () => new Map(overallRanking.map((user, index) => [user.id, index + 1])),
    [overallRanking],
  );

  const grades = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.grade).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      ),
    [users],
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
  const topScore = overallRanking[0]?.xp || 0;
  const totalQuestions = users.reduce((sum, user) => sum + (user.totalQuestionsAttended || 0), 0);
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
  const lead = topThree[0];
  const num = (value = 0) => numberFormatter.format(value);

  if (loading) return <p className="summit-status" role="status">Reading the league standings…</p>;

  return <div className="summit-board">
    <header className="summit-cover">
      <div className="summit-intro">
        <p className="summit-kicker"><Mountain size={18} /> Acadex / School standings</p>
        <h1>Summit <em>League.</em></h1>
        <p>One correct answer, one XP. Follow the climb from base camp to the summit.</p>
        <div className="summit-coordinates"><span>{num(users.length)} ranked</span><span>{num(totalQuestions)} answers logged</span></div>
      </div>
      <figure className="summit-map"><img src="/summit.svg" alt=""/><figcaption>Plate 02 &nbsp; / &nbsp; The ascent</figcaption></figure>
    </header>

    {error && <div className="summit-status" role="alert">{error} <button disabled={refreshing} onClick={() => void loadLeaderboard(true)}>Retry</button></div>}
    {(!error || users.length > 0) && <>
      <div className="summit-spread">
        <section className="summit-honours" aria-labelledby="summit-leaders">
          <p className="summit-kicker"><Flag size={15}/> Ridge markers / 01—03</p><h2 id="summit-leaders">At the summit</h2>
          {lead ? <ol>{topThree.map((u,i) => <li key={u.id}>
            <Link to={`/profile/${u.id}`} className="summit-medallist">
              <span className="summit-pin" aria-label={`Rank ${i+1}`}>{String(i+1).padStart(2,'0')}</span>
              <div><small>{['Flag bearer','Second ascent','Third ascent'][i]}</small><strong>{getDisplayName(u)}</strong></div>
              <b>{num(u.xp)} <small>XP</small></b><ArrowUpRight size={17}/>
            </Link>
          </li>)}</ol> : <p>No ranked profiles yet.</p>}
        </section>
        <section className="summit-pass" aria-labelledby="pass-title">
          <p className="summit-kicker">Personal field pass</p><h2 id="pass-title">Your position</h2>
          <div className="summit-position"><strong>{myRank ? `#${myRank}` : '—'}</strong><span>{self ? `Level ${getLevel(self.xp)} · ${num(self.xp)} XP` : 'Outside this board'}</span></div>
          <p>{ahead && self ? `${num((ahead.xp || 0) - (self.xp || 0) + 1)} more XP to beat ${getDisplayName(ahead)}’s score.` : myRank === 1 ? `You hold the flag with ${num(topScore)} XP.` : 'This register shows up to 100 profiles, ordered by XP.'}</p>
          {self && <Link to={`/profile/${self.id}`}>Open my record <ArrowUpRight size={16}/></Link>}
        </section>
      </div>

      <section className="summit-register" aria-labelledby="register-title">
        <div className="summit-register-title"><div><p className="summit-kicker">The field register</p><h2 id="register-title">All standings</h2></div>
          <button className="summit-refresh" disabled={refreshing} onClick={() => void loadLeaderboard(true)}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
        <div className="summit-tools">
          <label className="summit-search"><Search size={17}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search learners" placeholder="Name or username"/></label>
          <select value={grade} onChange={e=>setGrade(e.target.value)} aria-label="Filter by grade"><option value="all">All grades</option>{grades.map(g=><option key={g} value={g}>Grade {g}</option>)}</select>
          <select value={sortMode} onChange={e=>setSortMode(e.target.value as SortMode)} aria-label="Sort standings"><option value="xp">Highest XP</option><option value="quizzes">Most quizzes</option><option value="name">Name A–Z</option></select>
        </div>
        <div className="summit-count"><span role="status">Showing {visibleUsers.length} of {users.length}</span>{hasFilters && <button onClick={clearFilters}>Reset filters</button>}</div>
        {visibleUsers.length ? <table className="summit-table"><thead><tr><th scope="col">Rank</th><th scope="col">Learner</th><th scope="col" className="summit-rounds">Quizzes</th><th scope="col">XP</th></tr></thead>
          <tbody>{visibleUsers.map(u=><tr key={u.id} data-self={u.id === self?.id}><td>#{rankById.get(u.id)}</td>
            <td><Link to={`/profile/${u.id}`}><Avatar user={u}/><span className="summit-identity"><strong>{getDisplayName(u)}{u.id === self?.id && <small> · You</small>}</strong><span>@{u.username || 'learner'}{u.grade ? ` · Grade ${u.grade}` : ''}</span></span></Link></td>
            <td className="summit-rounds">{num(u.totalQuizzesPlayed)}</td><td>{num(u.xp)}</td></tr>)}</tbody></table> : <p className="summit-empty">{hasFilters ? 'No learners match these filters.' : 'No standings to display yet.'}</p>}
      </section>
    </>}
  </div>;
}
