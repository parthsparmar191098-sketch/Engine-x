// Diagnostic bootstrapper: loads every dependency one at a time so a failure
// names exactly which file/URL broke, instead of a generic "main.js failed".
function report(msg) {
  if (window.__atlasShow) window.__atlasShow(msg);
  else console.error('ATLAS BOOT:', msg);
}
async function step(label, fn) {
  try { return await fn(); }
  catch (err) {
    report('Failed to load: ' + label + '\n' + (err && err.message ? err.message : String(err)));
    throw err;
  }
}
(async () => {
  try {
    await step('three (3D library, from CDN)', () => import('three'));
    await step('three/addons: OrbitControls', () => import('three/addons/controls/OrbitControls.js'));
    await step('three/addons: RoomEnvironment', () => import('three/addons/environments/RoomEnvironment.js'));
    await step('three/addons: BufferGeometryUtils', () => import('three/addons/utils/BufferGeometryUtils.js'));
    await step('three/addons: RoundedBoxGeometry', () => import('three/addons/geometries/RoundedBoxGeometry.js'));
    await step('materials.js', () => import('./materials.js'));
    await step('geom.js', () => import('./geom.js'));
    await step('machines-index.js (all 8 machines)', () => import('./machines-index.js'));
    await step('viewer.js', () => import('./viewer.js'));
    await step('main.js (app)', () => import('./main.js'));
  } catch (e) {
    // already reported by step(); stop here so nothing half-runs.
  }
})();
