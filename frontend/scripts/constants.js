/**
 * @file constants.js
 * @description Centralized game configuration, board dimensions, and slot constants
 * for Connect 4.
 */

/** Board dimensions: standard 7 columns by 6 rows */
export const BOARD_CONFIG = Object.freeze({
  COLS: 7,
  ROWS: 6,
  TOTAL_CELLS: 42
});

/** Player slot descriptors (character metadata lives in characters.js) */
export const PLAYERS = Object.freeze({
  1: {
    id: 1,
    colorKey: 'p1',
    modelId: 'model1',
    panelId: 'panel1',
    scoreId: 'score1',
    nameId: 'name1'
  },
  2: {
    id: 2,
    colorKey: 'p2',
    modelId: 'model2',
    panelId: 'panel2',
    scoreId: 'score2',
    nameId: 'name2'
  }
});

/** Supported game modes */
export const GAME_MODES = Object.freeze({
  HUMAN_VS_HUMAN: 'human_vs_human',
  HUMAN_VS_AI: 'human_vs_ai'
});

export const GAME_STYLES = Object.freeze({
  FULL_BOARD: 0,
  FIRST_FOUR: 1
});

export const AI_CONFIG = Object.freeze({
  ALGORITHMS: Object.freeze({
    MINIMAX: 0,
    ALPHA_BETA: 1
  }),
  DEFAULT_ALGORITHM: 0,
  CPU_PLAYER: 2,
  MAX_LEVELS: 6
});

/** Cinematic reaction timings (in milliseconds) */
export const REACTION_TIMING = Object.freeze({
  WINNER_DELAY_MS: 110,
  LOSER_DELAY_MS: 250,
  WIN_CELL_STAGGER_MS: 65
});
