import React, { useState } from 'react';

export default function Navbar({ onOpenModal }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleMobile = () => setIsMobileOpen((prev) => !prev);
  const closeMobile = () => setIsMobileOpen(false);

  return (
    <>
      <header className="navbar-wrapper">
        <nav className="navbar-pill" aria-label="Main Navigation">
          <a href="#hero" className="nav-brand" aria-label="SAATHI Home">
            <span className="logo-mark" aria-hidden="true">
              <span className="logo-circle circle-left" />
              <span className="logo-circle circle-right" />
            </span>
            <span className="brand-text">SAATHI</span>
          </a>

          <div className="nav-links">
            <a href="#how-it-works" className="nav-link">HOW IT WORKS</a>
            <a href="#moments" className="nav-link">COMMUNITY</a>
            <a href="#modes" className="nav-link">MODES</a>
            <a href="#trust" className="nav-link">TRUST</a>
          </div>

          <div className="nav-actions">
            <button
              type="button"
              className="btn-primary nav-cta"
              id="navJoinBtn"
              onClick={onOpenModal}
            >
              JOIN YOUR COMMUNITY
            </button>
            <button
              type="button"
              className="menu-toggle-btn"
              id="menuToggleBtn"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileOpen}
              onClick={toggleMobile}
            >
              <span className="menu-pill-text">MENU</span>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      <div className={`mobile-menu ${isMobileOpen ? 'open' : ''}`} aria-hidden={!isMobileOpen}>
        <div className="mobile-menu-backdrop" onClick={closeMobile} />
        <div className="mobile-menu-content">
          <div className="mobile-menu-header">
            <span className="brand-text">SAATHI</span>
            <button type="button" className="mobile-close-btn" onClick={closeMobile} aria-label="Close menu">
              &times;
            </button>
          </div>
          <div className="mobile-menu-links">
            <a href="#how-it-works" className="mobile-nav-link" onClick={closeMobile}>HOW IT WORKS</a>
            <a href="#moments" className="mobile-nav-link" onClick={closeMobile}>COMMUNITY</a>
            <a href="#modes" className="mobile-nav-link" onClick={closeMobile}>TWO MODES</a>
            <a href="#trust" className="mobile-nav-link" onClick={closeMobile}>BUILT AROUND TRUST</a>
            <a href="#philosophy" className="mobile-nav-link" onClick={closeMobile}>PHILOSOPHY</a>
          </div>
          <div className="mobile-menu-footer">
            <button
              type="button"
              className="btn-primary btn-block"
              onClick={() => {
                closeMobile();
                onOpenModal();
              }}
            >
              JOIN YOUR COMMUNITY
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
