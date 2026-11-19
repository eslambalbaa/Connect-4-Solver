/**
 * @file characters.js
 * @description Character registry, theme derivation, 3D model framing helpers,
 * and choreographed animation configs for playable Connect 4 characters.
 */

const SHADOW_PREFIX = 'shadow.qc_skeleton|';

/**
 * Parses a 3-digit or 6-digit hex color string into RGB components.
 * Falls back to Sonic Blue (#1562f0) if invalid.
 *
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
export function parseHex(hex) {
  if (typeof hex !== 'string') {
    return { r: 21, g: 98, b: 240 };
  }
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return {
      r: Number.parseInt(clean[0] + clean[0], 16),
      g: Number.parseInt(clean[1] + clean[1], 16),
      b: Number.parseInt(clean[2] + clean[2], 16)
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: Number.parseInt(clean.slice(0, 2), 16),
      g: Number.parseInt(clean.slice(2, 4), 16),
      b: Number.parseInt(clean.slice(4, 6), 16)
    };
  }
  return { r: 21, g: 98, b: 240 };
}

/**
 * Converts a hex color into a comma-separated RGB triple string (`"r, g, b"`).
 * @param {string} hex
 * @returns {string}
 */
export function hexToRgbString(hex) {
  const { r, g, b } = parseHex(hex);
  return `${r}, ${g}, ${b}`;
}

/**
 * Linearly mixes two hex colors where `weight` is the proportion of `hexB` (0..1).
 * @param {string} hexA
 * @param {string} hexB
 * @param {number} weight
 * @returns {string}
 */
export function mixHex(hexA, hexB, weight = 0.5) {
  const t = Math.max(0, Math.min(1, Number(weight) || 0));
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/**
 * Computes relative luminance to check whether dark ink reads better over `hex`.
 * @param {string} hex
 * @returns {boolean}
 */
export function isLightHex(hex) {
  const { r, g, b } = parseHex(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

/**
 * Builds a complete visual theme object from a minimal `{ primary }` input,
 * honoring any explicit style overrides.
 *
 * @param {Object} [themeInput]
 * @returns {Object}
 */
export function buildTheme(themeInput = {}) {
  const primary = themeInput.primary || '#1562f0';
  const light = themeInput.light || mixHex(primary, '#ffffff', 0.52);
  const dark = themeInput.dark || mixHex(primary, '#071024', 0.48);
  const deep = mixHex(primary, '#050914', 0.68);
  const vividLight = mixHex(primary, '#ffffff', 0.34);
  const primaryIsLight = isLightHex(primary);

  const primaryRgb = hexToRgbString(primary);
  const lightRgb = hexToRgbString(light);

  return Object.freeze({
    primary,
    light,
    dark,
    accent: themeInput.accent || primary,
    tagColor: themeInput.tagColor || light,
    auraRgb: themeInput.auraRgb || primaryRgb,
    auraOuterRgb: themeInput.auraOuterRgb || hexToRgbString(mixHex(primary, dark, 0.25)),
    guideRgb: themeInput.guideRgb || primaryRgb,
    ringRgb: themeInput.ringRgb || lightRgb,
    glowRgb: themeInput.glowRgb || primaryRgb,
    statusBg:
      themeInput.statusBg ||
      `linear-gradient(135deg, ${mixHex(primary, '#ffffff', 0.14)} 0%, ${dark} 100%)`,
    discBg:
      themeInput.discBg ||
      `radial-gradient(circle at 34% 28%, ${mixHex(primary, '#ffffff', 0.68)}, ${primary} 45%, ${dark})`,
    discRim: themeInput.discRim || deep,
    matchupBg:
      themeInput.matchupBg ||
      `linear-gradient(180deg, #ffffff 0%, ${light} 25%, ${primary} 65%, ${dark} 100%)`,
    buttonBg:
      themeInput.buttonBg ||
      `linear-gradient(90deg, ${deep} 0%, ${dark} 38%, ${primary} 78%, ${vividLight} 100%)`,
    buttonText: themeInput.buttonText || (primaryIsLight ? 'var(--navy)' : '#ffffff'),
    buttonTextShadow:
      themeInput.buttonTextShadow ||
      (primaryIsLight ? '0 1px 0 rgba(255, 255, 255, 0.6)' : '0 2px 0 var(--navy)'),
    confettiColors: Object.freeze(
      Array.isArray(themeInput.confettiColors) && themeInput.confettiColors.length
        ? [...themeInput.confettiColors]
        : [primary, light, '#ffffff', '#ffc61a', dark]
    )
  });
}

/**
 * Produces a high-contrast Player 2 theme for mirror matches when both slots use the same character.
 * @param {Object} character
 * @returns {Object}
 */
export function buildMirrorTheme(character) {
  if (character.mirrorThemeInput) {
    return buildTheme(character.mirrorThemeInput);
  }
  const { r, b } = parseHex(character.theme.primary);
  const isBlueOrCyan = b > 170 && r < 120;
  return buildTheme(
    isBlueOrCyan
      ? {
          primary: '#e6228d',
          light: '#ff8fd0',
          dark: '#85094e',
          discRim: '#5c0535'
        }
      : {
          primary: '#00b8ff',
          light: '#9be7ff',
          dark: '#005fa3',
          discRim: '#043c6b'
        }
  );
}

/**
 * Normalizes a raw character definition, supplying safe defaults for optional framing,
 * CSS viewport sizing, and animation fields.
 *
 * @param {Object} raw
 * @returns {Object}
 */
export function normalizeCharacter(raw) {
  const theme = buildTheme(raw.theme || {});
  const model = Object.freeze({
    scale: raw.model?.scale || '0.85 0.85 0.85',
    cameraTarget: raw.model?.cameraTarget || '0m 0.25m 0m',
    orbitAzimuthDeg: Number.isFinite(raw.model?.orbitAzimuthDeg) ? raw.model.orbitAzimuthDeg : 55,
    orbitPolarDeg: Number.isFinite(raw.model?.orbitPolarDeg) ? raw.model.orbitPolarDeg : 82,
    orbitRadius: raw.model?.orbitRadius || 'auto',
    cameraOrbitLeft: raw.model?.cameraOrbitLeft || null,
    cameraOrbitRight: raw.model?.cameraOrbitRight || null
  });
  const viewport = Object.freeze({
    bottom: raw.viewport?.bottom || '-25%',
    width: raw.viewport?.width || '125%',
    height: raw.viewport?.height || '125%',
    translateXLeft: raw.viewport?.translateXLeft || '-50%',
    translateXRight: raw.viewport?.translateXRight || '-50%'
  });
  const animations = Object.freeze({
    idle: raw.animations?.idle || null,
    win: Object.freeze([...(raw.animations?.win || [])]),
    lose: Object.freeze([...(raw.animations?.lose || [])]),
    draw: Object.freeze([...(raw.animations?.draw || [])])
  });

  const normalized = {
    id: String(raw.id),
    name: String(raw.name),
    modelSrc: String(raw.modelSrc),
    winSpriteMotion: raw.winSpriteMotion === 'hover' ? 'hover' : 'ground',
    theme,
    mirrorThemeInput: raw.mirrorTheme || null,
    model,
    viewport,
    animations
  };

  normalized.mirrorTheme = buildMirrorTheme(normalized);
  return Object.freeze(normalized);
}

/* ==========================================================================
   Character Registry
   ==========================================================================
   To add a new 3D character:
   1. Put your .glb file in `frontend/assets/models/<name>.glb`
   2. Add an entry to `RAW_CHARACTERS` below (minimal example):

   {
     id: 'sonic',
     name: 'Sonic',
     modelSrc: 'assets/models/sonic.glb',
     theme: { primary: '#1562f0' },
     // Optional overrides once you inspect the model with `c4Characters.inspect()`:
     // model: { scale: '0.85 0.85 0.85', cameraTarget: '0m 0.25m 0m', orbitAzimuthDeg: 55, orbitPolarDeg: 82, orbitRadius: 'auto' },
     // viewport: { bottom: '-25%', width: '125%', height: '125%', translateXLeft: '-50%', translateXRight: '-50%' },
     // winSpriteMotion: 'ground', // 'ground' or 'hover'
     // animations: {
     //   idle: { name: 'idle_clip_name', fade: 350, timeScale: 1.0 },
     //   win: [{ name: 'win_clip', fade: 250, timeScale: 1.0, repetitions: Infinity }],
     //   lose: [{ name: 'lose_clip', fade: 250, timeScale: 1.0, repetitions: Infinity }],
     //   draw: [{ name: 'draw_clip', fade: 250, timeScale: 1.0, repetitions: Infinity }]
     // }
   }
   ========================================================================== */

const RAW_CHARACTERS = [
  {
    id: 'shadow',
    name: 'Shadow',
    modelSrc: 'assets/models/shadow.glb',
    winSpriteMotion: 'ground',
    theme: {
      primary: '#ff1e38',
      light: '#ff8592',
      dark: '#820612',
      accent: '#ff1e38',
      tagColor: '#ff8592',
      auraRgb: '255, 30, 56',
      auraOuterRgb: '255, 30, 56',
      guideRgb: '255, 65, 30',
      ringRgb: '255, 100, 80',
      glowRgb: '255, 30, 56',
      statusBg: 'linear-gradient(135deg, #ff3850 0%, #b80d21 100%)',
      discBg: 'radial-gradient(circle at 34% 28%, #ff9494, #ff1e38 44%, #820612)',
      discRim: '#14141c',
      matchupBg: 'linear-gradient(180deg, #ffffff 0%, #ff8592 25%, #ff1e38 65%, #a80014 100%)',
      buttonBg: 'linear-gradient(90deg, #161822 0%, #99071a 38%, #ff1e38 100%)',
      buttonText: '#ffffff',
      buttonTextShadow: '0 2px 0 var(--navy)',
      confettiColors: ['#ff1e38', '#ff8592', '#ffffff', '#ffc61a', '#14141c']
    },
    model: {
      scale: '0.78 0.78 0.78',
      cameraTarget: '0m 0.2m 0m',
      orbitAzimuthDeg: 55,
      orbitPolarDeg: 82,
      orbitRadius: 'auto'
    },
    viewport: {
      bottom: '-102%',
      width: '122%',
      height: '230%',
      translateXLeft: '-52%',
      translateXRight: '-48%'
    },
    animations: {
      idle: { name: SHADOW_PREFIX + 'boost', fade: 350, timeScale: 0.92 },
      win: [
        // Stage 1: Shadow plants his feet and fires a sharp victorious Chaos Spear strike
        { name: SHADOW_PREFIX + 'chaosspearground', ms: 1000, fade: 200, timeScale: 1.05, repetitions: Infinity },
        // Stage 2: Seamless transition into Chaos Blast charge & unleash
        { name: SHADOW_PREFIX + 'chaosblaststart', ms: 1220, fade: 160, timeScale: 0.92, repetitions: Infinity },
        // Stage 3: Hovers in mid-air radiating victorious Chaos Blast energy
        { name: SHADOW_PREFIX + 'chaosblastloop', ms: 850, fade: 180, timeScale: 0.78, repetitions: Infinity },
        // Stage 4: Smoothly descends into his calm, confident Ultimate Lifeform standing stance
        { name: SHADOW_PREFIX + 'idle', fade: 480, timeScale: 0.95, repetitions: Infinity }
      ],
      lose: [
        // Stage 1: Shadow flinches back from the blow in shock
        { name: SHADOW_PREFIX + 'damage', ms: 330, fade: 170, timeScale: 0.85, repetitions: Infinity },
        // Stage 2: Drops heavily onto one knee, bracing his hand down as his quills whip forward
        { name: SHADOW_PREFIX + 'stompland', ms: 350, fade: 200, timeScale: 0.78, repetitions: Infinity },
        // Stage 3: Smooth continuation into kneeling recovery, breathing slowly in defeat
        { name: SHADOW_PREFIX + 'squat', fade: 200, timeScale: 0.78, repetitions: Infinity }
      ],
      draw: [
        // Stage 1: Upright deceleration walk before settling
        { name: SHADOW_PREFIX + 'walk', ms: 420, fade: 220, timeScale: 1.45, repetitions: Infinity },
        // Stage 2: Calm standing stance
        { name: SHADOW_PREFIX + 'idle', fade: 380, timeScale: 0.95, repetitions: Infinity }
      ]
    }
  },
  {
    id: 'tails',
    name: 'Tails',
    modelSrc: 'assets/models/tails.glb',
    winSpriteMotion: 'hover',
    theme: {
      primary: '#ffc61a',
      light: '#fff394',
      dark: '#c47d00',
      accent: '#ff9a1f',
      tagColor: '#ffc61a',
      auraRgb: '255, 198, 26',
      auraOuterRgb: '255, 154, 31',
      guideRgb: '255, 198, 26',
      ringRgb: '255, 215, 64',
      glowRgb: '255, 215, 0',
      statusBg: 'linear-gradient(135deg, #ffbe2e 0%, #e07b00 100%)',
      discBg: 'radial-gradient(circle at 34% 28%, #fff6ad, #ffc61a 45%, #c47d00)',
      discRim: '#9e6200',
      matchupBg: 'linear-gradient(180deg, #ffffff 0%, #fff394 25%, #ffc61a 65%, #e06d00 100%)',
      buttonBg: 'linear-gradient(90deg, #ff8c00 0%, #ffb800 24%, #ffdd19 65%, #ffea47 100%)',
      buttonText: 'var(--navy)',
      buttonTextShadow: '0 1px 0 rgba(255, 255, 255, 0.6)',
      confettiColors: ['#ffc61a', '#fff394', '#ff9a1f', '#ffffff', '#1b5fe0']
    },
    model: {
      scale: '0.88 0.88 0.88',
      cameraTarget: '0m 0.3m 0m',
      orbitAzimuthDeg: 55,
      orbitPolarDeg: 82,
      orbitRadius: 'auto'
    },
    viewport: {
      bottom: '-31%',
      width: '140%',
      height: '140%',
      translateXLeft: '-53%',
      translateXRight: '-47%'
    },
    animations: {
      idle: { name: 'tl_jump_bunk_loop', fade: 350, timeScale: 0.92 },
      win: [
        // Stage 1: Tails bursts upward throwing both hands high above his head in celebration
        { name: 'tl_ph_astero_start', ms: 280, fade: 160, timeScale: 0.52, repetitions: Infinity },
        // Stage 2: Executes a joyful aerial celebratory spin
        { name: 'tl_dashring_loop', ms: 700, fade: 160, timeScale: 0.95, repetitions: Infinity },
        // Stage 3: Hits his signature mid-air right-hand fist-pump victory pose with spinning twin tails
        { name: 'tl_jump_trick_02', ms: 1150, fade: 220, timeScale: 0.9, repetitions: Infinity },
        // Stage 4: Settles into a cheerful, upright aerial victory hover
        { name: 'tl_springjump_loop', fade: 380, timeScale: 0.82, repetitions: Infinity }
      ],
      lose: [
        // Stage 1: Tails loses balance in mid-air, stumbling and flailing his arms
        { name: 'tl_stumble_run_loop', ms: 440, fade: 160, timeScale: 0.85, repetitions: Infinity },
        // Stage 2: Twin tails lose lift as he drops downward
        { name: 'tl_jump_fall_loop', ms: 340, fade: 190, timeScale: 0.85, repetitions: Infinity },
        // Stage 3: Slumps onto the ground, breathing slowly with drooping twin tails
        { name: 'tl_damage_miss_loop', fade: 300, timeScale: 0.35, repetitions: Infinity }
      ],
      draw: [
        // Stage 1: Smooth deceleration run before hovering
        { name: 'tl_run_loop', ms: 420, fade: 220, timeScale: 1.0, repetitions: Infinity },
        // Stage 2: Upright aerial hover
        { name: 'tl_springjump_loop', fade: 380, timeScale: 0.82, repetitions: Infinity }
      ]
    }
  },
  {
    id: 'sonic',
    name: 'Sonic',
    modelSrc: 'assets/models/sonic.glb',
    winSpriteMotion: 'ground',
    theme: {
      primary: '#0066ff',
      light: '#6be0ff',
      dark: '#002fa7',
      accent: '#0066ff',
      tagColor: '#52d9ff',
      auraRgb: '0, 148, 255',
      auraOuterRgb: '0, 216, 255',
      guideRgb: '0, 168, 255',
      ringRgb: '95, 226, 255',
      glowRgb: '0, 150, 255',
      statusBg: 'linear-gradient(135deg, #1aa3ff 0%, #0044cc 100%)',
      discBg: 'radial-gradient(circle at 34% 28%, #aef0ff, #0077ff 45%, #002b8f)',
      discRim: '#041a52',
      matchupBg: 'linear-gradient(180deg, #ffffff 0%, #8be8ff 26%, #0077ff 66%, #002fa7 100%)',
      buttonBg: 'linear-gradient(90deg, #002fa7 0%, #0066ff 48%, #24b4ff 100%)',
      buttonText: '#ffffff',
      buttonTextShadow: '0 2px 0 var(--navy)',
      confettiColors: ['#0077ff', '#6be0ff', '#ffffff', '#ffc61a', '#ff1e38']
    },
    model: {
      scale: '0.78 0.78 0.78',
      cameraTarget: '0m 0.1m 0m',
      orbitAzimuthDeg: 55,
      orbitPolarDeg: 82,
      orbitRadius: 'auto'
    },
    viewport: {
      bottom: '-100%',
      width: '122%',
      height: '228%',
      translateXLeft: '-52%',
      translateXRight: '-48%'
    },
    animations: {
      idle: { name: 'airboost', fade: 350, timeScale: 0.92 },
      win: [
        // Stage 1: Sonic curls into a rapid supersonic Spin Ball burst
        { name: 'Jump ball/Spin ball', ms: 520, fade: 150, timeScale: 0.92, repetitions: Infinity },
        // Stage 2: Bursts out of Spin Ball into an aerial Homing Attack twist strike (blends before 750ms snap)
        { name: 'homing attack', ms: 580, fade: 140, timeScale: 0.92, repetitions: Infinity },
        // Stage 3: Surges into a triumphant supersonic boost sprint
        { name: 'boost', ms: 1200, fade: 180, timeScale: 1.75, repetitions: Infinity },
        // Stage 4: Touches down cleanly into his relaxed, confident standing stance
        { name: 'Standing/idle', fade: 420, timeScale: 0.95, repetitions: Infinity }
      ],
      lose: [
        // Stage 1: Sonic recoils backward from the blow in shock
        { name: 'taken damage', ms: 330, fade: 170, timeScale: 0.85, repetitions: Infinity },
        // Stage 2: Drops hard onto one knee bracing his hand down
        { name: 'stomp land', ms: 350, fade: 200, timeScale: 0.78, repetitions: Infinity },
        // Stage 3: Smooth continuation into low kneeling crouch in defeat
        { name: 'Ducking/squat', fade: 200, timeScale: 0.78, repetitions: Infinity }
      ],
      draw: [
        // Stage 1: Upright deceleration walk before settling
        { name: 'walking', ms: 420, fade: 220, timeScale: 1.45, repetitions: Infinity },
        // Stage 2: Pops upright into his calm standing stance
        { name: 'Standing/idle', fade: 380, timeScale: 0.95, repetitions: Infinity }
      ]
    }
  }
];

export const CHARACTER_LIST = Object.freeze(RAW_CHARACTERS.map(normalizeCharacter));

export const CHARACTERS = Object.freeze(
  CHARACTER_LIST.reduce((acc, character) => {
    acc[character.id] = character;
    return acc;
  }, {})
);

export const DEFAULT_MATCHUP = Object.freeze({
  1: 'shadow',
  2: 'tails'
});

/**
 * Looks up a character by ID, falling back to the first registered character.
 * @param {string} id
 * @returns {Object}
 */
export function getCharacter(id) {
  return CHARACTERS[id] || CHARACTER_LIST[0];
}

/**
 * Resolves the effective theme for a slot, swapping to an alternate high-contrast theme
 * on Slot 2 when both players pick the same character.
 *
 * @param {Object} character
 * @param {number} slotId - 1 or 2
 * @param {boolean} [isMirror=false]
 * @returns {Object}
 */
export function getEffectiveTheme(character, slotId, isMirror = false) {
  if (isMirror && slotId === 2) {
    return character.mirrorTheme;
  }
  return character.theme;
}

/**
 * Computes the <model-viewer> `camera-orbit` string so characters always face toward the board.
 * @param {Object} character
 * @param {number} slotId - 1 (left) or 2 (right)
 * @returns {string}
 */
export function getCameraOrbitForSlot(character, slotId) {
  if (slotId === 1 && character.model.cameraOrbitLeft) {
    return character.model.cameraOrbitLeft;
  }
  if (slotId === 2 && character.model.cameraOrbitRight) {
    return character.model.cameraOrbitRight;
  }
  const azimuth = slotId === 1 ? -character.model.orbitAzimuthDeg : character.model.orbitAzimuthDeg;
  return `${azimuth}deg ${character.model.orbitPolarDeg}deg ${character.model.orbitRadius}`;
}

/**
 * Resolves slot-specific CSS positioning for the character's <model-viewer> box.
 * @param {Object} character
 * @param {number} slotId - 1 or 2
 * @returns {{ bottom: string, width: string, height: string, translateX: string }}
 */
export function getViewportStylesForSlot(character, slotId) {
  return {
    bottom: character.viewport.bottom,
    width: character.viewport.width,
    height: character.viewport.height,
    translateX: slotId === 1 ? character.viewport.translateXLeft : character.viewport.translateXRight
  };
}

/**
 * Builds the CSS custom property map for a given player slot and resolved theme.
 * @param {Object} theme
 * @param {number} slotId - 1 or 2
 * @returns {Record<string, string>}
 */
export function getSlotCssVars(theme, slotId) {
  const prefix = `--p${slotId}`;
  return {
    [`${prefix}-accent`]: theme.accent,
    [`${prefix}-tag`]: theme.tagColor,
    [`${prefix}-aura-rgb`]: theme.auraRgb,
    [`${prefix}-aura-outer-rgb`]: theme.auraOuterRgb,
    [`${prefix}-guide-rgb`]: theme.guideRgb,
    [`${prefix}-ring-rgb`]: theme.ringRgb,
    [`${prefix}-status-bg`]: theme.statusBg,
    [`${prefix}-disc-bg`]: theme.discBg,
    [`${prefix}-disc-rim`]: theme.discRim,
    [`${prefix}-matchup-bg`]: theme.matchupBg
  };
}
