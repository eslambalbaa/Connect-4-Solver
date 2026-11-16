/**
 * @file board-renderer.js
 * @description Manages Connect 4 DOM elements, piece drop physics animations,
 * target landing ring preview, board impact recoil, and visual status updates.
 */

import { BOARD_CONFIG, REACTION_TIMING } from './constants.js?v=47';

export class BoardRenderer {
  /**
   * @param {Object} elements
   * @param {HTMLElement} elements.boardEl
   * @param {HTMLElement} elements.piecesEl
   * @param {HTMLElement} elements.ringsEl
   * @param {HTMLElement} elements.activeEl
   * @param {HTMLElement} elements.guidelineEl
   * @param {HTMLElement} [elements.targetRingEl]
   * @param {HTMLElement} elements.statusEl
   */
  constructor({ boardEl, piecesEl, ringsEl, activeEl, guidelineEl, targetRingEl = null, statusEl }) {
    this.boardEl = boardEl;
    this.piecesEl = piecesEl;
    this.ringsEl = ringsEl;
    this.activeEl = activeEl;
    this.guidelineEl = guidelineEl;
    this.targetRingEl = targetRingEl || document.getElementById('targetRing');
    this.statusEl = statusEl;

    this.pieceElements = Array.from({ length: BOARD_CONFIG.ROWS }, () =>
      Array(BOARD_CONFIG.COLS).fill(null)
    );

    this.cachedPitch = null;
    this.cachedBoardRect = null;
    this.timers = [];

    window.addEventListener(
      'resize',
      () => {
        this.cachedPitch = null;
        this.cachedBoardRect = null;
      },
      { passive: true }
    );

    this.initGridRings();
  }

  /**
   * Generates grid ring overlays using a DocumentFragment to minimize DOM reflows.
   * @private
   */
  initGridRings() {
    if (this.ringsEl && this.ringsEl.children.length === 0) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < BOARD_CONFIG.TOTAL_CELLS; i++) {
        fragment.appendChild(document.createElement('i'));
      }
      this.ringsEl.appendChild(fragment);
    }
  }

  /**
   * Calculates and caches the distance between column centers for accurate piece drops.
   * @returns {number}
   */
  getColumnPitch() {
    if (this.cachedPitch !== null && this.cachedPitch > 0) {
      return this.cachedPitch;
    }
    if (this.ringsEl && this.ringsEl.children.length >= 2) {
      const first = this.ringsEl.children[0].offsetLeft;
      const second = this.ringsEl.children[1].offsetLeft;
      const pitch = second - first;
      if (pitch > 0) {
        this.cachedPitch = pitch;
        return pitch;
      }
    }
    return 64;
  }

  /**
   * Maps a viewport clientX coordinate to the nearest board column index (0 to COLS - 1).
   * @param {number} clientX
   * @returns {number | null}
   */
  getColumnFromClientX(clientX) {
    if (!this.boardEl) return null;
    const rect = this.boardEl.getBoundingClientRect();
    if (rect.width <= 0) return null;

    const relativeX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(0.999, relativeX / rect.width));
    return Math.floor(ratio * BOARD_CONFIG.COLS);
  }

  snapCursor(col) {
    this.activeEl.style.transition = 'none';
    this.guidelineEl.style.transition = 'none';
    this.activeEl.style.setProperty('--col', col);
    this.guidelineEl.style.setProperty('--col', col);
    void this.activeEl.offsetWidth;
    this.activeEl.style.transition = '';
    this.guidelineEl.style.transition = '';
  }

  wait(ms) {
    return new Promise((resolve) => {
      const timerId = window.setTimeout(resolve, ms);
      this.timers.push(timerId);
    });
  }

  async moveCursorSequentially(fromCol, toCol, player, getTargetRow, isCancelled, stepDelayMs = 115, settleDelayMs = 130) {
    if (isCancelled()) return false;

    const step = toCol > fromCol ? 1 : -1;
    let col = fromCol;
    this.renderCursor(col, player, false, getTargetRow(col));

    while (col !== toCol) {
      await this.wait(stepDelayMs);
      if (isCancelled()) return false;
      col += step;
      this.renderCursor(col, player, false, getTargetRow(col));
    }

    await this.wait(settleDelayMs);
    return !isCancelled();
  }

  /**
   * Updates preview guideline, target landing ring, and floating piece position.
   * Uses CSS transform3d for GPU compositing without layout thrashing.
   *
   * @param {number} col
   * @param {number} player
   * @param {boolean} isGameOver
   * @param {number} [targetRow=-1]
   */
  renderCursor(col, player, isGameOver, targetRow = -1) {
    this.activeEl.className = `piece p${player}${isGameOver ? ' hidden' : ''}`;
    this.activeEl.style.setProperty('--col', col);

    this.guidelineEl.style.setProperty('--col', col);
    this.guidelineEl.className = `active-guideline p${player}${isGameOver ? '' : ' visible'}`;

    if (this.targetRingEl) {
      if (targetRow >= 0 && !isGameOver) {
        this.targetRingEl.style.setProperty('--target-row', targetRow);
        this.targetRingEl.classList.remove('full');
      } else {
        this.targetRingEl.classList.add('full');
      }
    }
  }

  /**
   * Shakes the preview disc to signal an invalid move on a full column.
   */
  shakeActivePiece() {
    this.activeEl.animate(
      [
        { transform: 'translate3d(calc(var(--col) * var(--pitch)), 0, 0)' },
        { transform: 'translate3d(calc(var(--col) * var(--pitch) - 8px), 0, 0)' },
        { transform: 'translate3d(calc(var(--col) * var(--pitch) + 8px), 0, 0)' },
        { transform: 'translate3d(calc(var(--col) * var(--pitch)), 0, 0)' }
      ],
      { duration: 200, easing: 'ease-in-out' }
    );
  }

  /**
   * Animates a piece falling into the specified slot with physics-based bounce
   * and triggers a subtle tactile board recoil on primary impact.
   *
   * @param {number} col
   * @param {number} row
   * @param {number} player
   * @returns {Promise<void>} Resolves when the bounce animation finishes.
   */
  animateDrop(col, row, player) {
    return new Promise((resolve) => {
      const pitch = this.getColumnPitch();

      const pieceEl = document.createElement('div');
      pieceEl.className = `piece p${player}`;
      pieceEl.style.setProperty('--c', col);
      pieceEl.style.setProperty('--r', row);

      this.piecesEl.appendChild(pieceEl);
      this.pieceElements[row][col] = pieceEl;

      // Temporarily hide active cursor piece during drop
      this.activeEl.classList.add('hidden');
      this.guidelineEl.classList.remove('visible');

      const startDistance = (row + 1.35) * pitch;
      const bounceHeight = pitch * 0.21;
      const duration = 360 + 95 * (row + 1);

      const easeFall = 'cubic-bezier(.55, 0, 1, .45)';
      const easeBounce = 'cubic-bezier(0, .55, .45, 1)';

      const animation = pieceEl.animate(
        [
          { transform: `translate3d(0, ${-startDistance}px, 0)`, easing: easeFall, offset: 0 },
          { transform: 'translate3d(0, 0, 0)', easing: easeBounce, offset: 0.6 },
          { transform: `translate3d(0, ${-bounceHeight}px, 0)`, easing: easeFall, offset: 0.78 },
          { transform: 'translate3d(0, 0, 0)', easing: easeBounce, offset: 0.9 },
          { transform: `translate3d(0, ${-bounceHeight * 0.28}px, 0)`, easing: easeFall, offset: 0.95 },
          { transform: 'translate3d(0, 0, 0)', offset: 1 }
        ],
        {
          duration,
          fill: 'both'
        }
      );

      // Subtle tactile board thud at initial impact (60% of drop duration)
      if (this.boardEl) {
        const impactTimer = window.setTimeout(() => {
          this.boardEl.classList.add('board-thud');
          const releaseTimer = window.setTimeout(() => {
            this.boardEl.classList.remove('board-thud');
          }, 110);
          this.timers.push(releaseTimer);
        }, Math.round(duration * 0.58));
        this.timers.push(impactTimer);
      }

      animation.onfinish = () => {
        animation.cancel();
        this.snapCursor(Math.floor(BOARD_CONFIG.COLS / 2));
        resolve();
      };
    });
  }

  /**
   * Applies glowing pulse styling to all winning pieces in a sequential arcade cascade.
   * @param {Array<[number, number]>} winningCells
   */
  highlightWinners(winningCells) {
    if (!winningCells?.length) return;

    // Sort cells left-to-right (then top-to-bottom) for a clean directional cascade
    const sorted = [...winningCells].sort((a, b) => (a[1] !== b[1] ? a[1] - b[1] : a[0] - b[0]));

    sorted.forEach(([r, c], idx) => {
      const timerId = window.setTimeout(() => {
        const piece = this.pieceElements[r]?.[c];
        if (piece) {
          piece.classList.add('win');
        }
      }, idx * REACTION_TIMING.WIN_CELL_STAGGER_MS);
      this.timers.push(timerId);
    });
  }

  /**
   * Updates game status banner text and theme styling.
   * @param {string} text
   * @param {number|null} [player=null]
   */
  updateStatus(text, player = null) {
    this.statusEl.textContent = text;
    this.statusEl.className = 'plate' + (player ? ` p${player}` : '');
  }

  /**
   * Clears all placed pieces, cancels active board timers, and resets piece element cache.
   */
  clear() {
    for (const t of this.timers) {
      window.clearTimeout(t);
    }
    this.timers = [];
    this.boardEl?.classList.remove('board-thud');
    this.snapCursor(Math.floor(BOARD_CONFIG.COLS / 2));

    const piecesToRemove = this.piecesEl.querySelectorAll('.piece:not(#active)');
    piecesToRemove.forEach((el) => el.remove());

    this.pieceElements = Array.from({ length: BOARD_CONFIG.ROWS }, () =>
      Array(BOARD_CONFIG.COLS).fill(null)
    );
  }
}
