import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  ChevronRight,
  Crown,
  Flame,
  Medal,
  RefreshCw,
  Search,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
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

const podiumStyles = {
  1: {
    card: 'honour-card',
    avatar: 'border-amber-400 ring-4 ring-amber-200/70',
    badge: 'bg-amber-400 text-forest',
    order: 'order-1 sm:order-2',
    icon: Crown,
    iconClass: 'text-amber-500',
    label: 'Champion',
  },
  2: {
    card: 'honour-card',
    avatar: 'border-slate-300 ring-4 ring-slate-200/70',
    badge: 'bg-slate-300 text-slate-800',
    order: 'order-2 sm:order-1',
    icon: Medal,
    iconClass: 'text-slate-400',
    label: 'Runner-up',
  },
  3: {
    card: 'honour-card',
    avatar: 'border-orange-300 ring-4 ring-orange-100',
    badge: 'bg-orange-300 text-orange-950',
    order: 'order-3',
    icon: Award,
    iconClass: 'text-orange-500',
    label: 'Third place',
  },
} as const;

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

const Avatar = ({ user, className = '' }: { user: LeaderboardUser; className?: string }) => (
  <div
    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest text-sm font-black text-butter ${className}`}
  >
    {user.photoUrl ? (
      <img className="h-full w-full object-cover" src={user.photoUrl} alt={getDisplayName(user)} />
    ) : (
      <span>{getInitials(user)}</span>
    )}
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent: string;
}) => (
  <div className="glass-card-dark rounded-2xl border p-4">
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
        <Icon size={19} />
      </div>
      <div>
        <p className="text-xl font-black leading-none text-white">{value}</p>
        <p className="mt-1 text-xs font-semibold text-butter/65">{label}</p>
      </div>
    </div>
  </div>
);

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('xp');
  const reduceMotion = useReducedMotion();

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

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 py-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-[2rem] bg-butter/20" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-[2rem] bg-butter/20" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 py-4 pb-12 sm:py-7">
      <section className="glass-card-dark relative overflow-hidden rounded-[2rem] border px-5 py-7 sm:px-8 sm:py-9">

        <div className="relative grid gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="folio-kicker mb-3">
              Register &nbsp; / &nbsp; School standings
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl">
              League register
            </h1>
            <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-butter/70 sm:text-base">
              Compare quiz records or look up a learner by name.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <StatCard
              icon={Users}
              label="Learners ranked"
              value={numberFormatter.format(users.length)}
              accent="bg-cyan-300 text-forest"
            />
            <StatCard
              icon={Zap}
              label="Top score"
              value={numberFormatter.format(topScore)}
              accent="bg-amber-300 text-forest"
            />
            <StatCard
              icon={Target}
              label="Questions answered"
              value={numberFormatter.format(totalQuestions)}
              accent="bg-emerald-300 text-forest"
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-300/30 bg-red-950/30 p-4 text-sm font-semibold text-red-100 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadLeaderboard(true)}
            className="rounded-xl bg-red-100 px-4 py-2 text-red-950 transition hover:bg-white"
          >
            Try again
          </button>
        </div>
      )}

      {topThree.length > 0 ? (
        <section aria-labelledby="podium-title">
          <div className="mb-10 flex items-end justify-between sm:mb-12">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-butter/70">Honour roll</p>
              <h2 id="podium-title" className="mt-1 text-2xl font-black text-white sm:text-3xl">
                Top performers
              </h2>
            </div>
            <div className="hidden items-center gap-2 text-xs font-bold text-butter/55 sm:flex">
              <Flame size={15} className="text-orange-400" /> The podium updates with every point
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
            {topThree.map((user, index) => {
              const position = (index + 1) as 1 | 2 | 3;
              const style = podiumStyles[position];
              const PlaceIcon = style.icon;
              const xp = user.xp || 0;

              return (
                <motion.div
                  key={user.id}
                  className={style.order}
                  initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : index * 0.08, duration: 0.4 }}
                  whileHover={reduceMotion ? undefined : { y: -6 }}
                >
                  <Link
                    to={`/profile/${user.id}`}
                    className={`glass-card group relative block overflow-hidden rounded-[2rem] border p-5 text-forest transition sm:p-6 ${style.card}`}
                  >
                    <div className="relative">
                      <div className="mb-5 flex items-center justify-between">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${style.badge}`}>
                          #{position} {style.label}
                        </span>
                        <PlaceIcon size={position === 1 ? 30 : 26} className={style.iconClass} />
                      </div>

                      <div className="flex flex-col items-center text-center">
                        <Avatar user={user} className={`h-20 w-20 border-4 text-xl sm:h-24 sm:w-24 ${style.avatar}`} />
                        <h3 className="mt-4 max-w-full truncate text-xl font-black">{getDisplayName(user)}</h3>
                        <p className="mt-1 text-xs font-bold text-forest/50">
                          @{user.username || 'learner'} {user.grade ? `· Grade ${user.grade}` : ''}
                        </p>
                        <div className="mt-5 flex items-end gap-1.5">
                          <Zap size={20} className="mb-1 fill-amber-400 text-amber-500" />
                          <span className="text-3xl font-black leading-none">{numberFormatter.format(xp)}</span>
                          <span className="mb-0.5 text-xs font-extrabold text-forest/50">XP</span>
                        </div>
                        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-forest/10">
                          <div
                            className="h-full rounded-full bg-forest transition-all duration-700"
                            style={{ width: `${xp % 100}%` }}
                          />
                        </div>
                        <div className="mt-2 flex w-full justify-between text-[11px] font-extrabold uppercase tracking-wider text-forest/45">
                          <span>Level {getLevel(xp)}</span>
                          <span>{100 - (xp % 100)} to next</span>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-center gap-1 text-xs font-black text-forest/55 transition group-hover:text-forest">
                        View profile <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      ) : (
        !error && (
          <section className="glass-card-dark rounded-[2rem] border border-dashed px-6 py-16 text-center">
            <Trophy className="mx-auto text-amber-300" size={52} />
            <h2 className="mt-4 text-2xl font-black text-white">No results yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-butter/60">
              Learners appear here as they complete quizzes.
            </p>
          </section>
        )
      )}

      {users.length > 0 && (
        <section className="glass-card overflow-hidden rounded-[2rem] text-forest">
          <div className="border-b border-forest/10 p-5 sm:p-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-forest/45">Full standings</p>
                <h2 className="mt-1 text-2xl font-black sm:text-3xl">Find your place</h2>
                <p className="mt-1 text-sm font-medium text-forest/55">
                  Showing {visibleUsers.length} of {users.length} learners
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadLeaderboard(true)}
                disabled={refreshing}
                className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-forest/15 bg-white/45 px-4 text-xs font-black transition hover:border-forest/30 hover:bg-white disabled:cursor-wait disabled:opacity-60 xl:self-auto"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing' : 'Refresh board'}
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <label className="relative block">
                <span className="sr-only">Search learners</span>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-forest/40" size={19} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or username"
                  className="h-12 w-full rounded-xl border border-forest/15 bg-white/65 pl-11 pr-10 text-sm font-semibold outline-none transition placeholder:text-forest/35 focus:border-forest focus:ring-4 focus:ring-forest/10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-forest/45 transition hover:bg-forest/10 hover:text-forest"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </label>

              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className="h-12 rounded-xl border border-forest/15 bg-white/65 px-4 text-sm font-bold outline-none transition focus:border-forest focus:ring-4 focus:ring-forest/10"
                aria-label="Filter by grade"
              >
                <option value="all">All grades</option>
                {grades.map((gradeOption) => (
                  <option key={gradeOption} value={gradeOption}>
                    Grade {gradeOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-forest/40">Sort by</span>
              {([
                ['xp', 'Top XP'],
                ['quizzes', 'Most quizzes'],
                ['name', 'Name'],
              ] as [SortMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                    sortMode === mode ? 'bg-forest text-butter shadow-sm' : 'bg-forest/5 text-forest/55 hover:bg-forest/10'
                  }`}
                >
                  {label}
                </button>
              ))}
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black text-forest/55 transition hover:bg-forest/10 hover:text-forest"
                >
                  <X size={13} /> Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 p-3 sm:p-5">
            {visibleUsers.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Search className="mx-auto text-forest/25" size={42} />
                <h3 className="mt-3 text-lg font-black">No learners found</h3>
                <p className="mt-1 text-sm font-medium text-forest/50">Try another name or grade.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-xl bg-forest px-4 py-2.5 text-xs font-black text-butter transition hover:bg-forest/90"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              visibleUsers.map((user, index) => {
                const xp = user.xp || 0;
                const rank = rankById.get(user.id) || index + 1;
                const isCurrentUser = currentUserId === (user.uid || user.id);

                return (
                  <motion.div
                    key={user.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.3) }}
                  >
                    <Link
                      to={`/profile/${user.id}`}
                      className={`group grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl border p-3 transition sm:grid-cols-[52px_minmax(0,1fr)_130px_120px_24px] sm:gap-4 sm:p-4 ${
                        isCurrentUser
                          ? 'border-forest/35 bg-white shadow-[0_8px_30px_rgba(0,54,49,0.1)]'
                          : 'border-transparent hover:border-forest/10 hover:bg-white/60'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black sm:h-11 sm:w-11 ${
                          rank <= 3 ? 'bg-amber-300 text-forest' : 'bg-forest/7 text-forest/55'
                        }`}
                      >
                        {rank <= 3 ? <Trophy size={17} /> : `#${rank}`}
                      </div>

                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar user={user} className="h-11 w-11 border-2 border-white shadow-sm sm:h-12 sm:w-12" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-black sm:text-base">{getDisplayName(user)}</h3>
                            {isCurrentUser && (
                              <span className="rounded-full bg-forest px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-butter">
                                You
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-bold text-forest/45">
                            <span>@{user.username || 'learner'}</span>
                            {user.grade && <span>Grade {user.grade}</span>}
                            <span className="hidden min-[430px]:inline">Level {getLevel(xp)}</span>
                          </div>
                          <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-forest/8">
                            <div
                              className="h-full rounded-full bg-amber-400 transition-all duration-500"
                              style={{ width: `${xp % 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="text-right sm:text-left">
                        <div className="flex items-center justify-end gap-1.5 sm:justify-start">
                          <Zap size={15} className="fill-amber-400 text-amber-500" />
                          <span className="text-base font-black sm:text-lg">{numberFormatter.format(xp)}</span>
                        </div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-forest/35">Brain Gains</p>
                      </div>

                      <div className="hidden sm:block">
                        <p className="text-sm font-black">{numberFormatter.format(user.totalQuizzesPlayed || 0)}</p>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-forest/35">Quizzes played</p>
                      </div>

                      <ChevronRight
                        size={18}
                        className="hidden text-forest/25 transition-transform group-hover:translate-x-1 group-hover:text-forest sm:block"
                      />
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
