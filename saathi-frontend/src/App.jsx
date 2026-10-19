import React, { useState, useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import EditorialStatement from './components/EditorialStatement';
import CommunityMoments from './components/CommunityMoments';
import LandingNeighborhood from './components/LandingNeighborhood';
import TwoModes from './components/TwoModes';
import HowItWorks from './components/HowItWorks';
import CinematicTransition from './components/CinematicTransition';
import Philosophy from './components/Philosophy';
import FinalCta from './components/FinalCta';
import Footer from './components/Footer';
import CommunityModal from './components/CommunityModal';
import NeighborhoodStage1 from './neighborhood/NeighborhoodStage1';
import Dashboard from './dashboard/Dashboard';
import LoginView from './dashboard/LoginView';
import { auth } from './api/auth';
import { apiClient } from './api/client';
import './dashboard/dashboard.css';
import './neighborhood/neighborhood.css';

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionState, setSessionState] = useState('checking_session'); // 'checking_session' | 'unauthenticated' | 'authenticated'
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');

  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryView = params.get('view');
      if (queryView === 'dashboard' || window.location.hash === '#dashboard' || window.location.hash.startsWith('#dashboard/')) {
        return 'dashboard';
      }
      if (queryView === 'login' || window.location.hash === '#login') {
        return 'login';
      }
      if (queryView === 'neighborhood' || window.location.hash === '#neighborhood') {
        return 'neighborhood';
      }
      if (queryView === 'landing' || window.location.hash === '#landing') {
        return 'landing';
      }
    }
    return 'landing'; // Default to landing page
  });

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  // Bootstrap session on startup & register 401 expiration listener
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const user = await auth.bootstrapSession();
        if (!isMounted) return;
        if (user) {
          setCurrentUser(user);
          setSessionState('authenticated');
        } else {
          setCurrentUser(null);
          setSessionState('unauthenticated');
        }
      } catch {
        if (!isMounted) return;
        setCurrentUser(null);
        setSessionState('unauthenticated');
      }
    }

    checkSession();

    // Listen for 401 session expiration from API calls
    const unsubscribe = apiClient.onSessionExpired(() => {
      if (!isMounted) return;
      setCurrentUser(null);
      setSessionState('unauthenticated');
      setSessionNotice('Your session has expired. Please sign in again.');
      setView('login');
      if (typeof window !== 'undefined') {
        window.location.hash = '#login';
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Synchronize route hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#dashboard' || hash.startsWith('#dashboard/')) {
        setView('dashboard');
      } else if (hash === '#login') {
        setView('login');
      } else if (hash === '#neighborhood') {
        setView('neighborhood');
      } else if (hash === '' || hash === '#landing') {
        setView('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Smooth scroll Lenis effect on landing page
  useEffect(() => {
    if (view !== 'landing') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
    });

    window.__lenis = lenis;

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    const handleAnchorClick = (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;
      const targetId = anchor.getAttribute('href');
      if (targetId && targetId !== '#' && targetId !== '#neighborhood') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          lenis.scrollTo(targetElement, {
            offset: -32,
            duration: 1.3,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('click', handleAnchorClick);
      lenis.destroy();
      window.__lenis = null;
    };
  }, [view]);

  // Auth actions
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setSessionState('authenticated');
    setSessionNotice('');
    setView('dashboard');
    if (typeof window !== 'undefined') {
      window.location.hash = '#dashboard';
    }
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
    } catch {
      // safe idempotent logout
    } finally {
      setCurrentUser(null);
      setSessionState('unauthenticated');
      setSessionNotice('');
      setView('login');
      if (typeof window !== 'undefined') {
        window.location.hash = '#login';
      }
    }
  };

  // Route view rendering
  if (view === 'dashboard') {
    if (sessionState === 'checking_session') {
      return (
        <div className="saathi-login-page">
          <div className="login-card-container" style={{ textAlign: 'center', padding: '64px 24px' }}>
            <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '14px' }}>
              Verifying secure neighborhood session...
            </p>
          </div>
        </div>
      );
    }

    if (sessionState === 'unauthenticated') {
      return (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          sessionNotice={sessionNotice}
        />
      );
    }

    return (
      <Dashboard
        currentUser={currentUser}
        onLogout={handleLogout}
        onNavigateLanding={() => {
          setView('landing');
          if (typeof window !== 'undefined') {
            window.location.hash = '#landing';
          }
        }}
      />
    );
  }

  if (view === 'login') {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        sessionNotice={sessionNotice}
      />
    );
  }

  if (view === 'neighborhood') {
    return (
      <NeighborhoodStage1
        onBack={() => {
          if (sessionState === 'authenticated') {
            setView('dashboard');
            if (typeof window !== 'undefined') {
              window.location.hash = '#dashboard';
            }
          } else {
            setView('landing');
            if (typeof window !== 'undefined') {
              window.location.hash = '#landing';
            }
          }
        }}
      />
    );
  }

  return (
    <>
      <Navbar onOpenModal={handleOpenModal} />

      <main>
        <Hero onOpenModal={handleOpenModal} />
        <EditorialStatement />
        <CommunityMoments />
        <LandingNeighborhood />
        <TwoModes />
        <HowItWorks />
        <CinematicTransition />
        <Philosophy />
        <FinalCta onOpenModal={handleOpenModal} />
      </main>

      <Footer />

      <CommunityModal isOpen={isModalOpen} onClose={handleCloseModal} />

      {/* Resident Dashboard Direct Entry Pill */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', gap: '8px' }}>
        <button
          type="button"
          className="saathi-3d-entry-pill"
          onClick={() => {
            if (sessionState === 'authenticated') {
              setView('dashboard');
              if (typeof window !== 'undefined') {
                window.location.hash = '#dashboard';
              }
            } else {
              setView('login');
              if (typeof window !== 'undefined') {
                window.location.hash = '#login';
              }
            }
          }}
          aria-label="Open Resident Dashboard"
        >
          <span>🏡</span>
          <span>Resident Dashboard</span>
          <span style={{ opacity: 0.6 }}>↗</span>
        </button>
      </div>
    </>
  );
}
