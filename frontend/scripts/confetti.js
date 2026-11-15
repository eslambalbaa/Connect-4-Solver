/**
 * @file confetti.js
 * @description High-performance HTML5 Canvas confetti particle engine
 * used to celebrate player victories.
 */

const CONFETTI_COLORS = Object.freeze([
  '#ffc61a', '#e8262b', '#1b5fe0', '#f59a23', '#ffffff', '#49c13a', '#ff5fa2'
]);

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export class ConfettiEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.particles = [];
    this.animationFrameId = 0;
    this.lastTimestamp = 0;
    this.emitUntil = 0;
    this.carryOver = 0;
    this.emissionArea = null;
    this.secondaryBurstTimer = 0;
    this.isLite = false;

    this.handleResize = this.resize.bind(this);
    window.addEventListener('resize', this.handleResize, { passive: true });
    this.resize();
  }

  /**
   * Adjusts canvas backing store resolution to device pixel ratio (capped at 1.5).
   */
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  /**
   * Sets particle density for lite mode.
   * @param {boolean} value
   */
  setLite(value) {
    this.isLite = Boolean(value);
  }

  /**
   * Spawns a single confetti particle.
   */
  spawnParticle(x, y, vx, vy) {
    const maxParticles = this.isLite ? 120 : 240;
    if (this.particles.length >= maxParticles) return;

    this.particles.push({
      x,
      y,
      vx,
      vy,
      w: randomRange(6, 11),
      h: randomRange(4, 7),
      rot: randomRange(0, Math.PI * 2),
      vr: randomRange(-8, 8),
      flip: randomRange(0, Math.PI * 2),
      vf: randomRange(5, 11),
      color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
    });
  }

  /**
   * Triggers an explosive burst of confetti from the target area.
   * @param {number} count
   */
  burst(count) {
    if (!this.emissionArea) return;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + randomRange(-0.95, 0.95);
      const speed = randomRange(420, 950);
      this.spawnParticle(
        this.emissionArea.centerX + randomRange(-30, 30),
        this.emissionArea.bottomY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
  }

  /**
   * Animation frame loop: simulates particle physics and draws transforms.
   */
  step(currentTimestamp) {
    const dt = Math.min(0.033, (currentTimestamp - this.lastTimestamp) / 1000 || 0.016);
    this.lastTimestamp = currentTimestamp;

    // Continue gentle confetti shower over winner's panel during active emission window
    if (currentTimestamp < this.emitUntil && this.emissionArea) {
      this.carryOver += dt * (this.isLite ? 22 : 50);
      while (this.carryOver >= 1) {
        this.carryOver--;
        this.spawnParticle(
          randomRange(this.emissionArea.left, this.emissionArea.right),
          -12,
          randomRange(-60, 60),
          randomRange(40, 160)
        );
      }
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const drag = 1 - Math.min(1, 2.2 * dt);
    let aliveCount = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.vy += 900 * dt;
      p.vx *= drag;
      p.vy *= drag;

      p.x += (p.vx + Math.sin(p.flip) * 30) * dt;
      p.y += p.vy * dt;

      p.rot += p.vr * dt;
      p.flip += p.vf * dt;

      // Filter out particles that left the bottom of the viewport
      if (p.y > this.height + 20) continue;

      this.particles[aliveCount++] = p;

      const cosRot = Math.cos(p.rot);
      const sinRot = Math.sin(p.rot);
      const cosFlip = Math.cos(p.flip);

      ctx.setTransform(
        this.dpr * cosRot,
        this.dpr * sinRot,
        -this.dpr * sinRot * cosFlip,
        this.dpr * cosRot * cosFlip,
        this.dpr * p.x,
        this.dpr * p.y
      );

      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }

    this.particles.length = aliveCount;

    if (this.particles.length > 0 || currentTimestamp < this.emitUntil) {
      this.animationFrameId = requestAnimationFrame((t) => this.step(t));
    } else {
      this.animationFrameId = 0;
    }
  }

  /**
   * Starts a celebration over the specified character panel element.
   * @param {HTMLElement} panelElement
   */
  start(panelElement) {
    if (this.prefersReducedMotion.matches) return;
    this.stop();
    this.resize();

    const sprite = panelElement.querySelector('.sprite-container') || panelElement;
    const rect = sprite.getBoundingClientRect();

    this.emissionArea = {
      centerX: rect.left + rect.width / 2,
      bottomY: rect.top + rect.height * 0.6,
      left: Math.max(0, rect.left - rect.width * 0.1),
      right: Math.min(this.width, rect.right + rect.width * 0.1)
    };

    this.burst(this.isLite ? 45 : 100);

    this.secondaryBurstTimer = window.setTimeout(() => {
      this.burst(this.isLite ? 20 : 50);
      if (!this.animationFrameId) {
        this.lastTimestamp = performance.now();
        this.animationFrameId = requestAnimationFrame((t) => this.step(t));
      }
    }, 900);

    this.lastTimestamp = performance.now();
    this.emitUntil = this.lastTimestamp + 3800;
    this.animationFrameId = requestAnimationFrame((t) => this.step(t));
  }

  /**
   * Halts all active confetti animation and clears the canvas.
   */
  stop() {
    window.clearTimeout(this.secondaryBurstTimer);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    this.particles = [];
    this.emitUntil = 0;
    this.carryOver = 0;

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
