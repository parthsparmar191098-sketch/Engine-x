// Open differential with hypoid final drive. Pinion axis = X (input from −X), axle axis = Z.
import * as THREE from 'three';
import * as G from './geom.js';

const { TAU, DEG, V3 } = G;
const RING_T = 41, PIN_T = 11, M = 4;
const RING_R = M * RING_T / 2, HYPOID = -34;   // pinion offset below the ring gear centre

const INFO = {
  pinion: { desc: 'The drive pinion, turned by the propeller shaft. Its eleven teeth mesh with the ring gear’s forty-one, giving the final drive ratio of 3.73:1 and turning the drive through 90°.', notes: ['Hypoid: the pinion axis sits below the ring gear centre. That lets the pinion be larger and stronger and lowers the propshaft tunnel, at the cost of a sliding action that needs special oil.'], block: { teeth: '11', ratio: '41 : 11 = 3.73', offset: '34 mm hypoid', material: 'Case-hardened steel' } },
  ring: { desc: 'The ring gear (crown wheel) bolts to the differential carrier and is driven by the pinion. It is the last reduction in the drivetrain and carries the whole torque to the wheels.', block: { teeth: '41', diameter: 'Ø 164 mm pitch', bolts: '8 × M10' } },
  carrier: { desc: 'The differential carrier (case) rotates with the ring gear and carries the cross pin and the four bevel gears. When both wheels turn at the same speed the whole carrier turns as one lump and nothing inside it moves.', block: { material: 'Nodular iron', bearings: '2 taper roller' } },
  crossPin: { desc: 'The cross pin (spider shaft) is fixed in the carrier and carries the two spider gears. It goes round with the carrier.', block: { material: 'Hardened steel' } },
  spider: { desc: 'A spider (pinion) gear. It meshes with both side gears. If the wheels turn at the same speed it does not rotate on its pin at all; it only rolls between the side gears when one wheel turns faster than the other, and then it makes the other one slower by exactly the same amount.', notes: ['This is the whole trick: the carrier speed is always the average of the two wheel speeds.', 'It also splits torque equally, which is why a wheel on ice gets all the spin and the other gets nothing: the open differential’s weakness.'], block: { teeth: '10', bearing: 'Runs on the cross pin' } },
  side: { desc: 'A side gear, splined to an axle shaft. The two side gears face each other across the carrier and both mesh with both spider gears.', block: { teeth: '16', spline: 'to axle shaft' } },
  washer: { desc: 'A thrust washer behind a bevel gear, taking the separating force of the mesh.', block: { material: 'Hardened steel' } },
  axle: { desc: 'An axle half-shaft, splined into a side gear and carrying a wheel at the other end.', block: { material: 'Induction-hardened steel' } },
  bearing: { desc: 'A tapered roller bearing. The carrier bearings and pinion bearings are preloaded so that the gear mesh position does not move under load.', block: { type: 'Taper roller, preloaded' } },
  housing: { desc: 'The axle housing (banjo or carrier type) holds the pinion and carrier bearings at the exact positions needed for the hypoid mesh, and holds about a litre of gear oil.', block: { material: 'Cast iron / steel', oil: '75W-90 GL-5 hypoid' } },
  cover: { desc: 'The inspection cover on the back of the housing. Remove it and you can see the ring gear and carrier.', block: { bolts: '10 × M8' } },
  flange: { desc: 'The pinion flange, where the propeller shaft’s universal joint bolts on.', block: { bolts: '4 × M10' } },
  nut: { desc: 'The pinion nut. Tightening it crushes the collapsible spacer to set the bearing preload.', block: { torque: '≈ 200 N·m' } },
  spacer: { desc: 'The crush sleeve (collapsible spacer) between the pinion bearings; it yields as the nut is tightened and sets the preload.', block: { type: 'Collapsible spacer' } },
  tube: { desc: 'An axle tube, pressed and welded into the housing, carrying the axle shaft and the wheel bearing at its end.', block: { material: 'Steel tube' } },
  hub: { desc: 'The wheel hub and flange at the end of the axle shaft.', block: { studs: '5' } },
  plug: { desc: 'Filler plug. Oil level is checked at the bottom of this hole.', block: { size: '½ in NPT' } },
};

function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };
  yield 'final drive';
  const pin = add({ id: 'pinion', name: 'Drive pinion', system: 'drive', geo: G.merge([G.place(G.bevelGear(PIN_T, M, 44, 0.7, { bore: 10 }), { ry: -Math.PI / 2, x: -102 }), G.cyl(15, 150, { axis: 'x', x: -190 })]), mat: 'hardened', pos: [0, 0, HYPOID], ex: [-220, 0, 0] }, 'pinion');
  parts.pinion = pin;
  add({ id: 'pinion-flange', name: 'Pinion flange', system: 'drive', parent: 'pinion', geo: G.merge([G.cyl(45, 14, { axis: 'x', x: -268 }), G.cyl(22, 40, { axis: 'x', x: -250 })]), mat: 'steel', ex: [-120, 0, 0] }, 'flange');
  add({ id: 'pinion-nut', name: 'Pinion nut', system: 'drive', parent: 'pinion', geo: G.cyl(16, 12, { axis: 'x', x: -281, seg: 6 }), mat: 'darkSteel', ex: [-180, 0, 0] }, 'nut');
  [-150, -215].forEach((x, i) => add({ id: `pinion-bearing-${i}`, name: `Pinion bearing (${i ? 'front' : 'rear'})`, system: 'drive', geo: G.merge([G.annulus(34, 27, 20, { axis: 'x', x }), G.annulus(21, 15, 20, { axis: 'x', x }), G.radial(G.cyl(3.5, 14, { axis: 'x', y: 24 }), 14, 'x').translate(x, 0, 0)]), mat: 'hardened', pos: [0, 0, HYPOID], ex: [-100, 0, 0] }, 'bearing'));
  add({ id: 'spacer', name: 'Crush sleeve', system: 'drive', geo: G.annulus(19, 16, 50, { axis: 'x', x: -182 }), mat: 'steel', pos: [0, 0, HYPOID], ex: [-100, 40, 0] }, 'spacer');
  const carrier = add({ id: 'carrier', name: 'Differential carrier', system: 'diff', geo: G.merge([G.annulus(62, 30, 90, { axis: 'z', seg: 48 }), G.annulus(60, 22, 20, { axis: 'z', z: -55 }), G.annulus(60, 22, 20, { axis: 'z', z: 55 }), G.annulus(88, 62, 14, { axis: 'z', z: -22 })]), mat: 'castIron', ex: [0, 0, 0], ghost: true }, 'carrier');
  parts.carrier = carrier;
  const ringPhase = 0;
  add({ id: 'ring-gear', name: 'Ring gear (crown wheel)', system: 'drive', parent: 'carrier', geo: G.place(G.bevelGear(RING_T, M, 24, 0.7, { bore: 62 }), { z: -34 }), mat: 'hardened', ex: [0, 0, -90] }, 'ring');
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; add({ id: `ring-bolt-${i}`, name: `Ring gear bolt ${i + 1}`, system: 'drive', parent: 'carrier', geo: G.place(G.bolt(10, 30), { rx: Math.PI / 2, x: 72 * Math.cos(a), y: 72 * Math.sin(a), z: -46 }), mat: 'darkSteel', ex: [0, 0, -140] }, 'bolt'); }
  add({ id: 'cross-pin', name: 'Cross pin (spider shaft)', system: 'diff', parent: 'carrier', geo: G.cyl(8, 120), mat: 'hardened', ex: [0, 120, 0] }, 'crossPin');
  parts.spiders = [];
  [1, -1].forEach((s, i) => { const sp = add({ id: `spider-${i}`, name: `Spider gear ${i + 1}`, system: 'diff', parent: 'carrier', geo: G.place(G.bevelGear(10, 3, 18, 0.6, { bore: 8 }), { rx: s > 0 ? Math.PI / 2 : -Math.PI / 2, y: s * 38 }), mat: 'hardened', ex: [0, s * 90, 0] }, 'spider'); parts.spiders.push({ p: sp, s }); add({ id: `spider-washer-${i}`, name: `Spider thrust washer ${i + 1}`, system: 'diff', parent: 'carrier', geo: G.annulus(15, 8.5, 2, { y: s * 48 }), mat: 'steel', ex: [0, s * 120, 0] }, 'washer'); });
  parts.sides = [];
  [1, -1].forEach((s, i) => {
    const side = add({ id: `side-gear-${i}`, name: `Side gear (${s > 0 ? 'right' : 'left'})`, system: 'axles', geo: G.place(G.bevelGear(16, 3, 18, 0.6, { bore: 14 }), { rx: s > 0 ? Math.PI : 0, z: s * 30 }), mat: 'hardened', ex: [0, 0, s * 60] }, 'side');
    const axle = add({ id: `axle-${i}`, name: `Axle shaft (${s > 0 ? 'right' : 'left'})`, system: 'axles', geo: G.merge([G.cyl(14, 360, { axis: 'z', z: s * 215 }), G.cyl(60, 14, { axis: 'z', z: s * 400 })]), mat: 'steel', ex: [0, 0, s * 220] }, 'axle');
    add({ id: `hub-${i}`, name: `Wheel hub (${s > 0 ? 'right' : 'left'})`, system: 'axles', parent: axle.id, geo: G.merge([G.cyl(50, 20, { axis: 'z', z: s * 412 }), G.radial(G.cyl(6, 30, { axis: 'z', y: 38, z: s * 430 }), 5, 'z')]), mat: 'darkSteel', ex: [0, 0, s * 100] }, 'hub');
    add({ id: `carrier-bearing-${i}`, name: `Carrier bearing (${s > 0 ? 'right' : 'left'})`, system: 'diff', geo: G.merge([G.annulus(70, 62, 20, { axis: 'z', z: s * 75 }), G.annulus(30, 22, 20, { axis: 'z', z: s * 75 }), G.radial(G.cyl(4, 14, { axis: 'z', y: 46, z: s * 75 }), 18, 'z')]), mat: 'hardened', ex: [0, 0, s * 130] }, 'bearing');
    add({ id: `axle-tube-${i}`, name: `Axle tube (${s > 0 ? 'right' : 'left'})`, system: 'housing', geo: G.annulus(38, 30, 270, { axis: 'z', z: s * 245 }), mat: 'paintBlack', ex: [0, 0, s * 260], ghost: true }, 'tube');
    parts.sides.push({ side, axle, s });
  });
  yield 'housing';
  add({ id: 'housing', name: 'Axle housing (carrier)', system: 'housing', geo: G.merge([G.lathe([[0, -120], [120, -120], [125, -60], [125, 60], [120, 120], [0, 120]], { axis: 'z', seg: 64 }), G.annulus(46, 38, 150, { axis: 'x', x: -195, z: HYPOID })]), mat: 'castIron', ex: [0, 0, 0], ghost: true }, 'housing');
  add({ id: 'cover', name: 'Inspection cover', system: 'housing', geo: G.merge([G.cyl(128, 6, { axis: 'x', x: 128 }), G.cyl(110, 30, { axis: 'x', x: 140, rTop: 90 })]), mat: 'paintBlack', ex: [200, 0, 0], ghost: true }, 'cover');
  add({ id: 'fill-plug', name: 'Filler plug', system: 'housing', geo: G.merge([G.cyl(10, 10, { axis: 'x', x: 136, y: 60, seg: 6 })]), mat: 'darkSteel', ex: [240, 60, 0] }, 'plug');
}

function animate(ctx) {
  const parts = ctx.refs; const th = ctx.theta;
  const split = [0, 0.35, 1][ctx.mode ?? 0];   // 0 straight, 0.35 cornering, 1 one wheel free
  parts.pinion.obj.rotation.x = th;
  const wc = -th * PIN_T / RING_T;                // carrier angle
  parts.carrier.obj.rotation.z = wc;
  const wl = wc * (1 + split), wr = wc * (1 - split);
  parts.sides[0].side.obj.rotation.z = wr; parts.sides[0].axle.obj.rotation.z = wr;
  parts.sides[1].side.obj.rotation.z = wl; parts.sides[1].axle.obj.rotation.z = wl;
  const spin = split * wc * 16 / 10;              // spider rotation about the cross pin, relative to the carrier
  for (const sp of parts.spiders) { sp.p.obj.rotation.set(0, 0, 0); sp.p.obj.rotateY(sp.s * spin); }
}

export default {
  id: 'differential', name: 'Differential', shortName: 'the differential', sub: 'Open differential · hypoid final drive 3.73 : 1 · rear axle', color: '#9a6b4f',
  pieces: 40, explodeScale: 0.9, defaultView: 'iso', sectionDefault: 0, sectionAxis: 'y', ghostOpacity: 0.1,
  views: { iso: [-1, 0.6, 1.1], front: [-1, 0.08, 0.02], side: [0.02, 0.08, 1], top: [0.001, 1, 0.001] },
  drive: { label: 'Propeller shaft', revPerSec: 0.4 },
  modes: { label: 'Driving', options: ['Straight road', 'Cornering', 'One wheel on ice'], default: 1 },
  hint: 'Change the scenario below and watch the spider gears · X shows inside the carrier',
  systems: [
    { id: 'drive', name: 'Final drive', color: '#e2571f', kind: 'moving', blurb: 'Pinion, ring gear, flange, nut, spacer and bearings.' },
    { id: 'diff', name: 'Differential', color: '#f2b632', kind: 'moving', blurb: 'Carrier, cross pin, spider gears and carrier bearings.' },
    { id: 'axles', name: 'Axles', color: '#2fb27a', kind: 'moving', blurb: 'Side gears, half-shafts and hubs.' },
    { id: 'housing', name: 'Housing', color: '#b8bec6', kind: 'static', housing: true, blurb: 'Axle housing, tubes, cover and plug.' },
  ],
  about: `<p>The differential lets the two driven wheels turn at different speeds while both receive torque. The pinion turns the ring gear and carrier; inside the carrier, two spider gears mesh with a side gear on each axle. The carrier speed is always the average of the two wheel speeds. On a straight road the spiders stand still on their pin; in a corner they roll to make up the difference; with one wheel on ice they spin freely and the wheel on ice takes all the motion.</p>`,
  build, animate,
};
