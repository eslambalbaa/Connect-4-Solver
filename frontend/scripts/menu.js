/**
 * @file menu.js
 * @description Manages the Modern Sonic title/entering screen, mode selections,
 * algorithm selection view, keyboard navigation, and animated entrance sequence.
 */

import { AI_CONFIG, GAME_MODES, GAME_STYLES, PLAYERS } from './constants.js?v=47';

export class MenuManager {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.introScreenEl
   * @param {HTMLElement} options.mainViewEl
   * @param {HTMLElement} [options.gameStyleViewEl]
   * @param {HTMLElement} options.algoViewEl
   * @param {HTMLElement} [options.characterViewEl]
   * @param {HTMLElement} [options.depthViewEl]
   * @param {HTMLElement} [options.howToPlayViewEl]
   * @param {HTMLElement} options.btnHumanVsHuman
   * @param {HTMLElement} options.btnHumanVsAi
   * @param {HTMLElement} [options.btnStyleFirstFour]
   * @param {HTMLElement} [options.btnStyleFullBoard]
   * @param {HTMLElement} [options.btnBackToMainFromStyle]
   * @param {HTMLElement} [options.btnAlgoMinimax]
   * @param {HTMLElement} [options.btnAlgoAlphaBeta]
   * @param {HTMLElement} [options.btnChooseShadow]
   * @param {HTMLElement} [options.btnChooseTails]
   * @param {HTMLElement} [options.btnBackToAlgo]
   * @param {HTMLInputElement} [options.inputMaxLevels]
   * @param {HTMLElement} [options.btnDepthMinus]
   * @param {HTMLElement} [options.btnDepthPlus]
   * @param {HTMLElement} [options.btnStartAiMatch]
   * @param {HTMLElement} [options.btnBackToCharacter]
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
    gameStyleViewEl = null,
    algoViewEl,
    characterViewEl = null,
    depthViewEl = null,
    howToPlayViewEl = null,
    btnHumanVsHuman,
    btnHumanVsAi,
    btnStyleFirstFour = null,
    btnStyleFullBoard = null,
    btnBackToMainFromStyle = null,
    btnAlgoMinimax = null,
    btnAlgoAlphaBeta = null,
    btnChooseShadow = null,
    btnChooseTails = null,
    btnBackToAlgo = null,
    inputMaxLevels = null,
    btnDepthMinus = null,
    btnDepthPlus = null,
    btnStartAiMatch = null,
    btnBackToCharacter = null,
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
    this.gameStyleViewEl = gameStyleViewEl;
    this.algoViewEl = algoViewEl;
    this.characterViewEl = characterViewEl;
    this.depthViewEl = depthViewEl;
    this.howToPlayViewEl = howToPlayViewEl;
    this.btnHumanVsHuman = btnHumanVsHuman;
    this.btnHumanVsAi = btnHumanVsAi;
    this.btnStyleFirstFour = btnStyleFirstFour;
    this.btnStyleFullBoard = btnStyleFullBoard;
    this.btnBackToMainFromStyle = btnBackToMainFromStyle;
    this.btnAlgoMinimax = btnAlgoMinimax;
    this.btnAlgoAlphaBeta = btnAlgoAlphaBeta;
    this.btnChooseShadow = btnChooseShadow;
    this.btnChooseTails = btnChooseTails;
    this.btnBackToAlgo = btnBackToAlgo;
    this.inputMaxLevels = inputMaxLevels;
    this.btnDepthMinus = btnDepthMinus;
    this.btnDepthPlus = btnDepthPlus;
    this.btnStartAiMatch = btnStartAiMatch;
    this.btnBackToCharacter = btnBackToCharacter;
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
    this.selectedMode = GAME_MODES.HUMAN_VS_HUMAN;
    this.selectedGameStyle = GAME_STYLES.FIRST_FOUR;
    this.selectedAlgorithm = AI_CONFIG.DEFAULT_ALGORITHM;
    this.selectedHumanPlayer = PLAYERS[1].id;
    this.selectedCpuPlayer = PLAYERS[2].id;
    this.selectedMaxLevels = AI_CONFIG.MAX_LEVELS;

    this.initEvents();
  }

  normalizeMaxLevels(rawValue) {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.min(42, parsed);
  }

  commitDepthInput() {
    const valid = this.normalizeMaxLevels(this.inputMaxLevels?.value);
    this.selectedMaxLevels = valid;
    if (this.inputMaxLevels) {
      this.inputMaxLevels.value = String(valid);
    }
    return valid;
  }

  adjustDepth(delta) {
    const base = this.normalizeMaxLevels(this.inputMaxLevels?.value ?? this.selectedMaxLevels);
    const next = Math.max(1, Math.min(42, base + delta));
    this.selectedMaxLevels = next;
    if (this.inputMaxLevels) {
      this.inputMaxLevels.value = String(next);
    }
  }

  hideAllViews() {
    this.mainViewEl?.classList.add('hidden');
    this.gameStyleViewEl?.classList.add('hidden');
    this.algoViewEl?.classList.add('hidden');
    this.characterViewEl?.classList.add('hidden');
    this.depthViewEl?.classList.add('hidden');
    this.howToPlayViewEl?.classList.add('hidden');
  }

  handleGameStyleSelected(gameStyle) {
    this.selectedGameStyle = gameStyle;
    if (this.selectedMode === GAME_MODES.HUMAN_VS_HUMAN) {
      this.startEntranceSequence(GAME_MODES.HUMAN_VS_HUMAN, {
        gameStyle: this.selectedGameStyle
      });
    } else {
      this.showAlgoView();
    }
  }

  /**
   * Attaches click and keyboard handlers to menu buttons.
   * @private
   */
  initEvents() {
    this.btnHumanVsHuman?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showGameStyleView(GAME_MODES.HUMAN_VS_HUMAN);
    });

    this.btnHumanVsAi?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showGameStyleView(GAME_MODES.HUMAN_VS_AI);
    });

    this.btnStyleFirstFour?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.handleGameStyleSelected(GAME_STYLES.FIRST_FOUR);
    });

    this.btnStyleFullBoard?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.handleGameStyleSelected(GAME_STYLES.FULL_BOARD);
    });

    this.btnBackToMainFromStyle?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showMainView();
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
      this.showDepthView(PLAYERS[1].id, PLAYERS[2].id);
    });

    this.btnChooseTails?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showDepthView(PLAYERS[2].id, PLAYERS[1].id);
    });

    this.btnDepthMinus?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.adjustDepth(-1);
    });

    this.btnDepthPlus?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.adjustDepth(1);
    });

    this.inputMaxLevels?.addEventListener('blur', () => {
      this.commitDepthInput();
    });

    this.inputMaxLevels?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.btnStartAiMatch?.click();
      }
    });

    this.btnStartAiMatch?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      const maxLevels = this.commitDepthInput();
      this.startEntranceSequence(GAME_MODES.HUMAN_VS_AI, {
        gameStyle: this.selectedGameStyle,
        algorithm: this.selectedAlgorithm,
        humanPlayer: this.selectedHumanPlayer,
        cpuPlayer: this.selectedCpuPlayer,
        maxLevels
      });
    });

    this.btnBackToCharacter?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showCharacterView(this.selectedAlgorithm);
    });

    this.btnBackToAlgo?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showAlgoView();
    });

    this.btnBackToModes?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showGameStyleView(this.selectedMode);
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

      if (e.key === 'Escape' || (e.key === 'Backspace' && document.activeElement !== this.inputMaxLevels)) {
        if (this.currentView === 'depth') {
          e.preventDefault();
          this.showCharacterView(this.selectedAlgorithm);
        } else if (this.currentView === 'character') {
          e.preventDefault();
          this.showAlgoView();
        } else if (this.currentView === 'algo') {
          e.preventDefault();
          this.showGameStyleView(this.selectedMode);
        } else if (this.currentView === 'gameStyle') {
          e.preventDefault();
          this.showMainView();
          if (this.selectedMode === GAME_MODES.HUMAN_VS_AI) {
            this.btnHumanVsAi?.focus();
          } else {
            this.btnHumanVsHuman?.focus();
          }
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
      } else if (this.currentView === 'gameStyle' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (document.activeElement === this.btnStyleFirstFour) {
          this.btnStyleFullBoard?.focus();
        } else {
          this.btnStyleFirstFour?.focus();
        }
      } else if (this.currentView === 'algo' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (document.activeElement === this.btnAlgoMinimax) {
          this.btnAlgoAlphaBeta?.focus();
        } else {
          this.btnAlgoMinimax?.focus();
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
    this.hideAllViews();
    this.mainViewEl?.classList.remove('hidden');
  }

  showGameStyleView(mode) {
    this.currentView = 'gameStyle';
    this.selectedMode = mode;
    this.hideAllViews();
    this.gameStyleViewEl?.classList.remove('hidden');
    this.btnStyleFirstFour?.focus();
  }

  /**
   * Displays the algorithm options view (kept for user AI implementation).
   */
  showAlgoView() {
    this.currentView = 'algo';
    this.hideAllViews();
    this.algoViewEl?.classList.remove('hidden');
    this.btnAlgoMinimax?.focus();
  }

  showCharacterView(algorithm) {
    this.currentView = 'character';
    this.selectedAlgorithm = algorithm;
    this.hideAllViews();
    this.characterViewEl?.classList.remove('hidden');
    this.btnChooseShadow?.focus();
  }

  showDepthView(humanPlayer, cpuPlayer) {
    this.currentView = 'depth';
    this.selectedHumanPlayer = humanPlayer;
    this.selectedCpuPlayer = cpuPlayer;
    this.hideAllViews();
    this.depthViewEl?.classList.remove('hidden');
    if (this.inputMaxLevels) {
      this.inputMaxLevels.value = String(this.selectedMaxLevels);
      this.inputMaxLevels.focus();
      this.inputMaxLevels.select();
    }
  }

  /**
   * Displays the How to Play guide view.
   */
  showHowToPlayView() {
    this.currentView = 'howToPlay';
    this.hideAllViews();
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
