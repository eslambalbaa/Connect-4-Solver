/**
 * @file character-manager.js
 * @description Manages 3D character models (<model-viewer>), dynamic character loading,
 * framing, theme synchronization, animation states, and victory/defeat/draw sequences.
 */

import { REACTION_TIMING } from './constants.js?v=49';
import {
  DEFAULT_MATCHUP,
  getCameraOrbitForSlot,
  getCharacter,
  getEffectiveTheme,
  getSlotCssVars,
  getViewportStylesForSlot
} from './characters.js?v=54';

export class CharacterManager {
  /**
   * @param {Object} options
   * @param {Record<number, HTMLElement>} options.models
   * @param {Record<number, HTMLElement>} options.panels
   * @param {Record<number, HTMLElement>} [options.nameEls]
   * @param {Record<number, HTMLElement>} [options.scoreEls]
   * @param {{ subtitle?: HTMLElement, name1?: HTMLElement, name2?: HTMLElement }} [options.matchupEls]
   * @param {Record<number, string>} [options.initialMatchup]
   * @param {Function} [options.onAllLoaded]
   */
  constructor({
    models,
    panels,
    nameEls = {},
    scoreEls = {},
    matchupEls = {},
    initialMatchup = DEFAULT_MATCHUP,
    onAllLoaded = null
  }) {
    this.models = models;
    this.panels = panels;
    this.nameEls = nameEls;
    this.scoreEls = scoreEls;
    this.matchupEls = matchupEls;
    this.onAllLoaded = onAllLoaded;

    this.selectedIds = {
      1: getCharacter(initialMatchup?.[1] ?? DEFAULT_MATCHUP[1]).id,
      2: getCharacter(initialMatchup?.[2] ?? DEFAULT_MATCHUP[2]).id
    };
    this.loadedSrc = { 1: null, 2: null };
    this.hasFiredInitialLoad = false;

    this.isReady = { 1: false, 2: false };
    this.sequenceTokens = { 1: 0, 2: 0 };
    this.timers = { 1: [], 2: [] };

    this.setupListeners();
    this.syncMatchupPresentation();
    this.applyFraming(1, this.getCharacter(1));
    this.applyFraming(2, this.getCharacter(2));
  }

  /**
   * Returns the selected character ID for the given player slot.
   * @param {number} slotId - 1 or 2
   * @returns {string}
   */
  getCharacterId(slotId) {
    return this.selectedIds[slotId];
  }

  /**
   * Returns the normalized character config assigned to the given player slot.
   * @param {number} slotId - 1 or 2
   * @returns {Object}
   */
  getCharacter(slotId) {
    return getCharacter(this.selectedIds[slotId]);
  }

  /**
   * Returns true when both slots have the same character selected.
   * @returns {boolean}
   */
  isMirrorMatch() {
    return this.selectedIds[1] === this.selectedIds[2];
  }

  /**
   * Returns the active theme for a slot (accounting for mirror-match differentiation).
   * @param {number} slotId - 1 or 2
   * @returns {Object}
   */
  getEffectiveTheme(slotId) {
    return getEffectiveTheme(this.getCharacter(slotId), slotId, this.isMirrorMatch());
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
   * Marks a slot's <model-viewer> as loaded, applies framing while hidden, and starts idle.
   * @param {number} id
   * @private
   */
  handleModelLoaded(id) {
    const model = this.models[id];
    const panel = this.panels[id];
    if (!model || !panel) return;

    const character = this.getCharacter(id);
    if (model.getAttribute('src') !== character.modelSrc) return;

    this.isReady[id] = true;
    this.loadedSrc[id] = character.modelSrc;

    this.applyFraming(id, character);
    if (typeof model.jumpCameraToGoal === 'function') {
      model.jumpCameraToGoal();
    }

    this.setIdle(id);

    window.requestAnimationFrame(() => {
      if (this.isReady[id] && model.getAttribute('src') === character.modelSrc) {
        panel.classList.add('ready');
      }
    });

    if (!this.hasFiredInitialLoad && this.isReady[1] && this.isReady[2]) {
      this.hasFiredInitialLoad = true;
      if (typeof this.onAllLoaded === 'function') {
        this.onAllLoaded();
      }
    }
  }

  /**
   * Attaches persistent loading progress and readiness listeners to both 3D models.
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

      model.addEventListener('load', () => {
        this.handleModelLoaded(id);
      });

      model.addEventListener('error', (err) => {
        const charName = this.getCharacter(id).name;
        console.warn(`[CharacterManager] Model for ${charName} (Slot ${id}) encountered an error:`, err);
        panel.classList.add('ready');
      });

      if (model.loaded) {
        this.handleModelLoaded(id);
      }
    }
  }

  /**
   * Applies <model-viewer> camera/scale attributes and CSS viewport positioning for a character.
   * @param {number} slotId
   * @param {Object} character
   */
  applyFraming(slotId, character) {
    const model = this.models[slotId];
    if (!model || !character) return;

    model.setAttribute('scale', character.model.scale);
    model.setAttribute('camera-target', character.model.cameraTarget);
    model.setAttribute('camera-orbit', getCameraOrbitForSlot(character, slotId));
    model.setAttribute('alt', `${character.name} 3D Character Model`);

    const vp = getViewportStylesForSlot(character, slotId);
    model.style.setProperty('--model-bottom', vp.bottom);
    model.style.setProperty('--model-width', vp.width);
    model.style.setProperty('--model-height', vp.height);
    model.style.setProperty('--model-translate-x', vp.translateX);
  }

  /**
   * Applies a character's framing and model source to a slot without jumping the outgoing model.
   * @param {number} slotId
   * @param {Object} character
   * @private
   */
  applySlotCharacter(slotId, character) {
    const model = this.models[slotId];
    const panel = this.panels[slotId];
    if (!model) return;

    const currentSrc = model.getAttribute('src');
    if (this.loadedSrc[slotId] === character.modelSrc && currentSrc === character.modelSrc && this.isReady[slotId]) {
      this.applyFraming(slotId, character);
      panel?.classList.add('ready');
      if (typeof model.jumpCameraToGoal === 'function') {
        model.jumpCameraToGoal();
      }
      this.setIdle(slotId);
      return;
    }

    this.clearTimers(slotId);
    ++this.sequenceTokens[slotId];
    this.isReady[slotId] = false;

    panel?.classList.remove('ready');
    panel?.style.setProperty('--p', '0.06');

    const idleName =
      typeof character.animations.idle === 'string'
        ? character.animations.idle
        : character.animations.idle?.name;
    if (idleName) {
      model.setAttribute('animation-name', idleName);
    } else {
      model.removeAttribute('animation-name');
    }

    model.setAttribute('src', character.modelSrc);
  }

  /**
   * Assigns a character to a player slot and updates presentation, framing, and 3D model.
   * @param {number} slotId - 1 or 2
   * @param {string} characterId
   * @returns {Object} Assigned character config
   */
  setCharacter(slotId, characterId) {
    const id = slotId === 2 ? 2 : 1;
    const character = getCharacter(characterId);
    this.selectedIds[id] = character.id;
    this.syncMatchupPresentation();
    this.applySlotCharacter(id, character);
    return character;
  }

  /**
   * Assigns both player slots simultaneously (preventing intermediate mirror-theme flashes).
   * @param {string} charId1
   * @param {string} charId2
   */
  setMatchup(charId1, charId2) {
    const c1 = getCharacter(charId1);
    const c2 = getCharacter(charId2);
    this.selectedIds[1] = c1.id;
    this.selectedIds[2] = c2.id;
    this.syncMatchupPresentation();
    this.applySlotCharacter(1, c1);
    this.applySlotCharacter(2, c2);
  }

  /**
   * Swaps the characters currently assigned to Player 1 and Player 2.
   */
  swapCharacters() {
    this.setMatchup(this.selectedIds[2], this.selectedIds[1]);
  }

  /**
   * Synchronizes CSS variables, panel labels, score tooltips, matchup header, and page title.
   */
  syncMatchupPresentation() {
    const isMirror = this.isMirrorMatch();
    const rootStyle = document.documentElement.style;

    for (const id of [1, 2]) {
      const character = this.getCharacter(id);
      const theme = getEffectiveTheme(character, id, isMirror);
      const vars = getSlotCssVars(theme, id);
      for (const [key, value] of Object.entries(vars)) {
        rootStyle.setProperty(key, value);
      }

      const panel = this.panels[id];
      if (panel) {
        panel.dataset.winMotion = character.winSpriteMotion;
        panel.setAttribute('aria-label', character.name);
      }
      if (this.nameEls[id]) {
        this.nameEls[id].textContent = character.name;
      }
      if (this.scoreEls[id]) {
        this.scoreEls[id].title = `${character.name} Wins`;
      }
    }

    const c1 = this.getCharacter(1);
    const c2 = this.getCharacter(2);

    if (this.matchupEls?.name1) {
      this.matchupEls.name1.textContent = c1.name.toUpperCase();
    }
    if (this.matchupEls?.name2) {
      this.matchupEls.name2.textContent = c2.name.toUpperCase();
    }
    if (this.matchupEls?.subtitle) {
      this.matchupEls.subtitle.setAttribute('aria-label', `${c1.name} versus ${c2.name}`);
    }
    document.title = `Connect 4: ${c1.name} vs ${c2.name}`;
  }

  /**
   * Resolves the idle clip for a loaded model, gracefully falling back for untested .glb files.
   * @param {number} playerId
   * @returns {Object|null}
   * @private
   */
  resolveIdleClip(playerId) {
    const model = this.models[playerId];
    const character = this.getCharacter(playerId);
    const available = model?.availableAnimations || [];

    if (available.length === 0) {
      return null;
    }

    const configured = character.animations.idle;
    if (configured) {
      const normalized =
        typeof configured === 'string' ? { name: configured, fade: 350, timeScale: 1.0 } : configured;
      if (available.includes(normalized.name)) {
        return {
          name: normalized.name,
          fade: normalized.fade ?? 350,
          timeScale: normalized.timeScale ?? 1.0,
          repetitions: Infinity
        };
      }
    }

    const fallbackName = available.find((name) => /idle|stand|breath|wait|loop/i.test(name)) || available[0];
    console.info(
      `[CharacterManager] "${character.name}" (Slot ${playerId}) using fallback idle clip "${fallbackName}". Available animations:`,
      available
    );
    return {
      name: fallbackName,
      fade: 350,
      timeScale: 1.0,
      repetitions: Infinity
    };
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
      console.warn(`[CharacterManager] Clip not found on ${this.getCharacter(playerId).name}: ${clip.name}`);
      return;
    }

    const crossfade = clip.fade ?? 300;
    const repetitions = clip.repetitions ?? Infinity;
    const timeScale = clip.timeScale ?? 1.0;
    const isSameClip = model.animationName === clip.name;

    model.animationCrossfadeDuration = crossfade;
    model.animationName = clip.name;

    if (model.updateComplete) {
      try {
        await model.updateComplete;
      } catch (_) {}
    }

    if (this.sequenceTokens[playerId] !== token) return;

    model.timeScale = timeScale;
    if (isSameClip && clip.resetIfSame) {
      model.currentTime = 0;
    }
    model.play({ repetitions });

    if (clip.pauseAfter != null) {
      this.schedule(
        playerId,
        () => {
          if (this.sequenceTokens[playerId] === token) {
            model.pause();
          }
        },
        clip.pauseAfter
      );
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
    if (!model) return;

    if (!this.isReady[playerId]) {
      const idleConfig = this.getCharacter(playerId).animations.idle;
      const clipName = typeof idleConfig === 'string' ? idleConfig : idleConfig?.name;
      if (clipName) {
        model.setAttribute('animation-name', clipName);
      } else {
        model.removeAttribute('animation-name');
      }
      return;
    }

    const clip = this.resolveIdleClip(playerId);
    if (!clip) {
      model.pause?.();
      return;
    }

    this.applyClip(playerId, token, clip);
  }

  /**
   * Executes a multi-stage animation sequence with controlled timings, crossfades, and timeScale.
   * Quietly preserves idle if the model has no matching animation clips.
   *
   * @param {number} playerId
   * @param {Array<{name: string, ms?: number, fade?: number, timeScale?: number, repetitions?: number, pauseAfter?: number}>} steps
   */
  runSequence(playerId, steps) {
    const model = this.models[playerId];
    if (!model || !steps?.length) return;

    const available = model.availableAnimations || [];
    if (available.length === 0) return;

    const validSteps = steps.filter((step) => available.includes(step.name));
    if (validSteps.length === 0) return;

    this.clearTimers(playerId);
    const currentToken = ++this.sequenceTokens[playerId];
    let stepIndex = 0;

    const advanceStep = async () => {
      if (this.sequenceTokens[playerId] !== currentToken || stepIndex >= validSteps.length) {
        return;
      }

      const step = validSteps[stepIndex++];
      const isFinalStep = stepIndex === validSteps.length;

      // Always loop steps internally so outgoing actions never trigger model-viewer's auto-pause on crossfade
      await this.applyClip(playerId, currentToken, { ...step, repetitions: Infinity });

      if (this.sequenceTokens[playerId] !== currentToken || isFinalStep) return;

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
    this.schedule(
      winnerId,
      () => {
        this.panels[winnerId]?.classList.add('winner');
        this.runSequence(winnerId, this.getCharacter(winnerId).animations.win);
        if (typeof onWinnerStart === 'function') {
          onWinnerStart(this.panels[winnerId]);
        }
      },
      REACTION_TIMING.WINNER_DELAY_MS
    );

    // Loser reacts in defeat a split-second after the winner's triumphant strike
    this.schedule(
      loserId,
      () => {
        this.panels[loserId]?.classList.add('loser');
        this.runSequence(loserId, this.getCharacter(loserId).animations.lose);
      },
      REACTION_TIMING.LOSER_DELAY_MS
    );
  }

  /**
   * Choreographs character reactions when the match ends in a draw.
   */
  handleDraw() {
    this.clearTimers();
    for (const id of [1, 2]) {
      const drawSteps = this.getCharacter(id).animations.draw;
      if (drawSteps?.length) {
        this.schedule(id, () => this.runSequence(id, drawSteps), REACTION_TIMING.WINNER_DELAY_MS);
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
   * Updates panel active highlight based on current turn, game over, and winner state.
   * @param {number} activePlayer - 1 or 2
   * @param {boolean} isGameOver
   * @param {number|null} [winnerId=null]
   */
  updateActivePanel(activePlayer, isGameOver, winnerId = null) {
    if (isGameOver) {
      const p1Active = winnerId ? winnerId === 1 : true;
      const p2Active = winnerId ? winnerId === 2 : true;
      this.panels[1]?.classList.toggle('active', p1Active);
      this.panels[2]?.classList.toggle('active', p2Active);
      return;
    }
    this.panels[1]?.classList.toggle('active', activePlayer === 1);
    this.panels[2]?.classList.toggle('active', activePlayer === 2);
  }

  /**
   * DevTools helper: inspects loaded models, framing attributes, and embedded animations.
   * @returns {Record<number, Object>}
   */
  inspect() {
    const report = {};
    for (const id of [1, 2]) {
      const model = this.models[id];
      const char = this.getCharacter(id);
      report[id] = {
        slot: id,
        id: char.id,
        name: char.name,
        modelSrc: char.modelSrc,
        ready: this.isReady[id],
        scale: model?.getAttribute('scale') || null,
        cameraTarget: model?.getAttribute('camera-target') || null,
        cameraOrbit: model?.getAttribute('camera-orbit') || null,
        viewport: {
          bottom: model?.style.getPropertyValue('--model-bottom') || null,
          width: model?.style.getPropertyValue('--model-width') || null,
          height: model?.style.getPropertyValue('--model-height') || null,
          translateX: model?.style.getPropertyValue('--model-translate-x') || null
        },
        currentAnimation: model?.animationName || null,
        availableAnimations: [...(model?.availableAnimations || [])]
      };
    }
    return report;
  }

  /**
   * DevTools helper: previews any animation clip on a slot.
   * @param {number} slotId
   * @param {string} clipName
   * @param {{ fade?: number, timeScale?: number, repetitions?: number, pauseAfter?: number }} [opts]
   */
  playClip(slotId, clipName, opts = {}) {
    const id = slotId === 2 ? 2 : 1;
    this.clearTimers(id);
    const token = ++this.sequenceTokens[id];
    this.applyClip(id, token, {
      name: clipName,
      fade: opts.fade ?? 250,
      timeScale: opts.timeScale ?? 1.0,
      repetitions: opts.repetitions ?? Infinity,
      pauseAfter: opts.pauseAfter
    });
  }

  /**
   * DevTools helper: live-adjusts camera & CSS viewport offsets for tuning new .glb models.
   * @param {number} slotId
   * @param {{ scale?: string, cameraTarget?: string, cameraOrbit?: string, bottom?: string, width?: string, height?: string, translateX?: string }} [overrides]
   */
  setFramingOverride(slotId, overrides = {}) {
    const id = slotId === 2 ? 2 : 1;
    const model = this.models[id];
    if (!model) return;

    if (overrides.scale != null) model.setAttribute('scale', overrides.scale);
    if (overrides.cameraTarget != null) model.setAttribute('camera-target', overrides.cameraTarget);
    if (overrides.cameraOrbit != null) model.setAttribute('camera-orbit', overrides.cameraOrbit);
    if (overrides.bottom != null) model.style.setProperty('--model-bottom', overrides.bottom);
    if (overrides.width != null) model.style.setProperty('--model-width', overrides.width);
    if (overrides.height != null) model.style.setProperty('--model-height', overrides.height);
    if (overrides.translateX != null) model.style.setProperty('--model-translate-x', overrides.translateX);

    if (typeof model.jumpCameraToGoal === 'function') {
      model.jumpCameraToGoal();
    }
  }
}
