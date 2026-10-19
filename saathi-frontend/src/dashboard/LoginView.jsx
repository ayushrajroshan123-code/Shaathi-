import React, { useState } from 'react';
import { PILOT_HUB_INFO } from './dashboardData';
import { auth } from '../api/auth';
import { isDemoMode, DEMO_PERSONAS, DEFAULT_DEMO_PASSWORD } from '../utils/demoConfig';

/**
 * LoginView
 * Clean, restrained entry point into the SAATHI neighborhood network.
 * Server-authoritative authentication via POST /auth/login.
 * 
 * Strict invariants:
 * - Real token validation.
 * - Current user bootstrapped from backend.
 * - No fake authentication or mock bypass.
 * - Demo conveniences disabled by default (opt-in via VITE_DEMO_MODE=true).
 */
export default function LoginView({ onLoginSuccess, sessionNotice }) {
  const demoActive = isDemoMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setErrorMessage('');

    try {
      const { user } = await auth.login(email.trim(), password);
      onLoginSuccess(user);
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (persona) => {
    if (!demoActive) return;
    setSelectedPreset(persona.id);
    setErrorMessage('');
    setEmail(persona.email);
    setPassword(DEFAULT_DEMO_PASSWORD);
  };

  return (
    <div className="saathi-login-page">
      <div className="login-backdrop-glow" aria-hidden="true" />

      <main className="login-card-container">
        {/* Brand & Pilot Hub Heading */}
        <div className="login-header">
          <div className="login-brand-mark">
            <span className="logo-circle circle-left" />
            <span className="logo-circle circle-right" />
          </div>
          <span className="login-eyebrow">NEIGHBORHOOD COORDINATION OS</span>
          <h1 className="login-title">SAATHI</h1>
          <p className="login-hub-tag">
            <strong>{PILOT_HUB_INFO.name}</strong> · {PILOT_HUB_INFO.subName}
          </p>
        </div>

        {/* Informational notices */}
        {sessionNotice && (
          <div
            className="login-alert-banner notice"
            role="status"
            style={{
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              color: '#facc15',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            {sessionNotice}
          </div>
        )}

        {errorMessage && (
          <div
            className="login-alert-banner error"
            role="alert"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Demo Personas Prefill (Active ONLY when VITE_DEMO_MODE=true) */}
        {demoActive && (
          <div className="login-residents-preset-box" data-testid="demo-preset-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="preset-label" style={{ color: '#f59e0b', fontWeight: 600 }}>DEMO PERSONAS (FICTIONAL)</span>
              <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '2px 8px', borderRadius: '4px' }}>
                Demo Mode Active
              </span>
            </div>
            <div className="preset-grid">
              {DEMO_PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-btn ${selectedPreset === p.id ? 'active' : ''}`}
                  onClick={() => handlePresetSelect(p)}
                  title={`Select ${p.name} (${p.lotDisplay})`}
                >
                  <span className="preset-avatar">{p.avatar}</span>
                  <div className="preset-info">
                    <span className="preset-name">{p.name}</span>
                    <span className="preset-lot">{p.lotDisplay}</span>
                  </div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 0 0', textAlign: 'center', lineHeight: 1.4 }}>
              Fictional portfolio personas. Real server authentication required.
            </p>
          </div>
        )}

        <div className="login-divider-row">
          <span className="divider-line" />
          <span className="divider-text">
            {demoActive ? 'DEMO AUTHENTICATION' : 'AUTHENTICATE WITH CREDENTIALS'}
          </span>
          <span className="divider-line" />
        </div>

        {/* Standard Server-Authoritative Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="loginEmail">Pilot Hub Verified Email</label>
            <input
              id="loginEmail"
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMessage('');
              }}
              required
              disabled={loading}
              placeholder="e.g. alice.x@example.com"
            />
          </div>

          <div className="login-field">
            <label htmlFor="loginPassword">Keyholder Passcode</label>
            <input
              id="loginPassword"
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage('');
              }}
              required
              disabled={loading}
              placeholder="••••••••••••"
            />
          </div>

          <button type="submit" className="btn-primary login-submit-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Enter Neighborhood Home →'}
          </button>
        </form>

        <footer className="login-footer-note">
          <span className="lock-icon" aria-hidden="true">🔒</span>
          <span>Access restricted to verified pilot hub residents of Oakridge Circle.</span>
        </footer>
      </main>
    </div>
  );
}
