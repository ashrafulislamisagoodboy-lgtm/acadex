import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/" element={user ? <Layout user={user} /> : <Navigate to="/login" />}>
              <Route index element={<Home />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="quiz" element={<QuizGame />} />
              <Route path="profile/:uid" element={<Profile />} />
              <Route path="admin" element={<AdminPanel />} />
              <Route path="social" element={<Social />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
