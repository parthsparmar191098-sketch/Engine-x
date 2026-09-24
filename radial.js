// Seven-cylinder single-row radial engine. Crank axis = X, propeller at −X. Cylinder 1 at top (+Y), numbered toward +Z.
import * as THREE from 'three';
import * as G from './geom.js';
import { makeMaterial } from './materials.js';

const { TAU, DEG, V3 } = G;
const N = 7, DELTA = TAU / N;
const BORE = 130, STROKE = 130, R = STROKE / 2, L_MASTER = 245, L_LINK = 176, RHO = 70, CH = 45;
const CASE_R = 210, DECK = 360, HEAD_TOP = 470;
const FIRE_DEG = []; for (let c = 0; c < N; c++) FIRE_DEG[c] = ((4 * c) % 7) * (720 / 7);   // firing order 1-3-5-7-2-4-6
const CAM_LOBES = 4, CAM_RATIO = 1 / 8, CAM_X = -112, CAM_R = 200, LIFT = 12;
const VALVE_T = 36;                   // tangential offset of intake (+) and exhaust (−) valves
const TAPPET_ANG = VALVE_T / (CAM_R + 5);
const beta = c => c * DELTA;

const INFO = {
  crankcase: { desc: 'The crankcase: a short, stiff aluminum drum with seven mounting pads, one for each cylinder. All seven combustion loads meet here and are reacted by the single crankshaft throw in the centre.', notes: ['Split front-to-rear so the one-piece master rod assembly can be installed.', 'The engine is short because the cylinders are arranged around the crank instead of along it, which is why radials suit aircraft.'], block: { material: 'Forged aluminum, two halves', cylinders: '7 in one row', displacement: '≈ 12 L' } },
  noseCase: { desc: 'The nose case carries the front crank bearing, the cam ring and the propeller thrust bearing. On larger radials it also houses the propeller reduction gear.', block: { bearing: 'Ball thrust bearing', contents: 'Cam ring, tappets' } },
  rearCase: { desc: 'The rear (accessory) case: the supercharger diffuser, the intake distribution to the seven cylinders, and the drives for the magnetos, oil pumps and generator.', block: { drives: 'Magnetos, oil pump, generator, fuel pump' } },
  cylinder: { desc: 'A cylinder barrel: a steel sleeve with fins turned into it, screwed and shrunk into an aluminum head. Air cooling means every cylinder is an island, each with its own valves, plugs and exhaust.', notes: ['Fins on the barrel are machined steel; on the head they are cast aluminum, far deeper, because the head runs hottest.', 'Cooling air comes from the propeller slipstream, guided by sheet-metal baffles.'], block: { bore: '130 mm', material: 'Nitrided steel barrel', fins: 'Machined, 3 mm pitch' } },
  head: { desc: 'The cylinder head, deeply finned, with one intake and one exhaust valve, two spark plugs and the rocker boxes. Screwed onto the barrel while hot so that it clamps tight when it cools.', block: { material: 'Cast aluminum', valves: '2 per cylinder', plugs: '2 per cylinder' } },
  piston: { desc: 'A piston. Because all seven pistons rise and fall in different directions, the engine’s rotating balance is remarkably good, though each piston still reverses violently at the ends of its stroke.', block: { diameter: '130 mm', material: 'Forged aluminum', rings: '3' } },
  pin: { desc: 'A full-floating piston pin.', block: { size: 'Ø 32 mm' } },
  ring: { desc: 'A piston ring. Air-cooled cylinders run hotter and distort more than water-cooled ones, so radial engines use tall rings with generous end gaps.', block: { material: 'Cast iron' } },
  master: { desc: 'The master rod: the one connecting rod that actually rides on the crankpin. Its big end carries six knuckle pins for the link rods of the other cylinders. Everything about a radial follows from this part.', notes: ['Because the link rods pivot on the master rod and not on the crankpin, their pistons do not follow a true slider-crank motion: each link cylinder has a slightly different stroke and timing. Designers compensate in the cam and ignition timing.', 'The master rod cylinder is chosen as number 1.'], block: { length: '245 mm', bigEnd: 'Ø 70 mm crankpin', knucklePins: '6' } },
  link: { desc: 'A link rod (articulated rod). It connects its piston not to the crankshaft but to a knuckle pin on the master rod’s big end, which swings around with the master rod.', notes: ['Watch its lower end: it travels in a small loop rather than a circle.'], block: { length: '176 mm', material: 'Forged steel' } },
  knuckle: { desc: 'A knuckle pin: the hardened pin, pressed into the master rod flange, on which a link rod pivots.', block: { size: 'Ø 16 mm' } },
  crank: { desc: 'The crankshaft has a single throw for all seven cylinders. It is made in two pieces that clamp together at the crankpin so the master rod can be assembled around it, and it carries large counterweights, often with pendulum dampers, to balance the rotating mass.', notes: ['One crankpin serving seven cylinders is the defining trick of the radial layout.', 'Dynamic counterweights swing on pins to cancel torsional vibration at particular orders.'], block: { throw: '65 mm', pin: 'Ø 70 mm', pieces: '2, clamped at the pin' } },
  camRing: { desc: 'The cam ring: a large ring with four lobes on each of two tracks. It turns in the nose case at one-eighth crankshaft speed, the same direction as the crank, and one lobe passes each tappet exactly once per two crank revolutions. Seven cylinders, four lobes, and the 1-3-5-7-2-4-6 firing order all fall out of that arithmetic.', notes: ['Driven from the crank through a small gear train.', 'The intake and exhaust tracks are the same ring, phased differently.'], block: { lobes: '4 per track, 2 tracks', speed: '⅛ crank speed', drive: 'Spur gear reduction' } },
  tappet: { desc: 'A cam follower riding on the cam ring. As a lobe passes underneath it moves outward and pushes its pushrod.', block: { type: 'Roller tappet' } },
  pushrod: { desc: 'A pushrod carrying the tappet’s motion from the nose case out to the rocker arm on the head. It runs inside a sealed tube so the rocker box oil can drain back.', block: { length: '≈ 260 mm', material: 'Steel tube' } },
  pushrodTube: { desc: 'The pushrod housing: a tube with rubber seals at both ends that keeps the oil in and the weather out.', block: { seal: 'Rubber, both ends' } },
  rocker: { desc: 'A rocker arm on the head, pivoting on a roller bearing. The pushrod lifts one end and the other end pushes the valve open.', block: { ratio: '≈ 1 : 1', bearing: 'Needle roller' } },
  valveIn: { desc: 'The intake valve, opening to admit the charge delivered by the supercharger from the rear case.', block: { head: 'Ø 62 mm' } },
  valveEx: { desc: 'The exhaust valve, sodium-cooled: the hollow stem is part-filled with sodium that sloshes and carries heat from the head to the guide.', block: { head: 'Ø 55 mm', cooling: 'Sodium-filled stem' } },
  spring: { desc: 'Valve springs, usually a nested pair so that a broken outer spring does not drop a valve into the cylinder.', block: { type: 'Nested pair' } },
  intakePipe: { desc: 'An intake pipe from the rear case diffuser to the cylinder head. All seven are the same length so the mixture is shared evenly.', block: { material: 'Aluminum tube' } },
  exhaust: { desc: 'An exhaust stack. On installed engines these feed a collector ring inside the cowling.', block: { material: 'Stainless steel' } },
  plug: { desc: 'One of two spark plugs per cylinder, fired by separate magnetos so that no single failure stops the engine.', block: { thread: 'M18', ignition: 'Dual magneto' } },
  propHub: { desc: 'The propeller hub, splined to the crankshaft. On this direct-drive engine the propeller turns at crank speed.', block: { drive: 'Direct, spline' } },
  propBlade: { desc: 'A propeller blade. Twisted along its length so every station meets the air at a useful angle; the tip travels much faster than the root.', block: { diameter: '2.0 m', material: 'Aluminum alloy' } },
  magneto: { desc: 'A magneto: a self-contained generator and coil that makes its own spark current without a battery. Two of them, one per plug set.', block: { type: 'Rotating magnet', count: '2' } },
  carb: { desc: 'The carburetor on the rear case, ahead of the supercharger impeller. Mixture is set by the pilot with a separate lever.', block: { type: 'Updraft, pressure' } },
  supercharger: { desc: 'A gear-driven centrifugal supercharger impeller in the rear case. It spins at up to ten times crank speed and distributes the mixture evenly to the seven intake pipes, as much as it boosts it.', block: { ratio: '≈ 10 : 1', purpose: 'Mixture distribution and boost' } },
  sump: { desc: 'The oil sump collects the scavenge oil. Radials are dry-sump: the oil tank is elsewhere in the aircraft, and the engine pumps the oil back to it.', block: { system: 'Dry sump' } },
};

const bump = (g, half) => (Math.abs(g) < half ? 0.5 * (1 + Math.cos(Math.PI * g / half)) : 0);
// cam track phases (ring degrees): intake peak at cycle 450°, exhaust at 270°, plus the tangential tappet offset
const LAMBDA_IN = -450 / 8 + TAPPET_ANG / DEG, LAMBDA_EX = -270 / 8 - TAPPET_ANG / DEG;
const RING_HALF = 16; // ring degrees of lift half-width
function lift(thetaDeg, c, intake) {
  const psi = thetaDeg * CAM_RATIO + (intake ? LAMBDA_IN : LAMBDA_EX) - beta(c) / DEG;
  let g = ((psi % 90) + 90 + 45) % 90 - 45;
  return LIFT * bump(g, RING_HALF);
}
function camRingShape(lambdaDeg, rBase) {
  const s = new THREE.Shape(); const n = 360;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU; let r = rBase;
    for (let m = 0; m < CAM_LOBES; m++) { let g = (a / DEG - lambdaDeg - m * 90); g = ((g % 360) + 540) % 360 - 180; r += LIFT * bump(g, RING_HALF); }
    // ring rotates by +theta/8 about X in (v,u)=(Y,Z): angle a measured from +Y toward +Z -> (u,v) = (r sin a, r cos a)
    const u = r * Math.sin(a), v = r * Math.cos(a);
    if (i === 0) s.moveTo(u, v); else s.lineTo(u, v);
  }
  s.closePath(); G.circleHole(s, rBase - 28); return s;
}

function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };
  const qc = c => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), beta(c));
  const dir = c => V3(0, Math.cos(beta(c)), Math.sin(beta(c)));   // radial unit vector of cylinder c
  const tan = c => V3(0, -Math.sin(beta(c)), Math.cos(beta(c)));  // tangential (+ toward next cylinder)
  const at = (c, x, r, t) => V3(x, 0, 0).addScaledVector(dir(c), r).addScaledVector(tan(c), t);

  yield 'crankcase';
  add({ id: 'case-front', name: 'Crankcase (front half)', system: 'case', geo: G.merge([G.cyl(CASE_R, 90, { axis: 'x', x: -45, seg: 84 }), ...Array.from({ length: N }, (_, c) => G.place(G.cyl(78, 30, { y: CASE_R - 8, seg: 40 }), { rx: beta(c), x: -25 }))]), mat: 'castAlu', ex: [-260, 0, 0], ghost: true }, 'crankcase');
  add({ id: 'case-rear', name: 'Crankcase (rear half)', system: 'case', geo: G.merge([G.cyl(CASE_R, 90, { axis: 'x', x: 45, seg: 84 }), ...Array.from({ length: N }, (_, c) => G.place(G.cyl(78, 30, { y: CASE_R - 8, seg: 40 }), { rx: beta(c), x: 25 }))]), mat: 'castAlu', ex: [260, 0, 0], ghost: true }, 'crankcase');
  add({ id: 'nose-case', name: 'Nose case', system: 'case', geo: G.lathe([[70, -250], [150, -215], [225, -150], [232, -90], [232, -90.1], [0, -90.1], [0, -250]].map(p => p), { axis: 'x', seg: 72 }), mat: 'castAlu', ex: [-520, 0, 0], ghost: true }, 'noseCase');
  add({ id: 'rear-case', name: 'Rear accessory case', system: 'case', geo: G.merge([G.lathe([[0, 90], [232, 90], [232, 150], [200, 200], [120, 230], [0, 230]], { axis: 'x', seg: 72 }), G.torus(250, 28, { axis: 'x', x: 150, seg: 72 })]), mat: 'castAlu', ex: [520, 0, 0], ghost: true }, 'rearCase');
  add({ id: 'supercharger', name: 'Supercharger impeller', system: 'induction', geo: G.merge([G.cyl(110, 6, { axis: 'x', x: 130 }), ...Array.from({ length: 14 }, (_, i) => G.place(G.box(24, 70, 3, { y: 70 }), { rx: (i / 14) * TAU, x: 118 }))]), mat: 'aluminum', ex: [520, 0, 0] }, 'supercharger');
  add({ id: 'sump', name: 'Oil sump', system: 'case', geo: G.rbox(120, 70, 160, 12, { y: -235 }), mat: 'castAlu', ex: [0, -220, 0] }, 'sump');

  yield 'crankshaft';
  const cw = G.roundedPoly([[-90, -20, 12], [90, -20, 12], [110, -70, 20], [0, -120, 30], [-110, -70, 20]]);
  const crank = add({ id: 'crank', name: 'Crankshaft (two-piece, single throw)', system: 'crank', geo: G.merge([G.cyl(30, 120, { axis: 'x', x: -140 }), G.cyl(35, 110, { axis: 'x', x: 130 }), G.cyl(35, 90, { axis: 'x', x: 0, y: R }), G.extrudeX(cw, 34, { x: -62 }), G.extrudeX(cw, 34, { x: 62 }), G.cyl(48, 34, { axis: 'x', x: -62, y: R * 0.5 }), G.cyl(48, 34, { axis: 'x', x: 62, y: R * 0.5 }), G.cyl(22, 100, { axis: 'x', x: -240 })]), mat: 'steel', ex: [0, 0, 0] }, 'crank');
  parts.crank = crank;
  add({ id: 'prop-hub', name: 'Propeller hub', system: 'prop', parent: 'crank', geo: G.lathe([[0, -330], [60, -330], [80, -300], [80, -250], [60, -235], [0, -235]], { axis: 'x', seg: 48 }), mat: 'steel', ex: [-400, 0, 0] }, 'propHub');
  const propBlade = G.place(G.blade({ rRoot: 70, rTip: 1000, chordRoot: 170, chordTip: 120, staggerRoot: 55, staggerTip: 14, camber: 0.05, thick: 0.1, nSpan: 14, nChord: 12 }), { ry: Math.PI / 2, x: -283 });
  [0, Math.PI].forEach((a, i) => add({ id: `prop-${i}`, name: `Propeller blade ${i + 1}`, system: 'prop', parent: 'crank', geo: G.place(propBlade.clone(), { rx: a }), mat: 'aluminum', ex: [-400, 0, 0] }, 'propBlade'));
  add({ id: 'cam-ring', name: 'Cam ring (4 lobes × 2 tracks)', system: 'valvetrain', geo: G.merge([G.extrudeX(camRingShape(LAMBDA_IN, CAM_R), 14, { x: CAM_X - 8 }), G.extrudeX(camRingShape(LAMBDA_EX, CAM_R), 14, { x: CAM_X + 8 })]), mat: 'darkSteel', ex: [-300, 0, 0] }, 'camRing');
  parts.camRing = P.get('cam-ring');

  yield 'master rod';
  const knuckleBoss = c => G.place(G.annulus(17, 8, 40, { axis: 'x' }), { y: RHO, rx: beta(c) });
  const masterGeo = G.merge([G.annulus(62, 36, 60, { axis: 'x' }), G.box(14, 200, 40, { y: 130 }), G.box(40, 200, 8, { y: 130, z: 16 }), G.box(40, 200, 8, { y: 130, z: -16 }), G.annulus(30, 17, 44, { axis: 'x', y: L_MASTER }), ...Array.from({ length: 6 }, (_, i) => knuckleBoss(i + 1)), G.cyl(95, 12, { axis: 'x', x: -36 }), G.cyl(95, 12, { axis: 'x', x: 36 })]);
  const master = add({ id: 'master-rod', name: 'Master rod (cylinder 1)', system: 'crank', geo: masterGeo, mat: 'steel', pos: [0, R, 0], ex: [0, 0, 0] }, 'master');
  parts.master = master;
  const linkGeo = G.merge([G.annulus(20, 9, 34, { axis: 'x' }), G.box(10, L_LINK - 40, 26, { y: L_LINK / 2 }), G.box(26, L_LINK - 40, 6, { y: L_LINK / 2, z: 11 }), G.box(26, L_LINK - 40, 6, { y: L_LINK / 2, z: -11 }), G.annulus(26, 17, 34, { axis: 'x', y: L_LINK })]);
  parts.links = [];
  for (let c = 1; c < N; c++) {
    add({ id: `knuckle-${c}`, name: `Knuckle pin · cylinder ${c + 1}`, system: 'crank', parent: 'master-rod', geo: G.place(G.cyl(8, 64, { axis: 'x' }), { y: RHO, rx: beta(c) }), mat: 'hardened', ex: [-80, 0, 0] }, 'knuckle');
    parts.links[c] = add({ id: `link-rod-${c}`, name: `Link rod · cylinder ${c + 1}`, system: 'crank', geo: linkGeo.clone(), mat: 'steel', ex: [0, 0, 0] }, 'link');
  }

  yield 'cylinders';
  const barrelPts = G.finnedProfile(BORE / 2, BORE / 2 + 6, 150, 18, BORE / 2 + 34, 3).map(([r, y]) => [r, y + CASE_R]);
  const headPts = [[0, 0], [BORE / 2 + 8, 0], [BORE / 2 + 8, 12]]; for (let i = 0; i < 9; i++) { const y0 = 14 + i * 11; headPts.push([BORE / 2 + 8, y0], [BORE / 2 + 62, y0], [BORE / 2 + 62, y0 + 4], [BORE / 2 + 8, y0 + 4]); } headPts.push([BORE / 2 + 8, 110], [BORE / 2 - 20, 110], [0, 110]);
  const pistonPts = [[0, CH], [BORE / 2, CH], [BORE / 2, CH - 8], [BORE / 2 - 5, CH - 8], [BORE / 2 - 5, CH - 11], [BORE / 2, CH - 11], [BORE / 2, CH - 18], [BORE / 2 - 5, CH - 18], [BORE / 2 - 5, CH - 21], [BORE / 2, CH - 21], [BORE / 2, CH - 28], [BORE / 2 - 5, CH - 28], [BORE / 2 - 5, CH - 32], [BORE / 2, CH - 32], [BORE / 2, -45], [BORE / 2 - 8, -45], [BORE / 2 - 8, CH - 12], [0, CH - 12]];
  parts.pistons = [];
  for (let c = 0; c < N; c++) {
    const q = qc(c);
    add({ id: `barrel-${c + 1}`, name: `Cylinder barrel · cylinder ${c + 1}`, system: 'cylinders', geo: G.lathe(barrelPts, { seg: 64 }), mat: 'darkSteel', quat: q, ex: [0, 0, 0], ghost: true }, 'cylinder');
    const headP = at(c, 0, DECK, 0);
    add({ id: `head-${c + 1}`, name: `Cylinder head · cylinder ${c + 1}`, system: 'cylinders', geo: G.lathe(headPts, { seg: 64 }), mat: 'castAlu', pos: [headP.x, headP.y, headP.z], quat: q, ex: [0, 0, 0], ghost: true }, 'head');
    const pist = add({ id: `piston-${c + 1}`, name: `Piston · cylinder ${c + 1}`, system: 'crank', geo: G.merge([G.lathe(pistonPts, { seg: 64 }), G.cyl(22, 90, { axis: 'z', y: -4 })]), mat: 'aluminum', quat: q, ex: [0, 0, 0] }, 'piston');
    pist.userData = { c };
    parts.pistons[c] = pist;
    add({ id: `pin-${c + 1}`, name: `Piston pin · cylinder ${c + 1}`, system: 'crank', parent: pist.id, geo: G.annulus(16, 9, 96, { axis: 'z' }), mat: 'polished', ex: [0, 0, 100] }, 'pin');
    [CH - 9.5, CH - 19.5, CH - 30].forEach((y, j) => add({ id: `ring-${c + 1}-${j}`, name: `Piston ring ${j + 1} · cylinder ${c + 1}`, system: 'crank', parent: pist.id, geo: G.annulus(BORE / 2 + 0.3, BORE / 2 - 5.5, j === 2 ? 4 : 3, { y, seg: 64 }), mat: 'castIron', ex: [0, 60 - j * 15, 0] }, 'ring'));
    // heads: ports, plugs, exhaust, intake
    const plugF = at(c, -50, DECK + 40, 0), plugR = at(c, 50, DECK + 40, 0);
    [['a', plugF, 1], ['b', plugR, -1]].forEach(([s, p, sgn]) => add({ id: `plug-${c + 1}${s}`, name: `Spark plug ${s === 'a' ? '(front)' : '(rear)'} · cylinder ${c + 1}`, system: 'ignition', geo: G.merge([G.cyl(9, 24, { axis: 'x', x: sgn * -12 }), G.cyl(7, 26, { axis: 'x', x: sgn * -36 }), G.cyl(11, 8, { axis: 'x', x: sgn * -6, seg: 6 })]), mat: 'ceramic', pos: [p.x, p.y, p.z], quat: q, ex: [sgn * -120, 0, 0] }, 'plug'));
    const exP = at(c, -30, DECK + 70, -VALVE_T - 10);
    add({ id: `exhaust-${c + 1}`, name: `Exhaust stack · cylinder ${c + 1}`, system: 'induction', geo: G.pipe([[0, 0, 0], [-40, 10, -40], [-110, 20, -70], [-170, 20, -90]], 24), mat: 'exhaust', pos: [exP.x, exP.y, exP.z], quat: q, ex: [-150, 0, 0] }, 'exhaust');
    const inP = at(c, 30, DECK + 70, VALVE_T + 10);
    add({ id: `intake-${c + 1}`, name: `Intake pipe · cylinder ${c + 1}`, system: 'induction', geo: G.pipe([[0, 0, 0], [40, 0, 30], [110, -100, 60], [150, -190, 70]], 20), mat: 'aluminum', pos: [inP.x, inP.y, inP.z], quat: q, ex: [150, 0, 0] }, 'intakePipe');
  }

  yield 'valvetrain';
  parts.valves = [];
  const valveGeo = dia => G.lathe([[0, 0], [dia / 2, 0], [dia / 2, 3], [dia / 2 - 5, 7], [5.5, 10], [5.5, 100], [0, 100]], { seg: 32 });
  const springGeo = G.spring(22, 3, 46, 5);
  for (let c = 0; c < N; c++) {
    [['in', VALVE_T, 62, 'valveIn'], ['ex', -VALVE_T, 55, 'valveEx']].forEach(([side, t, dia, kind]) => {
      const id = `${side}-${c + 1}`; const intake = side === 'in';
      const q = qc(c); const d = dir(c);
      // valve: head face at DECK+12 (chamber roof), stem outward
      const face = at(c, 12, DECK + 12, t);
      const valve = add({ id: `valve-${id}`, name: `${intake ? 'Intake' : 'Exhaust'} valve · cylinder ${c + 1}`, system: 'valvetrain', geo: valveGeo(dia), mat: intake ? 'hardened' : 'inconel', pos: [face.x, face.y, face.z], quat: q, ex: [0, 0, 0] }, kind);
      valve.userData = { c, intake, d };
      const spP = at(c, 12, DECK + 12 + 70, t);
      const spring = add({ id: `spring-${id}`, name: `Valve spring · ${intake ? 'intake' : 'exhaust'} · cylinder ${c + 1}`, system: 'valvetrain', geo: springGeo.clone(), mat: 'darkSteel', pos: [spP.x, spP.y, spP.z], quat: q, ex: [0, 0, 0] }, 'spring');
      spring.userData = { seat: at(c, 12, DECK + 12 + 47, t), d };
      // rocker: pivot at x=-22, r=DECK+118, arm from x=-60 (pushrod) to x=+12 (valve tip)
      const piv = at(c, -22, DECK + 118, t);
      const rocker = add({ id: `rocker-${id}`, name: `Rocker arm · ${intake ? 'intake' : 'exhaust'} · cylinder ${c + 1}`, system: 'valvetrain', geo: G.merge([G.box(76, 12, 16, { x: -2 }), G.cyl(9, 22, { axis: 'z' }), G.box(10, 16, 14, { x: 32, y: -8 }), G.box(10, 16, 14, { x: -38, y: -8 })]), mat: 'steel', pos: [piv.x, piv.y, piv.z], quat: q, ex: [0, 0, 0] }, 'rocker');
      rocker.userData = { t: tan(c), intake };
      // pushrod from tappet (x=CAM_X, r=CAM_R+40) to rocker end (x=-60, r=DECK+108)
      const p0 = at(c, CAM_X, CAM_R + 40, t), p1 = at(c, -60, DECK + 106, t);
      const mid = p0.clone().add(p1).multiplyScalar(0.5); const len = p0.distanceTo(p1); const pd = p1.clone().sub(p0).normalize();
      const pushrod = add({ id: `pushrod-${id}`, name: `Pushrod · ${intake ? 'intake' : 'exhaust'} · cylinder ${c + 1}`, system: 'valvetrain', geo: G.merge([G.cyl(5, len - 4), G.sphere(7, { y: len / 2 - 2 }), G.sphere(7, { y: -len / 2 + 2 })]), mat: 'steel', pos: [mid.x, mid.y, mid.z], quat: G.quatToDir(pd), ex: [0, 0, 0] }, 'pushrod');
      pushrod.userData = { d, intake, c };
      add({ id: `tube-${id}`, name: `Pushrod tube · ${intake ? 'intake' : 'exhaust'} · cylinder ${c + 1}`, system: 'valvetrain', geo: G.annulus(11, 9, len - 60), mat: 'aluminum', pos: [mid.x, mid.y, mid.z], quat: G.quatToDir(pd), ex: [0, 0, 0], ghost: true }, 'pushrodTube');
      const tp = at(c, CAM_X, CAM_R + 22, t);
      const tappet = add({ id: `tappet-${id}`, name: `Cam follower · ${intake ? 'intake' : 'exhaust'} · cylinder ${c + 1}`, system: 'valvetrain', geo: G.merge([G.cyl(9, 36), G.cyl(11, 10, { axis: 'x', y: -20 })]), mat: 'hardened', pos: [tp.x, tp.y, tp.z], quat: q, ex: [0, 0, 0] }, 'tappet');
      tappet.userData = { d, intake, c };
      parts.valves.push({ valve, spring, rocker, pushrod, tappet, c, intake, d });
    });
  }

  yield 'accessories';
  [[-1, 'Magneto (left)'], [1, 'Magneto (right)']].forEach(([s, name], i) => add({ id: `magneto-${i}`, name, system: 'ignition', geo: G.merge([G.rbox(90, 70, 60, 8, { x: 250, y: 150, z: s * 90 }), G.cyl(20, 40, { axis: 'x', x: 210, y: 150, z: s * 90 })]), mat: 'paintBlack', ex: [300, 100, s * 100] }, 'magneto'));
  add({ id: 'carb', name: 'Carburetor', system: 'induction', geo: G.merge([G.rbox(90, 110, 90, 8, { x: 200, y: -160 }), G.annulus(38, 30, 30, { x: 200, y: -230 })]), mat: 'castAlu', ex: [300, -150, 0] }, 'carb');
}

function animate(ctx) {
  const parts = ctx.refs; const th = ctx.theta; const deg = th / DEG;
  parts.crank.obj.rotation.x = th;
  parts.camRing.obj.rotation.x = th * CAM_RATIO;
  // master rod: big end at the crankpin, small end on cylinder 1 axis (+Y)
  const py = R * Math.cos(th), pz = R * Math.sin(th);
  const s = R * Math.sin(th); const y1 = R * Math.cos(th) + Math.sqrt(L_MASTER * L_MASTER - s * s);
  const m = parts.master.obj; m.position.set(0, py, pz);
  const ang = Math.atan2(-pz, y1 - py); m.rotation.x = ang;
  parts.pistons[0].obj.position.set(0, y1, 0);
  // knuckle pins are fixed in the master rod frame at radius RHO, angle beta(c) from the rod axis
  const _k = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Vector3();
  for (let c = 1; c < N; c++) {
    // knuckle pin world position
    const a = ang + beta(c); _k.set(0, py + RHO * Math.cos(a), pz + RHO * Math.sin(a));
    _u.set(0, Math.cos(beta(c)), Math.sin(beta(c)));
    // piston pin along the cylinder axis at distance sPos: |sPos*u - k| = L_LINK
    const ku = _k.dot(_u); const perp2 = _k.lengthSq() - ku * ku;
    const sPos = ku + Math.sqrt(Math.max(0, L_LINK * L_LINK - perp2));
    _q.copy(_u).multiplyScalar(sPos);
    const pist = parts.pistons[c].obj; pist.position.copy(_q);
    const link = parts.links[c].obj; link.position.copy(_k);
    link.rotation.x = Math.atan2(_q.z - _k.z, _q.y - _k.y);
  }
  for (const v of parts.valves) {
    const L = lift(deg, v.c, v.intake);
    v.valve.obj.position.copy(v.valve.base.p).addScaledVector(v.d, -L);
    const len = 46 - L; v.spring.obj.position.copy(v.spring.userData.seat).addScaledVector(v.d, len / 2); v.spring.obj.scale.set(1, len / 46, 1);
    v.tappet.obj.position.copy(v.tappet.base.p).addScaledVector(v.d, L);
    v.pushrod.obj.position.copy(v.pushrod.base.p).addScaledVector(v.d, L);
    v.rocker.obj.quaternion.copy(v.rocker.base.q); v.rocker.obj.rotateZ(-L / 36);
  }
}
function cycle(theta) {
  const deg = ((theta / DEG) % 720 + 720) % 720;
  const idx = deg < 180 ? 2 : deg < 360 ? 3 : deg < 540 ? 0 : 1;
  return { title: 'Cylinder 1 (master rod)', labels: ['Intake', 'Compression', 'Power', 'Exhaust'], active: idx, color: ['#3b82f6', '#d9a300', '#e2571f', '#7a8794'][idx] };
}

export default {
  id: 'radial', name: 'Radial engine', shortName: 'the radial engine', sub: 'Seven-cylinder air-cooled · 130 × 130 mm · master and link rods · firing 1-3-5-7-2-4-6', color: '#d9a300',
  pieces: 210, explodeScale: 0.7, defaultView: 'iso', sectionDefault: 0.1, sectionAxis: 'x',
  views: { iso: [-1, 0.5, 1.1], front: [-1, 0.05, 0.02], side: [0.02, 0.05, 1], top: [0.001, 1, 0.001] },
  drive: { label: 'Crankshaft', revPerSec: 0.3 },
  hint: 'Front view shows the master rod and six link rods · Hide the case to watch the cam ring creep round',
  systems: [
    { id: 'crank', name: 'Crank & rods', color: '#e2571f', kind: 'moving', blurb: 'Single-throw crankshaft, master rod, six link rods and seven pistons.' },
    { id: 'cylinders', name: 'Cylinders & heads', color: '#8a929c', kind: 'static', housing: true, blurb: 'Seven finned barrels and heads.' },
    { id: 'valvetrain', name: 'Valvetrain', color: '#2fb27a', kind: 'moving', blurb: 'Cam ring, tappets, pushrods, rockers, valves and springs.' },
    { id: 'case', name: 'Crankcase & cases', color: '#b8bec6', kind: 'static', housing: true, blurb: 'Crankcase halves, nose case, rear case and sump.' },
    { id: 'prop', name: 'Propeller', color: '#5b8def', kind: 'moving', noBounds: true, blurb: 'Hub and two blades, direct drive.' },
    { id: 'induction', name: 'Induction & exhaust', color: '#3aa6d8', kind: 'static', blurb: 'Carburetor, supercharger, intake pipes and exhaust stacks.' },
    { id: 'ignition', name: 'Ignition', color: '#c9509d', kind: 'static', blurb: 'Two magnetos and fourteen spark plugs.' },
  ],
  about: `<p>A seven-cylinder single-row radial of about 12 litres, the classic light-aircraft engine of the 1930s and 40s. All seven connecting rods act on one crankpin: the master rod rides the pin directly and the six link rods pivot on knuckle pins in its big end.</p>
  <p>The link-rod pistons are solved each frame by intersecting the cylinder axis with a circle of the link-rod length about the moving knuckle pin, so their slightly irregular motion is real, not approximated. The cam ring's four lobes and one-eighth speed are derived from the firing order, and the valve lift you see is read off that ring.</p>`,
  build, animate, cycle,
};
