import React, { useState } from 'react';
import { PILOT_HUB_INFO, CURRENT_USER, RESIDENTIAL_LOTS } from './dashboardData';

/**
 * LoginView
 * Clean, restrained entry point into the SAATHI neighborhood network.
 * Immediately routes the resident directly to Neighborhood Home.
 */
export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('kavita.sharma@oakridge.pilot');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedPreset, setSelectedPreset] = useState(CURRENT_USER.id);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 400);
  };

  const handlePresetSelect = (lot) => {
    setSelectedPreset(lot.id);
    setEmail(`${lot.residentName.toLowerCase().replace(/[^a-z]/g, '.')}@oakridge.pilot`);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 300);
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

        {/* Quick Resident Authentication */}
        <div className="login-residents-preset-box">
          <span className="preset-label">SELECT RESIDENT PROFILE TO ENTER</span>
          <div className="preset-grid">
            {RESIDENTIAL_LOTS.slice(0, 3).map((lot) => (
              <button
                key={lot.id}
                type="button"
                className={`preset-btn ${selectedPreset === lot.id ? 'active' : ''}`}
                onClick={() => handlePresetSelect(lot)}
                title={`Enter as ${lot.residentName} (${lot.name})`}
              >
                <span className="preset-avatar">{lot.avatar}</span>
                <div className="preset-info">
                  <span className="preset-name">{lot.residentName}</span>
                  <span className="preset-lot">{lot.name.split('·')[0].trim()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="login-divider-row">
          <span className="divider-line" />
          <span className="divider-text">OR ENTER WITH CREDENTIALS</span>
          <span className="divider-line" />
        </div>

        {/* Standard Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="loginEmail">Pilot Hub Verified Email</label>
            <input
              id="loginEmail"
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="loginPassword">Keyholder Passcode</label>
            <input
              id="loginPassword"
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
