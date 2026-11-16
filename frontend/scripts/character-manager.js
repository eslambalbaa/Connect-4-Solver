/**
 * @file character-manager.js
 * @description Manages 3D character models (<model-viewer>), loading progress,
 * animation states, timeScale modulation, and victory/defeat/draw sequences.
 */

import { MODEL_ANIMATIONS, PLAYERS, REACTION_TIMING } from './constants.js?v=46';

export class CharacterManager {
  /**
   * @param {Object} options
   * @param {Record<number, HTMLElement>} options.models
   * @param {Record<number, HTMLElement>} options.panels
   * @param {Function} [options.onAllLoaded]
   */
  constructor({ models, panels, onAllLoaded = null }) {
    this.models = models;
    this.panels = panels;
    this.onAllLoaded = onAllLoaded;

    this.isReady = { 1: false, 2: false };
    this.sequenceTokens = { 1: 0, 2: 0 };
    this.timers = { 1: [], 2: [] };

    this.setupListeners();
  }

  /**
   * Clears all pending animation timers for a specific player (or both).
   * @param {number} [playerId]
   */
  clearTimers(playerId = null) {
    const ids = playerId ? [playerId] : [1, 2];
    for (const id of ids) {
      if (this.timers[id]?.length) {
        for (const t of this.timers[id]) {
          window.clearTimeout(t);
        }
        this.timers[id] = [];
      }
    }
  }

  /**
   * Registers a managed timeout for a player.
   * @param {number} playerId
   * @param {Function} fn
   * @param {number} delayMs
   */
  schedule(playerId, fn, delayMs) {
    const timerId = window.setTimeout(fn, delayMs);
    this.timers[playerId].push(timerId);
    return timerId;
  }

  /**
   * Attaches loading progress and readiness event listeners to both 3D models.
   * @private
   */
  setupListeners() {
    for (const id of [1, 2]) {
      const model = this.models[id];
      const panel = this.panels[id];
      if (!model || !panel) continue;

      model.addEventListener('progress', (event) => {
        const progress = Math.max(0.06, event.detail?.totalProgress || 0);
        panel.style.setProperty('--p', progress.toFixed(3));
      });

      model.addEventListener(
        'load',
        () => {
          this.isReady[id] = true;
          panel.classList.add('ready');
          this.setIdle(id);

          if (this.isReady[1] && this.isReady[2] && typeof this.onAllLoaded === 'function') {
            this.onAllLoaded();
          }
        },
        { once: true }
      );

      model.addEventListener(
        'error',
        (err) => {
          console.warn(`[CharacterManager] Model for ${PLAYERS[id].name} encountered an error:`, err);
          panel.classList.add('ready');
        },
        { once: true }
      );
    }
  }

  /**
   * Applies an animation clip to a <model-viewer> element, awaiting Lit's updateComplete
   * before configuring timeScale and play repetitions so they are never overwritten.
   *
   * @param {number} playerId
   * @param {number} token
   * @param {{name: string, fade?: number, timeScale?: number, repetitions?: number, pauseAfter?: number}} clip
   * @private
   */
  async applyClip(playerId, token, clip) {
    const model = this.models[playerId];
    if (!model || this.sequenceTokens[playerId] !== token) return;

    const availableAnimations = model.availableAnimations || [];
    if (availableAnimations.length && !availableAnimations.includes(clip.name)) {
      console.warn(`[CharacterManager] Clip not found on ${PLAYERS[playerId].name}: ${clip.name}`);
      return;
    }

    const crossfade = clip.fade ?? 300;
    const repetitions = clip.repetitions ?? Infinity;
    const timeScale = clip.timeScale ?? 1.0;

    model.animationCrossfadeDuration = crossfade;
    model.animationName = clip.name;

    if (model.updateComplete) {
      try {
        await model.updateComplete;
      } catch (_) {}
    }

    if (this.sequenceTokens[playerId] !== token) return;

    model.timeScale = timeScale;
    model.play({ repetitions });

    if (clip.pauseAfter != null) {
      this.schedule(playerId, () => {
        if (this.sequenceTokens[playerId] === token) {
          model.pause();
        }
      }, clip.pauseAfter);
    }
  }

  /**
   * Resets character animation to idle looping state.
   * Cancels any running animation sequences.
   * @param {number} playerId - 1 or 2
   */
  setIdle(playerId) {
    this.clearTimers(playerId);
    const token = ++this.sequenceTokens[playerId];
    const model = this.models[playerId];
    const idleConfig = MODEL_ANIMATIONS.idle[playerId];
    const clip = typeof idleConfig === 'string' ? { name: idleConfig, fade: 350, timeScale: 1.0 } : idleConfig;

    if (!model || !clip) return;

    if (!this.isReady[playerId]) {
      model.setAttribute('animation-name', clip.name);
      return;
    }

    this.applyClip(playerId, token, {
      name: clip.name,
      fade: clip.fade ?? 350,
      timeScale: clip.timeScale ?? 1.0,
      repetitions: Infinity
    });
  }

  /**
   * Executes a multi-stage animation sequence with controlled timings, crossfades, and timeScale.
   * @param {number} playerId
   * @param {Array<{name: string, ms?: number, fade?: number, timeScale?: number, repetitions?: number, pauseAfter?: number}>} steps
   */
  runSequence(playerId, steps) {
    const model = this.models[playerId];
    if (!model || !steps?.length) return;

    this.clearTimers(playerId);
    const currentToken = ++this.sequenceTokens[playerId];
    let stepIndex = 0;

    const advanceStep = () => {
      if (this.sequenceTokens[playerId] !== currentToken || stepIndex >= steps.length) {
        return;
      }

      const step = steps[stepIndex++];
      const isFinalStep = stepIndex === steps.length;

      this.applyClip(playerId, currentToken, step);

      if (isFinalStep) return;

      this.schedule(playerId, advanceStep, step.ms || 600);
    };

    advanceStep();
  }

  /**
   * Choreographs character reactions for win/loss conditions with staggered impact timing.
   * @param {number} winnerId - 1 or 2
   * @param {Function} [onWinnerStart] - Optional callback triggered when winner celebration begins
   */
  handleGameEnd(winnerId, onWinnerStart = null) {
    if (!winnerId) return;
    const loserId = winnerId === 1 ? 2 : 1;

    this.clearTimers();

    // Winner bursts into celebration first
    this.schedule(winnerId, () => {
      this.panels[winnerId]?.classList.add('winner');
      this.runSequence(winnerId, MODEL_ANIMATIONS.win[winnerId]);
      if (typeof onWinnerStart === 'function') {
        onWinnerStart(this.panels[winnerId]);
      }
    }, REACTION_TIMING.WINNER_DELAY_MS);

    // Loser reacts in defeat a split-second after the winner's triumphant strike
    this.schedule(loserId, () => {
      this.panels[loserId]?.classList.add('loser');
      this.runSequence(loserId, MODEL_ANIMATIONS.lose[loserId]);
    }, REACTION_TIMING.LOSER_DELAY_MS);
  }

  /**
   * Choreographs character reactions when the match ends in a draw.
   */
  handleDraw() {
    this.clearTimers();
    for (const id of [1, 2]) {
      const drawSteps = MODEL_ANIMATIONS.draw?.[id];
      if (drawSteps) {
        this.runSequence(id, drawSteps);
      }
    }
  }

  /**
   * Resets visual panel states (winner/loser classes) and restores idle animations.
   */
  resetStates() {
    this.clearTimers();
    for (const id of [1, 2]) {
      this.panels[id]?.classList.remove('winner', 'loser');
      this.setIdle(id);
    }
  }

  /**
   * Updates panel active highlight based on current turn and game over state.
   * @param {number} activePlayer - 1 or 2
   * @param {boolean} isGameOver
   */
  updateActivePanel(activePlayer, isGameOver) {
    this.panels[1]?.classList.toggle('active', isGameOver || activePlayer === 1);
    this.panels[2]?.classList.toggle('active', isGameOver || activePlayer === 2);
  }
}
