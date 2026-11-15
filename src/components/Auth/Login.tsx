import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  LogIn,
  RefreshCw,
  Shield,
  Trophy,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { api, login } from '../../lib/local';
import { cn } from '../../lib/utils';

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
      if (!status.needsSetup) setMethod('admin');
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
      <motion.section
        className="auth-story"
        initial={reduceMotion ? false : { opacity: 0, x: -18 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="brand-lockup brand-lockup--auth">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span><strong>Acadex</strong><small>Learning league</small></span>
        </div>
        <div className="auth-story__message">
          <p className="context-line context-line--light">Learn. Recall. Rise.</p>
          <h1>Turn schoolwork into visible progress.</h1>
          <p>Practice at your pace, collect XP, and see how every answer moves you forward.</p>
        </div>
        <div className="auth-story__proof" aria-label="Acadex features">
          <div><BookOpen size={20} aria-hidden="true" /><span>Focused practice by book and chapter</span></div>
          <div><Trophy size={20} aria-hidden="true" /><span>A fair, live learning league</span></div>
        </div>
      </motion.section>

      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span><strong>Acadex</strong><small>Learning league</small></span>
        </div>
        <motion.div
          className="auth-card glass-card"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="auth-card__icon" aria-hidden="true">
            {needsSetup ? <Shield size={26} /> : <GraduationCap size={28} />}
          </div>
          <div className="auth-card__heading">
            <h2>{needsSetup ? 'Create the first administrator' : 'Welcome back'}</h2>
            <p>{needsSetup ? 'Set up the account that will manage your school.' : 'Choose your account type, then enter your details.'}</p>
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
                <LogIn size={18} aria-hidden="true" />
                {loading ? 'Signing in…' : needsSetup ? 'Create administrator' : 'Sign in'}
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
        </motion.div>
        <p className="auth-footnote">Your school data stays inside Acadex.</p>
      </section>
    </main>
  );
}
