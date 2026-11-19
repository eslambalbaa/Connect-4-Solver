/**
 * @file menu.js
 * @description Manages the Modern Sonic title/entering screen, mode selections,
 * algorithm selection, live 3D fighter selection, keyboard navigation, and animated entrance sequence.
 */

import { AI_CONFIG, GAME_MODES, GAME_STYLES, PLAYERS } from './constants.js?v=49';
import { CHARACTER_LIST, DEFAULT_MATCHUP, getCharacter } from './characters.js?v=54';

export class MenuManager {
  /**
   * @param {Object} options
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
    btnSlot1 = null,
    btnSlot2 = null,
    slotRole1 = null,
    slotRole2 = null,
    slotName1 = null,
    slotName2 = null,
    btnSwapFighters = null,
    aiSideToggleEl = null,
    btnPlayAsP1 = null,
    btnPlayAsP2 = null,
    characterRosterEl = null,
    btnConfirmCharacters = null,
    btnConfirmCharactersLabel = null,
    btnBackFromCharacter = null,
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
    initialMatchup = DEFAULT_MATCHUP,
    onCharacterChange = null,
    onSwapCharacters = null,
    onBeforeStartGame = null,
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

    this.btnSlot1 = btnSlot1;
    this.btnSlot2 = btnSlot2;
    this.slotRole1 = slotRole1;
    this.slotRole2 = slotRole2;
    this.slotName1 = slotName1;
    this.slotName2 = slotName2;
    this.btnSwapFighters = btnSwapFighters;
    this.aiSideToggleEl = aiSideToggleEl;
    this.btnPlayAsP1 = btnPlayAsP1;
    this.btnPlayAsP2 = btnPlayAsP2;
    this.characterRosterEl = characterRosterEl;
    this.btnConfirmCharacters = btnConfirmCharacters;
    this.btnConfirmCharactersLabel = btnConfirmCharactersLabel;
    this.btnBackFromCharacter = btnBackFromCharacter;

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
    this.onCharacterChange = onCharacterChange;
    this.onSwapCharacters = onSwapCharacters;
    this.onBeforeStartGame = onBeforeStartGame;
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

    this.selectedCharacters = {
      1: getCharacter(initialMatchup?.[1] ?? DEFAULT_MATCHUP[1]).id,
      2: getCharacter(initialMatchup?.[2] ?? DEFAULT_MATCHUP[2]).id
    };
    this.editingSlot = PLAYERS[1].id;
    this.rosterButtons = [];

    this.renderCharacterRoster();
    this.syncCharacterViewUI();
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

  /**
   * Builds the selectable fighter roster cards dynamically from CHARACTER_LIST.
   * @private
   */
  renderCharacterRoster() {
    if (!this.characterRosterEl) return;
    this.characterRosterEl.innerHTML = '';
    this.rosterButtons = [];

    const fragment = document.createDocumentFragment();
    for (const character of CHARACTER_LIST) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'roster-card';
      btn.setAttribute('role', 'option');
      btn.dataset.characterId = character.id;
      btn.setAttribute('aria-label', `Select ${character.name}`);

      btn.style.setProperty('--char-btn-bg', character.theme.buttonBg);
      btn.style.setProperty('--char-btn-text', character.theme.buttonText);
      btn.style.setProperty('--char-btn-text-shadow', character.theme.buttonTextShadow);
      btn.style.setProperty('--char-glow-rgb', character.theme.glowRgb);
      btn.style.setProperty('--char-disc-bg', character.theme.discBg);
      btn.style.setProperty('--char-disc-rim', character.theme.discRim);

      const disc = document.createElement('span');
      disc.className = 'roster-card-disc';
      disc.setAttribute('aria-hidden', 'true');

      const info = document.createElement('div');
      info.className = 'roster-card-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'roster-card-name';
      nameEl.textContent = character.name;

      const tagsEl = document.createElement('div');
      tagsEl.className = 'roster-slot-tags';

      info.appendChild(nameEl);
      info.appendChild(tagsEl);
      btn.appendChild(disc);
      btn.appendChild(info);

      btn.addEventListener('click', () => {
        if (this.isTransitioning) return;
        this.assignCharacterToSlot(this.editingSlot, character.id);
      });

      fragment.appendChild(btn);
      this.rosterButtons.push({ characterId: character.id, button: btn, tagsEl });
    }

    this.characterRosterEl.appendChild(fragment);
  }

  /**
   * Assigns a character to a player slot and notifies the live 3D arena.
   * @param {number} slotId
   * @param {string} characterId
   */
  assignCharacterToSlot(slotId, characterId) {
    const id = slotId === 2 ? 2 : 1;
    const character = getCharacter(characterId);
    this.selectedCharacters[id] = character.id;
    this.onCharacterChange?.(id, character.id);
    this.syncCharacterViewUI();
  }

  /**
   * Swaps the characters assigned to Player 1 and Player 2.
   */
  swapFighters() {
    const p1 = this.selectedCharacters[1];
    this.selectedCharacters[1] = this.selectedCharacters[2];
    this.selectedCharacters[2] = p1;
    this.onSwapCharacters?.(this.selectedCharacters[1], this.selectedCharacters[2]);
    this.syncCharacterViewUI();
  }

  /**
   * Sets which player slot is currently targeted by roster card clicks.
   * @param {number} slotId
   */
  setEditingSlot(slotId) {
    this.editingSlot = slotId === 2 ? 2 : 1;
    this.syncCharacterViewUI();
  }

  /**
   * Updates which slot the human plays in VS Computer mode.
   * @param {number} humanSlotId - 1 or 2
   */
  setAiHumanSide(humanSlotId) {
    this.selectedHumanPlayer = humanSlotId === 2 ? PLAYERS[2].id : PLAYERS[1].id;
    this.selectedCpuPlayer = this.selectedHumanPlayer === 1 ? PLAYERS[2].id : PLAYERS[1].id;
    this.editingSlot = this.selectedHumanPlayer;
    this.syncCharacterViewUI();
  }

  /**
   * Synchronizes slot cards, AI turn toggle, confirm label, and roster badges.
   */
  syncCharacterViewUI() {
    const isAi = this.selectedMode === GAME_MODES.HUMAN_VS_AI;
    const c1 = getCharacter(this.selectedCharacters[1]);
    const c2 = getCharacter(this.selectedCharacters[2]);

    this.btnSlot1?.classList.toggle('editing', this.editingSlot === 1);
    this.btnSlot1?.setAttribute('aria-pressed', String(this.editingSlot === 1));
    this.btnSlot2?.classList.toggle('editing', this.editingSlot === 2);
    this.btnSlot2?.setAttribute('aria-pressed', String(this.editingSlot === 2));

    if (this.slotName1) this.slotName1.textContent = c1.name.toUpperCase();
    if (this.slotName2) this.slotName2.textContent = c2.name.toUpperCase();

    this.aiSideToggleEl?.classList.toggle('hidden', !isAi);

    if (this.slotRole1) {
      this.slotRole1.classList.toggle('hidden', !isAi);
      if (isAi) {
        const p1IsCpu = this.selectedHumanPlayer !== 1;
        this.slotRole1.textContent = p1IsCpu ? 'CPU' : 'YOU';
        this.slotRole1.classList.toggle('is-cpu', p1IsCpu);
      }
    }

    if (this.slotRole2) {
      this.slotRole2.classList.toggle('hidden', !isAi);
      if (isAi) {
        const p2IsCpu = this.selectedHumanPlayer !== 2;
        this.slotRole2.textContent = p2IsCpu ? 'CPU' : 'YOU';
        this.slotRole2.classList.toggle('is-cpu', p2IsCpu);
      }
    }

    this.btnPlayAsP1?.classList.toggle('active', this.selectedHumanPlayer === 1);
    this.btnPlayAsP1?.setAttribute('aria-pressed', String(this.selectedHumanPlayer === 1));
    this.btnPlayAsP2?.classList.toggle('active', this.selectedHumanPlayer === 2);
    this.btnPlayAsP2?.setAttribute('aria-pressed', String(this.selectedHumanPlayer === 2));

    if (this.btnConfirmCharactersLabel) {
      this.btnConfirmCharactersLabel.textContent = isAi ? 'NEXT: DEPTH' : 'START MATCH';
    }

    for (const item of this.rosterButtons) {
      const isP1 = this.selectedCharacters[1] === item.characterId;
      const isP2 = this.selectedCharacters[2] === item.characterId;
      item.button.classList.toggle('selected-p1', isP1);
      item.button.classList.toggle('selected-p2', isP2);
      item.button.setAttribute(
        'aria-selected',
        String((this.editingSlot === 1 && isP1) || (this.editingSlot === 2 && isP2))
      );

      item.tagsEl.innerHTML = '';
      if (isP1) {
        const p1Tag = document.createElement('span');
        p1Tag.className = 'roster-slot-tag tag-p1';
        p1Tag.textContent = 'P1';
        item.tagsEl.appendChild(p1Tag);
      }
      if (isP2) {
        const p2Tag = document.createElement('span');
        p2Tag.className = 'roster-slot-tag tag-p2';
        p2Tag.textContent = 'P2';
        item.tagsEl.appendChild(p2Tag);
      }
    }
  }

  handleGameStyleSelected(gameStyle) {
    this.selectedGameStyle = gameStyle;
    if (this.selectedMode === GAME_MODES.HUMAN_VS_HUMAN) {
      this.showCharacterView();
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

    this.btnSlot1?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.setEditingSlot(1);
    });

    this.btnSlot2?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.setEditingSlot(2);
    });

    this.btnSwapFighters?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.swapFighters();
    });

    this.btnPlayAsP1?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.setAiHumanSide(1);
    });

    this.btnPlayAsP2?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.setAiHumanSide(2);
    });

    this.btnConfirmCharacters?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      if (this.selectedMode === GAME_MODES.HUMAN_VS_AI) {
        this.showDepthView(this.selectedHumanPlayer, this.selectedCpuPlayer);
      } else {
        this.startEntranceSequence(GAME_MODES.HUMAN_VS_HUMAN, {
          gameStyle: this.selectedGameStyle,
          characters: { ...this.selectedCharacters }
        });
      }
    });

    this.btnBackFromCharacter?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      if (this.selectedMode === GAME_MODES.HUMAN_VS_AI) {
        this.showAlgoView();
      } else {
        this.showGameStyleView(this.selectedMode);
      }
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
        maxLevels,
        characters: { ...this.selectedCharacters }
      });
    });

    this.btnBackToCharacter?.addEventListener('click', () => {
      if (this.isTransitioning) return;
      this.showCharacterView(this.selectedAlgorithm);
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
          if (this.selectedMode === GAME_MODES.HUMAN_VS_AI) {
            this.showAlgoView();
          } else {
            this.showGameStyleView(this.selectedMode);
          }
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
      } else if (
        this.currentView === 'character' &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        const focusables = [
          ...this.rosterButtons.map((item) => item.button),
          this.btnConfirmCharacters,
          this.btnBackFromCharacter
        ].filter(Boolean);
        if (!focusables.length) return;
        e.preventDefault();
        const currentIdx = focusables.indexOf(document.activeElement);
        const step = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
        const nextIdx =
          currentIdx < 0 ? 0 : (currentIdx + step + focusables.length) % focusables.length;
        focusables[nextIdx].focus();
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

  showCharacterView(algorithm = this.selectedAlgorithm) {
    this.currentView = 'character';
    if (typeof algorithm === 'number') {
      this.selectedAlgorithm = algorithm;
    }
    if (this.selectedMode === GAME_MODES.HUMAN_VS_AI) {
      this.editingSlot = this.selectedHumanPlayer;
    }
    this.hideAllViews();
    this.characterViewEl?.classList.remove('hidden');
    this.syncCharacterViewUI();
    const firstTarget = this.rosterButtons[0]?.button || this.btnConfirmCharacters;
    firstTarget?.focus();
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
   * @param {Object} [options]
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

      if (typeof this.onBeforeStartGame === 'function') {
        this.onBeforeStartGame(mode, options);
      }

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
    this.introScreenEl.classList.add('leaving');
    this.introScreenEl.classList.remove('hidden');
    void this.introScreenEl.offsetWidth;
    this.introScreenEl.classList.remove('leaving');

    document.body.classList.remove('in-game');
    document.body.classList.add('in-menu');

    window.setTimeout(() => {
      this.isTransitioning = false;
      this.btnHumanVsHuman?.focus();
    }, 280);
  }
}
