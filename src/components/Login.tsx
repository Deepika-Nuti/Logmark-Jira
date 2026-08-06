import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Lock, User, FolderKanban, Loader2 } from 'lucide-react';
import { DEFAULT_MEMBERS } from '../config/members';

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

  // Auto-focus first input on mount or toggle
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // Clear inputs and errors on toggle
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
            addToast('Confirmation Email Sent', 'info');
          } else {
            addToast('Registration Successful! Logging in...', 'success');
            await login(emailOrUser.trim(), password, rememberSession);
          }
        } else {
          setErrorMsg(res.error || 'Registration failed.');
          setShake(true);
          addToast(res.error || 'Registration Failed', 'error');
          setTimeout(() => setShake(false), 500);
        }
      } else {
        const success = await login(emailOrUser.trim(), password, rememberSession);
        if (success) {
          addToast('Login Successful', 'success');
        } else {
          setErrorMsg(
            isCloud 
              ? 'Invalid email or password.' 
              : 'Invalid username or password.'
          );
          setShake(true);
          addToast('Authentication Failed', 'error');
          setTimeout(() => setShake(false), 500);
        }
      }
    } catch (err) {
      setErrorMsg('An error occurred during authentication.');
      setShake(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-viewport">
      <div className={`login-card ${shake ? 'shake-animation' : ''}`}>
        
        {/* Company Logo Header */}
        <div className="login-header-section">
          <FolderKanban className="login-logo-icon" />
          <h1 className="login-logo-title">Logmark <span>Jira Studio</span></h1>
          <p className="login-logo-subtitle">
            {isSignUpMode 
              ? 'Create your developer account to access workspace sync' 
              : 'Collaborate, track issues, and manage code efforts'}
          </p>
        </div>

        {errorMsg && (
          <div className="login-error-alert" style={{ 
            backgroundColor: errorMsg.includes('successful') || errorMsg.includes('validation') ? 'var(--status-done-pill)' : 'var(--priority-critical-bg)',
            borderColor: errorMsg.includes('successful') || errorMsg.includes('validation') ? 'var(--status-done-border)' : 'var(--priority-critical-text)',
            color: errorMsg.includes('successful') || errorMsg.includes('validation') ? 'var(--status-done-text)' : 'var(--priority-critical-text)',
          }}>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          
          <div className="login-form-group">
            <label htmlFor="login-email">{isCloud ? 'Email Address' : 'Username or Email'}</label>
            <div className="login-input-wrapper">
              <User size={16} className="login-input-icon" />
              <input
                id="login-email"
                ref={inputRef}
                type={isCloud ? 'email' : 'text'}
                className="login-input-field"
                placeholder={isCloud ? 'email@example.com' : 'Enter username or email'}
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label htmlFor="login-password">Password</label>
            <div className="login-input-wrapper">
              <Lock size={16} className="login-input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input-field"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="login-visibility-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isSignUpMode && (
            <div className="login-form-group">
              <label htmlFor="login-confirm-password">Confirm Password</label>
              <div className="login-input-wrapper">
                <Lock size={16} className="login-input-icon" />
                <input
                  id="login-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input-field"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
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
                <span>Remember Session</span>
              </label>
              <button
                type="button"
                className="login-forgot-btn"
                onClick={() => addToast('Resetting passwords is disabled in demo mode.', 'warning')}
                disabled={loading}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button type="submit" className="btn btn-primary login-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="spinner-icon" /> Processing...
              </>
            ) : isSignUpMode ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {isCloud ? (
          <div style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
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
        ) : (
          <div className="login-credentials-box">
            <h5>Demo Sandbox Accounts:</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.5rem', fontSize: '0.75rem', marginTop: '0.35rem' }}>
              {DEFAULT_MEMBERS.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <code style={{ fontSize: '0.7rem' }}>{m.name.toLowerCase()}</code>
                  <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>({m.name.toLowerCase()}123)</span>
                </div>
              ))}
            </div>
            <span className="disclaimer-text" style={{ marginTop: '0.5rem', display: 'block' }}>Demo Sandbox. Create .env keys to connect Supabase.</span>
          </div>
        )}

      </div>
    </div>
  );
};
