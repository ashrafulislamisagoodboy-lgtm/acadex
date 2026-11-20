import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  RefreshCw,
  Shield,
  ArrowUpRight,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { api, login } from '../../lib/local';
import { cn } from '../../lib/utils';

import FieldAtlas from '../Common/FieldAtlas';

export default function Login() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [method, setMethod] = useState<'student' | 'admin'>('student');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', name: '', studentId: '', phone: '' });
  const errorRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const checkStatus = async () => {
    setChecking(true);
    setError('');
    try {
      const status = await api('/status');
      setNeedsSetup(Boolean(status.needsSetup));
    } catch (statusError) {
      setNeedsSetup(null);
      setError((statusError as Error).message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { void checkStatus(); }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const update = (key: keyof typeof form, value: string) =>
    setForm(previous => ({ ...previous, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (needsSetup && form.password !== form.confirmPassword) {
        throw new Error('The two passwords do not match.');
      }
      const setupInput = { username: form.username.trim(), password: form.password, name: form.name.trim() };
      const studentInput = { method, studentId: form.studentId.trim(), phone: form.phone.trim() };
      const adminInput = { method, username: form.username.trim(), password: form.password };
      await login(needsSetup ? setupInput : method === 'student' ? studentInput : adminInput, needsSetup === true);
    } catch (submitError) {
      const message = (submitError as Error).message;
      setError(message);
      if (message.includes('already been set up')) {
        setNeedsSetup(false);
        setMethod('admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordField = (label: string, key: 'password' | 'confirmPassword', autoComplete: string) => {
    const id = key === 'password' ? 'login-password' : 'confirm-password';
    return (
      <div className="form-field">
        <label htmlFor={id}>{label}</label>
        <span className="password-control">
          <input
            id={id}
            type={showPassword ? 'text' : 'password'}
            className="input-field"
            value={form[key]}
            onChange={event => update(key, event.target.value)}
            required
            minLength={needsSetup ? 8 : undefined}
            maxLength={200}
            autoComplete={autoComplete}
            aria-describedby={needsSetup && key === 'password' ? 'password-hint' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(value => !value)}
            className="password-toggle"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
        </span>
      </div>
    );
  };

  return (
    <main className="auth-page">
      <header className="portal-masthead">
        <span className="portal-brand"><BookOpen size={24} aria-hidden="true" /> Acadex</span>
        <span className="portal-label">School learning league</span>
      </header>
      <div className="portal-spread">
        <aside className="portal-cover" aria-label="Acadex field notes">
          <span className="portal-label">Field notes &nbsp; / &nbsp; Vol. 01</span>
          <div className="portal-cover-title">The Study<br /><em>Edition.</em></div>
          <div className="cover-atlas"><FieldAtlas /></div>
          <p>Chapter quizzes, school events, and your place in the league.</p>
        </aside>
        <motion.section
          className="auth-card"
          aria-labelledby="portal-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="portal-label portal-card-label"><span className="portal-dot" /> Campus access</div>
          <div className="auth-card__heading">
            <h1 id="portal-heading">{needsSetup ? 'Open your school.' : 'Welcome back.'}</h1>
            <p>{needsSetup ? 'Create the first administrator account to get your school started.' : 'Sign in to your Acadex account.'}</p>
          </div>

          {needsSetup === false && (
            <div className="account-switcher" aria-label="Account type">
              {(['student', 'admin'] as const).map(value => (
                <button
                  type="button"
                  key={value}
                  onClick={() => { setMethod(value); setError(''); }}
                  aria-pressed={method === value}
                  className={cn(method === value && 'is-active')}
                >
                  {value === 'student' ? <GraduationCap size={17} aria-hidden="true" /> : <Shield size={16} aria-hidden="true" />}
                  {value === 'student' ? 'Student' : 'Administrator'}
                </button>
              ))}
            </div>
          )}

          {needsSetup !== null && (
            <form onSubmit={handleSubmit} className="auth-form">
              {needsSetup && (
                <div className="form-field">
                  <label htmlFor="setup-name">Your name</label>
                  <input id="setup-name" className="input-field" value={form.name} onChange={event => update('name', event.target.value)} required maxLength={50} autoComplete="name" autoFocus />
                </div>
              )}

              {needsSetup || method === 'admin' ? (
                <>
                  <div className="form-field">
                    <label htmlFor="login-username">Username</label>
                    <input id="login-username" className="input-field" value={form.username} onChange={event => update('username', event.target.value)} required minLength={3} maxLength={50} autoComplete="username" autoCapitalize="none" autoFocus={!needsSetup} aria-describedby={needsSetup ? 'username-hint' : undefined} />
                  </div>
                  {needsSetup && <p id="username-hint" className="field-hint">Use 3–50 characters. Email addresses and spaces are accepted.</p>}
                  {passwordField('Password', 'password', needsSetup ? 'new-password' : 'current-password')}
                  {needsSetup && passwordField('Confirm password', 'confirmPassword', 'new-password')}
                  {needsSetup && <p id="password-hint" className="field-hint">Use at least 8 characters and store these details safely. This account controls school setup.</p>}
                </>
              ) : (
                <>
                  <div className="form-field">
                    <label htmlFor="student-id">Student ID</label>
                    <input id="student-id" className="input-field" value={form.studentId} onChange={event => update('studentId', event.target.value)} required autoComplete="username" autoCapitalize="none" autoFocus />
                  </div>
                  <div className="form-field">
                    <label htmlFor="student-phone">Phone number</label>
                    <input id="student-phone" type={showPassword ? 'text' : 'password'} inputMode="tel" className="input-field" value={form.phone} onChange={event => update('phone', event.target.value)} required autoComplete="current-password" />
                  </div>
                  <p className="field-hint">Use the student ID and phone number provided by your administrator.</p>
                </>
              )}

              {error && (
                <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="form-error">
                  <AlertCircle size={18} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              <button className="btn-primary btn-lg w-full" disabled={loading}>
                {loading ? (needsSetup ? 'Creating account…' : 'Signing in…') : needsSetup ? 'Create administrator' : 'Sign in'}
                <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </form>
          )}

          {needsSetup === null && (
            <div className="auth-status">
              {checking && !error && <><span className="status-spinner" aria-hidden="true" /><p>Connecting securely…</p></>}
              {!checking && (
                <button type="button" onClick={() => void checkStatus()} className="btn-primary">
                  <RefreshCw size={17} aria-hidden="true" /> Try again
                </button>
              )}
              {error && (
                <div ref={errorRef} tabIndex={-1} role="alert" className="form-error">
                  <AlertCircle size={18} aria-hidden="true" /><span>{error}</span>
                </div>
              )}
            </div>
          )}
        </motion.section>
      </div>
      <footer className="portal-footer"><span>ACADEX</span><span>Student &amp; staff portal</span></footer>
    </main>
  );
}
