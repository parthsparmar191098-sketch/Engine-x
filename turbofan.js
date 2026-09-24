// High-bypass two-spool turbofan. Engine axis = X, air enters from −X. Dimensions in mm (fan Ø 1,800).
import * as THREE from 'three';
import * as G from '../geom.js';

const { TAU, DEG, V3 } = G;

const INFO = {
  spinner: { desc: 'The spinner is a conical fairing over the fan hub. It guides air smoothly into the fan roots and sheds ice by vibration and by its rubber tip.', block: { material: 'Composite or aluminum', tip: 'Rubber, de-icing by flexing' } },
  fanDisk: { desc: 'The fan disk holds the 22 fan blades in dovetail slots. It is the most critical rotating part in the engine: a failure would not be contained, so it is made and inspected to the highest standard in aviation.', notes: ['Forged titanium alloy, machined from a billet with full ultrasonic inspection.', 'Carries about 100 tonnes of centrifugal pull from each blade at take-off speed.'], block: { material: 'Ti-6Al-4V forging', blades: '22 in dovetail slots', speed: '≈ 5,000 rpm max' } },
  fanBlade: { desc: 'A wide-chord fan blade. The outer part of the fan pushes 85% of the engine’s air around the core as bypass flow; this is where most of the thrust comes from at take-off.', notes: ['Hollow titanium or carbon-fibre composite with a titanium leading edge against bird strikes and hail.', 'Tip speed about 450 m/s, supersonic; the swept shape delays the shock losses.', 'Each blade weighs about 12 kg and pulls 100 tonnes at full speed.'], block: { length: '≈ 0.9 m', material: 'Hollow titanium / CFRP', tipSpeed: '≈ 450 m/s' } },
  fanCase: { desc: 'The fan case surrounds the fan with a containment ring able to catch a released blade. Acoustic liners on its inner surface absorb fan noise.', notes: ['Aluminum ring wrapped in dry Kevlar, or a solid composite; the released-blade test is filmed at 20,000 frames per second.'], block: { containment: 'Kevlar wrap', liner: 'Honeycomb acoustic' } },
  ogv: { desc: 'Outlet guide vanes straighten the swirling bypass air behind the fan so it leaves the duct axially, and they carry the fan case structurally on the core.', block: { count: '40 vanes', material: 'Aluminum or composite' } },
  splitter: { desc: 'The splitter divides the fan air: the inner 15% enters the core, the rest goes down the bypass duct. Its lip is heated to stop ice.', block: { bypassRatio: '≈ 6 : 1' } },
  booster: { desc: 'A booster (low-pressure compressor) stage on the fan shaft. Three of these raise the core inlet pressure by about 2× before the high-pressure compressor.', block: { stages: '3', speed: 'N1, fan speed' } },
  boosterStator: { desc: 'A stator row of the booster. Stators are fixed to the casing; they remove the swirl the rotor added and set up the flow for the next rotor.', block: { type: 'Stator vane row' } },
  hpc: { desc: 'A high-pressure compressor rotor stage. Nine stages on the HP spool raise the pressure by about 12× more; the last stages are small because the air has been squeezed to a fraction of its volume.', notes: ['Blade heights shrink from about 150 mm to 35 mm along the compressor; the last rows run at 600 °C.', 'Titanium in the front stages, nickel alloy at the back where titanium would burn.'], block: { stages: '9', speed: 'N2, ≈ 14,000 rpm', overallPressure: '≈ 30 : 1 total' } },
  hpcStator: { desc: 'A high-pressure compressor stator row. The first few are variable: the vanes pivot at low speed to keep the front stages from stalling.', block: { type: 'Stator vane row (VSV in stages 1–4)' } },
  hpcDrum: { desc: 'The HPC rotor drum: the disks of the nine stages welded or bolted into one drum, turned by the HP turbine through the HP shaft.', block: { material: 'Titanium (front) / Inconel 718 (rear)' } },
  diffuser: { desc: 'The compressor diffuser slows the air leaving the last HPC stage from about 150 m/s to around 30 m/s before the combustor. Too fast and the flame would blow out.', block: { velocity: '≈ 150 → 30 m/s' } },
  combustor: { desc: 'The annular combustor: a ring-shaped flame tube where fuel burns continuously at about 2,000 °C in the primary zone. Only a fifth of the air burns; the rest enters through holes further back to dilute the gas to a temperature the turbine can survive.', notes: ['Liner walls are cooled by films of air fed through thousands of laser-drilled holes.', 'The flame never touches the walls; it is anchored by swirling air around each fuel nozzle.'], block: { type: 'Annular, 20 nozzles', flameTemp: '≈ 2,000 °C', exitTemp: '≈ 1,500 °C' } },
  combCase: { desc: 'The combustor outer casing carries the full compressor delivery pressure of about 30 bar around the flame tube and serves as the engine’s structural backbone at its hottest point.', block: { pressure: '≈ 30 bar', material: 'Inconel 718' } },
  nozzle: { desc: 'A fuel nozzle. It atomises jet fuel into a fine spray with swirling air so the droplets burn within centimetres. Twenty of them sit around the combustor.', block: { fuelFlow: '≈ 1 kg/s total at take-off', type: 'Airblast atomiser' } },
  ngv: { desc: 'Nozzle guide vanes of the high-pressure turbine: the hottest metal parts in the engine, sitting in gas hotter than their own melting point. They survive on internal cooling air and a ceramic thermal barrier coating.', notes: ['Single-crystal nickel superalloy castings with hundreds of film-cooling holes.'], block: { temperature: 'gas ≈ 1,500 °C, metal ≈ 1,000 °C', material: 'Single-crystal CMSX-4, TBC coated' } },
  hpt: { desc: 'A high-pressure turbine rotor stage. It extracts about 30 MW from the gas to drive the compressor, which is why the compressor and turbine are one spool.', notes: ['Blades pull 20 tonnes each at 14,000 rpm while glowing; they are single-crystal castings with internal cooling passages.'], block: { stages: '2', power: '≈ 30 MW', speed: 'N2' } },
  lpt: { desc: 'A low-pressure turbine rotor stage. Five stages extract the remaining energy to drive the fan through the long inner shaft. The gas has expanded by now, so these blades are much taller than the HP stages.', block: { stages: '5', speed: 'N1', material: 'Nickel alloy, uncooled' } },
  lptStator: { desc: 'A low-pressure turbine nozzle (stator) row, turning the gas to strike the next rotor at the right angle.', block: { type: 'Stator vane row' } },
  lpShaft: { desc: 'The low-pressure shaft runs the full length of the engine inside the HP spool, connecting the LP turbine at the back to the fan at the front. Long, slender and highly loaded: it carries around 25 MW at take-off.', block: { length: '≈ 2.5 m', material: 'Maraging steel', torque: '≈ 50 kN·m' } },
  hpShaft: { desc: 'The high-pressure shaft: a short drum linking the HP turbine to the HP compressor. It rotates around the LP shaft, at nearly three times its speed, with only bearings and air between them.', block: { speed: '≈ 14,000 rpm', material: 'Inconel 718' } },
  bearing: { desc: 'A main shaft bearing. Five of them position the two spools; ball bearings take the thrust, roller bearings take radial load and let the shafts grow with heat. Each sits in an oil-fed chamber sealed with air.', block: { type: 'Ball (thrust) or roller', oil: 'Jet-fed, 100 °C' } },
  frame: { desc: 'A structural frame carrying bearing loads out through the gas path to the casings. Its struts are hollow: oil pipes and air run through them.', block: { material: 'Cast titanium / steel' } },
  bypassDuct: { desc: 'The bypass duct carries the fan’s outer flow past the core to the nozzle. Roughly 85% of the air, and at cruise about 80% of the thrust, goes this way.', block: { bypassRatio: '≈ 6 : 1' } },
  coreCowl: { desc: 'The core cowl fairs the engine core inside the bypass duct so the bypass flow passes with little drag.', block: { material: 'Composite / titanium' } },
  coreNozzle: { desc: 'The core exhaust nozzle accelerates the turbine exhaust to produce the remaining thrust. Chevrons on the rim mix the hot jet with bypass air to cut noise.', block: { exitVelocity: '≈ 400 m/s at take-off' } },
  plug: { desc: 'The exhaust plug (tail cone) fairs the back of the LP turbine and forms the inner wall of the core nozzle.', block: { material: 'Titanium' } },
  inletCowl: { desc: 'The inlet cowl: a thick, rounded lip so that air still flows in cleanly at high angles of attack and in crosswinds. Hot air from the compressor is piped inside it to prevent ice.', block: { antiIce: 'Bleed air' } },
  fanCowl: { desc: 'The fan cowl doors: the smooth outer skin of the nacelle. They open upward for access to the accessory gearbox and the fan case.', block: { material: 'Composite sandwich' } },
  agb: { desc: 'The accessory gearbox is driven from the HP spool through a radial shaft. It turns the fuel pump, oil pumps, hydraulic pump, generator and the starter.', block: { drive: 'Radial tower shaft from N2', accessories: 'Fuel, oil, hydraulic pumps, generator, starter' } },
  towerShaft: { desc: 'The tower shaft: a bevel-driven radial shaft that takes power from the HP spool down through a fan-frame strut to the accessory gearbox. The starter spins the engine the same way, in reverse.', block: { drive: 'Bevel gears at N2' } },
};

// flowpath helpers
const rowX = (N, p, x, phase = 0) => G.place(G.bladeRow(N, p, phase), { ry: Math.PI / 2, x });

function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };
  const stageCount = { fan: 22 };

  yield 'shafts';
  const lp = add({ id: 'lp-shaft', name: 'Low-pressure shaft (N1)', system: 'shafts', geo: G.merge([G.cyl(45, 2900, { axis: 'x', x: 1050 }), G.cyl(120, 60, { axis: 'x', x: 2470 })]), mat: 'darkSteel', ex: [0, 0, 0] }, 'lpShaft');
  const hp = add({ id: 'hp-shaft', name: 'High-pressure shaft (N2)', system: 'shafts', geo: G.annulus(95, 70, 1250, { axis: 'x', x: 1330 }), mat: 'inconel', ex: [0, 0, 0] }, 'hpShaft');
  parts.lp = lp; parts.hp = hp;
  [[100, 'No. 1 bearing (fan, ball)'], [620, 'No. 2 bearing (LP, roller)'], [740, 'No. 3 bearing (HP front, ball)'], [1960, 'No. 4 bearing (HP rear, roller)'], [2480, 'No. 5 bearing (LP rear, roller)']].forEach(([x, name], i) => {
    const r = i === 2 || i === 3 ? 120 : 70;
    add({ id: `bearing-${i + 1}`, name, system: 'shafts', geo: G.merge([G.annulus(r + 34, r + 22, 40, { axis: 'x', x }), G.annulus(r + 12, r, 40, { axis: 'x', x }), G.radial(G.sphere(10, { y: r + 17 }), 14, 'x')]), mat: 'hardened', ex: [0, i % 2 ? -300 : 300, 0] }, 'bearing');
  });

  yield 'fan';
  add({ id: 'spinner', name: 'Spinner', system: 'fan', parent: 'lp-shaft', geo: G.lathe([[0, -380], [60, -340], [160, -200], [240, -60], [262, 0], [0, 0]], { axis: 'x', seg: 64 }), mat: 'paintWhite', ex: [-500, 0, 0] }, 'spinner');
  add({ id: 'fan-disk', name: 'Fan disk', system: 'fan', parent: 'lp-shaft', geo: G.lathe([[45, -20], [262, -20], [275, 0], [275, 160], [262, 180], [45, 180]], { axis: 'x', seg: 64 }), mat: 'titanium', ex: [-380, 0, 0] }, 'fanDisk');
  const fanBlade = G.place(G.blade({ rRoot: 262, rTip: 895, chordRoot: 220, chordTip: 380, staggerRoot: 22, staggerTip: 62, camber: 0.06, thick: 0.07, sweep: 60, lean: 20, nSpan: 12, nChord: 16 }), { ry: Math.PI / 2, x: 80 });
  for (let i = 0; i < 22; i++) add({ id: `fan-blade-${i}`, name: `Fan blade ${i + 1}`, system: 'fan', parent: 'lp-shaft', geo: G.place(fanBlade.clone(), { rx: (i / 22) * TAU }), mat: 'titanium', ex: [-380, 0, 0] }, 'fanBlade');
  add({ id: 'ogv', name: 'Fan outlet guide vanes', system: 'stators', geo: rowX(40, { rRoot: 470, rTip: 905, chordRoot: 120, chordTip: 140, staggerRoot: -12, staggerTip: -18, camber: 0.05, thick: 0.08, nSpan: 6, nChord: 10 }, 520), mat: 'aluminum', count: 40, ex: [0, 0, 0] }, 'ogv');
  add({ id: 'splitter', name: 'Core splitter lip', system: 'casings', geo: G.lathe([[440, 250], [452, 300], [470, 420], [478, 600], [470, 600], [458, 420], [446, 300]], { axis: 'x', seg: 64 }), mat: 'aluminum', ex: [-120, 0, 0] }, 'splitter');

  yield 'booster';
  const boosterX = [330, 410, 490];
  boosterX.forEach((x, i) => {
    const rHub = 300 + i * 12, rTip = 440 - i * 8;
    add({ id: `booster-rotor-${i + 1}`, name: `Booster rotor stage ${i + 1}`, system: 'lpc', parent: 'lp-shaft', geo: G.merge([rowX(56, { rRoot: rHub, rTip, chordRoot: 48, chordTip: 44, staggerRoot: 35, staggerTip: 52, camber: 0.06, thick: 0.08, nSpan: 5, nChord: 8 }, x), G.annulus(rHub + 2, rHub - 30, 44, { axis: 'x', x })]), mat: 'titanium', count: 56, ex: [-200, 0, 0] }, 'booster');
    add({ id: `booster-stator-${i + 1}`, name: `Booster stator stage ${i + 1}`, system: 'stators', geo: rowX(60, { rRoot: rHub + 6, rTip: rTip - 2, chordRoot: 40, chordTip: 40, staggerRoot: -30, staggerTip: -40, camber: 0.06, thick: 0.08, nSpan: 4, nChord: 8 }, x + 40), mat: 'steel', count: 60, ex: [0, 0, 0] }, 'boosterStator');
  });
  add({ id: 'front-frame', name: 'Intermediate case (fan frame)', system: 'casings', geo: G.merge([G.annulus(470, 455, 120, { axis: 'x', x: 640 }), G.annulus(300, 285, 120, { axis: 'x', x: 640 }), G.radial(G.box(60, 170, 22, { y: 378 }), 8, 'x')]), mat: 'steel', ex: [0, 0, 0] }, 'frame');

  yield 'high-pressure compressor';
  const hpcDrum = [];
  for (let i = 0; i < 9; i++) {
    const x = 800 + i * 66; const rHub = 262 + i * 5, rTip = 418 - i * 10;
    add({ id: `hpc-rotor-${i + 1}`, name: `HP compressor rotor stage ${i + 1}`, system: 'hpc', parent: 'hp-shaft', geo: rowX(50 + i * 6, { rRoot: rHub, rTip, chordRoot: 36 - i * 1.2, chordTip: 32 - i, staggerRoot: 35, staggerTip: 50, camber: 0.05, thick: 0.08, nSpan: 4, nChord: 8 }, x), mat: i < 5 ? 'titanium' : 'inconel', count: 50 + i * 6, ex: [0, 0, 0] }, 'hpc');
    add({ id: `hpc-stator-${i + 1}`, name: `HP compressor stator stage ${i + 1}`, system: 'stators', geo: rowX(56 + i * 6, { rRoot: rHub + 8, rTip: rTip - 4, chordRoot: 30 - i, chordTip: 28 - i, staggerRoot: -32, staggerTip: -42, camber: 0.05, thick: 0.08, nSpan: 4, nChord: 8 }, x + 34), mat: 'steel', count: 56 + i * 6, ex: [0, 0, 0] }, 'hpcStator');
    hpcDrum.push(G.annulus(rHub + 2, 100, 30, { axis: 'x', x }));
  }
  add({ id: 'hpc-drum', name: 'HP compressor rotor drum', system: 'hpc', parent: 'hp-shaft', geo: G.merge([...hpcDrum, G.annulus(150, 100, 620, { axis: 'x', x: 1070 })]), mat: 'titanium', ex: [0, 0, 0] }, 'hpcDrum');
  add({ id: 'hpc-case', name: 'HP compressor casing', system: 'casings', geo: G.lathe([[425, 770], [425, 1400], [345, 1400], [345, 1380], [420, 1380], [420, 790]], { axis: 'x', seg: 64 }), mat: 'steel', ex: [0, 300, 0] }, 'combCase');
  add({ id: 'diffuser', name: 'Compressor diffuser', system: 'combustor', geo: G.lathe([[300, 1400], [330, 1400], [370, 1470], [420, 1500], [420, 1512], [355, 1512], [305, 1470], [295, 1420]], { axis: 'x', seg: 64 }), mat: 'inconel', ex: [0, 0, 0] }, 'diffuser');

  yield 'combustor';
  add({ id: 'combustor', name: 'Annular combustor liner', system: 'combustor', geo: G.merge([G.lathe([[300, 1500], [270, 1560], [265, 1780], [285, 1820], [292, 1820], [272, 1780], [277, 1560], [306, 1500]], { axis: 'x', seg: 64 }), G.lathe([[400, 1500], [420, 1560], [425, 1780], [410, 1820], [403, 1820], [418, 1780], [413, 1560], [394, 1500]], { axis: 'x', seg: 64 }), G.annulus(400, 300, 8, { axis: 'x', x: 1500 })]), mat: 'inconel', ex: [0, 0, 0] }, 'combustor');
  add({ id: 'comb-case', name: 'Combustor outer casing', system: 'casings', geo: G.annulus(470, 458, 380, { axis: 'x', x: 1690 }), mat: 'steel', ex: [0, 380, 0] }, 'combCase');
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; add({ id: `nozzle-${i}`, name: `Fuel nozzle ${i + 1}`, system: 'combustor', geo: G.merge([G.cyl(10, 80, { axis: 'x', x: 1470, y: 350 }), G.cyl(18, 16, { axis: 'x', x: 1508, y: 350 }), G.cyl(6, 120, { y: 410, x: 1440 })]).rotateX(a), mat: 'steel', ex: [0, 400 * Math.cos(a), 400 * Math.sin(a)] }, 'nozzle'); }
  const flame = add({ id: 'flame', name: 'Primary combustion zone', system: 'combustor', geo: G.annulus(392, 280, 220, { axis: 'x', x: 1640 }), mat: 'fire', ex: [0, 0, 0] }, 'combustor');
  parts.flame = flame;

  yield 'turbines';
  add({ id: 'ngv-1', name: 'HP turbine nozzle guide vanes', system: 'stators', geo: rowX(44, { rRoot: 290, rTip: 400, chordRoot: 60, chordTip: 60, staggerRoot: -48, staggerTip: -52, camber: 0.12, thick: 0.16, nSpan: 4, nChord: 10 }, 1850), mat: 'inconel', count: 44, ex: [0, 0, 0] }, 'ngv');
  [1900, 1970].forEach((x, i) => {
    add({ id: `hpt-${i + 1}`, name: `HP turbine rotor stage ${i + 1}`, system: 'hpt', parent: 'hp-shaft', geo: G.merge([rowX(76, { rRoot: 290, rTip: 405 + i * 8, chordRoot: 44, chordTip: 40, staggerRoot: 40, staggerTip: 55, camber: 0.14, thick: 0.14, nSpan: 4, nChord: 10 }, x), G.annulus(292, 100, 40, { axis: 'x', x })]), mat: 'inconel', count: 76, ex: [0, 0, 0] }, 'hpt');
    if (i === 0) add({ id: 'ngv-2', name: 'HP turbine stage-2 vanes', system: 'stators', geo: rowX(50, { rRoot: 292, rTip: 410, chordRoot: 44, chordTip: 44, staggerRoot: -45, staggerTip: -50, camber: 0.12, thick: 0.14, nSpan: 4, nChord: 10 }, x + 36), mat: 'inconel', count: 50, ex: [0, 0, 0] }, 'ngv');
  });
  for (let i = 0; i < 5; i++) {
    const x = 2060 + i * 72; const rHub = 300 + i * 6, rTip = 430 + i * 22;
    add({ id: `lpt-stator-${i + 1}`, name: `LP turbine nozzle stage ${i + 1}`, system: 'stators', geo: rowX(70, { rRoot: rHub, rTip: rTip - 6, chordRoot: 34, chordTip: 34, staggerRoot: -40, staggerTip: -48, camber: 0.12, thick: 0.12, nSpan: 4, nChord: 8 }, x - 36), mat: 'inconel', count: 70, ex: [0, 0, 0] }, 'lptStator');
    add({ id: `lpt-${i + 1}`, name: `LP turbine rotor stage ${i + 1}`, system: 'lpt', parent: 'lp-shaft', geo: G.merge([rowX(90, { rRoot: rHub, rTip, chordRoot: 36, chordTip: 32, staggerRoot: 38, staggerTip: 52, camber: 0.14, thick: 0.12, nSpan: 4, nChord: 8 }, x), G.annulus(rHub + 2, 60, 36, { axis: 'x', x })]), mat: 'inconel', count: 90, ex: [0, 0, 0] }, 'lpt');
  }
  add({ id: 'turbine-case', name: 'Turbine casing', system: 'casings', geo: G.lathe([[418, 1830], [418, 2000], [438, 2040], [540, 2420], [540, 2440], [528, 2440], [428, 2040], [406, 2000], [406, 1830]], { axis: 'x', seg: 64 }), mat: 'steel', ex: [0, 420, 0] }, 'combCase');
  add({ id: 'rear-frame', name: 'Turbine rear frame', system: 'casings', geo: G.merge([G.annulus(545, 530, 90, { axis: 'x', x: 2480 }), G.annulus(140, 125, 90, { axis: 'x', x: 2480 }), G.radial(G.box(50, 400, 24, { y: 335 }), 10, 'x', 0.3).translate(2480, 0, 0)]), mat: 'steel', ex: [200, 0, 0] }, 'frame');

  yield 'nacelle';
  add({ id: 'core-nozzle', name: 'Core exhaust nozzle', system: 'casings', geo: G.lathe([[545, 2500], [520, 2600], [430, 2850], [420, 2850], [510, 2600], [535, 2500]], { axis: 'x', seg: 64 }), mat: 'titanium', ex: [400, 0, 0] }, 'coreNozzle');
  add({ id: 'plug', name: 'Exhaust plug (tail cone)', system: 'casings', parent: 'lp-shaft', geo: G.lathe([[0, 3000], [120, 2560], [125, 2520], [0, 2520]].reverse(), { axis: 'x', seg: 48 }), mat: 'titanium', ex: [500, 0, 0] }, 'plug');
  add({ id: 'fan-case', name: 'Fan case (containment)', system: 'casings', geo: G.annulus(935, 905, 420, { axis: 'x', x: 130 }), mat: 'aluminum', ex: [0, 0, 0], ghost: true }, 'fanCase');
  add({ id: 'bypass-duct', name: 'Bypass duct (outer wall)', system: 'nacelle', geo: G.lathe([[945, 340], [945, 1500], [900, 1900], [880, 2000], [870, 2000], [890, 1900], [935, 1500], [935, 340]], { axis: 'x', seg: 72 }), mat: 'aluminum', ex: [0, 0, 0], ghost: true }, 'bypassDuct');
  add({ id: 'core-cowl', name: 'Core cowl', system: 'nacelle', geo: G.lathe([[482, 600], [482, 1830], [560, 2000], [556, 2440], [548, 2440], [552, 2000], [474, 1830], [474, 600]], { axis: 'x', seg: 72 }), mat: 'titanium', ex: [0, 0, 0], ghost: true }, 'coreCowl');
  add({ id: 'inlet-cowl', name: 'Inlet cowl', system: 'nacelle', geo: G.lathe([[935, -60], [960, -300], [1010, -520], [1040, -540], [1060, -520], [1010, -300], [985, -60]], { axis: 'x', seg: 72 }), mat: 'paintWhite', ex: [-700, 0, 0], ghost: true }, 'inletCowl');
  add({ id: 'fan-cowl', name: 'Fan cowl doors', system: 'nacelle', geo: G.lathe([[985, -60], [985, 1600], [975, 1600], [975, -60]], { axis: 'x', seg: 72 }), mat: 'paintWhite', ex: [0, 700, 0], ghost: true }, 'fanCowl');
  add({ id: 'agb', name: 'Accessory gearbox', system: 'accessories', geo: G.merge([G.rbox(320, 180, 520, 20, { x: 700, y: -870 }), G.cyl(70, 160, { axis: 'x', x: 940, y: -880, z: 120 }), G.cyl(60, 140, { axis: 'x', x: 930, y: -880, z: -140 }), G.cyl(50, 120, { axis: 'x', x: 460, y: -860 })]), mat: 'castAlu', ex: [0, -500, 0] }, 'agb');
  add({ id: 'tower-shaft', name: 'Tower shaft (radial drive)', system: 'accessories', geo: G.merge([G.cyl(22, 640, { x: 700, y: -460 }), G.cyl(55, 40, { axis: 'x', x: 700, y: -770 })]), mat: 'steel', ex: [0, -300, 0] }, 'towerShaft');
}

function animate(ctx) {
  const parts = ctx.refs;
  parts.lp.obj.rotation.x = ctx.theta;
  parts.hp.obj.rotation.x = ctx.theta * 2.8;
  const g = ctx.running ? 0.55 + 0.1 * Math.sin(ctx.t * 7) : 0.45;
  for (const m of parts.flame.mats) { m.emissiveIntensity = g * 2.5; m.opacity = 0.55; }
}

export default {
  id: 'turbofan', name: 'Turbofan jet engine', shortName: 'the turbofan', sub: 'High-bypass, two-spool · Ø1.8 m fan · 22 fan blades · 9-stage HP compressor', color: '#3ea8c9',
  pieces: 4600, explodeScale: 0.6, ghostOpacity: 0.08, defaultView: 'iso', sectionDefault: 0, sectionAxis: 'z',
  views: { iso: [-1, 0.5, 1.2], front: [-1, 0.08, 0.02], side: [0.02, 0.08, 1], top: [0.001, 1, 0.001] },
  drive: { label: 'Fan (N1)', revPerSec: 0.25, unit: 'rpm on screen (real N1: ~5,000)' },
  hint: 'Press S to cut the engine open · X hides the nacelle · The HP spool turns 2.8× faster than the fan',
  systems: [
    { id: 'fan', name: 'Fan', color: '#e2571f', kind: 'moving', blurb: 'Spinner, disk and 22 wide-chord blades: the propeller of the jet age.' },
    { id: 'lpc', name: 'Booster (LP compressor)', color: '#f08a24', kind: 'moving', blurb: 'Three compressor stages on the fan shaft.' },
    { id: 'hpc', name: 'HP compressor', color: '#e0c020', kind: 'moving', blurb: 'Nine stages on the HP spool, squeezing the core air 12×.' },
    { id: 'combustor', name: 'Combustor', color: '#c0509a', kind: 'static', blurb: 'Diffuser, annular flame tube, fuel nozzles and the flame itself.' },
    { id: 'hpt', name: 'HP turbine', color: '#b0574a', kind: 'moving', blurb: 'Two stages of cooled single-crystal blades driving the HP compressor.' },
    { id: 'lpt', name: 'LP turbine', color: '#5b8def', kind: 'moving', blurb: 'Five stages driving the fan and booster through the inner shaft.' },
    { id: 'shafts', name: 'Shafts & bearings', color: '#2fb27a', kind: 'moving', blurb: 'The concentric LP and HP shafts and their five main bearings.' },
    { id: 'stators', name: 'Stators & vanes', color: '#8a929c', tint: 0.3, kind: 'static', blurb: 'Every fixed vane row: OGVs, compressor stators and turbine nozzles.' },
    { id: 'casings', name: 'Casings & frames', color: '#b8bec6', kind: 'static', housing: true, blurb: 'Fan case, compressor and turbine casings, frames and nozzle.' },
    { id: 'nacelle', name: 'Nacelle & ducts', color: '#8fb3c9', kind: 'static', housing: true, tint: 0, blurb: 'Inlet, fan cowl, bypass duct and core cowl.' },
    { id: 'accessories', name: 'Accessories', color: '#5f6d9b', kind: 'static', blurb: 'Accessory gearbox and its radial drive shaft.' },
  ],
  about: `<p>A two-spool high-bypass turbofan in the 100–150 kN class, the engine on most single-aisle airliners. The fan and the three booster stages are driven by the five-stage low-pressure turbine through a shaft running the length of the engine. Inside that, the nine-stage high-pressure compressor is driven by the two-stage high-pressure turbine at nearly three times the speed.</p>
  <p>All blade rows are lofted from NACA-style airfoil sections with span-wise twist and taper. Row-by-row hub and tip radii follow a typical flowpath: converging through the compressors, expanding through the turbines. Blade counts are realistic, which is why the piece count runs into the thousands.</p>`,
  build, animate,
};
