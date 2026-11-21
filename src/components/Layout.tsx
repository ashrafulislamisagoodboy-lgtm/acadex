import { motion, useReducedMotion } from 'motion/react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { User, LogOut, BookOpen } from 'lucide-react';
import { auth, db, signOut, doc, onSnapshot, type LocalUser } from '../lib/local';
import { useState, useEffect, type CSSProperties } from 'react';
import { cn } from '../lib/utils';

import { sections } from './Common/sections';
import { WallpaperControl } from './Common/LiveWallpaper';

// Each navigation has its own shared lens: the hidden desktop/mobile copy
// must never become the origin of the visible animation.
function TabLens({ surface }: { surface: 'desktop' | 'mobile' }) {
  const still = useReducedMotion();
  if (still) return <span className="tab-lens" aria-hidden="true" />;
  return <motion.span aria-hidden="true" className="tab-lens" layoutId={`tab-lens-${surface}`}
    initial={false} transition={{ type: 'spring', stiffness: 520, damping: 35, mass: .65 }}
    style={{ borderRadius: 24 }} />;
}

interface LayoutProps {
  user: LocalUser | null;
}

export default function Layout({ user }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserData(data);
        setIsAdmin(data.role === 'admin');
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = sections.filter(item => item.path !== '/profile' && (item.path !== '/admin' || isAdmin));
  const sectionPath = '/' + (location.pathname.split('/')[1] || '');
  const section = sections.find(item => item.path === sectionPath) ?? sections[0];
  const isCurrent = (path: string) => path === section.path;
  const displayName = userData?.name || user?.displayName || 'Learner';

  return (
    <div className="app-shell min-h-dvh" style={{ '--section-tint': section.tint } as CSSProperties}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="brand-lockup" aria-label="Acadex home">
            <span className="brand-mark" aria-hidden="true"><BookOpen size={21} /></span>
            <span>
              <strong>Acadex</strong>
              <small>Campus handbook</small>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isCurrent(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={cn('desktop-nav__item', active && 'is-active')}
                >
                  {active && <TabLens surface="desktop" />}
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="header-actions">
            <WallpaperControl />
            <Link to={`/profile/${user?.uid}`} aria-current={isCurrent('/profile') ? 'page' : undefined} className="profile-chip" aria-label={`Open ${displayName}'s profile`}>
              <span className="profile-chip__avatar">
                {userData?.photoUrl ? (
                  <img src={userData.photoUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <User size={18} aria-hidden="true" />
                )}
              </span>
              <span className="profile-chip__copy">
                <strong>{displayName}</strong>
                <small>{isAdmin ? 'Administrator' : `Level ${Math.floor((userData?.xp || 0) / 100) + 1}`}</small>
              </span>
            </Link>
            <button type="button" onClick={handleLogout} className="icon-button header-logout" aria-label="Sign out">
              <LogOut size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
        <div key={location.pathname} className="route-stage">
          <div className="route-reveal" data-page={location.pathname}>
            <Outlet />
          </div>
        </div>
      </main>

      <nav className="mobile-dock" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrent(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={cn('mobile-dock__item', active && 'is-active')}
            >
              {active && <TabLens surface="mobile" />}
              <span className="mobile-dock__icon"><Icon size={20} aria-hidden="true" /></span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
