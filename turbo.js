// Turbocharger: shaft axis = X, compressor at −X (air enters from −X), turbine at +X (exhaust leaves toward +X).
import * as THREE from 'three';
import * as G from './geom.js';

const { TAU, DEG, V3 } = G;

const INFO = {
  shaft: { desc: 'The turbine shaft joins the two wheels. The turbine wheel is friction-welded to one end; the compressor wheel is clamped on the other by a nut. At full boost it turns at 150,000 rpm or more, faster than anything else in the car.', notes: ['Balanced as an assembly to a fraction of a gram-millimetre; a speck of dirt is enough to shake it.', 'Runs on floating oil films only: no ball bearings in this design.'], block: { diameter: '8 mm at the journals', speed: 'up to 180,000 rpm', material: 'Alloy steel, welded to Inconel wheel' } },
  compWheel: { desc: 'The compressor wheel draws air in axially at the inducer and flings it outward at the exducer. Its blades accelerate the air to over 300 m/s; the diffuser and scroll turn that speed into pressure.', notes: ['Machined from a forged aluminum billet or cast; some are titanium for high boost.', 'Tip speed at 150,000 rpm and 60 mm diameter is 470 m/s, above the speed of sound in the surrounding air.', 'Six main blades and six splitters: the splitters start further in so the inlet is not choked.'], block: { inducer: 'Ø47 mm', exducer: 'Ø60 mm', blades: '6 + 6 splitter', material: 'Forged 2618 aluminum' } },
  compBlade: { desc: 'A full-length compressor blade, curving back against the direction of rotation at the exit (backsweep) so the flow leaves with less swirl and the pressure rise is more stable.', block: { backsweep: '≈ 30°', thickness: '≈ 1 mm' } },
  splitter: { desc: 'A splitter blade starts partway along the passage. It adds guiding surface where the passage is wide without crowding the inlet, where the full blades alone leave room for the air to enter.', block: { starts: '≈ 35% along the passage' } },
  compNut: { desc: 'The compressor nut clamps the wheel to the shaft. It is torqued to a tiny value and its position is marked, because the whole rotor is balanced with it in place.', block: { thread: 'M6 left-hand' } },
  turbWheel: { desc: 'The turbine wheel is spun by exhaust gas at up to 950 °C. Gas enters radially from the scroll, expands through the blades and leaves axially, giving up its energy to drive the compressor.', notes: ['Investment-cast nickel superalloy, because nothing else keeps its strength at exhaust temperature.', 'Radial-inflow turbines are compact and cheap; large engines use axial turbines instead.'], block: { diameter: 'Ø54 mm', blades: '11', material: 'Inconel 713C', temperature: 'up to 950 °C inlet' } },
  turbBlade: { desc: 'One of eleven turbine blades. The blade is radial at the inlet so that centrifugal stress does not bend it, and curves to exit the gas axially.', block: { inlet: 'radial', exit: 'axial with swirl' } },
  chra: { desc: 'The centre housing (CHRA: centre housing rotating assembly) carries the shaft in oil-fed journal bearings between the hot turbine and the cool compressor. Engine oil flows in from the top and drains from the bottom; a water jacket keeps it from coking after shutdown.', notes: ['Oil at 3–4 bar arrives through a banjo bolt; the drain must be gravity-fed and downhill.', 'Turbo timers exist because oil left standing here at 300 °C turns to carbon.'], block: { material: 'Cast iron', oilFeed: 'M10 banjo, 3–4 bar', coolant: 'Water-cooled jacket' } },
  journal: { desc: 'A floating journal bearing: a bronze bush that turns at about half shaft speed with oil films on both its inside and its outside. The double film damps shaft whirl that a fixed bush could not.', block: { type: 'Fully floating bush', material: 'Leaded bronze', clearance: '≈ 0.02 mm each film' } },
  thrust: { desc: 'The thrust bearing takes the axial load from the pressure difference across the two wheels. It is a flat plate with tapered oil-wedge pads on both faces.', block: { type: '360° hydrodynamic thrust pad', load: 'up to ≈ 100 N' } },
  thrustCollar: { desc: 'The thrust collar on the shaft runs against the thrust bearing pads and also carries the oil slinger that throws oil away from the compressor-side seal.', block: { material: 'Hardened steel' } },
  sealRing: { desc: 'A piston-ring type seal that stops oil migrating along the shaft into the housings. Turbos rely on pressure difference more than on the ring itself, which is why a blocked drain smokes.', block: { type: 'Piston ring seal', material: 'Cast iron' } },
  sealPlate: { desc: 'The compressor-side seal plate (insert) closes the centre housing and forms the back wall of the compressor.', block: { material: 'Aluminum' } },
  oilFeed: { desc: 'Oil inlet boss with a banjo bolt. A restrictor is sometimes fitted so that the seals are not flooded.', block: { fitting: 'M10 × 1.0 banjo' } },
  oilDrain: { desc: 'The oil drain flange. It is large because the oil leaves as foam at low pressure, and it must fall freely back to the sump.', block: { size: '2 × M8 flange, Ø 16 mm bore' } },
  coolantPort: { desc: 'A coolant port. Thermosiphon flow through the water jacket keeps cooling the bearing housing after the engine is switched off.', block: { fitting: 'M14 banjo' } },
  compHousing: { desc: 'The compressor housing (cover) shrouds the wheel with a close-fitting contour, then collects the air in a scroll (volute) whose cross-section grows around the wheel so the flow speed stays constant as more air joins.', notes: ['Cast aluminum; the wheel-to-contour clearance is about 0.3 mm because every bit of leakage is lost efficiency.', 'Some housings have a ported shroud that recirculates a little air to widen the surge margin.'], block: { material: 'Cast aluminum A356', clearance: '≈ 0.3 mm to wheel', outlet: 'Ø 50 mm' } },
  inlet: { desc: 'The compressor inlet: a plain bore that guides air onto the inducer with as little swirl as possible.', block: { bore: 'Ø 60 mm' } },
  backplate: { desc: 'The compressor backplate closes the wheel’s back face and carries the vaneless diffuser: the parallel gap between backplate and cover where the air slows down and gains pressure before reaching the scroll.', block: { diffuser: 'vaneless, 5 mm wide' } },
  compBolt: { desc: 'One of the bolts clamping the compressor cover to the centre housing.', block: { size: 'M8 × 1.25' } },
  turbHousing: { desc: 'The turbine housing: a cast-iron scroll that takes exhaust from the manifold flange and wraps it around the turbine wheel. Its cross-section shrinks around the wheel (the reverse of the compressor) so the gas keeps its speed as it is fed inward.', notes: ['The A/R ratio (scroll area over its centroid radius) sets how fast the turbo spools versus how much it flows at the top end.', 'Runs cherry red under full load; ductile iron with high silicon and molybdenum survives the cycling.'], block: { material: 'Ductile iron D5S / SiMo', ar: 'A/R 0.64', inlet: 'T3 flange' } },
  turbInlet: { desc: 'The turbine inlet flange bolts to the exhaust manifold. The rectangular T3 pattern is a decades-old standard.', block: { pattern: 'T3, 4 studs' } },
  turbOutlet: { desc: 'The turbine outlet, clamped to the downpipe with a V-band. Gas leaves here at around 700 °C.', block: { size: 'Ø 76 mm V-band' } },
  heatShield: { desc: 'A stamped stainless shield between the turbine housing and the centre housing. It keeps radiant heat from the turbine scroll away from the bearing oil.', block: { material: 'Stainless steel, 0.8 mm' } },
  vband: { desc: 'A V-band clamp holds the housing to the centre section and allows the housing to be clocked to any angle for the plumbing.', block: { type: 'V-band, single bolt' } },
  turbBolt: { desc: 'One of the bolts clamping the turbine housing to the centre housing; high-temperature alloy so it does not relax.', block: { size: 'M10 × 1.5, Inconel' } },
  wastegate: { desc: 'The internal wastegate is a flap valve in the turbine housing that lets exhaust bypass the wheel once boost reaches the target. Opening it caps turbine power and therefore boost pressure.', notes: ['Shown cycling open and closed. In service it cracks open only as far as needed to hold the set boost.'], block: { valve: 'Ø 30 mm poppet', travel: '≈ 25°' } },
  wgArm: { desc: 'The wastegate arm: a lever on a shaft through the housing wall that swings the valve flap.', block: { material: 'Stainless steel' } },
  actuator: { desc: 'The wastegate actuator: a spring-loaded diaphragm can. Boost pressure from the compressor outlet pushes the diaphragm against the spring; above the set pressure the rod moves and opens the wastegate.', notes: ['The spring preload sets the base boost; the engine controller bleeds the signal with a solenoid to raise it.'], block: { type: 'Pneumatic diaphragm', setPoint: '≈ 0.8 bar' } },
  rod: { desc: 'The actuator rod connecting the diaphragm to the wastegate arm. Its length is adjusted to set the valve preload.', block: { adjustment: 'Threaded clevis' } },
  speedSensor: { desc: 'A shaft speed sensor reading the passing compressor blades, so the engine controller can keep the rotor below its speed limit rather than guessing from pressure.', block: { type: 'Eddy current', limit: '≈ 200,000 rpm' } },
};

function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };

  yield 'rotor';
  // ---- shaft & rotating group (children of the shaft) ----
  const shaft = add({ id: 'shaft', name: 'Turbine shaft', system: 'rotor', geo: G.merge([G.cyl(4, 150, { axis: 'x', x: -8 }), G.cyl(6, 40, { axis: 'x', x: 30 })]), mat: 'polished', ex: [0, 0, 0] }, 'shaft');
  parts.shaft = shaft;
  // compressor wheel: built around Z with the nose at -Z, then rotated so the nose points -X
  const compHubPts = [[0, -34], [8, -34]]; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; compHubPts.push([8 + 22 * (1 - Math.cos(a)), -30 + 30 * Math.sin(a)]); } compHubPts.push([30, 3], [0, 3]);
  const compHub = G.place(G.lathe(compHubPts, { axis: 'z', seg: 64 }), { ry: Math.PI / 2, x: -50 });
  add({ id: 'comp-wheel', name: 'Compressor wheel (hub)', system: 'rotor', parent: 'shaft', geo: compHub, mat: 'aluminum', ex: [-70, 0, 0] }, 'compWheel');
  const mainBlade = G.radialBlade({ rHubIn: 8.5, rHubOut: 30, rShroudIn: 23.5, rShroudOut: 30, zIn: -30, zOut: 0, wrap: 55, thick: 1.1, shroudZ: 0.72 });
  const splitBlade = (() => { const g = G.radialBlade({ rHubIn: 17, rHubOut: 30, rShroudIn: 27, rShroudOut: 30, zIn: -19, zOut: 0, wrap: 35, thick: 1.0, shroudZ: 0.72 }); g.rotateZ(TAU / 12); return g; })();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    add({ id: `comp-blade-${i}`, name: `Compressor blade ${i + 1}`, system: 'rotor', parent: 'shaft', geo: G.place(mainBlade.clone(), { rz: a, ry: Math.PI / 2, x: -50 }), mat: 'aluminum', ex: [-70, 0, 0] }, 'compBlade');
    add({ id: `comp-split-${i}`, name: `Splitter blade ${i + 1}`, system: 'rotor', parent: 'shaft', geo: G.place(splitBlade.clone(), { rz: a, ry: Math.PI / 2, x: -50 }), mat: 'aluminum', ex: [-70, 0, 0] }, 'splitter');
  }
  add({ id: 'comp-nut', name: 'Compressor nut', system: 'rotor', parent: 'shaft', geo: G.merge([G.cyl(5, 8, { axis: 'x', x: -86, seg: 6 }), G.cyl(4, 6, { axis: 'x', x: -80 })]), mat: 'steel', ex: [-120, 0, 0] }, 'compNut');
  // turbine wheel: same construction, nose toward +X
  const turbHubPts = [[0, -32], [6, -32]]; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; turbHubPts.push([6 + 22 * (1 - Math.cos(a)), -28 + 28 * Math.sin(a)]); } turbHubPts.push([28, 4], [10, 4], [10, 8], [0, 8]);
  add({ id: 'turb-wheel', name: 'Turbine wheel (hub)', system: 'rotor', parent: 'shaft', geo: G.place(G.lathe(turbHubPts, { axis: 'z', seg: 64 }), { ry: -Math.PI / 2, x: 50 }), mat: 'inconel', ex: [70, 0, 0] }, 'turbWheel');
  const turbBlade = G.radialBlade({ rHubIn: 7, rHubOut: 27.5, rShroudIn: 20, rShroudOut: 27.5, zIn: -28, zOut: 0, wrap: 40, thick: 1.4, shroudZ: 0.7 });
  for (let i = 0; i < 11; i++) add({ id: `turb-blade-${i}`, name: `Turbine blade ${i + 1}`, system: 'rotor', parent: 'shaft', geo: G.place(turbBlade.clone(), { rz: (i / 11) * TAU, ry: -Math.PI / 2, x: 50 }), mat: 'inconel', ex: [70, 0, 0] }, 'turbBlade');
  add({ id: 'thrust-collar', name: 'Thrust collar & oil slinger', system: 'rotor', parent: 'shaft', geo: G.merge([G.cyl(9, 6, { axis: 'x', x: -34 }), G.cyl(7, 8, { axis: 'x', x: -27 }), G.cyl(11, 2, { axis: 'x', x: -22 })]), mat: 'hardened', ex: [-40, 0, 0] }, 'thrustCollar');
  add({ id: 'seal-ring-c', name: 'Piston-ring seal (compressor side)', system: 'rotor', parent: 'shaft', geo: G.annulus(6.5, 4.2, 1.5, { axis: 'x', x: -40 }), mat: 'castIron', ex: [-55, 0, 0] }, 'sealRing');
  add({ id: 'seal-ring-t', name: 'Piston-ring seal (turbine side)', system: 'rotor', parent: 'shaft', geo: G.annulus(8.5, 6.2, 1.5, { axis: 'x', x: 44 }), mat: 'castIron', ex: [55, 0, 0] }, 'sealRing');

  yield 'bearing housing';
  const chra = G.merge([G.cyl(34, 70, { axis: 'x', x: 3, seg: 64 }), G.cyl(55, 8, { axis: 'x', x: -36, seg: 64 }), G.cyl(52, 8, { axis: 'x', x: 42, seg: 64 }), G.cyl(14, 26, { y: 44 }), G.rbox(46, 6, 34, 3, { y: -40 }), G.cyl(8, 24, { axis: 'z', z: 40 }), G.cyl(8, 24, { axis: 'z', z: -40 })]);
  add({ id: 'chra', name: 'Centre housing (CHRA)', system: 'bearing', geo: chra, mat: 'castIron', ex: [0, 0, 0], ghost: true }, 'chra');
  add({ id: 'journal-c', name: 'Journal bearing (compressor side)', system: 'bearing', geo: G.annulus(7, 4.3, 12, { axis: 'x', x: -14 }), mat: 'bronze', ex: [0, 60, 0] }, 'journal');
  add({ id: 'journal-t', name: 'Journal bearing (turbine side)', system: 'bearing', geo: G.annulus(7, 4.3, 12, { axis: 'x', x: 18 }), mat: 'bronze', ex: [0, 60, 0] }, 'journal');
  add({ id: 'thrust-bearing', name: 'Thrust bearing', system: 'bearing', geo: G.merge([G.annulus(16, 7.5, 4, { axis: 'x', x: -30 }), G.cyl(2, 10, { x: -30, y: 14 })]), mat: 'bronze', ex: [0, 90, 0] }, 'thrust');
  add({ id: 'seal-plate', name: 'Seal plate (insert)', system: 'bearing', geo: G.annulus(30, 6.8, 6, { axis: 'x', x: -43 }), mat: 'aluminum', ex: [-30, 0, 0] }, 'sealPlate');
  add({ id: 'oil-feed', name: 'Oil feed banjo bolt', system: 'bearing', geo: G.merge([G.cyl(6, 14, { y: 62, seg: 6 }), G.cyl(9, 6, { y: 58 }), G.cyl(3, 18, { y: 68, axis: 'z' })]), mat: 'steel', ex: [0, 60, 0] }, 'oilFeed');
  add({ id: 'oil-drain', name: 'Oil drain flange', system: 'bearing', geo: G.merge([G.rbox(46, 4, 34, 3, { y: -45 }), G.cyl(9, 6, { y: -49 }), ...[-16, 16].map(x => G.place(G.bolt(8, 14), { rx: Math.PI, x, y: -47 }))]), mat: 'steel', ex: [0, -70, 0] }, 'oilDrain');
  add({ id: 'coolant-a', name: 'Coolant port (inlet)', system: 'bearing', geo: G.merge([G.cyl(7, 8, { axis: 'z', z: 55, seg: 6 }), G.cyl(4, 20, { z: 60 })]), mat: 'steel', ex: [0, 0, 60] }, 'coolantPort');
  add({ id: 'coolant-b', name: 'Coolant port (outlet)', system: 'bearing', geo: G.merge([G.cyl(7, 8, { axis: 'z', z: -55, seg: 6 }), G.cyl(4, 20, { z: -60 })]), mat: 'steel', ex: [0, 0, -60] }, 'coolantPort');

  yield 'compressor housing';
  const compShell = G.lathe([[30, -135], [30, -90], [40, -70], [66, -52], [72, -48], [72, -44], [58, -44], [58, -48], [33, -53], [25, -80], [25, -90], [25, -135]], { axis: 'x', seg: 72 });
  const compScroll = G.place(G.volute({ R0: 50, Rg: 12, rho0: 10, rho1: 12, outlet: 55, phase: Math.PI }), { ry: Math.PI / 2, x: -52 });
  add({ id: 'comp-housing', name: 'Compressor housing', system: 'compressor', geo: G.merge([compShell, compScroll]), mat: 'castAlu', ex: [-160, 0, 0], ghost: true }, 'compHousing');
  add({ id: 'comp-inlet', name: 'Compressor inlet', system: 'compressor', geo: G.annulus(32, 30, 20, { axis: 'x', x: -145 }), mat: 'castAlu', ex: [-220, 0, 0] }, 'inlet');
  add({ id: 'backplate', name: 'Compressor backplate (diffuser)', system: 'compressor', geo: G.annulus(70, 31, 5, { axis: 'x', x: -46.5 }), mat: 'aluminum', ex: [-90, 0, 0] }, 'backplate');
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; add({ id: `comp-bolt-${i}`, name: `Compressor housing bolt ${i + 1}`, system: 'compressor', geo: G.place(G.bolt(8, 20), { rz: Math.PI / 2, x: -46, y: 62 * Math.cos(a), z: 62 * Math.sin(a) }), mat: 'darkSteel', ex: [-200, 0, 0] }, 'compBolt'); }
  add({ id: 'speed-sensor', name: 'Shaft speed sensor', system: 'compressor', geo: G.merge([G.cyl(4, 20, { axis: 'z', x: -78, z: 36 }), G.cyl(7, 8, { axis: 'z', x: -78, z: 48, seg: 6 })]), mat: 'steel', ex: [-160, 0, 60] }, 'speedSensor');

  yield 'turbine housing';
  const turbScroll = G.place(G.volute({ R0: 48, Rg: -4, rho0: 20, rho1: -11, inlet: 50, phase: -Math.PI / 2 }), { ry: Math.PI / 2, x: 50 });
  const turbShell = G.lathe([[36, 95], [36, 60], [50, 52], [60, 48], [60, 44], [30, 44], [30, 52], [40, 60], [30, 70], [30, 95]], { axis: 'x', seg: 72 });
  add({ id: 'turb-housing', name: 'Turbine housing', system: 'turbine', geo: G.merge([turbScroll, turbShell]), mat: 'exhaust', ex: [170, 0, 0], ghost: true }, 'turbHousing');
  add({ id: 'turb-inlet', name: 'Turbine inlet flange (T3)', system: 'turbine', geo: G.merge([G.rbox(12, 95, 75, 4, { x: 50, y: -48, z: -78 }), ...[[-35, -25], [35, -25], [-35, 25], [35, 25]].map(([dy, dz]) => G.place(G.bolt(10, 20), { rx: -Math.PI / 2, x: 50, y: -48 + dy, z: -86 + dz }))]), mat: 'darkSteel', ex: [170, -40, -80] }, 'turbInlet');
  add({ id: 'turb-outlet', name: 'Turbine outlet (V-band)', system: 'turbine', geo: G.merge([G.annulus(40, 36, 12, { axis: 'x', x: 100 }), G.annulus(46, 40, 4, { axis: 'x', x: 104 })]), mat: 'exhaust', ex: [240, 0, 0] }, 'turbOutlet');
  add({ id: 'heat-shield', name: 'Turbine heat shield', system: 'turbine', geo: G.annulus(52, 12, 1.2, { axis: 'x', x: 46 }), mat: 'steel', ex: [110, 0, 0] }, 'heatShield');
  add({ id: 'vband', name: 'V-band clamp (turbine)', system: 'turbine', geo: G.merge([G.torus(56, 4, { axis: 'x', x: 42, seg: 64 }), G.rbox(10, 16, 24, 2, { x: 42, y: 60 })]), mat: 'steel', ex: [130, 40, 0] }, 'vband');
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; add({ id: `turb-bolt-${i}`, name: `Turbine housing bolt ${i + 1}`, system: 'turbine', geo: G.place(G.bolt(10, 20), { rz: -Math.PI / 2, x: 46, y: 60 * Math.cos(a), z: 60 * Math.sin(a) }), mat: 'inconel', ex: [220, 0, 0] }, 'turbBolt'); }

  yield 'wastegate';
  const wg = add({ id: 'wg-arm', name: 'Wastegate arm & shaft', system: 'wastegate', geo: G.merge([G.cyl(4, 30, { axis: 'z', z: -15 }), G.rbox(8, 30, 6, 2, { y: -14, z: 0 }), G.cyl(15, 3, { y: -28 })]), mat: 'steel', pos: [82, 30, -30], ex: [120, 60, -40] }, 'wgArm');
  parts.wg = wg;
  add({ id: 'wg-valve', name: 'Wastegate valve (flap)', system: 'wastegate', parent: 'wg-arm', geo: G.cyl(15, 4, { y: -31 }), mat: 'inconel', ex: [0, -40, 0] }, 'wastegate');
  add({ id: 'actuator', name: 'Wastegate actuator', system: 'wastegate', geo: G.merge([G.cyl(30, 34, { axis: 'x', x: -100, y: 62, z: 30, seg: 48 }), G.cyl(6, 14, { axis: 'x', x: -76, y: 62, z: 30 }), G.rbox(30, 6, 20, 2, { x: -90, y: 44, z: 30 })]), mat: 'paintBlack', ex: [-120, 90, 60] }, 'actuator');
  parts.rod = add({ id: 'wg-rod', name: 'Actuator rod', system: 'wastegate', geo: G.merge([G.cyl(2.5, 150, { axis: 'x', x: 5 }), G.rbox(10, 10, 6, 2, { x: 78 })]), mat: 'polished', pos: [0, 62, 30], ex: [0, 90, 60] }, 'rod');
}

function animate(ctx) {
  const parts = ctx.refs;
  parts.shaft.obj.rotation.x = ctx.theta;
  const open = 0.5 - 0.5 * Math.cos(ctx.t * 0.9);
  parts.wg.obj.rotation.z = -25 * DEG * open;
  parts.rod.obj.position.x = -12 * open;
}

export default {
  id: 'turbo', name: 'Turbocharger', shortName: 'the turbocharger', sub: 'Journal-bearing turbo · Ø60 mm compressor · internal wastegate', color: '#6b6f8a',
  pieces: 75, explodeScale: 0.8, defaultView: 'iso', sectionDefault: 0, sectionAxis: 'z',
  views: { iso: [-1, 0.7, 1.1], front: [-1, 0.1, 0.02], side: [0.02, 0.1, 1], top: [0.001, 1, 0.001] },
  drive: { label: 'Shaft', revPerSec: 0.5, unit: 'rpm on screen (real: ~150,000)' },
  hint: 'Drag to orbit · X shows the wheels inside the housings · Section along Z cuts the scrolls open',
  systems: [
    { id: 'rotor', name: 'Rotating group', color: '#e2571f', kind: 'moving', blurb: 'Shaft, compressor wheel, turbine wheel, nut, collar and seal rings: everything that spins.' },
    { id: 'bearing', name: 'Bearing housing', color: '#8a929c', kind: 'static', blurb: 'Centre housing, floating bearings, thrust bearing, oil and coolant connections.' },
    { id: 'compressor', name: 'Compressor stage', color: '#3aa6d8', kind: 'static', housing: true, blurb: 'Aluminum cover, inlet, backplate and diffuser: the cold side.' },
    { id: 'turbine', name: 'Turbine stage', color: '#b0574a', kind: 'static', housing: true, blurb: 'Cast-iron scroll, inlet flange, outlet, heat shield and clamps: the hot side.' },
    { id: 'wastegate', name: 'Boost control', color: '#2fb27a', kind: 'moving', blurb: 'Internal wastegate valve, arm, actuator and rod.' },
  ],
  about: `<p>A journal-bearing turbocharger of the size fitted to a 2-litre engine. Exhaust gas from the manifold enters the cast-iron turbine scroll, spins the Inconel turbine wheel and leaves through the V-band outlet. The shaft carries that power to the aluminum compressor wheel, which draws in fresh air and delivers it at up to 2.5 bar absolute.</p>
  <p>The two wheels are lofted from parametric blade surfaces: a hub and shroud contour, a wrap angle that increases toward the exit, and a thickness offset. The scrolls are lofted circles swept around a spiral whose radius and tube section change with angle, exactly the way a volute is laid out on a drawing.</p>`,
  build, animate,
};
