import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { EASING } from '../motion/variants';

export default function CoordinateSection() {
  const canvasRef = useRef(null);
  const sectionRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // Scroll-linked camera entrance
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'center center'],
  });

  const wordOpacity = useTransform(scrollYProgress, [0.15, 0.75], [0.12, 1]);
  const wordY = useTransform(scrollYProgress, [0.15, 0.75], [36, 0]);
  const wordScale = useTransform(scrollYProgress, [0.15, 0.75], [0.96, 1]);
  const wordTracking = useTransform(scrollYProgress, [0.15, 0.75], ['0.09em', '0.04em']);

  const copyOpacity = useTransform(scrollYProgress, [0.4, 0.85], [0, 1]);
  const copyY = useTransform(scrollYProgress, [0.4, 0.85], [20, 0]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let isSectionVisible = false;

    let width = (canvas.width = section.clientWidth);
    let height = (canvas.height = section.clientHeight);

    const resizeHandler = () => {
      if (!canvas || !section) return;
      width = canvas.width = section.clientWidth;
      height = canvas.height = section.clientHeight;
    };
    window.addEventListener('resize', resizeHandler);

    // Mouse tracking for subtle ambient constellation interaction
    const mouse = { x: null, y: null, radius: 120 };
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    section.addEventListener('mousemove', onMouseMove);
    section.addEventListener('mouseleave', onMouseLeave);

    // Ambient node particles
    const particleCount = Math.min(Math.floor((width * height) / 20000), 50);
    const particles = [];

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = Math.random() * 1.4 + 0.8;
        this.baseAlpha = Math.random() * 0.35 + 0.25;
        this.alpha = this.baseAlpha;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            this.x -= (dx / dist) * force * 0.7;
            this.y -= (dy / dist) * force * 0.7;
            this.alpha = Math.min(0.9, this.baseAlpha + force * 0.4);
          } else {
            this.alpha = this.baseAlpha;
          }
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(94, 234, 212, ${this.alpha})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(94, 234, 212, 0.35)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    function drawLines() {
      const maxDist = 110;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * 0.16;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(94, 234, 212, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }
    }

    function loop() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        if (!shouldReduceMotion) {
          particles[i].update();
        }
        particles[i].draw();
      }
      drawLines();

      if (isSectionVisible && !shouldReduceMotion) {
        animationFrameId = requestAnimationFrame(loop);
      }
    }

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

    if (shouldReduceMotion) {
      loop();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', resizeHandler);
      section.removeEventListener('mousemove', onMouseMove);
      section.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [shouldReduceMotion]);

  return (
    <section className="cinematic-dark-section" id="coordinate" ref={sectionRef}>
      {/* Interactive Particle and Constellation Field */}
      <canvas ref={canvasRef} className="constellation-canvas" aria-hidden="true" />
      <div className="dark-vertical-light-beam" aria-hidden="true" />

      <div className="dark-section-inner">
        <div className="dark-word-container">
          <motion.h2
            className="dark-word"
            id="coordinateWord"
            style={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: wordOpacity,
                    y: wordY,
                    scale: wordScale,
                    letterSpacing: wordTracking,
                  }
            }
          >
            COORDINATE
          </motion.h2>
        </div>

        <motion.div
          className="dark-supporting-copy"
          style={
            shouldReduceMotion
              ? undefined
              : {
                  opacity: copyOpacity,
                  y: copyY,
                }
          }
        >
          <p>SAATHI helps communities act together — before, during, and after the moments that matter.</p>
        </motion.div>
      </div>
    </section>
  );
}
