import * as THREE from 'three';

// Physically-based presets. Tints are chosen to read as the real material on both light and dark grounds.
export const MATERIALS = {
  castIron:   { color: 0x6f757c, metalness: 0.55, roughness: 0.78 },
  castAlu:    { color: 0xb8bdc2, metalness: 0.75, roughness: 0.55 },
  aluminum:   { color: 0xc9cdd1, metalness: 0.85, roughness: 0.38 },
  steel:      { color: 0x9aa3ad, metalness: 0.9,  roughness: 0.35 },
  darkSteel:  { color: 0x55606b, metalness: 0.85, roughness: 0.45 },
  polished:   { color: 0xd6dadf, metalness: 1.0,  roughness: 0.14 },
  chrome:     { color: 0xe4e7ea, metalness: 1.0,  roughness: 0.08 },
  hardened:   { color: 0xaab3bc, metalness: 0.95, roughness: 0.28 },
  bronze:     { color: 0xb0885a, metalness: 0.9,  roughness: 0.35 },
  brass:      { color: 0xc9a85c, metalness: 0.9,  roughness: 0.32 },
  copper:     { color: 0xb87352, metalness: 0.95, roughness: 0.3 },
  babbitt:    { color: 0xd8d5cc, metalness: 0.8,  roughness: 0.4 },
  plastic:    { color: 0x2a2e33, metalness: 0.0,  roughness: 0.55 },
  plasticGray:{ color: 0x8d949b, metalness: 0.0,  roughness: 0.6 },
  rubber:     { color: 0x1f2226, metalness: 0.0,  roughness: 0.92 },
  ceramic:    { color: 0xf0ede4, metalness: 0.0,  roughness: 0.35 },
  paintRed:   { color: 0xb8362b, metalness: 0.2,  roughness: 0.45 },
  paintBlue:  { color: 0x2f5f9e, metalness: 0.2,  roughness: 0.45 },
  paintBlack: { color: 0x1c1f23, metalness: 0.3,  roughness: 0.5 },
  paintGray:  { color: 0x7b8289, metalness: 0.25, roughness: 0.5 },
  paintWhite: { color: 0xe8e9ea, metalness: 0.1,  roughness: 0.45 },
  exhaust:    { color: 0x5f5a55, metalness: 0.7,  roughness: 0.7 },
  inconel:    { color: 0x8f8a80, metalness: 0.9,  roughness: 0.4 },
  titanium:   { color: 0x9da2a6, metalness: 0.85, roughness: 0.42 },
  carbon:     { color: 0x2b2f33, metalness: 0.35, roughness: 0.4 },
  gasket:     { color: 0x4a4f55, metalness: 0.1,  roughness: 0.9 },
  oil:        { color: 0x8a5a12, metalness: 0.0,  roughness: 0.1, transparent: true, opacity: 0.55 },
  coolant:    { color: 0x29a3a8, metalness: 0.0,  roughness: 0.1, transparent: true, opacity: 0.35 },
  glass:      { color: 0x9fb8c8, metalness: 0.0,  roughness: 0.05, transparent: true, opacity: 0.35 },
  fire:       { color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.0, metalness: 0.0, roughness: 0.6, transparent: true, opacity: 0.0 },
  air:        { color: 0x6fb2ff, metalness: 0.0, roughness: 0.3, transparent: true, opacity: 0.25 },
};

export function makeMaterial(key, overrides = {}) {
  const spec = MATERIALS[key] || MATERIALS.steel;
  const m = new THREE.MeshStandardMaterial({
    color: spec.color, metalness: spec.metalness, roughness: spec.roughness,
    emissive: spec.emissive ?? 0x000000, emissiveIntensity: spec.emissiveIntensity ?? 1,
    transparent: !!spec.transparent, opacity: spec.opacity ?? 1,
    ...overrides,
  });
  m.userData.key = key;
  m.userData.baseOpacity = m.opacity;
  m.userData.baseTransparent = m.transparent;
  m.userData.baseEmissive = m.emissive.getHex();
  m.userData.baseEmissiveIntensity = m.emissiveIntensity;
  return m;
}
