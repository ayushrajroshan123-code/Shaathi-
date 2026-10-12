/**
 * SAATHI — Community Coordination Platform
 * Interactive behaviors, particle field, scroll observers, and modal logic
 */

function resolveApiBaseUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    const url = import.meta.env.VITE_API_BASE_URL.trim();
    if (url) return url.replace(/\/+$/, '');
  }
  const isProd = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD;
  if (isProd) {
    console.error('[main.js] VITE_API_BASE_URL is missing in production environment');
    return '';
  }
  return 'http://localhost:3000';
}
const API_BASE_URL = resolveApiBaseUrl();
const PILOT_HUB_ID = '00000000-0000-0000-0000-000000000001';

document.addEventListener('DOMContentLoaded', () => {
  initParticleConstellation();
  initScrollAnimations();
  initMobileMenu();
  initModalInteractions();
});

/* ==========================================================================
   01. INTERACTIVE CONSTELLATION / PARTICLE FIELD (DARK SECTION)
   ========================================================================== */

function initParticleConstellation() {
  const canvas = document.getElementById('constellationCanvas');
  const section = document.getElementById('coordinate');
  if (!canvas || !section) return;

  const ctx = canvas.getContext('2d');
  let animationFrameId;
  let isSectionVisible = false;

  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = (canvas.width = section.clientWidth);
  let height = (canvas.height = section.clientHeight);

  const resizeHandler = () => {
    width = canvas.width = section.clientWidth;
    height = canvas.height = section.clientHeight;
  };
  window.addEventListener('resize', resizeHandler);

  // Mouse tracking
  const mouse = { x: null, y: null, radius: 120 };
  section.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  section.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // Create lightweight points of light
  const particleCount = Math.min(Math.floor((width * height) / 18000), 60);
  const particles = [];

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = (Math.random() - 0.5) * 0.35;
      this.radius = Math.random() * 1.5 + 1;
      this.baseAlpha = Math.random() * 0.4 + 0.3;
      this.alpha = this.baseAlpha;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      // Mouse gentle repulsion/influence
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          this.x -= (dx / dist) * force * 0.8;
          this.y -= (dy / dist) * force * 0.8;
          this.alpha = Math.min(1, this.baseAlpha + force * 0.5);
        } else {
          this.alpha = this.baseAlpha;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(94, 234, 212, ${this.alpha})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(94, 234, 212, 0.4)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  // Draw connections between proximate particles
  function drawLines() {
    const maxDist = 120;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const lineAlpha = (1 - dist / maxDist) * 0.18;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(94, 234, 212, ${lineAlpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      if (!isReducedMotion) {
        particles[i].update();
      }
      particles[i].draw();
    }
    drawLines();

    if (isSectionVisible && !isReducedMotion) {
      animationFrameId = requestAnimationFrame(loop);
    }
  }

  // Intersection Observer to freeze canvas off-screen for battery/CPU efficiency
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        isSectionVisible = entry.isIntersecting;
        if (isSectionVisible) {
          cancelAnimationFrame(animationFrameId);
          loop();
        } else {
          cancelAnimationFrame(animationFrameId);
        }
      });
    },
    { threshold: 0.1 }
  );
  observer.observe(section);

  if (isReducedMotion) {
    loop(); // Render single static frame
  }
}

/* ==========================================================================
   02. SCROLL ANIMATIONS & INTERSECTION OBSERVERS
   ========================================================================== */

function initScrollAnimations() {
  // Dark section "COORDINATE" entrance
  const darkWord = document.getElementById('coordinateWord');
  const darkSection = document.getElementById('coordinate');

  if (darkWord && darkSection) {
    const darkObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            darkWord.classList.add('in-view');
          }
        });
      },
      { threshold: 0.35 }
    );
    darkObserver.observe(darkSection);
  }

  // Statement line scroll-linked darkening
  const statementLine = document.getElementById('statementLine1');
  const statementSection = document.getElementById('statement');

  if (statementLine && statementSection) {
    const statementObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            statementLine.classList.add('active-dark');
          } else {
            statementLine.classList.remove('active-dark');
          }
        });
      },
      { threshold: 0.5 }
    );
    statementObserver.observe(statementSection);
  }

  // How it works step card activation
  const stepCards = document.querySelectorAll('.step-card');
  if (stepCards.length > 0) {
    const stepObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      },
      { threshold: 0.4 }
    );
    stepCards.forEach((card) => stepObserver.observe(card));
  }
}

/* ==========================================================================
   03. MOBILE MENU
   ========================================================================== */

function initMobileMenu() {
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileCloseBtn = document.getElementById('mobileCloseBtn');
  const mobileMenuBackdrop = document.getElementById('mobileMenuBackdrop');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  if (!menuToggleBtn || !mobileMenu) return;

  const openMenu = () => {
    mobileMenu.classList.add('open');
    menuToggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeMenu = () => {
    mobileMenu.classList.remove('open');
    menuToggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  menuToggleBtn.addEventListener('click', openMenu);
  if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', closeMenu);
  if (mobileMenuBackdrop) mobileMenuBackdrop.addEventListener('click', closeMenu);

  mobileNavLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
}

/* ==========================================================================
   04. COMMUNITY INTERACTION MODAL
   ========================================================================== */

function initModalInteractions() {
  const modal = document.getElementById('communityModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  // Trigger buttons
  const joinBtns = [
    document.getElementById('navJoinBtn'),
    document.getElementById('heroJoinBtn'),
    document.getElementById('mobileJoinBtn'),
    document.getElementById('ctaJoinBtn')
  ].filter(Boolean);

  const openModal = () => {
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const firstInput = modal.querySelector('input:not([type="hidden"])');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  joinBtns.forEach((btn) => btn.addEventListener('click', openModal));
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) {
      closeModal();
    }
  });

  // Tabs switching
  const tabResident = document.getElementById('tabResident');
  const tabLogin = document.getElementById('tabLogin');
  const signupForm = document.getElementById('signupForm');
  const loginForm = document.getElementById('loginForm');

  if (tabResident && tabLogin && signupForm && loginForm) {
    tabResident.addEventListener('click', () => {
      tabResident.classList.add('active');
      tabLogin.classList.remove('active');
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });

    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabResident.classList.remove('active');
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
    });
  }

  // Signup form submission
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('signupFeedback');
      const submitBtn = document.getElementById('signupSubmitBtn');
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;

      if (!name || !email || !password) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      feedback.textContent = '';
      feedback.className = 'form-feedback';

      try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hub_id: PILOT_HUB_ID,
            name,
            email,
            password
          })
        });

        const data = await response.json();

        if (response.ok && data.account_status === 'pending_approval') {
          feedback.textContent = 'Registration submitted! Your request is pending pilot coordinator approval.';
          feedback.className = 'form-feedback feedback-success';
          signupForm.reset();
        } else {
          feedback.textContent = data.message || data.error || 'Failed to submit registration.';
          feedback.className = 'form-feedback feedback-error';
        }
      } catch (err) {
        // Fallback message if API server is not running
        feedback.textContent = 'Registration noted for SAATHI Pilot Hub. (Local API offline)';
        feedback.className = 'form-feedback feedback-success';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
      }
    });
  }

  // Login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('loginFeedback');
      const submitBtn = document.getElementById('loginSubmitBtn');
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
      feedback.textContent = '';
      feedback.className = 'form-feedback';

      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.token) {
          feedback.textContent = `Signed in as ${data.role}. Session active.`;
          feedback.className = 'form-feedback feedback-success';
        } else {
          feedback.textContent = data.message || data.error || 'Invalid credentials or inactive account.';
          feedback.className = 'form-feedback feedback-error';
        }
      } catch (err) {
        feedback.textContent = 'Unable to connect to local authentication server.';
        feedback.className = 'form-feedback feedback-error';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }
}
