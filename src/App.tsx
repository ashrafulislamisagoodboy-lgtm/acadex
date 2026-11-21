import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from './lib/local';
import { auth } from './lib/local';
import Layout from './components/Layout';
import ErrorBoundary from './components/Common/ErrorBoundary';

const Login = lazy(() => import('./components/Auth/Login'));
const Home = lazy(() => import('./components/Dashboard/Home'));
const Leaderboard = lazy(() => import('./components/Dashboard/Leaderboard'));
const QuizGame = lazy(() => import('./components/Quiz/QuizGame'));
const Profile = lazy(() => import('./components/Profile/Profile'));
const AdminPanel = lazy(() => import('./components/Admin/AdminPanel'));
const Social = lazy(() => import('./components/Social/Social'));

function RequestLogin() {
  const { pathname, search, hash } = useLocation();
  return <Navigate replace to="/login" state={{ returnTo: { pathname, search, hash } }} />;
}

function AfterLogin() {
  const { state } = useLocation();
  const target = state?.returnTo;
  return <Navigate replace to={target && /^\/(?:$|quiz$|leaderboard$|social$|admin$|profile\/[^/]+$)/.test(target.pathname) ? target : '/'} />;
}

function AppLoader() {
  return (
    <div className="app-loader" role="status" aria-live="polite">
      <div className="brand-mark" aria-hidden="true">A</div>
      <div className="loader-line"><span /></div>
      <span className="sr-only">Loading Acadex</span>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <AppLoader />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<AppLoader />}>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <AfterLogin />} />
            <Route path="/" element={user ? <Layout user={user} /> : <RequestLogin />}>
              <Route index element={<Home />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="quiz" element={<QuizGame />} />
              <Route path="profile/:uid" element={<Profile />} />
              <Route path="admin" element={<AdminPanel />} />
              <Route path="social" element={<Social />} />
            </Route>
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
