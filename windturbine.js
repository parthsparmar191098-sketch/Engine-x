// Utility-scale wind turbine drivetrain: 3 MW class, 90 m rotor. Main shaft axis = X (rotor at −X), yaw axis = Y. Units mm.
import * as THREE from 'three';
import * as G from './geom.js';

const { TAU, DEG, V3 } = G;
const RING_T = 90, PLANET_T = 33, SUN_T = 24, MOD = 24;      // planetary stage
const INT_T = [90, 22], HS_T = [80, 20];                      // parallel stages
const RATIO1 = 1 + RING_T / SUN_T, RATIO2 = INT_T[0] / INT_T[1], RATIO3 = HS_T[0] / HS_T[1];

const INFO = {
  blade: { desc: 'A rotor blade, 45 metres long, made of glass and carbon fibre in two shells bonded over a spar. Its twist and taper are set so that the whole span works at its best angle at rated wind speed; near the tip it is thin and fast, near the root thick and slow.', notes: ['Tip speed about 80 m/s at 17 rpm.', 'Each blade weighs about 10 tonnes and is bolted to the hub through a pitch bearing so its angle can be changed.', 'Aerodynamically it is a wing, not a paddle: lift, not drag, drives the rotor.'], block: { length: '45 m', mass: '≈ 10 t', material: 'GFRP / CFRP spar', tipSpeed: '≈ 80 m/s' } },
  hub: { desc: 'The hub: a cast iron sphere-like casting that ties the three blades to the main shaft. The pitch systems live inside it.', block: { material: 'Ductile cast iron', mass: '≈ 20 t' } },
  spinner: { desc: 'The nose cone (spinner) fairs the hub and keeps the weather off the pitch drives.', block: { material: 'GFRP' } },
  pitchBearing: { desc: 'A pitch bearing: a large slewing ring between blade root and hub. Turning the blade about its own axis controls the power: at high wind the blades pitch toward feather to shed load, and in a storm they feather fully and the rotor stops.', block: { diameter: 'Ø 2.6 m', type: 'Four-point contact slewing ring' } },
  pitchDrive: { desc: 'A pitch drive: an electric motor and planetary reducer whose pinion turns the pitch bearing’s internal gear. Backed by batteries so the blades can still feather if the grid fails.', block: { type: 'Electric, gear-driven', speed: '≈ 5°/s' } },
  mainShaft: { desc: 'The main (low-speed) shaft, forged steel, carries the rotor’s 100-tonne weight and its thrust, and delivers about 2 MN·m of torque at only 17 rpm into the gearbox.', block: { diameter: 'Ø 0.8 m', torque: '≈ 2 MN·m', speed: '10–17 rpm' } },
  mainBearing: { desc: 'The main bearing: a spherical roller bearing nearly two metres across, carrying the rotor’s weight and bending moment so that the gearbox sees mostly torque.', block: { type: 'Spherical roller', diameter: 'Ø 1.8 m' } },
  gearbox: { desc: 'The gearbox raises the rotor’s 17 rpm to about 1,300 rpm for the generator, a ratio of roughly 78:1 in three stages: a planetary stage followed by two parallel helical stages. It is the most failure-prone part of the turbine.', notes: ['Stage 1 is planetary because a planetary stage shares the huge input torque across three planets.', 'Oil is filtered, cooled and monitored for metal particles.'], block: { ratio: `${(RATIO1 * RATIO2 * RATIO3).toFixed(1)} : 1`, stages: '1 planetary + 2 helical', mass: '≈ 25 t' } },
  ringGear: { desc: 'The planetary ring gear (annulus), fixed to the gearbox housing. The planets roll around inside it.', block: { teeth: `${RING_T}, internal`, fixed: 'yes' } },
  carrier: { desc: 'The planet carrier is driven by the main shaft. As it turns it carries the three planets around the fixed ring gear, and the planets in turn drive the sun gear faster.', block: { drive: 'Main shaft', speed: 'rotor speed' } },
  planet: { desc: 'A planet gear. It rolls around the inside of the fixed ring while orbiting with the carrier; the combination spins the sun gear at the carrier speed times (1 + ring teeth / sun teeth).', block: { teeth: `${PLANET_T}`, count: '3' } },
  sun: { desc: 'The sun gear, at the centre of the planetary stage, is the output of stage one. It turns at (1 + 90/24) = 4.75 times the rotor speed.', block: { teeth: `${SUN_T}`, speed: `${RATIO1.toFixed(2)} × rotor` } },
  intGear: { desc: 'The intermediate stage: a large helical gear on the sun shaft driving a small pinion on the intermediate shaft. Another 4.1:1.', block: { ratio: `${RATIO2.toFixed(2)} : 1` } },
  hsGear: { desc: 'The high-speed stage: the last helical pair, driving the output shaft at generator speed.', block: { ratio: `${RATIO3.toFixed(2)} : 1` } },
  hsShaft: { desc: 'The high-speed shaft links the gearbox to the generator through a flexible coupling. It carries the brake disc.', block: { speed: '≈ 1,300 rpm' } },
  brake: { desc: 'The mechanical brake: a disc on the high-speed shaft and hydraulic calipers. It is a parking brake; the blades themselves stop the rotor by feathering.', block: { type: 'Hydraulic disc brake' } },
  coupling: { desc: 'A flexible coupling that isolates the generator from gearbox misalignment and from electrical fault torques.', block: { type: 'Composite link coupling' } },
  generator: { desc: 'The generator: a doubly-fed induction machine of about 3 MW. Its rotor winding is fed through slip rings by a converter so the turbine can run at variable speed while feeding a fixed-frequency grid.', block: { power: '3 MW', type: 'DFIG, 4-pole', speed: '900–1,700 rpm' } },
  bedplate: { desc: 'The bedplate: a cast and welded frame that carries the whole drivetrain and sits on the yaw bearing.', block: { material: 'Cast iron + welded steel' } },
  yawBearing: { desc: 'The yaw bearing: a slewing ring with an external gear, bolted to the tower top, on which the entire nacelle turns to face the wind.', block: { diameter: 'Ø 3.2 m', type: 'Slewing ring, geared' } },
  yawDrive: { desc: 'A yaw drive: an electric motor and reducer with a pinion on the yaw bearing gear. Four of them turn the 100-tonne nacelle into the wind at about half a degree per second.', block: { count: '4', speed: '≈ 0.5°/s' } },
  tower: { desc: 'The top section of the tubular steel tower. The full tower is about 90 m tall and 4 m across at the top.', block: { height: '≈ 90 m', material: 'Rolled steel, 40 mm plate' } },
  cover: { desc: 'The nacelle cover, a glass-fibre shell that keeps weather out and noise in.', block: { material: 'GFRP' } },
  anemometer: { desc: 'Anemometer and wind vane on the nacelle roof. They tell the controller when to yaw and how to pitch.', block: { type: 'Cup anemometer + vane' } },
  cooler: { desc: 'The cooling unit on the nacelle roof: radiators for the gearbox oil and generator water jackets.', block: { type: 'Air-cooled radiators' } },
  converter: { desc: 'The power converter and transformer cabinets. The converter conditions the rotor current; the transformer steps the output up to the collection grid voltage.', block: { output: '33 kV' } },
};

function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };

  yield 'rotor';
  const shaft = add({ id: 'main-shaft', name: 'Main shaft', system: 'rotor', geo: G.merge([G.cyl(400, 4200, { axis: 'x', x: -2200 }), G.cyl(900, 250, { axis: 'x', x: -4300 })]), mat: 'steel', ex: [-3000, 0, 0] }, 'mainShaft');
  parts.shaft = shaft;
  add({ id: 'hub', name: 'Hub', system: 'rotor', parent: 'main-shaft', geo: G.sphere(1500, { x: -5200, seg: 48 }), mat: 'castIron', ex: [-4000, 0, 0] }, 'hub');
  add({ id: 'spinner', name: 'Spinner (nose cone)', system: 'rotor', parent: 'main-shaft', geo: G.lathe([[0, -7400], [900, -6900], [1700, -6200], [1900, -5400], [0, -5400]], { axis: 'x', seg: 48 }), mat: 'paintWhite', ex: [-6000, 0, 0] }, 'spinner');
  const bladeGeo = G.place(G.blade({ rRoot: 1450, rTip: 46000, chordRoot: 3400, chordTip: 700, staggerRoot: 20, staggerTip: 0, camber: 0.05, thick: 0.18, sweep: 800, lean: 0, nSpan: 18, nChord: 14 }), { ry: Math.PI / 2, x: -5200 });
  parts.blades = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const pb = add({ id: `pitch-bearing-${i}`, name: `Pitch bearing ${i + 1}`, system: 'pitch', parent: 'main-shaft', geo: G.place(G.annulus(1350, 1150, 240, { y: 1500 }), { rx: a, x: -5200 }), mat: 'hardened', ex: [0, 0, 0] }, 'pitchBearing');
    const bl = add({ id: `blade-${i}`, name: `Blade ${i + 1}`, system: 'blades', parent: 'main-shaft', geo: bladeGeo.clone(), mat: 'paintWhite', rot: [a, 0, 0], ex: [0, 0, 0] }, 'blade');
    bl.userData = { a }; parts.blades.push(bl);
    add({ id: `pitch-drive-${i}`, name: `Pitch drive ${i + 1}`, system: 'pitch', parent: 'main-shaft', geo: G.place(G.merge([G.rbox(500, 500, 900, 60, { y: 1000, z: 1000 }), G.cyl(160, 300, { y: 1400, z: 1000 })]), { rx: a, x: -5000 }), mat: 'paintGray', ex: [0, 0, 0] }, 'pitchDrive');
  }
  add({ id: 'main-bearing', name: 'Main bearing', system: 'drivetrain', geo: G.merge([G.annulus(900, 780, 600, { axis: 'x', x: -3000 }), G.annulus(480, 400, 600, { axis: 'x', x: -3000 }), G.radial(G.cyl(120, 400, { axis: 'x', y: 640 }), 22, 'x').translate(-3000, 0, 0)]), mat: 'hardened', ex: [0, 1500, 0] }, 'mainBearing');
  add({ id: 'bearing-housing', name: 'Main bearing housing', system: 'structure', geo: G.merge([G.annulus(1150, 920, 700, { axis: 'x', x: -3000 }), G.box(1600, 900, 2600, { x: -3000, y: -1000 })]), mat: 'castIron', ex: [0, 2200, 0] }, 'bedplate');

  yield 'gearbox';
  // planetary stage at x ≈ -600; carrier driven by main shaft
  const carrier = add({ id: 'carrier', name: 'Planet carrier', system: 'gearbox', parent: 'main-shaft', geo: G.merge([G.cyl(1250, 220, { axis: 'x', x: -900 }), G.cyl(1250, 220, { axis: 'x', x: -300 }), ...[0, 1, 2].map(i => G.place(G.cyl(150, 400, { axis: 'x', y: MOD * (SUN_T + PLANET_T) / 2 }), { rx: (i / 3) * TAU, x: -600 }))]), mat: 'steel', ex: [0, 0, 0] }, 'carrier');
  parts.carrier = carrier; parts.planets = [];
  const planetR = MOD * (SUN_T + PLANET_T) / 2;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const pg = add({ id: `planet-${i}`, name: `Planet gear ${i + 1}`, system: 'gearbox', parent: 'main-shaft', geo: G.place(G.gear(PLANET_T, MOD, 360, { helix: 8, bore: 150 }), { ry: Math.PI / 2 }), mat: 'hardened', pos: [-600, planetR * Math.cos(a), planetR * Math.sin(a)], ex: [0, 0, 0] }, 'planet');
    pg.userData = { a }; parts.planets.push(pg);
  }
  add({ id: 'ring-gear', name: 'Ring gear (fixed annulus)', system: 'gearbox', geo: G.place(G.ringGear(RING_T, MOD, 380, 1380), { ry: Math.PI / 2, x: -600 }), mat: 'hardened', ex: [0, 0, 0] }, 'ringGear');
  const sun = add({ id: 'sun', name: 'Sun gear & shaft', system: 'gearbox', geo: G.merge([G.place(G.gear(SUN_T, MOD, 360, { helix: 8, bore: 80 }), { ry: Math.PI / 2, x: -600 }), G.cyl(160, 1400, { axis: 'x', x: 200 }), G.place(G.gear(INT_T[0], 12, 260, { helix: 15, bore: 160 }), { ry: Math.PI / 2, x: 700 })]), mat: 'hardened', ex: [0, 0, 0] }, 'sun');
  parts.sun = sun;
  const intR = 12 * (INT_T[0] + INT_T[1]) / 2;
  const inter = add({ id: 'intermediate', name: 'Intermediate shaft & gears', system: 'gearbox', geo: G.merge([G.place(G.gear(INT_T[1], 12, 260, { helix: 15, bore: 60 }), { ry: Math.PI / 2, x: 700 }), G.cyl(90, 1100, { axis: 'x', x: 1100 }), G.place(G.gear(HS_T[0], 8, 220, { helix: 15, bore: 90 }), { ry: Math.PI / 2, x: 1500 })]), mat: 'hardened', pos: [0, -intR, 0], ex: [0, -1200, 0] }, 'intGear');
  parts.inter = inter;
  const hsR = 8 * (HS_T[0] + HS_T[1]) / 2;
  const hs = add({ id: 'hs-shaft', name: 'High-speed shaft & pinion', system: 'gearbox', geo: G.merge([G.place(G.gear(HS_T[1], 8, 220, { helix: 15, bore: 40 }), { ry: Math.PI / 2, x: 1500 }), G.cyl(70, 2400, { axis: 'x', x: 2500 }), G.cyl(600, 60, { axis: 'x', x: 2200, seg: 64 })]), mat: 'steel', pos: [0, -intR + hsR, 0], ex: [1500, 0, 0] }, 'hsShaft');
  parts.hs = hs;
  add({ id: 'brake', name: 'Brake calipers', system: 'drivetrain', geo: G.merge([G.rbox(260, 300, 200, 30, { x: 2200, y: 620 }), G.rbox(260, 300, 200, 30, { x: 2200, y: -620 })]), mat: 'paintRed', pos: [0, -intR + hsR, 0], ex: [1500, 800, 0] }, 'brake');
  add({ id: 'coupling', name: 'Flexible coupling', system: 'drivetrain', parent: 'hs-shaft', geo: G.merge([G.cyl(240, 300, { axis: 'x', x: 3100 }), G.cyl(200, 500, { axis: 'x', x: 3500 })]), mat: 'carbon', ex: [600, 0, 0] }, 'coupling');
  add({ id: 'gearbox-housing', name: 'Gearbox housing', system: 'structure', geo: G.merge([G.cyl(1480, 1500, { axis: 'x', x: -500, seg: 64 }), G.rbox(2400, 2200, 1600, 150, { x: 1000, y: -400 })]), mat: 'castIron', ex: [0, 2600, 0], ghost: true }, 'gearbox');

  yield 'generator and nacelle';
  const gen = add({ id: 'generator', name: 'Generator (3 MW DFIG)', system: 'drivetrain', geo: G.merge([G.cyl(1000, 2600, { axis: 'x', x: 5200, seg: 64 }), G.rbox(1400, 500, 900, 60, { x: 5200, y: 1200 })]), mat: 'paintGray', pos: [0, -intR + hsR, 0], ex: [2200, 0, 0], ghost: true }, 'generator');
  add({ id: 'gen-rotor', name: 'Generator rotor', system: 'drivetrain', parent: 'hs-shaft', geo: G.merge([G.cyl(600, 2200, { axis: 'x', x: 5200, seg: 48 }), G.cyl(70, 800, { axis: 'x', x: 6800 })]), mat: 'copper', ex: [2200, 0, 0] }, 'generator');
  add({ id: 'bedplate', name: 'Bedplate', system: 'structure', geo: G.merge([G.rbox(11000, 500, 3800, 100, { x: 1200, y: -2000 }), G.box(3000, 1200, 3000, { x: -2000, y: -1300 })]), mat: 'castIron', ex: [0, -1500, 0] }, 'bedplate');
  add({ id: 'yaw-bearing', name: 'Yaw bearing (slewing ring)', system: 'yaw', geo: G.merge([G.place(G.gear(140, 22, 300, { bore: 1420 }), { rx: Math.PI / 2, y: -2400 }), G.annulus(1700, 1580, 300, { y: -2400 })]), mat: 'hardened', pos: [-1200, 0, 0], ex: [0, -1200, 0] }, 'yawBearing');
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; add({ id: `yaw-drive-${i}`, name: `Yaw drive ${i + 1}`, system: 'yaw', geo: G.merge([G.cyl(220, 900, { y: -1650 }), G.cyl(140, 400, { y: -2400, seg: 24 }), G.place(G.gear(14, 22, 260, { bore: 40 }), { rx: Math.PI / 2, y: -2400 })]), mat: 'paintGray', pos: [-1200 + 1760 * Math.cos(a), 0, 1760 * Math.sin(a)], ex: [0, -600, 0] }, 'yawDrive'); }
  add({ id: 'tower', name: 'Tower top section', system: 'structure', geo: G.lathe([[1800, -10500], [1650, -2550], [1500, -2550], [1650, -10500]], { seg: 64 }), mat: 'paintWhite', pos: [-1200, 0, 0], ex: [0, -4000, 0] }, 'tower');
  add({ id: 'nacelle-cover', name: 'Nacelle cover', system: 'structure', geo: G.rbox(13000, 4600, 4400, 500, { x: 1600, y: 200 }), mat: 'paintWhite', ex: [0, 5000, 0], ghost: true }, 'cover');
  add({ id: 'anemometer', name: 'Anemometer & wind vane', system: 'yaw', geo: G.merge([G.cyl(30, 1200, { x: 6500, y: 3100 }), G.radial(G.sphere(90, { x: 220 }), 3, 'y').translate(6500, 3700, 0), G.box(600, 40, 200, { x: 5400, y: 3500 }), G.cyl(30, 800, { x: 5400, y: 3000 })]), mat: 'darkSteel', ex: [0, 2500, 0] }, 'anemometer');
  add({ id: 'cooler', name: 'Cooling unit', system: 'structure', geo: G.rbox(1800, 1200, 2600, 100, { x: 7800, y: 3000 }), mat: 'paintGray', ex: [0, 2500, 0] }, 'cooler');
  add({ id: 'converter', name: 'Converter & transformer cabinets', system: 'structure', geo: G.merge([G.rbox(1800, 1600, 1200, 60, { x: 4000, y: -1000, z: -1400 }), G.rbox(1400, 1400, 1000, 60, { x: 6000, y: -1100, z: 1500 })]), mat: 'paintGray', ex: [0, -1800, 0] }, 'converter');
}

let pitchNow = 0;
function animate(ctx) {
  const parts = ctx.refs; const th = ctx.theta;
  parts.shaft.obj.rotation.x = th;
  const wc = th;                                        // carrier = rotor
  const planetRel = -wc * RING_T / PLANET_T;            // planet spin relative to carrier (fixed ring)
  for (const pg of parts.planets) {
    const a = pg.userData.a + wc; const r = MOD * (SUN_T + PLANET_T) / 2;
    pg.obj.position.set(-600, r * Math.cos(a), r * Math.sin(a));
    pg.obj.rotation.x = wc + planetRel;
  }
  const wsun = wc * RATIO1;
  parts.sun.obj.rotation.x = wsun;
  const wint = -wsun * RATIO2; parts.inter.obj.rotation.x = wint;
  const whs = -wint * RATIO3; parts.hs.obj.rotation.x = whs;
  // blade pitch: mode 0 = producing (0°), 1 = feathered (90°)
  const target = (ctx.mode ?? 0) === 0 ? 0 : 88 * DEG;
  pitchNow += (target - pitchNow) * Math.min(1, ctx.dt * 1.2);
  for (const bl of parts.blades) { bl.obj.rotation.set(bl.userData.a, 0, 0); bl.obj.rotateY(pitchNow); }
}

export default {
  id: 'windturbine', name: 'Wind turbine nacelle', shortName: 'the wind turbine', sub: '3 MW class · 90 m rotor · planetary + 2 helical stages, 78 : 1', color: '#8fb3c9',
  pieces: 45, explodeScale: 0.5, defaultView: 'iso', sectionDefault: 0, sectionAxis: 'z', ghostOpacity: 0.08,
  views: { iso: [1, 0.5, 1.2], front: [-1, 0.05, 0.02], side: [0.02, 0.05, 1], top: [0.001, 1, 0.001] },
  drive: { label: 'Rotor', revPerSec: 0.12, unit: 'rpm on screen (real: 10–17)' },
  modes: { label: 'Blades', options: ['Producing', 'Feathered'], default: 0 },
  hint: 'Zoom into the nacelle to see the gearbox stages · Press X to hide the covers',
  systems: [
    { id: 'blades', name: 'Blades', color: '#e2571f', kind: 'moving', noBounds: true, tint: 0, blurb: 'Three 45 m blades.' },
    { id: 'rotor', name: 'Hub & main shaft', color: '#f0a020', kind: 'moving', blurb: 'Hub, spinner and the main shaft.' },
    { id: 'pitch', name: 'Pitch system', color: '#c9509d', kind: 'moving', blurb: 'Pitch bearings and drives inside the hub.' },
    { id: 'gearbox', name: 'Gearbox', color: '#f2b632', kind: 'moving', blurb: 'Planet carrier, planets, fixed ring, sun, and the two helical stages.' },
    { id: 'drivetrain', name: 'Drivetrain', color: '#2fb27a', kind: 'moving', blurb: 'Main bearing, brake, coupling and generator.' },
    { id: 'yaw', name: 'Yaw & sensors', color: '#5b8def', kind: 'moving', blurb: 'Yaw bearing, four yaw drives, anemometer and vane.' },
    { id: 'structure', name: 'Structure & covers', color: '#b8bec6', kind: 'static', housing: true, blurb: 'Bedplate, bearing and gearbox housings, tower top, nacelle cover, cabinets.' },
  ],
  about: `<p>A 3 MW class geared wind turbine. The 90 m rotor turns at 10–17 rpm; the gearbox steps that up through a planetary stage (the carrier is driven, the ring is fixed, the sun is the output) and two helical stages to about 1,300 rpm for the generator. Every gear ratio in the model comes from the tooth counts, so the sun really does turn 4.75 times per rotor turn and the high-speed shaft about 78 times.</p>
  <p>Switch the blades to Feathered to see the pitch system turn them edge-on, which is how a turbine is stopped.</p>`,
  build, animate,
};
