/**
 * @file main.js
 * @description Main application entry point, lifecycle coordinator, pointer/keyboard
 * input controller, and match state manager for Connect 4: Shadow vs Tails.
 */

import { AI_CONFIG, BOARD_CONFIG, GAME_MODES, GAME_STYLES, PLAYERS } from './constants.js?v=46';
import { perf } from './perf.js?v=42';
import { ConfettiEngine } from './confetti.js?v=42';
import { CharacterManager } from './character-manager.js?v=46';
import { Connect4Game } from './game.js?v=46';
import { BoardRenderer } from './board-renderer.js?v=46';
import { MenuManager } from './menu.js?v=46';

document.addEventListener('DOMContentLoaded', () => {
  // DOM References
  const boardEl = document.getElementById('board');
  const piecesEl = document.getElementById('pieces');
  const ringsEl = document.getElementById('rings');
  const activeEl = document.getElementById('active');
  const guidelineEl = document.getElementById('guideline');
  const targetRingEl = document.getElementById('targetRing');
  const statusEl = document.getElementById('status');
  const confettiCanvas = document.getElementById('confetti');
  const speedContainer = document.getElementById('speed');
  const btnMenuEl = document.getElementById('btnMenu');
  const btnRestartEl = document.getElementById('btnRestart');

  const panels = {
    1: document.getElementById('panel1'),
    2: document.getElementById('panel2')
  };

  const models = {
    1: document.getElementById('model1'),
    2: document.getElementById('model2')
  };

  const scoreEls = {
    1: document.getElementById('score1'),
    2: document.getElementById('score2')
  };

  const scores = { 1: 0, 2: 0 };

  // Generate dynamic background speed lines (capped at 7 for clean GPU compositing)
  if (speedContainer) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 7; i++) {
      const line = document.createElement('i');
      line.style.top = `${((i * 37 + 11) % 88) + 4}vh`;
      line.style.width = `${16 + (i % 4) * 8}vw`;
      line.style.animationDuration = `${2.3 + (i % 4) * 0.55}s`;
      line.style.animationDelay = `${-i * 0.7}s`;
      fragment.appendChild(line);
    }
    speedContainer.appendChild(fragment);
  }

  // Initialize subsystems
  const confetti = new ConfettiEngine(confettiCanvas);
  perf.init([models[1], models[2]], confetti);

  const characterManager = new CharacterManager({
    models,
    panels,
    onAllLoaded: () => {
      window.setTimeout(() => perf.probePerformance(), 1500);
    }
  });

  const boardRenderer = new BoardRenderer({
    boardEl,
    piecesEl,
    ringsEl,
    activeEl,
    guidelineEl,
    targetRingEl,
    statusEl
  });

  const game = new Connect4Game();

  const CENTER_COL = Math.floor(BOARD_CONFIG.COLS / 2);

  let activeColumn = CENTER_COL;
  let isDropping = false;
  let isAiThinking = false;
  let currentMode = GAME_MODES.HUMAN_VS_HUMAN;
  let currentGameStyle = GAME_STYLES.FIRST_FOUR;
  let currentAlgorithm = AI_CONFIG.DEFAULT_ALGORITHM;
  let currentMaxLevels = AI_CONFIG.MAX_LEVELS;
  let cpuPlayer = AI_CONFIG.CPU_PLAYER;
  let aiAbortController = null;
  let matchGeneration = 0;

  function isCpuTurn() {
    return currentMode === GAME_MODES.HUMAN_VS_AI && game.currentPlayer === cpuPlayer && !game.isOver;
  }

  function abortPendingAiMove() {
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }
    isAiThinking = false;
  }

  /**
   * Increments and animates the player's win counter pill.
   * @param {number} winnerId
   */
  function recordWinScore(winnerId) {
    scores[winnerId] = (scores[winnerId] || 0) + 1;
    const el = scoreEls[winnerId];
    if (!el) return;
    el.textContent = String(scores[winnerId]);
    el.classList.add('bump');
    window.setTimeout(() => el.classList.remove('bump'), 320);
  }

  /**
   * Refreshes the board cursor, target landing ring, and character UI based on current game state.
   */
  function syncUI() {
    const player = game.currentPlayer;
    const isOver = game.isOver;
    const targetRow = isOver ? -1 : game.getLowestAvailableRow(activeColumn);

    boardRenderer.renderCursor(activeColumn, player, isOver, targetRow);
    characterManager.updateActivePanel(player, isOver);

    if (!isOver) {
      let scoreSuffix = '';
      if (currentGameStyle === GAME_STYLES.FULL_BOARD) {
        const fours = game.getFourCounts();
        scoreSuffix = ` (${fours[1]} - ${fours[2]})`;
      }

      if (isAiThinking) {
        boardRenderer.updateStatus(`${PLAYERS[player].name} is thinking...${scoreSuffix}`, player);
      } else {
        boardRenderer.updateStatus(`${PLAYERS[player].name}: your move${scoreSuffix}`, player);
      }
    }
  }

  /**
   * Resets the match state, clearing pieces, cancelling pending sequences, and restarting turns.
   */
  function resetMatch() {
    matchGeneration++;
    abortPendingAiMove();
    game.reset(currentGameStyle);
    isDropping = false;
    activeColumn = CENTER_COL;

    confetti.stop();
    characterManager.resetStates();
    boardRenderer.clear();
    syncUI();

    if (!game.isOver && isCpuTurn() && !menuManager.isInMenu) {
      triggerCpuTurn(matchGeneration);
    }
  }

  async function executeMove(col) {
    const currentGen = matchGeneration;
    isDropping = true;
    const dropResult = game.dropPiece(col);
    if (!dropResult.success) {
      isDropping = false;
      return false;
    }

    // Animate the physical falling disc
    await boardRenderer.animateDrop(dropResult.col, dropResult.row, dropResult.player);

    // Abort if match was reset or returned to menu while piece was mid-air
    if (matchGeneration !== currentGen) {
      return false;
    }

    if (dropResult.winnerId) {
      const winnerId = dropResult.winnerId;
      const winnerName = PLAYERS[winnerId].name;

      boardRenderer.highlightWinners(dropResult.winLine);
      if (currentGameStyle === GAME_STYLES.FULL_BOARD && dropResult.fours) {
        const high = Math.max(dropResult.fours[1], dropResult.fours[2]);
        const low = Math.min(dropResult.fours[1], dropResult.fours[2]);
        boardRenderer.updateStatus(`${winnerName} wins ${high} - ${low}! Press R or Click to rematch`, winnerId);
      } else {
        boardRenderer.updateStatus(`${winnerName} wins! Press R or Click to rematch`, winnerId);
      }
      recordWinScore(winnerId);

      // Choreographed staggered victory & defeat sequences
      characterManager.handleGameEnd(winnerId, (winnerPanel) => {
        if (matchGeneration === currentGen && !menuManager.isInMenu) {
          confetti.start(winnerPanel);
        }
      });
    } else if (dropResult.isDraw) {
      if (currentGameStyle === GAME_STYLES.FULL_BOARD && dropResult.fours) {
        boardRenderer.updateStatus(`Draw ${dropResult.fours[1]} - ${dropResult.fours[2]}! Press R or Click to rematch`, null);
      } else {
        boardRenderer.updateStatus('Draw Game! Press R or Click to rematch', null);
      }
      characterManager.handleDraw();
    } else {
      game.switchPlayer();
      activeColumn = CENTER_COL;
    }

    isDropping = false;
    syncUI();

    if (!game.isOver && isCpuTurn() && matchGeneration === currentGen && !menuManager.isInMenu) {
      await triggerCpuTurn(currentGen);
    }

    return true;
  }

  async function triggerCpuTurn(currentGen) {
    isAiThinking = true;
    activeColumn = CENTER_COL;
    const turnStartMs = performance.now();
    syncUI();

    aiAbortController = new AbortController();
    try {
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          algorithm: currentAlgorithm,
          game_style: currentGameStyle,
          color: cpuPlayer,
          max_levels: currentMaxLevels,
          board: game.grid
        }),
        signal: aiAbortController.signal
      });

      const data = await response.json();
      if (matchGeneration !== currentGen || menuManager.isInMenu) {
        return;
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const aiCol = game.findMoveCol(data.board, cpuPlayer);
      if (aiCol < 0) {
        throw new Error('Solver returned an invalid move');
      }

      const remainingSpawnMs = Math.max(0, 220 - (performance.now() - turnStartMs));
      if (remainingSpawnMs > 0) {
        await boardRenderer.wait(remainingSpawnMs);
        if (matchGeneration !== currentGen || menuManager.isInMenu) {
          return;
        }
      }

      activeColumn = aiCol;
      const moved = await boardRenderer.moveCursorSequentially(
        CENTER_COL,
        aiCol,
        cpuPlayer,
        (c) => game.getLowestAvailableRow(c),
        () => matchGeneration !== currentGen || menuManager.isInMenu
      );
      if (!moved) {
        return;
      }

      isAiThinking = false;
      await executeMove(aiCol);
    } catch (err) {
      if (err.name === 'AbortError' || matchGeneration !== currentGen || menuManager.isInMenu) {
        return;
      }
      isAiThinking = false;
      boardRenderer.updateStatus(`AI error: ${err.message}`, null);
    } finally {
      if (matchGeneration === currentGen) {
        aiAbortController = null;
        isAiThinking = false;
      }
    }
  }

  /**
   * Handles dropping a piece into the target column.
   * @param {number} col
   */
  async function handleDrop(col) {
    if (menuManager.isInMenu || menuManager.isTransitioning || isDropping || isAiThinking || isCpuTurn() || game.isOver) {
      return;
    }

    const availableRow = game.getLowestAvailableRow(col);
    if (availableRow < 0) {
      boardRenderer.shakeActivePiece();
      return;
    }

    if (col !== activeColumn) {
      const currentGen = matchGeneration;
      const startCol = activeColumn;
      isDropping = true;
      activeColumn = col;
      const moved = await boardRenderer.moveCursorSequentially(
        startCol,
        col,
        game.currentPlayer,
        (c) => game.getLowestAvailableRow(c),
        () => matchGeneration !== currentGen || menuManager.isInMenu
      );
      if (!moved) {
        isDropping = false;
        return;
      }
    }

    await executeMove(col);
  }

  // Initialize Menu Manager
  const menuManager = new MenuManager({
    introScreenEl: document.getElementById('intro-screen'),
    mainViewEl: document.getElementById('menuMainView'),
    gameStyleViewEl: document.getElementById('menuGameStyleView'),
    algoViewEl: document.getElementById('menuAlgoView'),
    characterViewEl: document.getElementById('menuCharacterView'),
    depthViewEl: document.getElementById('menuDepthView'),
    howToPlayViewEl: document.getElementById('menuHowToPlayView'),
    btnHumanVsHuman: document.getElementById('btnHumanVsHuman'),
    btnHumanVsAi: document.getElementById('btnHumanVsAi'),
    btnStyleFirstFour: document.getElementById('btnStyleFirstFour'),
    btnStyleFullBoard: document.getElementById('btnStyleFullBoard'),
    btnBackToMainFromStyle: document.getElementById('btnBackToMainFromStyle'),
    btnAlgoMinimax: document.getElementById('btnAlgoMinimax'),
    btnAlgoAlphaBeta: document.getElementById('btnAlgoAlphaBeta'),
    btnChooseShadow: document.getElementById('btnChooseShadow'),
    btnChooseTails: document.getElementById('btnChooseTails'),
    btnBackToAlgo: document.getElementById('btnBackToAlgo'),
    inputMaxLevels: document.getElementById('inputMaxLevels'),
    btnDepthMinus: document.getElementById('btnDepthMinus'),
    btnDepthPlus: document.getElementById('btnDepthPlus'),
    btnStartAiMatch: document.getElementById('btnStartAiMatch'),
    btnBackToCharacter: document.getElementById('btnBackToCharacter'),
    btnHowToPlay: document.getElementById('btnHowToPlay'),
    btnCloseHowToPlay: document.getElementById('btnCloseHowToPlay'),
    btnBackToModes: document.getElementById('btnBackToModes'),
    panelLeft: panels[1],
    panelRight: panels[2],
    centerSection: document.querySelector('.center'),
    onStartGame: (mode, options = {}) => {
      currentMode = mode;
      currentGameStyle = typeof options.gameStyle === 'number' ? options.gameStyle : GAME_STYLES.FIRST_FOUR;
      if (typeof options.algorithm === 'number') {
        currentAlgorithm = options.algorithm;
      }
      cpuPlayer = typeof options.cpuPlayer === 'number' ? options.cpuPlayer : AI_CONFIG.CPU_PLAYER;
      currentMaxLevels = typeof options.maxLevels === 'number' ? options.maxLevels : AI_CONFIG.MAX_LEVELS;
      resetMatch();
    }
  });

  // Action Bar Buttons: Restart & Return to Menu
  btnRestartEl?.addEventListener('click', () => {
    if (!menuManager.isInMenu && !menuManager.isTransitioning) {
      resetMatch();
    }
  });

  btnMenuEl?.addEventListener('click', () => {
    if (!menuManager.isInMenu && !menuManager.isTransitioning) {
      matchGeneration++;
      abortPendingAiMove();
      isDropping = false;
      confetti.stop();
      characterManager.resetStates();
      menuManager.returnToMenu();
    }
  });

  // Interactive Pointer / Mouse Hover & Click on Connect 4 Board
  boardEl?.addEventListener(
    'pointermove',
    (e) => {
      if (menuManager.isInMenu || menuManager.isTransitioning || isDropping || isAiThinking || isCpuTurn() || game.isOver) {
        return;
      }
      const hoveredCol = boardRenderer.getColumnFromClientX(e.clientX);
      if (hoveredCol !== null && hoveredCol !== activeColumn) {
        activeColumn = hoveredCol;
        syncUI();
      }
    },
    { passive: true }
  );

  boardEl?.addEventListener('click', (e) => {
    if (menuManager.isInMenu || menuManager.isTransitioning || isDropping || isAiThinking) {
      return;
    }
    if (game.isOver) {
      resetMatch();
      return;
    }
    if (isCpuTurn()) {
      return;
    }
    const clickedCol = boardRenderer.getColumnFromClientX(e.clientX);
    if (clickedCol !== null) {
      handleDrop(clickedCol);
    }
  });

  // Keyboard navigation & controls
  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'Enter', ' '].includes(e.key)) {
      if (!menuManager.isInMenu) {
        e.preventDefault();
      }
    }

    if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
      if (!menuManager.isInMenu && !menuManager.isTransitioning) {
        matchGeneration++;
        abortPendingAiMove();
        isDropping = false;
        confetti.stop();
        characterManager.resetStates();
        menuManager.returnToMenu();
        return;
      }
    }

    if (menuManager.isInMenu || menuManager.isTransitioning) {
      return;
    }

    if (e.key === 'r' || e.key === 'R') {
      resetMatch();
      return;
    }

    if (game.isOver) {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        resetMatch();
      }
      return;
    }

    if (isDropping || isAiThinking || isCpuTurn()) {
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      activeColumn = Math.max(0, activeColumn - 1);
      syncUI();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      activeColumn = Math.min(BOARD_CONFIG.COLS - 1, activeColumn + 1);
      syncUI();
    } else if (
      (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') &&
      !e.repeat
    ) {
      handleDrop(activeColumn);
    } else if (e.key >= '1' && e.key <= '7' && !e.repeat) {
      handleDrop(Number(e.key) - 1);
    }
  });

  // Initial setup: start in menu state
  document.body.classList.add('in-menu');
  characterManager.setIdle(1);
  characterManager.setIdle(2);
});
