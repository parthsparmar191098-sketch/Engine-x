import * as THREE from 'three';

// Material library, organized by family instead of one flat table. Each
// family is a small lookup of PBR presets (color / metalness / roughness,
// plus optional emissive or transparency), and the families are merged into
// a single registry below. Keeping them grouped makes it easy to see at a
// glance which finishes belong together (bare metals vs. painted vs. fluids).

const METAL_FINISHES = {
  castIron:  [0x6f757c, 0.55, 0.78],
  castAlu:   [0xb8bdc2, 0.75, 0.55],
  aluminum:  [0xc9cdd1, 0.85, 0.38],
  steel:     [0x9aa3ad, 0.90, 0.35],
  darkSteel: [0x55606b, 0.85, 0.45],
  polished:  [0xd6dadf, 1.00, 0.14],
  chrome:    [0xe4e7ea, 1.00, 0.08],
  hardened:  [0xaab3bc, 0.95, 0.28],
  inconel:   [0x8f8a80, 0.90, 0.40],
  titanium:  [0x9da2a6, 0.85, 0.42],
};

const NONFERROUS_FINISHES = {
  bronze:  [0xb0885a, 0.90, 0.35],
  brass:   [0xc9a85c, 0.90, 0.32],
  copper:  [0xb87352, 0.95, 0.30],
  babbitt: [0xd8d5cc, 0.80, 0.40],
};

const NONMETAL_FINISHES = {
  plastic:     [0x2a2e33, 0.0, 0.55],
  plasticGray: [0x8d949b, 0.0, 0.60],
  rubber:      [0x1f2226, 0.0, 0.92],
  ceramic:     [0xf0ede4, 0.0, 0.35],
  gasket:      [0x4a4f55, 0.1, 0.90],
  carbon:      [0x2b2f33, 0.35, 0.40],
};

const PAINT_FINISHES = {
  paintRed:   [0xb8362b, 0.20, 0.45],
  paintBlue:  [0x2f5f9e, 0.20, 0.45],
  paintBlack: [0x1c1f23, 0.30, 0.50],
  paintGray:  [0x7b8289, 0.25, 0.50],
  paintWhite: [0xe8e9ea, 0.10, 0.45],
  exhaust:    [0x5f5a55, 0.70, 0.70],
};

// A tuple [color, metalness, roughness] is the common case; expand it into
// the descriptor shape the rest of this module works with.
function fromTuple([color, metalness, roughness]) {
  return { color, metalness, roughness };
}

function buildFinishGroup(tuples) {
  const out = {};
  for (const name of Object.keys(tuples)) out[name] = fromTuple(tuples[name]);
  return out;
}

// A few presets need transparency or an emissive glow and don't fit the
// plain [color, metalness, roughness] tuple shape, so they're written out
// in full here rather than forced into the table above.
const SPECIAL_FINISHES = {
  oil:     { color: 0x8a5a12, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.55 },
  coolant: { color: 0x29a3a8, metalness: 0.0, roughness: 0.1, transparent: true, opacity: 0.35 },
  glass:   { color: 0x9fb8c8, metalness: 0.0, roughness: 0.05, transparent: true, opacity: 0.35 },
  air:     { color: 0x6fb2ff, metalness: 0.0, roughness: 0.3, transparent: true, opacity: 0.25 },
  fire:    {
    color: 0xff7a1a, metalness: 0.0, roughness: 0.6,
    emissive: 0xff5a00, emissiveIntensity: 0.0,
    transparent: true, opacity: 0.0,
  },
};

export const MATERIALS = {
  ...buildFinishGroup(METAL_FINISHES),
  ...buildFinishGroup(NONFERROUS_FINISHES),
  ...buildFinishGroup(NONMETAL_FINISHES),
  ...buildFinishGroup(PAINT_FINISHES),
  ...SPECIAL_FINISHES,
};

const FALLBACK_FINISH = 'steel';

// Fields whose "resting" value the app needs to remember, so that visual
// effects (fade-outs, highlight glows, etc.) can be reset back to how the
// material was authored. Stashed under a stable set of userData keys rather
// than one ad-hoc block, so it's obvious at a glance what's being restored.
const RESTORE_FIELDS = [
  ['baseOpacity', (mat) => mat.opacity],
  ['baseTransparent', (mat) => mat.transparent],
  ['baseEmissive', (mat) => mat.emissive.getHex()],
  ['baseEmissiveIntensity', (mat) => mat.emissiveIntensity],
];

export function makeMaterial(key, overrides = {}) {
  const finish = MATERIALS[key] || MATERIALS[FALLBACK_FINISH];

  const mat = new THREE.MeshStandardMaterial({
    color: finish.color,
    metalness: finish.metalness,
    roughness: finish.roughness,
    emissive: finish.emissive ?? 0x000000,
    emissiveIntensity: finish.emissiveIntensity ?? 1,
    transparent: Boolean(finish.transparent),
    opacity: finish.opacity ?? 1,
    ...overrides,
  });

  mat.userData.key = key;
  for (const [field, read] of RESTORE_FIELDS) mat.userData[field] = read(mat);

  return mat;
}
