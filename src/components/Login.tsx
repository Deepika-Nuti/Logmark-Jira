import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Lock, Mail, FolderKanban, Loader2, Zap, Users, Shield } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, signUp, isCloud } = useAuth();
  const { addToast } = useToast();

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    setEmailOrUser('');
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
  }, [isSignUpMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUser.trim() || !password) return;

    setLoading(true);
    setErrorMsg(null);
    setShake(false);

    try {
      if (isSignUpMode) {
        if (password !== confirmPassword) {
          setErrorMsg('Passwords do not match.');
          setShake(true);
          addToast('Passwords do not match', 'error');
          setTimeout(() => setShake(false), 500);
          setLoading(false);
          return;
        }

        const res = await signUp(emailOrUser.trim(), password);
        if (res.success) {
          if (res.error) {
            setErrorMsg(res.error);
            addToast('Confirmation email sent', 'info');
          } else {
            addToast('Account created! Signing in...', 'success');
            await login(emailOrUser.trim(), password, rememberSession);
          }
        } else {
          setErrorMsg(res.error || 'Registration failed.');
          setShake(true);
          addToast(res.error || 'Registration failed', 'error');
          setTimeout(() => setShake(false), 500);
        }
      } else {
        const success = await login(emailOrUser.trim(), password, rememberSession);
        if (success) {
          addToast('Welcome back!', 'success');
        } else {
          setErrorMsg(
            isCloud
              ? 'Invalid email or password.'
              : 'Invalid username or password.'
          );
          setShake(true);
          addToast('Authentication failed', 'error');
          setTimeout(() => setShake(false), 500);
        }
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      setShake(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-viewport">

      {/* Left Brand Panel */}
      <div className="login-panel-brand">
        <div className="login-brand-logo">
          <FolderKanban className="login-brand-logo-icon" />
          <span className="login-brand-name">
            Logmark <span>Jira Studio</span>
          </span>
        </div>

        <div className="login-brand-tagline">
          <h2>Collaborate.<br />Track. Deliver.</h2>
          <p>
            Your team's internal workspace for managing work items, tracking
            progress, and staying aligned — all in one place.
          </p>
        </div>

        <div className="login-brand-features">
          <div className="login-brand-feature">
            <div className="login-brand-feature-dot" />
            <span>Kanban boards with real-time drag & drop</span>
          </div>
          <div className="login-brand-feature">
            <div className="login-brand-feature-dot" />
            <span>Team workload & allocation overview</span>
          </div>
          <div className="login-brand-feature">
            <div className="login-brand-feature-dot" />
            <span>File attachments, comments & activity logs</span>
          </div>
          <div className="login-brand-feature">
            <div className="login-brand-feature-dot" />
            <span>Light & dark theme with persistent preferences</span>
          </div>
        </div>

        {/* Bottom badges */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {[
            { icon: <Zap size={12} />, label: 'Supabase Powered' },
            { icon: <Users size={12} />, label: '6 Team Members' },
            { icon: <Shield size={12} />, label: 'Secure Auth' },
          ].map(b => (
            <div key={b.label} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.65rem',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '20px',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              {b.icon} {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-panel-form">
        <div className={`login-card ${shake ? 'shake-animation' : ''}`}>

          {/* Header */}
          <div className="login-header-section">
            <h1 className="login-logo-title">
              {isSignUpMode ? 'Create Account' : 'Sign In'}
            </h1>
            <p className="login-logo-subtitle">
              {isSignUpMode
                ? 'Set up your Logmark workspace account'
                : 'Enter your credentials to access the workspace'}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="login-error-alert">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">

            <div className="login-form-group">
              <label htmlFor="login-email">
                {isCloud ? 'Email Address' : 'Username or Email'}
              </label>
              <div className="login-input-wrapper">
                <Mail size={15} className="login-input-icon" />
                <input
                  id="login-email"
                  ref={inputRef}
                  type={isCloud ? 'email' : 'text'}
                  className="login-input-field"
                  placeholder={isCloud ? 'you@logmark-ai.com' : 'Enter username or email'}
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="login-form-group">
              <label htmlFor="login-password">Password</label>
              <div className="login-input-wrapper">
                <Lock size={15} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input-field"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="login-visibility-btn"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {isSignUpMode && (
              <div className="login-form-group">
                <label htmlFor="login-confirm">Confirm Password</label>
                <div className="login-input-wrapper">
                  <Lock size={15} className="login-input-icon" />
                  <input
                    id="login-confirm"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input-field"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {!isSignUpMode && (
              <div className="login-extra-row">
                <label className="login-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(e) => setRememberSession(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Stay signed in</span>
                </label>
                <button
                  type="button"
                  className="login-forgot-btn"
                  onClick={() => addToast('Use your Supabase dashboard to reset passwords.', 'info')}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-submit-btn"
              disabled={loading}
              id="login-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="spinner-icon" />
                  {isSignUpMode ? 'Creating account...' : 'Signing in...'}
                </>
              ) : (
                isSignUpMode ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {/* Toggle sign-in / sign-up (cloud mode only) */}
          {isCloud && (
            <div className="login-switch-text">
              {isSignUpMode ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="login-forgot-btn"
                    onClick={() => setIsSignUpMode(false)}
                    disabled={loading}
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="login-forgot-btn"
                    onClick={() => setIsSignUpMode(true)}
                    disabled={loading}
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          )}

          {/* Local sandbox credentials */}
          {!isCloud && (
            <div className="login-credentials-box">
              <h5>Demo Accounts</h5>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.25rem 0.75rem',
                marginTop: '0.4rem',
                fontSize: '0.72rem',
              }}>
                {[
                  { name: 'Venky', label: 'Product Manager' },
                  { name: 'Togy', label: 'Product Manager' },
                  { name: 'Mohan', label: 'Product Manager' },
                  { name: 'Deepika', label: 'Intern' },
                  { name: 'Manasa', label: 'Intern' },
                  { name: 'Oliver', label: 'Intern' },
                ].map(m => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <code>{m.name.toLowerCase()}</code>
                    <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>({m.name.toLowerCase()}123)</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Demo sandbox. Add Supabase keys in <code>.env</code> for full cloud mode.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
