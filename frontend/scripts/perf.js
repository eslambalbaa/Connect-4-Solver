/**
 * @file perf.js
 * @description Performance optimization utilities, frame-rate profiling,
 * visibility-aware GPU power management, and adaptive lightweight rendering mode.
 */

class PerformanceManager {
  constructor() {
    this.isLite = false;
    this.models = [];
    this.confettiInstance = null;
  }

  /**
   * Initializes performance checks, checks query params / localStorage,
   * and registers the model instances for potential graphics scaling.
   *
   * @param {HTMLElement[]} models - Array of model-viewer elements.
   * @param {Object} confettiInstance - Confetti particle system instance.
   */
  init(models = [], confettiInstance = null) {
    this.models = models.filter(Boolean);
    this.confettiInstance = confettiInstance;

    const urlParams = new URLSearchParams(window.location.search);
    let storedMode = null;
    try {
      storedMode = localStorage.getItem('c4-perf');
    } catch (_) {}

    if (urlParams.has('full')) {
      try {
        localStorage.removeItem('c4-perf');
      } catch (_) {}
    } else if (urlParams.has('lite') || storedMode === 'lite') {
      this.enableLite();
    }
  }

  /**
   * Activates lite mode, turning off speed lines and disabling 3D shadow map
   * render passes to maintain 60 FPS on lower-tier hardware.
   */
  enableLite() {
    if (this.isLite) return;
    this.isLite = true;
    document.body.classList.add('lite');

    if (this.confettiInstance?.setLite) {
      this.confettiInstance.setLite(true);
    }

    for (const model of this.models) {
      model.shadowIntensity = 0;
    }

    try {
      localStorage.setItem('c4-perf', 'lite');
    } catch (_) {}
  }

  /**
   * Samples rendering frame intervals. If the median frame time exceeds
   * the 42 FPS threshold (~24ms), lite mode is automatically engaged.
   */
  probePerformance() {
    if (this.isLite || document.body.classList.contains('lite')) return;

    const frameDeltas = [];
    let previousTimestamp = 0;

    const sampleFrame = (currentTimestamp) => {
      if (document.hidden) {
        previousTimestamp = 0;
        requestAnimationFrame(sampleFrame);
        return;
      }

      if (previousTimestamp > 0) {
        const delta = currentTimestamp - previousTimestamp;
        // Ignore tab-switch spikes (> 200ms)
        if (delta > 0 && delta < 200) {
          frameDeltas.push(delta);
        }
      }
      previousTimestamp = currentTimestamp;

      if (frameDeltas.length < 100) {
        requestAnimationFrame(sampleFrame);
        return;
      }

      frameDeltas.sort((a, b) => a - b);
      const medianDelta = frameDeltas[frameDeltas.length >> 1];

      if (medianDelta > 24) {
        this.enableLite();
      }
    };

    requestAnimationFrame(sampleFrame);
  }
}

export const perf = new PerformanceManager();
