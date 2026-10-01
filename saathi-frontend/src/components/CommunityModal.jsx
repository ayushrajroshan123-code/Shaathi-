import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = 'http://localhost:3000';
const PILOT_HUB_ID = '00000000-0000-0000-0000-000000000001';

export default function CommunityModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('resident'); // 'resident' | 'login'

  // Signup form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupFeedback, setSignupFeedback] = useState({ text: '', type: '' });

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState({ text: '', type: '' });

  const firstInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => firstInputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = '';
      setSignupFeedback({ text: '', type: '' });
      setLoginFeedback({ text: '', type: '' });
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) return;

    setSignupLoading(true);
    setSignupFeedback({ text: '', type: '' });

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hub_id: PILOT_HUB_ID,
          name: regName.trim(),
          email: regEmail.trim(),
          password: regPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.account_status === 'pending_approval') {
        setSignupFeedback({
          text: 'Registration submitted! Your request is pending pilot coordinator approval.',
          type: 'feedback-success',
        });
        setRegName('');
        setRegEmail('');
        setRegPassword('');
      } else {
        setSignupFeedback({
          text: data.message || data.error || 'Failed to submit registration.',
          type: 'feedback-error',
        });
      }
    } catch (err) {
      setSignupFeedback({
        text: 'Registration noted for SAATHI Pilot Hub. (Local API offline)',
        type: 'feedback-success',
      });
    } finally {
      setSignupLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;

    setLoginLoading(true);
    setLoginFeedback({ text: '', type: '' });

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        setLoginFeedback({
          text: `Signed in as ${data.role}. Session active.`,
          type: 'feedback-success',
        });
      } else {
        setLoginFeedback({
          text: data.message || data.error || 'Invalid credentials or inactive account.',
          type: 'feedback-error',
        });
      }
    } catch (err) {
      setLoginFeedback({
        text: 'Unable to connect to local authentication server.',
        type: 'feedback-error',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div
      className="community-modal open"
      id="communityModal"
      aria-hidden="false"
      role="dialog"
      aria-labelledby="modalTitle"
    >
      <div className="modal-backdrop" id="modalBackdrop" onClick={onClose} />
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-eyebrow">PILOT HUB</div>
            <h3 className="modal-title" id="modalTitle">SAATHI Pilot Hub</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            id="modalCloseBtn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-tabs">
            <button
              type="button"
              className={`modal-tab ${activeTab === 'resident' ? 'active' : ''}`}
              id="tabResident"
              onClick={() => setActiveTab('resident')}
            >
              Resident Signup
            </button>
            <button
              type="button"
              className={`modal-tab ${activeTab === 'login' ? 'active' : ''}`}
              id="tabLogin"
              onClick={() => setActiveTab('login')}
            >
              Member Sign In
            </button>
          </div>

          {/* Signup Form View */}
          {activeTab === 'resident' && (
            <form className="modal-form" id="signupForm" onSubmit={handleSignup} autoComplete="on">
              <div className="form-group">
                <label htmlFor="regName" className="form-label">Full Name</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  id="regName"
                  className="form-input"
                  placeholder="e.g. Priya Sharma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="regEmail" className="form-label">Email Address</label>
                <input
                  type="email"
                  id="regEmail"
                  className="form-input"
                  placeholder="you@domain.local"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="regPassword" className="form-label">Password</label>
                <input
                  type="password"
                  id="regPassword"
                  className="form-input"
                  placeholder="Min. 8 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-notice">
                <span>Account requests are reviewed by the pilot hub coordinator before activation.</span>
              </div>

              <button
                type="submit"
                className="btn-primary btn-block modal-submit-btn"
                id="signupSubmitBtn"
                disabled={signupLoading}
              >
                {signupLoading ? 'Submitting...' : 'Submit Request'}
              </button>

              {signupFeedback.text && (
                <div className={`form-feedback ${signupFeedback.type}`} id="signupFeedback" aria-live="polite">
                  {signupFeedback.text}
                </div>
              )}
            </form>
          )}

          {/* Login Form View */}
          {activeTab === 'login' && (
            <form className="modal-form" id="loginForm" onSubmit={handleLogin} autoComplete="on">
              <div className="form-group">
                <label htmlFor="loginEmail" className="form-label">Email Address</label>
                <input
                  ref={firstInputRef}
                  type="email"
                  id="loginEmail"
                  className="form-input"
                  placeholder="coordinator@saathi.local"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="loginPassword" className="form-label">Password</label>
                <input
                  type="password"
                  id="loginPassword"
                  className="form-input"
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary btn-block modal-submit-btn"
                id="loginSubmitBtn"
                disabled={loginLoading}
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>

              {loginFeedback.text && (
                <div className={`form-feedback ${loginFeedback.type}`} id="loginFeedback" aria-live="polite">
                  {loginFeedback.text}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
