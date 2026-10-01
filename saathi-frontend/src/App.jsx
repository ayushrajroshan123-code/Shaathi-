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
import './dashboard/dashboard.css';

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryView = params.get('view');
      if (queryView === 'dashboard' || window.location.hash === '#dashboard') {
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
    return 'dashboard'; // Default to resident dashboard per prompt
  });

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#dashboard') {
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
  }, [view]);

  useEffect(() => {
    // Only initialize smooth scroll on landing page
    if (view !== 'landing') return;

    // Respect user's accessibility setting
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      return;
    }

    // Initialize single global Lenis smooth scroll instance
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

    // Smooth anchor navigation handler
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

  if (view === 'dashboard') {
    return (
      <Dashboard
        onLogout={() => {
          setView('login');
          window.location.hash = '#login';
        }}
      />
    );
  }

  if (view === 'login') {
    return (
      <LoginView
        onLoginSuccess={() => {
          setView('dashboard');
          window.location.hash = '#dashboard';
        }}
      />
    );
  }

  if (view === 'neighborhood') {
    return (
      <NeighborhoodStage1
        onBack={() => {
          setView('dashboard');
          window.location.hash = '#dashboard';
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
            setView('dashboard');
            window.location.hash = '#dashboard';
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

