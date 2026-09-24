// Five-speed manual gearbox (rear-drive layout, constant mesh, synchromesh). Shaft axis = X, input at −X.
import * as THREE from 'three';
import * as G from './geom.js';

const { TAU, DEG, V3 } = G;
const M = 2.5, C = 70, HELIX = 25;                       // module, centre distance, helix angle
const IN_T = 22, CS_IN_T = 34;                            // input gear / countershaft drive gear teeth
// mainshaft gears: [name, x, countershaft teeth, mainshaft teeth]
const GEARS = { 3: ['3rd', -60, 27, 29], 2: ['2nd', 0, 22, 34], 1: ['1st', 60, 16, 40], R: ['Reverse', 120, 15, 38], 5: ['5th', 180, 36, 20] };
const HUBS = [{ id: 'hub-34', x: -100, lo: '4', hi: '3' }, { id: 'hub-12', x: 30, lo: '2', hi: '1' }, { id: 'hub-5r', x: 150, lo: 'R', hi: '5' }];
const MODES = ['1st', '2nd', '3rd', '4th', '5th', 'Reverse', 'Neutral'];
const MODE_KEY = ['1', '2', '3', '4', '5', 'R', 'N'];
const IDLER = { y: -57.8, z: 39.4, teeth: 18 };

const INFO = {
  input: { desc: 'The input shaft is driven by the clutch. Its gear is in constant mesh with the countershaft, so whenever the clutch is engaged the countershaft and every gear on the mainshaft are already turning.', block: { drive: 'Clutch disc spline', gear: `${IN_T} teeth` } },
  counter: { desc: 'The countershaft (layshaft) is a one-piece cluster of gears turning below the mainshaft. It is driven by the input shaft and drives all the mainshaft gears at once; the ratio you get depends only on which mainshaft gear is locked to its shaft.', notes: ['One machined forging; the gears cannot be replaced separately.', 'Turns in the opposite direction to the input shaft at 22/34 of its speed.'], block: { gears: '6 (drive, 5, R, 1, 2, 3)', material: 'Case-hardened steel forging' } },
  main: { desc: 'The mainshaft (output shaft) carries the free-spinning gears and the synchronizer hubs. Only the hubs are splined to it; the gears ride on needle bearings until a sleeve locks one of them in.', notes: ['In 4th gear the input shaft is locked straight to the mainshaft and the countershaft just idles along: direct drive, 1 : 1.'], block: { output: 'Slip-yoke spline to propshaft', material: 'Case-hardened steel' } },
  gear: { desc: 'A helical gear on the mainshaft, always meshed with its partner on the countershaft and always turning. It becomes “selected” only when the synchronizer sleeve next to it slides over its dog teeth and locks it to the shaft.', notes: ['Helical teeth engage gradually and quietly; the price is an axial thrust the bearings must take.', 'The small ring of dog teeth on its side is what the sleeve engages.'], block: { module: '2.5 mm', helix: '25°', bearing: 'Needle rollers on the shaft' } },
  hub: { desc: 'A synchronizer hub, splined to the mainshaft. The sleeve slides on its outer splines; the blocking rings sit on either side. It spins with the shaft at all times.', block: { fixed: 'Splined to mainshaft' } },
  sleeve: { desc: 'The synchronizer sleeve. The shift fork slides it toward a gear; the blocking ring first matches the gear’s speed to the shaft by friction, and only then can the sleeve pass over the ring and engage the gear’s dog teeth. That friction pause is the “synchro” that stopped drivers double-declutching.', notes: ['Moves about 12 mm to engage.'], block: { travel: '± 12 mm', teeth: 'Internal dog teeth' } },
  blocker: { desc: 'A blocking ring (synchro ring): a brass or sintered cone that rubs on the gear’s cone to bring it to shaft speed. Its outer teeth block the sleeve until the speeds match.', block: { material: 'Brass or carbon-lined steel', cone: '≈ 7° half-angle' } },
  fork: { desc: 'A shift fork rides in the groove of a sleeve and pushes it left or right. Each fork is fixed to a shift rail.', block: { material: 'Cast iron or steel' } },
  rail: { desc: 'A shift rail: a rod carrying one fork. A detent ball holds it in each position and an interlock stops two rails moving at once, so two gears cannot be selected together.', block: { positions: '3, with detents' } },
  lever: { desc: 'The gear lever. Sideways motion chooses a rail, fore and aft motion slides it. Shown in the position of the selected gear.', block: { pattern: 'H, 5 forward + R' } },
  idler: { desc: 'The reverse idler gear. Reverse needs the output to turn the other way, so a third gear is put between the countershaft and the mainshaft reverse gear. It is a straight-cut spur gear, which is why reverse whines.', block: { teeth: '18, spur' } },
  bearing: { desc: 'A shaft bearing. Tapered rollers or deep-groove balls: they carry the gear loads and the axial thrust from the helical teeth.', block: { type: 'Deep-groove ball / taper roller' } },
  case: { desc: 'The gearbox case, cast aluminum, holding the three shafts at exact centre distances and about two litres of oil that the countershaft flings over everything.', block: { material: 'Cast aluminum', oil: '≈ 2 L, 75W-90' } },
  bell: { desc: 'The bell housing bolts to the engine and encloses the clutch. The input shaft and its bearing retainer pass through its centre.', block: { material: 'Cast aluminum' } },
  ext: { desc: 'The extension housing carries the output shaft’s rear bearing and the propeller-shaft slip yoke.', block: { seal: 'Lip seal on the slip yoke' } },
  flange: { desc: 'The output yoke (or flange) to the propeller shaft.', block: { drive: 'Splined slip yoke' } },
};

function toothPhase(center, target, N, gap) {
  // rotation about X (base) so a tooth (or gap) of an X-axis gear points from `center` toward `target` in the YZ plane
  const dy = target[0] - center[0], dz = target[1] - center[1];
  let a = Math.atan2(dy, -dz);
  if (gap) a += Math.PI / N;
  return a;
}
const gearX = (N, thick, opts = {}) => G.place(G.gear(N, M, thick, { helix: opts.helix ?? HELIX, bore: opts.bore ?? 14 }), { ry: Math.PI / 2 });

function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };

  yield 'shafts';
  const input = add({ id: 'input', name: 'Input shaft', system: 'shafts', geo: G.merge([G.cyl(14, 180, { axis: 'x', x: -210 }), G.cyl(11, 60, { axis: 'x', x: -320, seg: 24 }), G.cyl(16, 40, { axis: 'x', x: -128 })]), mat: 'steel', ex: [-200, 0, 0] }, 'input');
  parts.input = input;
  const inGearPhase = toothPhase([0, 0], [-C, 0], IN_T, false);
  add({ id: 'input-gear', name: `Input gear (${IN_T} teeth, drives countershaft)`, system: 'gears', parent: 'input', geo: G.merge([G.place(gearX(IN_T, 22), { x: -140 }), G.place(G.gear(26, 1.6, 6, { bore: 12 }), { ry: Math.PI / 2, x: -122 })]), mat: 'hardened', rot: [inGearPhase, 0, 0], ex: [-160, 0, 0] }, 'gear');
  P.get('input-gear').userData = { phase: inGearPhase };
  // countershaft cluster
  const csList = [G.cyl(13, 380, { axis: 'x', x: 20 })];
  const csPhaseIn = toothPhase([-C, 0], [0, 0], CS_IN_T, true);
  csList.push(G.place(gearX(CS_IN_T, 22), { rx: csPhaseIn, x: -140 }));
  for (const k of Object.keys(GEARS)) { const [, x, csT] = GEARS[k]; const ph = k === 'R' ? toothPhase([-C, 0], [IDLER.y, IDLER.z], csT, false) : toothPhase([-C, 0], [0, 0], csT, true); csList.push(G.place(gearX(csT, k === 'R' ? 16 : 20, k === 'R' ? { helix: 0 } : {}), { rx: ph, x })); }
  const counter = add({ id: 'countershaft', name: 'Countershaft cluster gear', system: 'gears', geo: G.merge(csList), mat: 'hardened', pos: [0, -C, 0], ex: [0, -160, 0] }, 'counter');
  parts.counter = counter;
  const main = add({ id: 'mainshaft', name: 'Mainshaft (output shaft)', system: 'shafts', geo: G.merge([G.cyl(14, 420, { axis: 'x', x: 90 }), G.cyl(9, 60, { axis: 'x', x: 330 })]), mat: 'steel', ex: [200, 0, 0] }, 'main');
  parts.main = main;
  add({ id: 'output-flange', name: 'Output slip yoke', system: 'shafts', parent: 'mainshaft', geo: G.merge([G.cyl(22, 60, { axis: 'x', x: 335 }), G.box(60, 40, 12, { x: 372, y: 0, z: 14 }), G.box(60, 40, 12, { x: 372, z: -14 })]), mat: 'steel', ex: [120, 0, 0] }, 'flange');

  yield 'mainshaft gears';
  parts.gears = {};
  for (const k of Object.keys(GEARS)) {
    const [name, x, csT, msT] = GEARS[k];
    const ph = k === 'R' ? toothPhase([0, 0], [IDLER.y, IDLER.z], msT, true) : toothPhase([0, 0], [-C, 0], msT, false);
    const hubSide = k === '3' || k === '2' || k === 'R' ? 1 : -1;   // which side the synchro hub is on (+x or −x)
    const g = add({ id: `gear-${k}`, name: `${name} gear (${msT} teeth)`, system: 'gears', geo: G.merge([G.place(gearX(msT, k === 'R' ? 16 : 20, k === 'R' ? { helix: 0 } : {}), { x }), G.place(G.gear(30, 1.6, 6, { bore: 12 }), { ry: Math.PI / 2, x: x + hubSide * 14 }), G.cone(19, 15, 6, { axis: 'x', x: x + hubSide * 20 })]), mat: 'hardened', rot: [ph, 0, 0], ex: [0, 80, 0] }, 'gear');
    g.userData = { phase: ph, ratio: (CS_IN_T / IN_T) * (msT / csT), k };
    parts.gears[k] = g;
  }
  const idPh = toothPhase([IDLER.y, IDLER.z], [-C, 0], IDLER.teeth, true);
  const idler = add({ id: 'idler', name: 'Reverse idler gear', system: 'gears', geo: G.merge([G.place(gearX(IDLER.teeth, 16, { helix: 0, bore: 8 }), { x: 120 })]), mat: 'hardened', pos: [0, IDLER.y, IDLER.z], rot: [idPh, 0, 0], ex: [0, -40, 120] }, 'idler');
  idler.userData = { phase: idPh };
  parts.idler = idler;
  add({ id: 'idler-shaft', name: 'Reverse idler shaft', system: 'shafts', geo: G.cyl(7, 60, { axis: 'x', x: 120 }), mat: 'steel', pos: [0, IDLER.y, IDLER.z], ex: [0, -40, 160] }, 'bearing');

  yield 'synchronizers';
  parts.hubs = [];
  HUBS.forEach(h => {
    add({ id: h.id, name: `Synchronizer hub (${h.lo === '4' ? '3–4' : h.lo === '2' ? '1–2' : '5–R'})`, system: 'synchro', parent: 'mainshaft', geo: G.place(G.gear(36, 1.6, 22, { bore: 14 }), { ry: Math.PI / 2, x: h.x }), mat: 'steel', ex: [0, 60, 0] }, 'hub');
    const sleeve = add({ id: h.id + '-sleeve', name: `Synchronizer sleeve (${h.lo === '4' ? '3–4' : h.lo === '2' ? '1–2' : '5–R'})`, system: 'synchro', parent: 'mainshaft', geo: G.merge([G.annulus(38, 30, 24, { axis: 'x', x: h.x }), G.annulus(43, 38, 8, { axis: 'x', x: h.x - 8 }), G.annulus(43, 38, 8, { axis: 'x', x: h.x + 8 })]), mat: 'polished', ex: [0, 100, 0] }, 'sleeve');
    [-1, 1].forEach(s => add({ id: `${h.id}-ring${s > 0 ? 'b' : 'a'}`, name: `Blocking ring (${s < 0 ? h.lo : h.hi})`, system: 'synchro', parent: 'mainshaft', geo: G.merge([G.cone(20, 17, 7, { axis: 'x', x: h.x + s * 17 }), G.place(G.gear(30, 1.6, 3, { bore: 17 }), { ry: Math.PI / 2, x: h.x + s * 12 })]), mat: 'brass', ex: [0, 60, 0] }, 'blocker'));
    const fork = add({ id: h.id + '-fork', name: `Shift fork (${h.lo === '4' ? '3–4' : h.lo === '2' ? '1–2' : '5–R'})`, system: 'shift', geo: G.merge([G.place(G.torus(45, 4, { axis: 'x', arc: Math.PI * 1.1, tube: 8 }), { rx: -Math.PI * 0.05, x: h.x }), G.box(12, 40, 14, { x: h.x, y: 60 }), G.annulus(11, 6, 24, { axis: 'x', x: h.x, y: 84 })]), mat: 'castIron', ex: [0, 150, 0] }, 'fork');
    const rail = add({ id: h.id + '-rail', name: `Shift rail (${h.lo === '4' ? '3–4' : h.lo === '2' ? '1–2' : '5–R'})`, system: 'shift', geo: G.cyl(6, 300, { axis: 'x', x: 40 }), mat: 'steel', pos: [0, 84, (parts.hubs.length - 1) * 30], ex: [0, 200, 0] }, 'rail');
    fork.obj.position.z = (parts.hubs.length - 1) * 30; fork.base.p.z = fork.obj.position.z;
    parts.hubs.push({ ...h, sleeve, fork, rail, offset: 0 });
  });
  const lever = add({ id: 'lever', name: 'Gear lever', system: 'shift', geo: G.merge([G.cyl(6, 120, { y: 120 }), G.sphere(16, { y: 186 }), G.cyl(12, 30, { y: 60 })]), mat: 'darkSteel', pos: [110, 60, 0], ex: [0, 200, 0] }, 'lever');
  parts.lever = lever;

  yield 'case';
  [-180, 250].forEach((x, i) => add({ id: `bearing-in-${i}`, name: i ? 'Mainshaft rear bearing' : 'Input shaft bearing', system: 'shafts', geo: G.merge([G.annulus(30, 24, 18, { axis: 'x', x }), G.annulus(18, 14, 18, { axis: 'x', x }), G.radial(G.sphere(3.6, { y: 21 }), 12, 'x').translate(x, 0, 0)]), mat: 'hardened', ex: [i ? 260 : -260, 0, 0] }, 'bearing'));
  [-180, 250].forEach((x, i) => add({ id: `bearing-cs-${i}`, name: `Countershaft bearing (${i ? 'rear' : 'front'})`, system: 'shafts', geo: G.merge([G.annulus(28, 22, 18, { axis: 'x', x }), G.annulus(17, 13, 18, { axis: 'x', x }), G.radial(G.sphere(3.4, { y: 19.5 }), 12, 'x').translate(x, 0, 0)]), mat: 'hardened', pos: [0, -C, 0], ex: [i ? 260 : -260, -80, 0] }, 'bearing'));
  const shell = G.roundedPoly([[-90, -125, 30], [90, -125, 30], [90, 60, 30], [-90, 60, 30]]); G.rectHole(shell, 150, 160, 0, -32);
  add({ id: 'case', name: 'Gearbox case', system: 'case', geo: G.merge([G.extrudeX(shell, 440, { x: 35 }), G.extrudeX(G.roundedPoly([[-90, -125, 30], [90, -125, 30], [90, 60, 30], [-90, 60, 30]]), 12, { x: -191 }), G.rbox(120, 30, 100, 8, { x: 110, y: 72 })]), mat: 'castAlu', ex: [0, 0, 0], ghost: true }, 'case');
  add({ id: 'ext-housing', name: 'Extension housing', system: 'case', geo: G.lathe([[0, 255], [70, 255], [70, 300], [40, 360], [40, 400], [30, 400], [30, 360], [60, 300], [60, 262], [0, 262]], { axis: 'x', seg: 48 }), mat: 'castAlu', ex: [260, 0, 0], ghost: true }, 'ext');
  add({ id: 'bell', name: 'Bell housing', system: 'case', geo: G.lathe([[0, -200], [180, -200], [180, -320], [60, -320], [60, -300], [170, -300], [170, -210], [0, -210]], { axis: 'x', seg: 64 }), mat: 'castAlu', ex: [-400, 0, 0], ghost: true }, 'bell');
}

let smooth = {};
function animate(ctx) {
  const parts = ctx.refs; const th = ctx.theta;
  const modeKey = MODE_KEY[ctx.mode ?? 3];
  // shaft speeds
  parts.input.obj.rotation.x = th;
  const csAng = -th * IN_T / CS_IN_T;
  parts.counter.obj.rotation.x = csAng;
  for (const k of Object.keys(parts.gears)) {
    const g = parts.gears[k]; const [, , csT, msT] = GEARS[k];
    let ang;
    if (k === 'R') { const idlerAng = -csAng * csT / IDLER.teeth; parts.idler.obj.rotation.x = parts.idler.userData.phase + idlerAng; ang = -idlerAng * IDLER.teeth / msT; }
    else ang = -csAng * csT / msT;
    g.obj.rotation.x = g.userData.phase + ang;
    g.userData.ang = ang;
  }
  let outAng = 0;
  if (modeKey === '4') outAng = th; else if (modeKey !== 'N') outAng = parts.gears[modeKey].userData.ang;
  parts.main.obj.rotation.x = outAng;
  // sleeves slide toward the selected gear
  for (const h of parts.hubs) {
    const target = modeKey === h.lo ? -12 : modeKey === h.hi ? 12 : 0;
    h.offset += (target - h.offset) * Math.min(1, ctx.dt * 8);
    h.sleeve.obj.position.x = h.offset; h.fork.obj.position.x = h.offset; h.rail.obj.position.x = h.offset;
  }
  const idx = HUBS.findIndex(h => h.lo === modeKey || h.hi === modeKey);
  const lz = idx < 0 ? 0 : (idx - 1) * 30; const lx = idx < 0 ? 0 : (modeKey === HUBS[idx].lo ? -1 : 1) * 12;
  smooth.z = (smooth.z ?? 0) + (lz - (smooth.z ?? 0)) * Math.min(1, ctx.dt * 8); smooth.x = (smooth.x ?? 0) + (lx - (smooth.x ?? 0)) * Math.min(1, ctx.dt * 8);
  parts.lever.obj.rotation.z = smooth.x * 0.06; parts.lever.obj.rotation.x = -smooth.z * 0.012;
}

export default {
  id: 'gearbox', name: 'Manual gearbox', shortName: 'the gearbox', sub: 'Five-speed synchromesh · constant mesh · helical gears, spur reverse', color: '#2fb27a',
  pieces: 40, explodeScale: 0.9, defaultView: 'iso', sectionDefault: 0, sectionAxis: 'z', ghostOpacity: 0.1,
  views: { iso: [-1, 0.6, 1.2], front: [-1, 0.05, 0.02], side: [0.02, 0.05, 1], top: [0.001, 1, 0.001] },
  drive: { label: 'Input shaft', revPerSec: 0.3 },
  modes: { label: 'Gear', options: MODES, default: 3 },
  hint: 'Pick a gear below · Press X to see through the case · Watch which sleeve slides',
  systems: [
    { id: 'shafts', name: 'Shafts & bearings', color: '#5f6d9b', kind: 'moving', blurb: 'Input shaft, mainshaft, idler shaft, output yoke and bearings.' },
    { id: 'gears', name: 'Gears', color: '#e2571f', kind: 'moving', blurb: 'Countershaft cluster, the five mainshaft gears and the reverse idler.' },
    { id: 'synchro', name: 'Synchronizers', color: '#f2b632', kind: 'moving', blurb: 'Hubs, sleeves and blocking rings that lock a gear to the mainshaft.' },
    { id: 'shift', name: 'Shift mechanism', color: '#2fb27a', kind: 'moving', blurb: 'Forks, rails and the gear lever.' },
    { id: 'case', name: 'Case', color: '#b8bec6', kind: 'static', housing: true, blurb: 'Main case, bell housing and extension housing.' },
  ],
  about: `<p>A classic rear-drive five-speed. The input shaft turns the countershaft through a constant-mesh pair; the countershaft turns every mainshaft gear all the time. Selecting a gear does not move any gear into mesh: it slides a synchronizer sleeve to lock one already-spinning gear to the mainshaft. Fourth is direct: the sleeve locks input to output and the countershaft merely idles.</p>
  <p>All gear rotations are computed from tooth counts, so the mesh stays in step. Ratios in this model: 3.86, 2.39, 1.66, 1.00, 0.86 and 3.91 in reverse.</p>`,
  build, animate,
};
