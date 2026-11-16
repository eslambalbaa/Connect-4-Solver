/**
 * @file constants.js
 * @description Centralized game configuration, board dimensions, choreographed 3D
 * animation sequences, and player constants for Connect 4: Shadow vs Tails.
 */

/** Board dimensions: standard 7 columns by 6 rows */
export const BOARD_CONFIG = Object.freeze({
  COLS: 7,
  ROWS: 6,
  TOTAL_CELLS: 42
});

/** Player identification and metadata */
export const PLAYERS = Object.freeze({
  1: {
    id: 1,
    name: 'Shadow',
    colorKey: 'p1',
    themeColor: '#ff1e38',
    modelId: 'model1',
    panelId: 'panel1',
    scoreId: 'score1'
  },
  2: {
    id: 2,
    name: 'Tails',
    colorKey: 'p2',
    themeColor: '#ffc61a',
    modelId: 'model2',
    panelId: 'panel2',
    scoreId: 'score2'
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

/** Animation clip definitions for 3D character models */
const SHADOW_PREFIX = 'shadow.qc_skeleton|';

export const MODEL_ANIMATIONS = Object.freeze({
  idle: {
    1: { name: SHADOW_PREFIX + 'boost', fade: 350, timeScale: 0.92 },
    2: { name: 'tl_jump_bunk_loop', fade: 350, timeScale: 0.92 }
  },
  win: {
    1: [
      // Stage 1: Shadow plants his feet and fires a sharp victorious Chaos Spear strike
      { name: SHADOW_PREFIX + 'chaosspearground', ms: 920, fade: 220, timeScale: 1.05, repetitions: 1 },
      // Stage 2: Seamless 0.00-pose transition into Chaos Blast charge & unleash
      { name: SHADOW_PREFIX + 'chaosblaststart', ms: 1320, fade: 160, timeScale: 1.0, repetitions: 1 },
      // Stage 3: Hovers in mid-air radiating victorious Chaos Blast energy
      { name: SHADOW_PREFIX + 'chaosblastloop', ms: 1350, fade: 150, timeScale: 0.72, repetitions: Infinity },
      // Stage 4: Smoothly descends into his calm, confident Ultimate Lifeform standing stance
      { name: SHADOW_PREFIX + 'idle', fade: 550, timeScale: 0.95, repetitions: Infinity }
    ],
    2: [
      // Stage 1: Tails bursts upward throwing both hands high above his head in celebration
      { name: 'tl_ph_astero_start', ms: 340, fade: 160, timeScale: 0.75, repetitions: 1 },
      // Stage 2: Executes a joyful aerial 360-degree celebratory spin
      { name: 'tl_dashring_loop', ms: 620, fade: 170, timeScale: 0.95, repetitions: 2 },
      // Stage 3: Hits his signature mid-air right-hand fist-pump victory pose with spinning twin tails
      { name: 'tl_jump_trick_02', ms: 1150, fade: 240, timeScale: 0.88, repetitions: Infinity },
      // Stage 4: Settles into a cheerful, upright aerial victory hover
      { name: 'tl_springjump_loop', fade: 360, timeScale: 0.82, repetitions: Infinity }
    ]
  },
  lose: {
    1: [
      // Stage 1: Shadow flinches back from the blow in shock
      { name: SHADOW_PREFIX + 'damage', ms: 310, fade: 170, timeScale: 0.85, repetitions: 1 },
      // Stage 2: Drops heavily onto one knee, bracing his hand down as his quills whip forward
      { name: SHADOW_PREFIX + 'stompland', ms: 440, fade: 210, timeScale: 0.92, repetitions: 1 },
      // Stage 3: Seamless 0.02-pose continuation into kneeling recovery, breathing slowly in defeat
      { name: SHADOW_PREFIX + 'squat', fade: 180, timeScale: 0.75, repetitions: Infinity }
    ],
    2: [
      // Stage 1: Tails loses balance in mid-air, stumbling and flailing his arms
      { name: 'tl_stumble_run_loop', ms: 480, fade: 160, timeScale: 0.85, repetitions: Infinity },
      // Stage 2: Twin tails lose lift as he drops downward
      { name: 'tl_jump_fall_loop', ms: 340, fade: 190, timeScale: 0.85, repetitions: Infinity },
      // Stage 3: Slumps onto the ground, breathing slowly with drooping twin tails
      { name: 'tl_damage_miss_loop', fade: 300, timeScale: 0.35, repetitions: Infinity }
    ]
  },
  draw: {
    1: [
      { name: SHADOW_PREFIX + 'stompland', ms: 440, fade: 220, timeScale: 0.95, repetitions: 1 },
      { name: SHADOW_PREFIX + 'idle', fade: 450, timeScale: 0.9, repetitions: Infinity }
    ],
    2: [
      { name: 'tl_landing', ms: 260, fade: 180, timeScale: 0.65, repetitions: 1 },
      { name: 'tl_springjump_loop', fade: 350, timeScale: 0.8, repetitions: Infinity }
    ]
  }
});
