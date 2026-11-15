import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Flame,
  Medal,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { auth, db, doc, getDoc } from '../../lib/local';

const numberFormatter = new Intl.NumberFormat('en-US');

export default function Home() {
  const [userData, setUserData] = useState<any>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;
      const snapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (snapshot.exists()) setUserData(snapshot.data());
    };
    void fetchUserData();
  }, []);

  const xp = Number(userData?.xp || 0);
  const level = Math.floor(xp / 100) + 1;
  const levelProgress = xp % 100;
  const achievements = userData?.achievements?.length || 0;
  const displayName = userData?.name || auth.currentUser?.displayName || 'Learner';
  const firstName = displayName.trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const entrance = reduceMotion ? {} : { opacity: [0, 1], y: [14, 0] };

  return (
    <div className="page-shell home-page">
      <motion.section
        className="home-hero glass-card"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="home-hero__copy">
          <p className="context-line">{today}</p>
          <h1>Make one idea stick today, {firstName}.</h1>
          <p className="home-hero__intro">
            A short quiz keeps your momentum moving and brings the next level closer.
          </p>
          <div className="home-hero__actions">
            <Link to="/quiz" className="btn-primary btn-lg">
              <Sparkles size={19} aria-hidden="true" />
              Start a quiz
            </Link>
            <Link to="/leaderboard" className="btn-quiet">
              View the league
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="progress-orbit" aria-label={`Level ${level}, ${levelProgress}% complete`} role="img">
          <div className="progress-orbit__ring" style={{ '--progress': `${levelProgress * 3.6}deg` } as CSSProperties}>
            <div className="progress-orbit__core">
              <span>Level</span>
              <strong>{level}</strong>
              <small>{100 - levelProgress} XP to go</small>
            </div>
          </div>
          <div className="progress-orbit__note">
            <Flame size={18} aria-hidden="true" />
            <span>Keep the learning streak alive</span>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="learning-ribbon"
        aria-label="Learning summary"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? undefined : { opacity: 1 }}
        transition={{ delay: 0.12, duration: 0.4 }}
      >
        <div>
          <Trophy size={20} aria-hidden="true" />
          <span><strong>{numberFormatter.format(xp)}</strong> total XP</span>
        </div>
        <div>
          <Medal size={20} aria-hidden="true" />
          <span><strong>{achievements}</strong> achievements</span>
        </div>
        <div className="learning-ribbon__track">
          <span>Level progress</span>
          <div role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelProgress}>
            <i style={{ width: `${levelProgress}%` }} />
          </div>
          <strong>{levelProgress}%</strong>
        </div>
      </motion.section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <h2>Choose your next move</h2>
            <p>Everything you need for today, in one place.</p>
          </div>
        </div>

        <div className="action-grid">
          <motion.div animate={entrance} transition={{ delay: 0.08 }}>
            <Link to="/quiz" className="action-card action-card--feature glass-card">
              <div className="action-card__icon"><BookOpen size={25} aria-hidden="true" /></div>
              <span className="action-card__index">01</span>
              <div className="action-card__copy">
                <h3>Practice room</h3>
                <p>Pick a book and turn recall into points.</p>
              </div>
              <span className="action-card__link">Open quiz <ChevronRight size={18} aria-hidden="true" /></span>
            </Link>
          </motion.div>

          <motion.div animate={entrance} transition={{ delay: 0.14 }}>
            <Link to="/leaderboard" className="action-card action-card--dark glass-card-dark">
              <div className="action-card__icon"><Trophy size={24} aria-hidden="true" /></div>
              <div className="action-card__copy">
                <h3>Learning league</h3>
                <p>See who is climbing and find your place.</p>
              </div>
              <span className="action-card__link">View ranks <ChevronRight size={18} aria-hidden="true" /></span>
            </Link>
          </motion.div>

          <motion.div animate={entrance} transition={{ delay: 0.2 }}>
            <Link to="/social" className="action-card action-card--mint">
              <div className="action-card__icon"><CalendarDays size={24} aria-hidden="true" /></div>
              <div className="action-card__copy">
                <h3>School calendar</h3>
                <p>Plan around events, deadlines, and study days.</p>
              </div>
              <span className="action-card__link">Open calendar <ChevronRight size={18} aria-hidden="true" /></span>
            </Link>
          </motion.div>

          {userData?.role === 'admin' && (
            <motion.div animate={entrance} transition={{ delay: 0.26 }}>
              <Link to="/admin" className="action-card action-card--admin glass-card-dark">
                <div className="action-card__icon"><Settings size={24} aria-hidden="true" /></div>
                <div className="action-card__copy">
                  <h3>Admin studio</h3>
                  <p>Manage learners, questions, books, and platform records.</p>
                </div>
                <span className="action-card__link">Manage Acadex <ChevronRight size={18} aria-hidden="true" /></span>
              </Link>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
