// Two-rotor Wankel rotary (13B geometry: R = 105 mm, e = 15 mm). Eccentric shaft axis = X, front at −X.
// 2D housing/rotor shapes use (u, v) = (Z, Y): the trochoid's major axis is horizontal (Z).
import * as THREE from 'three';
import * as G from './geom.js';

const { TAU, DEG, V3 } = G;
const RR = 105, E = 15, W = 80;                       // generating radius, eccentricity, rotor housing width
const ROTOR_X = [-45, 45];                            // centre of each rotor chamber
const HOUSING_HALF = 36;                              // rotor housing half-width per rotor (housing is 80 wide: 2*40)

const INFO = {
  rotorHousing: { desc: 'The rotor housing: an aluminum block whose bore is a two-lobed epitrochoid, the curve traced by the rotor’s apexes. It is the “cylinder” of a rotary engine, with intake, compression, combustion and exhaust happening in different parts of the same bore at once.', notes: ['The bore surface is hard chrome-plated so the apex seals can run on it at 60 m/s.', 'The two-lobe shape is x = e·cos 3α + R·cos α, y = e·sin 3α + R·sin α, drawn here exactly.'], block: { R: '105 mm', e: '15 mm', width: '80 mm', material: 'Cast aluminum, chrome-plated bore' } },
  sideHousing: { desc: 'A side housing: a flat iron plate that closes the rotor chamber on one side. It carries the side intake ports, the main bearing, and the stationary gear the rotor rolls around.', block: { material: 'Cast iron, nitrided face' } },
  rotor: { desc: 'The rotor: a triangle with bowed flanks that orbits inside the housing while turning slowly on its own axis, at one-third of the shaft speed. Each of its three flanks is a separate combustion chamber, so one rotor delivers three power pulses per rotor turn, one per shaft turn.', notes: ['Its centre moves on a circle of radius e (the eccentric) while it rotates once for every three turns of the shaft.', 'The rotor is a 2:3 planetary gear: its internal gear rolls around the fixed stationary gear.', 'A dish in each flank forms the combustion chamber recess.'], block: { flanks: '3', speed: '⅓ shaft speed', material: 'Cast iron' } },
  apexSeal: { desc: 'An apex seal: a spring-loaded blade at each rotor tip that scrapes along the trochoid bore and separates the three chambers. It is the rotary engine’s piston ring, and its wear is the engine’s weak point.', notes: ['Ceramic or carbon-impregnated cast iron; about 2 mm thick, pressed outward by a leaf spring and by gas pressure.'], block: { material: 'Cast iron or ceramic', thickness: '2 mm', springLoaded: 'yes' } },
  sideSeal: { desc: 'Side seals run along the rotor faces to seal against the side housings, joined to the apex seals by corner seals.', block: { material: 'Cast iron' } },
  eShaft: { desc: 'The eccentric shaft: the rotary’s crankshaft. Two eccentric lobes 180° apart carry the two rotors; each rotor bears on its lobe through a plain bearing, and the rotors’ orbital motion turns the shaft.', notes: ['No connecting rods, no reciprocating parts: only rotation and orbiting, which is why rotaries are so smooth.'], block: { eccentricity: '15 mm', lobes: '2 at 180°', material: 'Forged steel' } },
  stationaryGear: { desc: 'The stationary gear is fixed to the side housing. It does not transmit power; it only phases the rotor, forcing it to turn once for every three shaft revolutions so the apexes always follow the trochoid.', block: { teeth: '20 (external)', ratio: '2 : 3 with rotor gear' } },
  rotorGear: { desc: 'The rotor’s internal gear meshes with the stationary gear: 30 teeth against 20, a 3:2 ratio that holds the rotor to one-third of shaft speed.', block: { teeth: '30 (internal)' } },
  plug: { desc: 'Spark plug. Each rotor has two: a leading plug lower in the housing and a trailing plug above it, fired slightly apart to sweep the flame through the long, thin chamber.', block: { count: '2 per rotor (leading & trailing)' } },
  intakePort: { desc: 'A side intake port in the side housing. The rotor face uncovers it as it sweeps past: no valves needed. Shown as the shape of the opening.', block: { type: 'Side port, valveless' } },
  exhaustPort: { desc: 'The peripheral exhaust port in the rotor housing, uncovered by the trailing apex seal. The exhaust leaves at over 900 °C, hotter than a piston engine, because the chamber is long and cools the flame less.', block: { type: 'Peripheral port', temperature: '≈ 900 °C' } },
  chamber: { desc: 'One of the three working chambers of this rotor: the space between a flank and the housing. Follow it round: it grows (intake), shrinks (compression), is fired by the plugs, grows again (power) and shrinks (exhaust). Shown glowing on the power phase.', block: { volume: '654 cm³ per chamber max', cycle: 'one per shaft revolution per rotor' } },
  flywheel: { desc: 'The flywheel, with a counterweight cast in to balance the rotor at the rear, as the front pulley’s counterweight balances the front rotor.', block: { diameter: '300 mm' } },
  counterweight: { desc: 'A counterweight on the shaft nose. The two rotors are 180° apart so their forces cancel, but they act at different points along the shaft and would rock it; the front and rear counterweights cancel that couple.', block: { purpose: 'Balances the rotor couple' } },
  intakeManifold: { desc: 'The intake manifold feeding the side ports.', block: { type: 'Port injection' } },
  exhaustManifold: { desc: 'The exhaust manifold, collecting from both peripheral ports.', block: { material: 'Cast iron' } },
  oilInjector: { desc: 'A metering oil injector that squirts a small amount of engine oil into the intake to lubricate the apex seals. Rotaries burn a little oil by design.', block: { rate: '≈ 1 L per 2,000 km' } },
  bolt: { desc: 'One of the long tension bolts that clamp the whole stack of side housings and rotor housings together.', block: { size: 'M10 × 300' } },
};

const bump = (g, half) => (Math.abs(g) < half ? 0.5 * (1 + Math.cos(Math.PI * g / half)) : 0);

function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };
  const troch = G.epitrochoidShape(RR, E);
  yield 'housings';
  ROTOR_X.forEach((x, i) => {
    const outer = G.roundedPoly([[-165, -135, 40], [165, -135, 40], [165, 135, 40], [-165, 135, 40]]);
    outer.holes.push(new THREE.Path(troch.getPoints(180).reverse()));
    add({ id: `rotor-housing-${i + 1}`, name: `Rotor housing ${i + 1}`, system: 'housings', geo: G.extrudeX(outer, W, { x }), mat: 'castAlu', ex: [0, 0, 0], ghost: true }, 'rotorHousing');
    // exhaust port: peripheral, lower-left; intake ports: side, upper-right
    const exA = 200 * DEG; const exU = (RR - E) * 1.05 * Math.cos(exA), exV = (RR - E) * 1.05 * Math.sin(exA);
    add({ id: `exhaust-port-${i + 1}`, name: `Exhaust port · rotor ${i + 1}`, system: 'ports', geo: G.pipe([[x, exV * 0.9, exU * 0.9], [x, exV * 1.5, exU * 1.5], [x, exV * 1.5 - 60, exU * 1.5 - 30]], 20), mat: 'air', matOpts: { color: 0xffa060 }, ex: [0, -80, -120] }, 'exhaustPort');
    add({ id: `plug-lead-${i + 1}`, name: `Spark plug (leading) · rotor ${i + 1}`, system: 'ignition', geo: G.merge([G.cyl(7, 30, { z: -110 }), G.cyl(10, 8, { z: -128, seg: 6 }), G.cyl(5, 20, { z: -142 })]).rotateX(Math.PI / 2), mat: 'ceramic', pos: [x, 0, 0], ex: [0, -160, 0] }, 'plug');
    add({ id: `plug-trail-${i + 1}`, name: `Spark plug (trailing) · rotor ${i + 1}`, system: 'ignition', geo: G.merge([G.cyl(7, 30, { z: -110 }), G.cyl(10, 8, { z: -128, seg: 6 }), G.cyl(5, 20, { z: -142 })]).rotateX(Math.PI / 2).rotateX(-14 * DEG), mat: 'ceramic', pos: [x, 0, 0], ex: [0, -160, 0] }, 'plug');
    add({ id: `oil-injector-${i + 1}`, name: `Oil metering injector · rotor ${i + 1}`, system: 'ports', geo: G.merge([G.cyl(5, 30, { y: 128 }), G.cyl(8, 8, { y: 145, seg: 6 })]), mat: 'plasticGray', pos: [x, 0, 0], ex: [0, 160, 0] }, 'oilInjector');
  });
  const sidePlate = () => { const s = G.roundedPoly([[-165, -135, 40], [165, -135, 40], [165, 135, 40], [-165, 135, 40]]); G.circleHole(s, 42); return s; };
  [[-95, 'Front side housing', 'front'], [0, 'Intermediate housing', 'mid'], [95, 'Rear side housing', 'rear']].forEach(([x, name, id]) => add({ id: `side-${id}`, name, system: 'housings', geo: G.extrudeX(sidePlate(), id === 'mid' ? 20 : 20, { x }), mat: 'castIron', ex: [x * 2.4, 0, 0], ghost: true }, 'sideHousing'));
  [[-84, 1], [-16, 1], [16, 2], [84, 2]].forEach(([x, r], i) => { const a = 55 * DEG; add({ id: `intake-port-${i}`, name: `Side intake port ${i % 2 ? 'B' : 'A'} · rotor ${r}`, system: 'ports', geo: G.rbox(8, 44, 30, 8, { x, y: 78 * Math.sin(a), z: 78 * Math.cos(a) }), mat: 'air', ex: [x * 2.4, 60, 60] }, 'intakePort'); });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.39; add({ id: `tension-bolt-${i}`, name: `Tension bolt ${i + 1}`, system: 'housings', geo: G.place(G.bolt(10, 220), { rz: Math.PI / 2, x: -112, y: 150 * Math.sin(a) * 0.8, z: 150 * Math.cos(a) }), mat: 'darkSteel', ex: [-300, 0, 0] }, 'bolt'); }
  add({ id: 'intake-manifold', name: 'Intake manifold', system: 'ports', geo: G.merge([G.cyl(28, 240, { axis: 'x', y: 150, z: 90 }), ...[-84, -16, 16, 84].map(x => G.cyl(16, 70, { x, y: 120, z: 75, rx: -0.7 }))]), mat: 'plastic', ex: [0, 160, 120], ghost: true }, 'intakeManifold');
  add({ id: 'exhaust-manifold', name: 'Exhaust manifold', system: 'ports', geo: G.merge([G.pipe([[-45, -120, -120], [-45, -160, -170], [0, -190, -200], [60, -230, -210]], 24), G.pipe([[45, -120, -120], [45, -160, -170], [30, -190, -200], [60, -230, -210]], 24), G.annulus(46, 26, 10, { x: 60, y: -236, z: -212 })]), mat: 'exhaust', ex: [0, -160, -160] }, 'exhaustManifold');

  yield 'eccentric shaft';
  const eshaft = add({ id: 'e-shaft', name: 'Eccentric shaft', system: 'rotor', geo: G.merge([G.cyl(21, 330, { axis: 'x' }), G.cyl(37, 74, { axis: 'x', x: ROTOR_X[0], z: E }), G.cyl(37, 74, { axis: 'x', x: ROTOR_X[1], z: -E }), G.cyl(30, 20, { axis: 'x', x: -95 }), G.cyl(30, 20, { axis: 'x', x: 0 }), G.cyl(30, 20, { axis: 'x', x: 95 })]), mat: 'steel', ex: [0, 0, 0] }, 'eShaft');
  parts.eshaft = eshaft;
  add({ id: 'counterweight', name: 'Front counterweight & pulley', system: 'rotor', parent: 'e-shaft', geo: G.merge([G.place(G.extrudeX(G.roundedPoly([[-40, -20, 10], [40, -20, 10], [55, -60, 14], [0, -95, 20], [-55, -60, 14]]), 22), { rz: 0, x: -122, ry: 0 }).rotateX(Math.PI / 2), G.cyl(60, 18, { axis: 'x', x: -150 })]), mat: 'darkSteel', ex: [-200, 0, 0] }, 'counterweight');
  add({ id: 'flywheel', name: 'Flywheel with counterweight', system: 'rotor', parent: 'e-shaft', geo: G.merge([G.cyl(150, 24, { axis: 'x', x: 130, seg: 96 }), G.place(G.extrudeX(G.roundedPoly([[-40, -20, 10], [40, -20, 10], [55, -60, 14], [0, -95, 20], [-55, -60, 14]]), 22), { x: 115 }).rotateX(-Math.PI / 2)]), mat: 'castIron', ex: [220, 0, 0] }, 'flywheel');
  [[-95, 'stationary-1', 'Stationary gear (front)', 1], [0, 'stationary-2', 'Stationary gear (intermediate)', 2]].forEach(([x, id, name]) => add({ id, name, system: 'rotor', geo: G.place(G.gear(20, 3, 16, { bore: 22 }), { ry: Math.PI / 2, x: x + (x < 0 ? 22 : 22) }), mat: 'hardened', ex: [x * 2.4 - 40, 0, 0] }, 'stationaryGear'));

  yield 'rotors';
  parts.rotors = []; parts.chambers = [];
  const rotorProfile = G.rotorShape(RR - 1.5, E);
  const sealFrame = () => { const f = G.rotorShape(RR - 2.5, E); f.holes.push(new THREE.Path(G.rotorShape(RR - 9, E).getPoints().reverse())); return f; };
  ROTOR_X.forEach((x, i) => {
    const rotor = add({ id: `rotor-${i + 1}`, name: `Rotor ${i + 1}`, system: 'rotor', geo: G.merge([G.extrudeX(rotorProfile, W - 4), G.annulus(60, 38, W - 4, { axis: 'x' })]), mat: 'castIron', pos: [x, 0, 0], ex: [0, 0, 0] }, 'rotor');
    parts.rotors[i] = rotor;
    for (let j = 0; j < 3; j++) {
      const a = j * TAU / 3;
      add({ id: `apex-${i + 1}-${j}`, name: `Apex seal ${j + 1} · rotor ${i + 1}`, system: 'seals', parent: rotor.id, geo: G.place(G.box(W - 6, 6, 2.2), { z: RR - 2.4 }).rotateX(-a), mat: 'hardened', ex: [0, 0, 0] }, 'apexSeal');
      const cham = add({ id: `chamber-${i + 1}-${j}`, name: `Working chamber ${j + 1} · rotor ${i + 1}`, system: 'ignition', parent: rotor.id, geo: G.place(G.rbox(W - 10, 60, 14, 6), { z: RR * 0.5 * 1.15 }).rotateX(-(a + Math.PI / 3)), mat: 'fire', ex: [0, 0, 0] }, 'chamber');
      parts.chambers.push({ part: cham, rotor: i, j });
    }
    add({ id: `side-seals-${i + 1}`, name: `Side seals · rotor ${i + 1}`, system: 'seals', parent: rotor.id, geo: G.merge([G.extrudeX(sealFrame(), 1.5, { x: -(W - 4) / 2 }), G.extrudeX(sealFrame(), 1.5, { x: (W - 4) / 2 })]), mat: 'darkSteel', ex: [0, 0, 0], count: 6 }, 'sideSeal');
    add({ id: `rotor-gear-${i + 1}`, name: `Rotor internal gear · rotor ${i + 1}`, system: 'rotor', parent: rotor.id, geo: G.place(G.ringGear(30, 3, 14, 58), { ry: Math.PI / 2, x: -(W - 4) / 2 + 9 }), mat: 'hardened', ex: [-60, 0, 0] }, 'rotorGear');
  });
}

function animate(ctx) {
  const parts = ctx.refs; const th = ctx.theta;
  parts.eshaft.obj.rotation.x = -th;   // eccentric built at +Z: world angle in the (Z,Y) plane increases with theta
  for (let i = 0; i < 2; i++) {
    const ph = th + i * Math.PI;
    const r = parts.rotors[i].obj;
    r.position.set(ROTOR_X[i], E * Math.sin(ph), E * Math.cos(ph));
    r.rotation.x = -ph / 3;
  }
  const deg = th / DEG;
  for (const c of parts.chambers) {
    // chamber j of rotor i faces the plugs (bottom, −Y) when its flank centre angle ≡ 270° in the (Z,Y) plane
    const rotorAng = ((th + c.rotor * Math.PI) / 3) / DEG;
    const flank = rotorAng + 60 + 120 * c.j;
    let d = ((flank - 270) % 360 + 540) % 360 - 180;
    const glow = d > -8 && d < 40 ? 1 - (d + 8) / 48 : 0;
    for (const m of c.part.mats) { m.emissiveIntensity = glow * 2.2; m.opacity = glow * 0.8; }
  }
}
function cycle(theta) {
  // rotor 1, chamber 1 (flank j=0): phase by its angular position; one full cycle per 3 shaft turns
  const rotorAng = ((theta / 3) / DEG) % 360;
  const flank = ((rotorAng + 60) % 360 + 360) % 360;   // 0..360, plugs at 270
  const ph = ((flank - 270 + 360) % 360);                 // 0 at ignition
  const idx = ph < 90 ? 2 : ph < 180 ? 3 : ph < 270 ? 0 : 1;
  return { title: 'Rotor 1 · chamber 1', labels: ['Intake', 'Compression', 'Power', 'Exhaust'], active: idx, color: ['#3b82f6', '#d9a300', '#e2571f', '#7a8794'][idx] };
}

export default {
  id: 'wankel', name: 'Wankel rotary engine', shortName: 'the rotary', sub: 'Two-rotor · R 105 mm, e 15 mm · 2 × 654 cm³ · no reciprocating parts', color: '#c0509a',
  pieces: 60, explodeScale: 0.8, ghostOpacity: 0.05, defaultView: 'iso', sectionDefault: -0.5, sectionAxis: 'x',
  views: { iso: [-1, 0.5, 1.1], front: [-1, 0.05, 0.02], side: [0.02, 0.05, 1], top: [0.001, 1, 0.001] },
  drive: { label: 'Eccentric shaft', revPerSec: 0.3 },
  hint: 'Front view with X-ray shows the rotor orbiting inside the trochoid · Section along X opens a chamber',
  systems: [
    { id: 'rotor', name: 'Rotors & shaft', color: '#e2571f', kind: 'moving', blurb: 'Two rotors, the eccentric shaft, phasing gears, flywheel and counterweight.' },
    { id: 'seals', name: 'Seals', color: '#2fb27a', kind: 'moving', blurb: 'Apex seals and side seals riding on the housing surfaces.' },
    { id: 'housings', name: 'Housings', color: '#8a929c', kind: 'static', housing: true, blurb: 'Two trochoid rotor housings, three side housings and the tension bolts.' },
    { id: 'ports', name: 'Ports & manifolds', color: '#3aa6d8', kind: 'static', blurb: 'Side intake ports, peripheral exhaust ports, manifolds and oil injectors.' },
    { id: 'ignition', name: 'Ignition & chambers', color: '#c9509d', kind: 'static', blurb: 'Leading and trailing plugs, and the six working chambers that glow on the power phase.' },
  ],
  about: `<p>A two-rotor Wankel of the 13B type: each rotor housing has a bore shaped as a two-lobed epitrochoid with R = 105 mm and e = 15 mm. The rotor’s centre orbits on a 15 mm circle while the rotor turns at one-third shaft speed; the phasing gears keep the three apexes on the bore. Each flank of each rotor completes the four-stroke cycle once per rotor revolution, so each rotor gives one power pulse per shaft revolution.</p>
  <p>Because the apex positions follow x = e·cos 3α + R·cos α, the rotor in this model stays in contact with the bore at every angle. Turn on X-ray and look from the front to watch it.</p>`,
  build, animate, cycle,
};
