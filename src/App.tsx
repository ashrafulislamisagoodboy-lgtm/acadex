import React, { createContext, useContext, lazy, Suspense, useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { auth, onAuthStateChanged } from './lib/local';
import { type LocalUser } from './lib/local';
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

const Session = createContext<LocalUser | null>(null);
function Workspace() {
  const user = useContext(Session);
  return user ? <Layout user={user} /> : <Navigate to="/login" replace />;
}
function Entry() {
  return useContext(Session) ? <Navigate to="/" replace /> : <Login />;
}
// Data-router links let the browser capture the outgoing view without keeping
// a second, interactive copy of a quiz, form or profile mounted.
const router = createBrowserRouter([
  { path: '/login', element: <Entry /> },
  { path: '/', element: <Workspace />, children: [
    { index: true, element: <Home /> },
    { path: 'leaderboard', element: <Leaderboard /> },
    { path: 'quiz', element: <QuizGame /> },
    { path: 'profile/:uid', element: <Profile /> },
    { path: 'admin', element: <AdminPanel /> },
    { path: 'social', element: <Social /> },
  ] },
]);

export default function App() {
  const [user, setUser] = useState<LocalUser | null>(null);
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
      <Session.Provider value={user}>
        <Suspense fallback={<AppLoader />}><RouterProvider router={router} /></Suspense>
      </Session.Provider>
    </ErrorBoundary>
  );
}
