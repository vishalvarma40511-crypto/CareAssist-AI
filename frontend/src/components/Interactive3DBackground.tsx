import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const Interactive3DBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates and state
    const mouse = {
      x: null as number | null,
      y: null as number | null,
      radius: 180, // Influence radius
      active: false
    };

    // Particles array
    interface Particle {
      x: number;
      y: number;
      z: number; // 3D depth layer
      vx: number;
      vy: number;
      radius: number;
      baseColor: string;
    }

    const particles: Particle[] = [];
    const particleCount = Math.min(100, Math.floor((width * height) / 15000)); // Responsive density

    // Spark trail array
    interface Spark {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
      radius: number;
    }
    const sparks: Spark[] = [];

    // Helper for random values
    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    // Create primary particles
    const initParticles = () => {
      particles.length = 0;
      const isDark = document.documentElement.classList.contains('dark') || theme === 'dark';
      const color = isDark ? 'rgba(99, 102, 241,' : 'rgba(79, 70, 229,'; // brand-500 alpha base

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: random(0, width),
          y: random(0, height),
          z: random(0.5, 1.5), // 3D depth layer
          vx: random(-0.5, 0.5),
          vy: random(-0.5, 0.5),
          radius: random(1.5, 4),
          baseColor: color
        });
      }
    };

    initParticles();

    // Resize listener
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    // Mouse events
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;

      // Spawn cursor sparks dynamically during movement
      if (Math.random() < 0.35) {
        const isDark = document.documentElement.classList.contains('dark') || theme === 'dark';
        const color = isDark 
          ? `hsla(${random(180, 240)}, 85%, 65%, `
          : `hsla(${random(220, 260)}, 80%, 50%, `;
        
        sparks.push({
          x: e.clientX,
          y: e.clientY,
          vx: random(-1.2, 1.2),
          vy: random(-1.2, 1.2),
          alpha: 1.0,
          color,
          radius: random(1, 3)
        });
      }
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
      mouse.active = false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Render loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains('dark') || theme === 'dark';

      // 1. Draw Spotlight glow under cursor
      if (mouse.active && mouse.x !== null && mouse.y !== null) {
        const grad = ctx.createRadialGradient(
          mouse.x, mouse.y, 10,
          mouse.x, mouse.y, mouse.radius * 1.5
        );
        grad.addColorStop(0, isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Draw Sparks (Cursor Trail)
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= 0.025; // Fade out rate

        if (s.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color + s.alpha + ')';
        ctx.shadowBlur = 8;
        ctx.shadowColor = s.color + '1)';
        ctx.fill();
        ctx.restore();
      }

      // 3. Draw Particle Connection Grid (3D mesh connection)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Drift movement scaled by Z depth
        p.x += p.vx * p.z;
        p.y += p.vy * p.z;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Mouse attraction / distortion
        if (mouse.active && mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouse.radius) {
            // Pull factor increases when closer, scaled by Z depth
            const force = (mouse.radius - dist) / mouse.radius;
            p.x += (dx / dist) * force * 1.5 * p.z;
            p.y += (dy / dist) * force * 1.5 * p.z;
          }
        }

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.z, 0, Math.PI * 2);
        ctx.fillStyle = p.baseColor + (0.12 + (p.z - 0.5) * 0.2).toFixed(2) + ')';
        ctx.fill();

        // Connect nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const maxDist = 120;
          if (dist < maxDist) {
            const alpha = ((maxDist - dist) / maxDist) * 0.12 * (p.z * p2.z / 2);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isDark 
              ? `rgba(99, 102, 241, ${alpha})`
              : `rgba(79, 70, 229, ${alpha})`;
            ctx.lineWidth = 0.6 * (p.z + p2.z) / 2;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[-1] transition-opacity duration-500"
      style={{ opacity: 0.85 }}
    />
  );
};

export default Interactive3DBackground;
