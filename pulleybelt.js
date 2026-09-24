// Two-pulley V-belt drive (bench test-rig scale). Shaft axis = X, driver at z=0, driven at z=+C, both at height y=YSHAFT.
// The belt loop itself lies in the Y-Z plane at x = BELT_X, exactly like the accessory belt in inline4.js.
import * as THREE from 'three';
import * as G from './geom.js';

const { TAU, DEG, V3 } = G;
const R1 = 50, R2 = 125;                 // driver / driven pulley radius (mm) -> 2.5 : 1 speed reduction
const RID = 25;                          // idler radius
const C = 380;                           // shaft centre distance
const YSHAFT = 190;                      // shaft height above the base plate
const BELT_X = 0;                        // axial position of the belt plane
const PW = 22;                           // pulley width
const GROOVE = 9;                        // V-groove depth
const RATIO = R2 / R1;

const INFO = {
  base: { desc: 'The base plate. It fixes the centre distance between the two shafts, which is what fixes the amount of wrap the belt gets around each pulley.', block: { material: 'Steel channel, painted', length: `${C + 120} mm` } },
  motor: { desc: 'The driver: an electric motor. Its shaft turns at a constant speed set by the supply frequency (or by a variable-frequency drive), and that speed is all this whole machine has to work with — everything downstream is a ratio of it.', block: { power: '≈ 0.37 kW', speed: '1,440 rpm (4-pole, 50 Hz)' } },
  block: { desc: 'A pillow block (plummer block): a bearing housing bolted to the base that lets a shaft spin freely while carrying its weight and the belt’s pull.', block: { bearing: 'Deep-groove ball', material: 'Cast iron' } },
  shaftDriver: { desc: 'The driver shaft, coupled directly to the motor. It turns at motor speed — there is no reduction before the belt.', block: { material: 'Steel', diameter: 'Ø 36 mm' } },
  shaftDriven: { desc: 'The driven (output) shaft. Whatever it feeds — a pump, a fan, a conveyor — sees whatever speed the pulley ratio has left it with.', block: { material: 'Steel', diameter: 'Ø 44 mm' } },
  pulleyDriver: { desc: `The driver pulley. Its radius is the whole reason a belt drive can change speed at all: the belt must travel the same distance per second at both pulleys, so a small pulley here has to spin faster than a big one downstream.`, block: { radius: `${R1} mm`, groove: 'Single V, A-section' } },
  pulleyDriven: { desc: `The driven pulley, ${(R2 / R1).toFixed(2)}× the driver's radius. Because belt speed is the same all the way round the loop, this pulley turns exactly ${(R2 / R1).toFixed(2)}× slower than the driver — a plain speed reducer with no gear teeth at all.`, notes: ['Unlike a meshing gear pair, both pulleys turn the same way round. Crossing the belt into a figure-eight is the only way to reverse it.'], block: { radius: `${R2} mm`, ratio: `${RATIO.toFixed(2)} : 1 reduction` } },
  belt: { desc: 'The V-belt: a closed loop of rubber over steel or polyester cords, wedged into the pulleys’ grooves. Wedging (not just friction on a flat face) is what lets it grip hard enough to transmit real power without slipping.', notes: ['Runs slightly under the pulleys’ outer diameter, on the cord line partway down the V, which is the "effective" radius the speed ratio really uses.'], block: { section: 'A-section, 13 mm top width', material: 'Rubber over cord' } },
  mark: { desc: 'A painted reference mark. It isn’t a real part of the belt — it’s here so the belt’s motion is visible. Watch it travel: its speed along the loop never changes, even though the two pulleys spin at very different rates. That constant loop speed is the entire mechanism of a belt drive.', block: {} },
  idler: { desc: 'An idler pulley, carrying no load of its own. It presses on the belt’s slack side purely to keep enough tension in the loop for the wedging action to grip — too little tension and the belt slips; too much and it cooks the bearings.', block: { radius: `${RID} mm`, type: 'Flat idler, free-spinning' } },
  bracket: { desc: 'The idler bracket. Its mounting slot lets the idler be pushed in to tension a new belt, or to take up the slack as an old one stretches.', block: { adjustment: '± 20 mm' } },
  guard: { desc: 'The belt guard. A spinning belt and two pulley nips are a serious entanglement hazard, so a guard covers them on every real machine; this one is drawn semi-transparent so the drive underneath stays visible.', block: { material: 'Sheet steel, painted' } },
  bolt: { desc: 'A hex bolt, holding one of the drive’s components to the base plate or to the pillow blocks.', block: { grade: '8.8' } },
  disc: { desc: 'A speed-indicator disc on the output shaft. The stripe is a strobe/tachometer reference mark — a fixed light flashed at the shaft’s true speed would make it appear to stand still.', block: {} },
};

function vPulleyPts(R) {
  const h = PW / 2, n = h * 0.2;
  return [[0, -h], [R, -h], [R, -n], [R - GROOVE, 0], [R, n], [R, h], [0, h]];
}

function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };

  yield 'base & motor';
  add({ id: 'base-plate', name: 'Base plate', system: 'frame', geo: G.rbox(C + 200, 24, 220, 6, { x: C / 2, y: -12, z: 0 }), mat: 'paintGray', ex: [0, -160, 0], ghost: true }, 'base');
  add({ id: 'motor', name: 'Motor', system: 'frame', geo: G.merge([G.cyl(72, 170, { axis: 'x', x: -190 }), G.rbox(80, 30, 90, 6, { x: -190, y: -36 }), G.cyl(16, 16, { axis: 'x', x: -108 })]), mat: 'paintBlue', pos: [0, YSHAFT, 0], ex: [-260, 0, 0] }, 'motor');
  [-40, 40].forEach((dz, i) => [-220, -160].forEach((x, j) => add({ id: `motor-bolt-${i}-${j}`, name: `Motor mounting bolt ${i * 2 + j + 1}`, system: 'hardware', geo: G.place(G.bolt(8, 26, { washer: true }), { rx: Math.PI, x, y: -2, z: dz }), mat: 'darkSteel', ex: [-260, -60, dz * 2] }, 'bolt')));

  yield 'shafts & pulleys';
  const driverShaft = add({ id: 'driver-shaft', name: 'Driver shaft', system: 'drive', geo: G.cyl(18, 210, { axis: 'x' }), mat: 'steel', pos: [-15, YSHAFT, 0], ex: [-140, 0, 0] }, 'shaftDriver');
  parts.driverShaft = driverShaft;
  const driverPulley = add({ id: 'driver-pulley', name: `Driver pulley (Ø${R1 * 2} mm)`, system: 'drive', geo: G.merge([G.lathe(vPulleyPts(R1), { axis: 'x', x: BELT_X, seg: 48 }), G.cyl(19, 30, { axis: 'x', x: BELT_X, seg: 24 })]), mat: 'darkSteel', pos: [0, YSHAFT, 0], ex: [-90, 90, 0] }, 'pulleyDriver');
  parts.driverPulley = driverPulley;

  const driverShaftLen = 210;
  const driverBlockX = -driverShaftLen / 2 + 25;
  add({ id: 'bearing-block-driver', name: 'Pillow block (driver shaft)', system: 'frame', geo: G.merge([G.rbox(74, YSHAFT, 66, 8, { x: driverBlockX, y: YSHAFT / 2, z: 0 }), G.place(G.annulus(32, 20, 32, { axis: 'x' }), { x: driverBlockX, y: YSHAFT, z: 0 })]), mat: 'castIron', ex: [0, -140, 0], ghost: true }, 'block');
  [-16, 16].forEach((dz, i) => add({ id: `driver-block-bolt-${i}`, name: `Pillow block bolt ${i + 1} (driver)`, system: 'hardware', geo: G.place(G.bolt(7, 24, { washer: true }), { rx: Math.PI, x: driverBlockX, y: -2, z: dz }), mat: 'darkSteel', ex: [0, -200, dz * 3] }, 'bolt'));

  const drivenShaftLen = 260;
  const driven = add({ id: 'driven-shaft', name: 'Driven shaft', system: 'drive', geo: G.cyl(22, drivenShaftLen, { axis: 'x' }), mat: 'steel', pos: [15, YSHAFT, C], ex: [140, 0, 0] }, 'shaftDriven');
  parts.drivenShaft = driven;
  const drivenPulley = add({ id: 'driven-pulley', name: `Driven pulley (Ø${R2 * 2} mm)`, system: 'drive', geo: G.merge([G.lathe(vPulleyPts(R2), { axis: 'x', x: BELT_X, seg: 64 }), G.cyl(23, 34, { axis: 'x', x: BELT_X, seg: 32 })]), mat: 'darkSteel', pos: [0, YSHAFT, C], ex: [90, 90, 0] }, 'pulleyDriven');
  parts.drivenPulley = drivenPulley;
  const disc = add({ id: 'speed-disc', name: 'Speed-indicator disc', system: 'drive', geo: G.merge([G.cyl(66, 8, { axis: 'x', x: 0 }), G.rbox(10, 58, 10, 2, { x: 5, y: 33 })]), mat: 'paintRed', pos: [drivenShaftLen / 2 - 8, YSHAFT, C], ex: [200, 60, 0] }, 'disc');
  parts.disc = disc;

  const drivenBlockX = -drivenShaftLen / 2 + 30;
  add({ id: 'bearing-block-driven', name: 'Pillow block (driven shaft)', system: 'frame', geo: G.merge([G.rbox(84, YSHAFT, 76, 8, { x: drivenBlockX, y: YSHAFT / 2, z: C }), G.place(G.annulus(38, 24, 36, { axis: 'x' }), { x: drivenBlockX, y: YSHAFT, z: C })]), mat: 'castIron', ex: [0, -140, 0], ghost: true }, 'block');
  [-18, 18].forEach((dz, i) => add({ id: `driven-block-bolt-${i}`, name: `Pillow block bolt ${i + 1} (driven)`, system: 'hardware', geo: G.place(G.bolt(8, 26, { washer: true }), { rx: Math.PI, x: drivenBlockX, y: -2, z: C + dz }), mat: 'darkSteel', ex: [0, -200, dz * 3] }, 'bolt'));

  yield 'idler & belt';
  const idlerY = YSHAFT - 150, idlerZ = C / 2;
  add({ id: 'idler-bracket', name: 'Idler bracket', system: 'frame', geo: G.merge([G.rbox(28, idlerY - 6, 28, 4, { x: 0, y: idlerY / 2, z: idlerZ }), G.cyl(22, 34, { axis: 'x', x: 0, y: idlerY, z: idlerZ })]), mat: 'paintGray', ex: [0, -120, 0] }, 'bracket');
  add({ id: 'idler-pivot-bolt', name: 'Idler pivot bolt', system: 'hardware', geo: G.place(G.bolt(9, 44, { washer: true }), { axis: 'x', x: -18, y: idlerY, z: idlerZ }), mat: 'darkSteel', ex: [-70, 0, 0] }, 'bolt');
  const idler = add({ id: 'idler-pulley', name: `Idler pulley (Ø${RID * 2} mm)`, system: 'belt', geo: G.lathe(vPulleyPts(RID), { axis: 'x', x: BELT_X, seg: 32 }), mat: 'polished', pos: [0, idlerY, idlerZ], ex: [0, -120, 0] }, 'idler');
  parts.idler = idler;

  const basis = { o: V3(BELT_X, 0, 0), U: V3(0, 1, 0), V: V3(0, 0, 1) };
  const pulleys = [{ c: [YSHAFT, 0], r: R1 }, { c: [YSHAFT, C], r: R2 }, { c: [idlerY, idlerZ], r: RID, inside: true }];
  const bp = G.beltPath(pulleys, basis);
  add({ id: 'belt', name: 'V-belt', system: 'belt', geo: G.sweep(bp.path, [[-6.5, -4], [6.5, -4], [6.5, 4], [-6.5, 4]], V3(1, 0, 0), 220), mat: 'rubber', ex: [0, 0, 0] }, 'belt');
  const beltRun = parts.beltRun = { path: bp.path, length: bp.length, r: R1, marks: [] };
  const nMarks = 4;
  const markGeo = G.merge([G.rbox(15, 9, 3, 1.5, { z: 4.6 }), G.rbox(15, 9, 3, 1.5, { z: -4.6 })]);
  for (let i = 0; i < nMarks; i++) {
    const m = add({ id: `belt-mark-${i}`, name: `Belt reference mark ${i + 1}`, system: 'belt', geo: markGeo.clone(), mat: 'paintWhite', ex: [0, 0, 0] }, 'mark');
    beltRun.marks.push(m);
  }

  yield 'guard';
  add({ id: 'belt-guard', name: 'Belt guard', system: 'frame', geo: G.rbox(60, R2 * 2 + 90, C + 90, 12, { x: 0, y: YSHAFT + 25, z: C / 2 }), mat: 'paintGray', ex: [230, 0, 0], ghost: true }, 'guard');
}

const _t = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4();

function animate(ctx) {
  const parts = ctx.refs;
  const th = ctx.theta;
  parts.driverShaft.obj.rotation.x = th;
  parts.driverPulley.obj.rotation.x = th;

  const thDriven = th * (R1 / R2);               // open belt: driven pulley turns the SAME way, just slower
  parts.drivenShaft.obj.rotation.x = thDriven;
  parts.drivenPulley.obj.rotation.x = thDriven;
  parts.disc.obj.rotation.x = thDriven;

  if (parts.idler) parts.idler.obj.rotation.x = -th * (R1 / RID);   // free-spinning; sign is a visual approximation

  const run = parts.beltRun;
  if (run && run.marks.length) {
    const shift = th * run.r;                      // belt travel = driver radius x driver angle (no slip)
    const pitch = run.length / run.marks.length;
    run.marks.forEach((mk, i) => {
      let s = (i * pitch + shift) % run.length; if (s < 0) s += run.length;
      const u = s / run.length;
      run.path.getPointAt(u, mk.obj.position);
      run.path.getTangentAt(u, _t).normalize();
      _b.crossVectors(_n, _t);
      _m.makeBasis(_t, _b, _n);
      mk.obj.quaternion.setFromRotationMatrix(_m);
    });
  }
}

export default {
  id: 'pulleybelt', name: 'Pulley & belt drive', shortName: 'the belt drive', sub: `V-belt speed reducer · Ø${R1 * 2}/Ø${R2 * 2} mm pulleys · ${RATIO.toFixed(2)} : 1`, color: '#39b58c',
  pieces: 26, explodeScale: 0.85, defaultView: 'iso', sectionDefault: 0, sectionAxis: 'z', ghostOpacity: 0.12,
  views: { iso: [1, 0.7, 1.35], front: [0, 0.12, 1], side: [1, 0.12, 0], top: [0.001, 1, 0.001] },
  drive: { label: 'Driver shaft (motor)', revPerSec: 0.35 },
  hint: 'Watch the reference marks: belt speed never changes, only the pulleys’ spin does',
  systems: [
    { id: 'drive', name: 'Drive train', color: '#e2571f', kind: 'moving', blurb: 'Driver shaft, driven shaft, both pulleys and the speed-indicator disc.' },
    { id: 'belt', name: 'Belt & idler', color: '#2fb27a', kind: 'moving', blurb: 'The V-belt, its reference marks, and the free-spinning idler pulley.' },
    { id: 'frame', name: 'Frame & mounts', color: '#b8bec6', kind: 'static', housing: true, blurb: 'Base plate, motor, pillow blocks, idler bracket and belt guard.' },
    { id: 'hardware', name: 'Hardware', color: '#8a929c', kind: 'static', blurb: 'Mounting and pivot bolts.' },
  ],
  about: `<p>A V-belt drive does one job: change speed (and torque) between two parallel shafts without any teeth meshing. Because the belt cannot stretch, every point on it must move at the same speed all the way round the loop — so a pulley's rotational speed has to be inversely proportional to its radius. Here that gives a ${RATIO.toFixed(2)} : 1 reduction from a ${R1 * 2} mm driver pulley to a ${R2 * 2} mm driven pulley.</p>
  <p>The reference marks on the belt move at one constant speed regardless of which pulley they are passing, which is the clearest way to see the "belt speed is shared" rule in action. Unlike a meshing gear pair (see the gearbox model), both pulleys turn the <em>same</em> way round — reversing an open belt drive needs a mechanical cross, not just a sign change.</p>
  <p>The idler exists only to keep tension in the loop; it carries no load and its position is normally adjustable to take up slack as the belt wears.</p>`,
  build, animate,
};
