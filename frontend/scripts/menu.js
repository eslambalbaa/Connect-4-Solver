/**
 * @file menu.js
 * @description Manages the Modern Sonic title/entering screen, mode selections,
 * algorithm selection view, keyboard navigation, and animated entrance sequence.
 */

import { AI_CONFIG, GAME_MODES, PLAYERS } from './constants.js?v=42';

export class MenuManager {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.introScreenEl
   * @param {HTMLElement} options.mainViewEl
   * @param {HTMLElement} options.algoViewEl
   * @param {HTMLElement} [options.characterViewEl]
   * @param {HTMLElement} [options.howToPlayViewEl]
   * @param {HTMLElement} options.btnHumanVsHuman
   * @param {HTMLElement} options.btnHumanVsAi
   * @param {HTMLElement} [options.btnAlgoMinimax]
   * @param {HTMLElement} [options.btnAlgoAlphaBeta]
   * @param {HTMLElement} [options.btnChooseShadow]
   * @param {HTMLElement} [options.btnChooseTails]
   * @param {HTMLElement} [options.btnBackToAlgo]
   * @param {HTMLElement} [options.btnHowToPlay]
   * @param {HTMLElement} [options.btnCloseHowToPlay]
   * @param {HTMLElement} options.btnBackToModes
   * @param {HTMLElement} options.panelLeft
   * @param {HTMLElement} options.panelRight
   * @param {HTMLElement} options.centerSection
   * @param {Function} options.onStartGame
   */
  constructor({
    introScreenEl,
    mainViewEl,
    algoViewEl,
    characterViewEl = null,
    howToPlayViewEl = null,
    btnHumanVsHuman,
    btnHumanVsAi,
    btnAlgoMinimax = null,
    btnAlgoAlphaBeta = null,
    btnChooseShadow = null,
    btnChooseTails = null,
    btnBackToAlgo = null,
    btnHowToPlay = null,
    btnCloseHowToPlay = null,
    btnBackToModes,
    panelLeft,
    panelRight,
    centerSection,
    onStartGame
  }) {
    this.introScreenEl = introScreenEl;
    this.mainViewEl = mainViewEl;
    this.algoViewEl = algoViewEl;
    this.characterViewEl = characterViewEl;
    this.howToPlayViewEl = howToPlayViewEl;
    this.btnHumanVsHuman = btnHumanVsHuman;
    this.btnHumanVsAi = btnHumanVsAi;
    this.btnAlgoMinimax = btnAlgoMinimax;
    this.btnAlgoAlphaBeta = btnAlgoAlphaBeta;
    this.btnChooseShadow = btnChooseShadow;
    this.btnChooseTails = btnChooseTails;
    this.btnBackToAlgo = btnBackToAlgo;
    this.btnHowToPlay = btnHowToPlay;
    this.btnCloseHowToPlay = btnCloseHowToPlay;
    this.btnBackToModes = btnBackToModes;
    this.panelLeft = panelLeft;
    this.panelRight = panelRight;
    this.centerSection = centerSection;
    this.onStartGame = onStartGame;

    this.isInMenu = true;
    this.isTransitioning = false;
    this.currentView = 'main';
    this.selectedAlgorithm = AI_CONFIG.DEFAULT_ALGORITHM;

    this.initEvents();
  }

  /**
   * Attaches click and keyboard handlers to menu buttons.
   * @private
   */
  initEvents() {
    this.btnHumanVsHuman?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.startEntranceSequence(GAME_MODES.HUMAN_VS_HUMAN);
    });

    this.btnHumanVsAi?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showAlgoView();
    });

    this.btnAlgoMinimax?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showCharacterView(AI_CONFIG.ALGORITHMS.MINIMAX);
    });

    this.btnAlgoAlphaBeta?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showCharacterView(AI_CONFIG.ALGORITHMS.ALPHA_BETA);
    });

    this.btnChooseShadow?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.startEntranceSequence(GAME_MODES.HUMAN_VS_AI, {
        algorithm: this.selectedAlgorithm,
        humanPlayer: PLAYERS[1].id,
        cpuPlayer: PLAYERS[2].id
      });
    });

    this.btnChooseTails?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.startEntranceSequence(GAME_MODES.HUMAN_VS_AI, {
        algorithm: this.selectedAlgorithm,
        humanPlayer: PLAYERS[2].id,
        cpuPlayer: PLAYERS[1].id
      });
    });

    this.btnBackToAlgo?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showAlgoView();
    });

    this.btnBackToModes?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showMainView();
    });

    this.btnHowToPlay?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showHowToPlayView();
    });

    this.btnCloseHowToPlay?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showMainView();
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isInMenu || this.isTransitioning) return;

      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (this.currentView === 'character') {
          e.preventDefault();
          this.showAlgoView();
        } else if (this.currentView === 'algo') {
          e.preventDefault();
          this.showMainView();
          this.btnHumanVsAi?.focus();
        } else if (this.currentView === 'howToPlay') {
          e.preventDefault();
          this.showMainView();
          this.btnHowToPlay?.focus();
        }
      } else if (this.currentView === 'main' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (document.activeElement === this.btnHumanVsHuman) {
          this.btnHumanVsAi?.focus();
        } else {
          this.btnHumanVsHuman?.focus();
        }
      } else if (this.currentView === 'character' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (document.activeElement === this.btnChooseShadow) {
          this.btnChooseTails?.focus();
        } else {
          this.btnChooseShadow?.focus();
        }
      }
    });
  }

  /**
   * Displays the main mode selection view.
   */
  showMainView() {
    this.currentView = 'main';
    this.algoViewEl?.classList.add('hidden');
    this.characterViewEl?.classList.add('hidden');
    this.howToPlayViewEl?.classList.add('hidden');
    this.mainViewEl?.classList.remove('hidden');
  }

  /**
   * Displays the algorithm options view (kept for user AI implementation).
   */
  showAlgoView() {
    this.currentView = 'algo';
    this.mainViewEl?.classList.add('hidden');
    this.characterViewEl?.classList.add('hidden');
    this.howToPlayViewEl?.classList.add('hidden');
    this.algoViewEl?.classList.remove('hidden');
    this.btnAlgoMinimax?.focus();
  }

  showCharacterView(algorithm) {
    this.currentView = 'character';
    this.selectedAlgorithm = algorithm;
    this.mainViewEl?.classList.add('hidden');
    this.algoViewEl?.classList.add('hidden');
    this.howToPlayViewEl?.classList.add('hidden');
    this.characterViewEl?.classList.remove('hidden');
    this.btnChooseShadow?.focus();
  }

  /**
   * Displays the How to Play guide view.
   */
  showHowToPlayView() {
    this.currentView = 'howToPlay';
    this.mainViewEl?.classList.add('hidden');
    this.algoViewEl?.classList.add('hidden');
    this.characterViewEl?.classList.add('hidden');
    this.howToPlayViewEl?.classList.remove('hidden');
    this.btnCloseHowToPlay?.focus();
  }

  /**
   * Runs the animated entrance sequence:
   * 1. Fades out the intro menu screen.
   * 2. Smoothly slides player 1, player 2, and the game board into active positions.
   * 3. Hands over control to the game engine upon completion.
   *
   * @param {string} mode
   */
  startEntranceSequence(mode, options = {}) {
    this.isTransitioning = true;

    this.panelLeft.style.willChange = 'transform, opacity';
    this.panelRight.style.willChange = 'transform, opacity';
    this.centerSection.style.willChange = 'transform, opacity';

    this.introScreenEl.classList.add('leaving');

    window.setTimeout(() => {
      this.introScreenEl.classList.add('hidden');
      this.introScreenEl.classList.remove('leaving');

      document.body.classList.remove('in-menu');
      document.body.classList.add('in-game');

      window.setTimeout(() => {
        this.isInMenu = false;
        this.isTransitioning = false;

        this.panelLeft.style.willChange = '';
        this.panelRight.style.willChange = '';
        this.centerSection.style.willChange = '';

        if (typeof this.onStartGame === 'function') {
          this.onStartGame(mode, options);
        }
      }, 780);
    }, 320);
  }

  /**
   * Returns back to the entering screen from an active game session.
   */
  returnToMenu() {
    if (this.isTransitioning || this.isInMenu) return;
    this.isTransitioning = true;
    this.isInMenu = true;

    this.showMainView();
    this.introScreenEl.classList.remove('hidden', 'leaving');
    document.body.classList.remove('in-game');
    document.body.classList.add('in-menu');

    window.setTimeout(() => {
      this.isTransitioning = false;
      this.btnHumanVsHuman?.focus();
    }, 450);
  }
}
