// Inline-four DOHC 16-valve engine, 2.0 L (86 × 86 mm). Crank axis = X (front at −X), cylinders up (+Y), intake side +Z.
import * as THREE from 'three';
import * as G from './geom.js';
import { makeMaterial } from './materials.js';

const { TAU, DEG, V3 } = G;
const BORE = 86, STROKE = 86, R = STROKE / 2, ROD = 143, CH = 30;     // crank throw, rod length, compression height
const CYL_X = [-141, -47, 47, 141], JOURNAL_X = [-188, -94, 0, 94, 188];
const PIN_PHASE = [0, Math.PI, Math.PI, 0];                             // flat-plane crank: 1&4 up, 2&3 down
const FIRE_DEG = [0, 540, 180, 360];                                    // firing order 1-3-4-2: cylinder k fires at this crank angle
const DECK = 216, HEAD_Y = 218, ROOF_Y = 232, VALVE_ANG = 12 * DEG;
const CAM_Y = 353, CAM_Z = 44.6, CAM_RB = 19, LIFT = 9, CAM_HALF = 1.4;  // base radius, max lift, half-duration (cam rad)
const CHAIN_X = -232, BELT_X = -300;
const dI = V3(0, Math.cos(VALVE_ANG), Math.sin(VALVE_ANG)), dE = V3(0, Math.cos(VALVE_ANG), -Math.sin(VALVE_ANG));
const faceY = z => ROOF_Y - Math.abs(z) * Math.tan(VALVE_ANG);
const SPRING_FREE = 40;

// ---------- part knowledge ----------
const INFO = {
  block: { desc: 'The cylinder block is the engine’s frame. It holds the four bores in line, carries the crankshaft in five main bearings, and routes oil and coolant through cast-in passages.', notes: ['Cast aluminum with pressed-in iron liners; a deep-skirt design stiffens the crankcase against bending from combustion loads.', 'Bore spacing 94 mm leaves an 8 mm wall between cylinders for the coolant jacket.', 'Bulkheads between the bores tie the deck to the main bearing saddles so the block acts as one beam.'], block: { material: 'Cast aluminum A356-T6', bores: '4 × 86 mm', deck: 'height 216 mm above crank axis', mass: '≈ 32 kg bare' } },
  liner: { desc: 'A thin cast-iron sleeve that gives the aluminum block a hard, wear-resistant bore surface for the rings to run against.', notes: ['Honed with a 45° cross-hatch that holds an oil film for the rings.', 'Cast into the block so it never moves; wall thickness about 3 mm.'], block: { material: 'Gray cast iron', bore: '86.00 mm, cross-hatch honed' } },
  jacket: { desc: 'The coolant jacket is the water-filled space cast around the cylinders. Shown here as the shape of the cavity: coolant enters from the water pump, sweeps around each bore, and exits up into the head.', notes: ['Coolant flow removes roughly a third of the fuel’s energy as heat.', 'Rendered as a solid so you can see where the passage goes; in the casting it is empty space.'], block: { fluid: '50/50 ethylene glycol – water', temperature: '85–105 °C at the thermostat' } },
  mainCap: { desc: 'Main bearing caps bolt to the block from below and clamp the crankshaft’s main journals in their bearing shells. They take the full downward thrust of every power stroke.', notes: ['Each cap is machined together with the block and must go back in the same position and orientation.', 'Bolts are tightened to yield, then angle-torqued, giving a clamping force of about 100 kN per cap.'], block: { material: 'Nodular cast iron', bolts: '2 × M10, torque-to-yield' } },
  mainBolt: { desc: 'A high-strength bolt that clamps a main bearing cap to the block. It is stretched into its plastic range on installation so the clamp load stays constant under vibration.', block: { size: 'M10 × 1.25, 90 mm', grade: '10.9 / torque-to-yield' } },
  mainShell: { desc: 'A split plain bearing shell that carries the crankshaft main journal on a hydrodynamic oil film. The crank never touches the shell while running; it rides on oil pressurised by its own rotation.', notes: ['Steel backing with a soft overlay (aluminum–tin or copper–lead) that embeds debris instead of scoring the journal.', 'Clearance is only 0.02–0.05 mm, the thickness of a sheet of paper.'], block: { type: 'Bimetal plain bearing', clearance: '0.025–0.045 mm', oil: 'fed through the block gallery' } },
  thrust: { desc: 'Thrust washers at the centre main bearing stop the crankshaft from sliding fore and aft when the clutch is pressed.', block: { endplay: '0.05–0.25 mm', position: 'main bearing 3' } },
  crank: { desc: 'The crankshaft turns the pistons’ up-and-down motion into rotation. Four crankpins, offset 43 mm from the axis, are set 180° apart so cylinders 1 & 4 rise while 2 & 3 fall.', notes: ['Forged steel, induction-hardened journals, drilled oil passages from each main journal to its crankpin.', 'Eight counterweights balance the rotating mass of the rods and pins; the reciprocating imbalance of an inline four is left to the balance shafts or the mounts.', 'Stroke 86 mm means the piston travels 172 mm per revolution, about 1.2 km every minute at 7,000 rpm, which is why the rods matter.'], block: { material: 'Forged 4340 steel', throw: '43 mm (stroke 86 mm)', mains: '5 × Ø56 mm', pins: '4 × Ø48 mm', mass: '≈ 14 kg' } },
  frontSeal: { desc: 'Rotary lip seal that keeps oil inside the timing case where the crankshaft nose passes through the front cover.', block: { type: 'PTFE lip seal' } },
  rearSeal: { desc: 'The rear main seal sits around the crankshaft flange, between the block and the flywheel. Leaks here are the classic reason to separate engine and gearbox.', block: { type: 'PTFE lip seal, one-piece' } },
  rod: { desc: 'The connecting rod links piston to crankpin. Its shank is an I-beam because it is loaded in both tension (top of the exhaust stroke) and compression (combustion), and must not buckle.', notes: ['Forged steel; the big end is fracture-split so the cap fits back with perfect registration.', 'Rod length 143 mm gives a rod-to-stroke ratio of 1.66, a common compromise between piston side load and engine height.', 'At 7,000 rpm the small end sees an inertial pull of about 10 kN as the piston reverses at TDC.'], block: { material: 'Forged 36MnVS4 steel', length: '143 mm centre to centre', bigEnd: 'Ø52 mm, fracture-split', smallEnd: 'Ø22 mm with bronze bush' } },
  rodCap: { desc: 'The lower half of the connecting rod’s big end. It is cracked off the forged rod during manufacture, so its rough fracture surface mates only with its own rod.', block: { fit: 'Fracture-split, unique to its rod' } },
  rodBolt: { desc: 'Clamps the cap to the rod. Rod bolts are among the most highly stressed fasteners in the engine and are replaced whenever they are loosened.', block: { size: 'M9 × 1.0', grade: '12.9, torque + angle' } },
  rodShell: { desc: 'Half-shell plain bearing between the rod big end and the crankpin. It runs on a film of oil that arrives through the drilling in the crankshaft.', block: { clearance: '0.02–0.04 mm', overlay: 'aluminum–tin' } },
  bush: { desc: 'Bronze bush pressed into the small end of the rod; the piston pin oscillates in it with only splash lubrication.', block: { material: 'Leaded bronze', fit: 'Pin Ø22 floating' } },
  piston: { desc: 'The piston is the moving wall of the combustion chamber. Gas pressure of up to 80 bar pushes on its crown; it passes that force through the pin into the rod.', notes: ['Cast aluminum alloy with a short skirt to save mass; the crown may carry valve reliefs and a small dish to set the compression ratio.', 'Compression height 30 mm from pin centre to crown.', 'Its skirt is slightly oval and tapered so that it becomes round only at running temperature.'], block: { material: 'Cast Al-Si alloy (M124)', diameter: '85.96 mm cold', compHeight: '30 mm', mass: '≈ 300 g with pin' } },
  pin: { desc: 'The piston pin (gudgeon pin) is a hollow, case-hardened tube joining the piston to the rod. It is the highest-loaded bearing surface for its size in the whole engine.', block: { size: 'Ø22 × 66 mm, hollow', material: 'Case-hardened 16MnCr5' } },
  clip: { desc: 'A wire circlip in a groove of the pin bore that stops the floating pin from walking out and scoring the cylinder wall.', block: { type: 'Round-wire circlip' } },
  ringTop: { desc: 'The top compression ring seals combustion pressure above the piston. It is pressed against the bore by its own spring tension and, during combustion, by gas pressure behind it.', notes: ['Barrel-faced steel with a hard PVD or chrome-nitride coating to survive the hottest, least-lubricated spot in the engine.'], block: { section: '1.2 mm × 3.5 mm', material: 'Nitrided steel, PVD face' } },
  ringSecond: { desc: 'The second compression ring backs up the top ring and scrapes oil downward. Its tapered face works like a wiper on the down-stroke.', block: { section: '1.5 mm × 3.5 mm', material: 'Cast iron, taper-faced' } },
  ringOil: { desc: 'The oil control ring is two thin rails held apart by a corrugated expander. It scrapes excess oil off the bore into holes that drain back through the piston.', block: { section: '2.5 mm, three-piece', material: 'Steel rails, stainless expander' } },
  flywheel: { desc: 'A heavy disc bolted to the rear of the crankshaft. Its inertia smooths the pulses of the four power strokes, and its face is the clutch’s friction surface.', notes: ['On a four-cylinder engine there are only two power strokes per revolution, so the flywheel carries the crank through compression.', 'Dual-mass flywheels add a spring-coupled second disc to filter torsional vibration before the gearbox.'], block: { material: 'Cast iron', diameter: '280 mm', mass: '≈ 8 kg' } },
  ringGear: { desc: 'The starter ring gear is shrunk onto the flywheel rim. The starter pinion engages its 120 teeth to spin the engine for starting.', block: { teeth: '120, module 2.33', fit: 'Shrink-fit at 200 °C' } },
  flyBolt: { desc: 'One of six bolts fixing the flywheel to the crankshaft flange. Asymmetric spacing means the flywheel goes on in one orientation only.', block: { size: 'M12 × 1.25' } },
  damper: { desc: 'The harmonic damper on the crankshaft nose doubles as the drive pulley. A rubber ring between hub and inertia ring absorbs torsional vibration that would otherwise crack the crank.', notes: ['Without it the crankshaft’s twisting resonance near 300 Hz could fatigue the nose.', 'Six-rib profile drives the serpentine belt.'], block: { diameter: '150 mm', ribs: '6, PK profile', element: 'EPDM rubber' } },
  crankBolt: { desc: 'The bolt that clamps the damper and sprocket onto the crankshaft nose. Its stretch, not the keyway, is what transmits torque.', block: { size: 'M16 × 1.5', torque: '150 N·m + 90°' } },
  toneWheel: { desc: 'A toothed wheel read by the crankshaft position sensor. It has 36 teeth with two missing, so the engine controller finds top dead centre from the gap.', block: { pattern: '36–2 teeth' } },
  crankSprocket: { desc: 'A 20-tooth sprocket on the crankshaft that drives the timing chain. The camshaft sprockets have twice as many teeth, so the cams turn at half crankshaft speed.', block: { teeth: '20', pitch: '8 mm' } },
  crankSensor: { desc: 'Hall-effect sensor reading the tone wheel. Its signal gives the controller crank angle to within a fraction of a degree for ignition and injection timing.', block: { type: 'Hall effect', gap: '0.5–1.5 mm' } },
  head: { desc: 'The cylinder head closes the top of the cylinders and houses the pent-roof combustion chambers, the valves and ports, the camshafts and the spark plugs.', notes: ['Cast aluminum for heat conduction; the combustion chamber roof runs at around 200 °C.', 'Pent-roof chamber with a 24° included valve angle puts the plug in the centre for a short flame path.', 'Ports are cast in place with sand cores and then only lightly machined.'], block: { material: 'Cast aluminum AlSi7Mg', chambers: '4 × pent roof, 24° included', valves: '16 (Ø33 in, Ø28 ex)' } },
  headGasket: { desc: 'A multi-layer steel gasket that seals combustion pressure, oil and coolant between the head and the block. Embossed beads around each bore act as springs.', notes: ['Three layers of spring steel, each about 0.25 mm; the stopper ring around the bore takes the clamp load.'], block: { type: 'MLS, 3 layers', thickness: '≈ 1.2 mm compressed' } },
  headBolt: { desc: 'One of ten bolts that clamp the head to the block against combustion pressure of up to 80 bar acting on four 86 mm bores.', notes: ['Tightened to yield in stages so all ten bolts share the load evenly; single use.'], block: { size: 'M11 × 1.5, 150 mm', clamp: '≈ 60 kN each' } },
  chamber: { desc: 'The combustion chamber: the space above the piston at top dead centre. Mixture is compressed here to about 10:1 and lit by the spark plug; the flame front crosses it in a few milliseconds. Shown as a volume that glows on the power stroke.', block: { volume: '≈ 53 cm³ at TDC', compression: '10.5 : 1', pressure: 'up to 80 bar' } },
  seatIn: { desc: 'A hardened ring pressed into the head that the intake valve seals against. Ground at 45° to match the valve face.', block: { material: 'Sintered steel', angle: '45°, 1.5 mm wide' } },
  seatEx: { desc: 'Hardened seat ring for the exhaust valve. It must conduct heat out of the valve head, which would otherwise burn.', block: { material: 'Cobalt-alloy sintered steel', angle: '45°' } },
  guide: { desc: 'A sintered bronze or iron tube pressed into the head that keeps the valve stem aligned with its seat and conducts heat from the stem.', block: { material: 'Sintered iron', clearance: '0.03 mm' } },
  stemSeal: { desc: 'A small rubber seal on top of the guide that meters oil onto the stem. Worn seals cause the blue puff of smoke on start-up.', block: { material: 'Fluoroelastomer (FKM)' } },
  valveIn: { desc: 'A poppet valve that opens to admit the fuel–air charge and seals the port shut during compression and combustion. The head is larger than the exhaust valve because the intake stroke is driven only by atmospheric pressure.', notes: ['Two intake valves per cylinder give more curtain area than one large valve, with less mass each.', 'Opens about 10° before TDC on the exhaust stroke, closes about 50° after BDC.'], block: { head: 'Ø33 mm', stem: 'Ø5.5 mm', material: 'Martensitic steel', lift: '9 mm' } },
  valveEx: { desc: 'A poppet valve that opens near the end of the power stroke to release the burnt gas. It runs at 700–800 °C, so it is made from a nickel superalloy and may be sodium-filled to move heat down the stem.', notes: ['Opens about 50° before BDC, while there is still 4–5 bar in the cylinder, so the gas blows out on its own.', 'Smaller than the intake valve: exhaust gas leaves under pressure, so less area is needed.'], block: { head: 'Ø28 mm', stem: 'Ø5.5 mm', material: 'Inconel 751 / 21-4N', lift: '9 mm' } },
  spring: { desc: 'The valve spring closes the valve and keeps the tappet in contact with the cam lobe. If the engine over-revs, the spring cannot return the valve fast enough and the valve floats.', notes: ['Installed with about 250 N preload and around 600 N at full lift.', 'Variable-pitch coils raise the natural frequency above the cam’s excitation.'], block: { wire: 'Ø4 mm chrome-silicon', rate: '≈ 40 N/mm', installed: '40 mm' } },
  retainer: { desc: 'A hardened steel cup on top of the spring, locked to the valve stem by the two keepers. It transmits the spring force to the valve.', block: { material: 'Case-hardened steel' } },
  keepers: { desc: 'Two half-cone collets that sit in a groove near the valve tip. Spring force wedges them into the retainer, locking everything together without a single threaded part.', block: { type: 'Split collets, 3 beads' } },
  tappet: { desc: 'A bucket tappet, an inverted cup that rides on the cam lobe and pushes the valve open. Its large flat face keeps contact stress low.', notes: ['Clearance is set by a shim or by the bucket’s own thickness; hydraulic versions self-adjust with oil pressure.', 'Rotates slowly in its bore to spread wear.'], block: { diameter: '31 mm', clearance: '0.20 in / 0.30 ex mm (cold)' } },
  camIn: { desc: 'The intake camshaft carries eight lobes, one per intake valve, and turns at half crankshaft speed. The profile of each lobe sets when the valve opens, how far, and how quickly.', notes: ['Base circle radius 19 mm, lobe lift 9 mm.', 'Lobes for cylinders 1 & 4 and 2 & 3 are set 180° apart on the shaft, matching the firing order 1-3-4-2.', 'The lobe outline here is computed from the lift curve, exactly as a cam designer would derive it for a flat follower.'], block: { material: 'Chilled cast iron', journals: '5 × Ø28 mm', speed: '½ crank speed' } },
  camEx: { desc: 'The exhaust camshaft. Its lobes are timed to open each exhaust valve late in the power stroke, about 180° of crank before the intake lobes for the same cylinder.', notes: ['Driven by the same chain as the intake cam; both turn in the crankshaft’s direction.'], block: { material: 'Chilled cast iron', journals: '5 × Ø28 mm', speed: '½ crank speed' } },
  camCap: { desc: 'A bearing cap clamping the camshaft journal into its saddle in the head. Machined line-bored with the head, so caps are numbered and not interchangeable.', block: { bolts: '2 × M6' } },
  camCapBolt: { desc: 'Small bolt holding a camshaft bearing cap. Tightened in sequence so the shaft is not bent as the spring loads come on.', block: { size: 'M6 × 1.0', torque: '10 N·m' } },
  vvt: { desc: 'The intake cam sprocket is a variable valve timing phaser. Oil pressure on vanes inside it rotates the cam relative to the sprocket by up to 50° of crank, advancing or retarding the intake timing while the engine runs.', notes: ['Advanced at mid load for torque; retarded at idle for stability and at high rpm for power.'], block: { teeth: '40', range: '50° crank', actuation: 'Oil pressure, solenoid-controlled' } },
  exSprocket: { desc: 'The exhaust cam sprocket. Forty teeth against twenty on the crank gives the required 2:1 reduction: two crank revolutions per cam revolution, one four-stroke cycle.', block: { teeth: '40', pitch: '8 mm' } },
  chainLink: { desc: 'One link of the timing chain. Inner links carry rollers that seat in the sprocket teeth; outer links join them with press-fit pins. The chain locks the camshafts to the crankshaft so the valves never meet the pistons.', notes: ['A stretched chain retards the cam timing; most engines allow about 1% elongation before the tensioner runs out of travel.', 'Chain speed at 6,000 rpm is about 16 m/s.'], block: { pitch: '8 mm', type: 'Simplex roller', links: 'see count' } },
  tensioner: { desc: 'A hydraulic tensioner presses a pivoting arm against the slack side of the chain. Oil pressure and a spring take up wear; a ratchet stops it backing off when the engine is stopped.', block: { type: 'Hydraulic with ratchet', travel: '≈ 15 mm' } },
  tensionerArm: { desc: 'The pivoting arm with a nylon shoe that the tensioner pushes against the chain. The chain slides along the shoe on a film of oil.', block: { shoe: 'Polyamide 66' } },
  chainGuide: { desc: 'A fixed rail on the tight side of the chain that stops it whipping between the sprockets.', block: { material: 'Polyamide on steel backbone' } },
  timingCover: { desc: 'The front cover closes the timing case and carries the oil pump and the front crank seal. It is sealed to the block and head with a bead of RTV silicone.', block: { material: 'Cast aluminum', seal: 'RTV silicone bead' } },
  valveCover: { desc: 'The cam cover keeps oil in and dirt out of the valvetrain. Modern covers are plastic or magnesium and often integrate the oil separator for crankcase ventilation.', block: { material: 'Cast aluminum here; often PA66 or magnesium', gasket: 'Moulded rubber' } },
  vcGasket: { desc: 'A moulded rubber gasket around the cam cover. It is the most common oil leak on an ageing engine because heat hardens the rubber.', block: { material: 'Acrylic rubber (ACM)' } },
  vcBolt: { desc: 'Cam cover bolt with a rubber-isolated shoulder that limits the clamp so the gasket is not crushed.', block: { size: 'M6', torque: '8 N·m' } },
  plugTube: { desc: 'A tube through the cam cover that seals oil away from the spark plug well and guides the coil down to the plug.', block: { seal: 'Rubber at both ends' } },
  plug: { desc: 'The spark plug ignites the compressed mixture with a 20–30 kV arc across a 0.8 mm gap. Its ceramic insulator keeps the centre electrode at a temperature that burns off deposits without causing pre-ignition.', notes: ['At 7,000 rpm each plug fires 58 times a second: once every two revolutions.', 'Iridium centre electrodes last 100,000 km because the tiny tip needs less voltage and erodes slowly.'], block: { thread: 'M14 × 1.25', gap: '0.8 mm', heat: 'range 6–7', electrode: 'Iridium tip' } },
  coil: { desc: 'A coil-on-plug ignition coil. The controller charges its primary winding for about 3 ms; when the current is cut, the collapsing field induces 30 kV in the secondary and the plug fires.', block: { primary: '≈ 6 A, 3 ms dwell', output: '25–35 kV', energy: '≈ 60 mJ' } },
  plenum: { desc: 'The intake manifold plenum is a reservoir of air the four runners draw from. Its volume damps the pulses of the individual cylinders so the throttle sees a smooth flow.', notes: ['Moulded glass-filled nylon: light, smooth inside, and it stays cool, so the air stays dense.', 'Runner length tunes the pressure waves so the port fills best in a chosen rpm band.'], block: { material: 'PA66-GF30', volume: '≈ 3 L', runners: '4 × 300 mm' } },
  runner: { desc: 'An intake runner carrying air from the plenum to one cylinder’s port. Its length is tuned: the pressure wave reflected from the closed valve returns just as the valve opens again, ramming in extra charge.', block: { length: '≈ 300 mm', bore: 'Ø42 mm' } },
  throttle: { desc: 'The throttle body meters air into the engine. An electric motor rotates the butterfly plate in response to the accelerator pedal; at idle it is nearly closed and the engine pulls a vacuum against it.', block: { bore: 'Ø60 mm', actuation: 'Electronic (drive-by-wire)' } },
  throttlePlate: { desc: 'The throttle butterfly: a disc on a shaft that swings from closed (idle) to fully open. Shown part-open.', block: { angle: 'shown at 30°' } },
  intakeGasket: { desc: 'Seals the manifold to the head ports. Moulded rubber in a carrier keeps it in place during assembly.' },
  fuelRail: { desc: 'A pipe that holds fuel at regulated pressure and feeds the four injectors. On this port-injected engine it runs at about 4 bar; direct-injection rails run at 200–350 bar.', block: { pressure: '3.5–4 bar', material: 'Stainless steel' } },
  injector: { desc: 'A solenoid valve that sprays a measured pulse of fuel into the intake port, aimed at the back of the hot intake valve so it evaporates before the valve opens.', notes: ['Pulse widths of 2–15 ms; the controller varies them for load, temperature and the oxygen sensor reading.'], block: { type: 'Port fuel injector, 4-hole', flow: '≈ 250 cm³/min at 3 bar' } },
  portIn: { desc: 'The intake port, cast into the head, carries the charge from the manifold face down to the two intake valves. Shown as the shape of the passage. A slight curve builds tumble motion in the cylinder that speeds up combustion.', block: { crossSection: 'Ø38 mm → 2 valves', flow: 'tumble-generating' } },
  portEx: { desc: 'The exhaust port collects burnt gas from the two exhaust valves and leads it out to the manifold face. Shown as the shape of the passage. Short and straight, to get heat out of the head quickly.', block: { crossSection: '2 valves → Ø32 mm', temperature: 'up to 900 °C' } },
  exRunner: { desc: 'One exhaust manifold runner. It carries pulses of 800 °C gas from a port to the collector; runner lengths are equalised so the pulses arrive evenly spaced.', block: { material: 'Cast iron or 409 stainless', temperature: '700–900 °C' } },
  collector: { desc: 'Where the four exhaust runners merge. A 4-into-1 collector at the right length lets the pulse from one cylinder help draw gas out of the next.', block: { outlet: 'Ø65 mm' } },
  exFlange: { desc: 'The flange joining the manifold to the downpipe and catalytic converter. Studs and copper nuts survive the heat cycling.', block: { bolts: '3 × M10 studs' } },
  exGasket: { desc: 'Multi-layer steel gasket sealing the manifold to the head against pulsing hot gas.', block: { type: 'MLS, embossed' } },
  o2: { desc: 'The oxygen sensor measures how much oxygen is left in the exhaust. Its signal lets the controller trim fuel to the stoichiometric ratio of 14.7:1 that the catalytic converter needs.', block: { type: 'Wideband zirconia', heater: '12 V, reaches 700 °C in 10 s' } },
  heatShield: { desc: 'A stamped sheet over the manifold that keeps radiant heat away from wiring, hoses and the hood.', block: { material: 'Aluminised steel, 0.8 mm' } },
  pan: { desc: 'The oil pan (sump) is the reservoir under the crankcase. Oil drains back into it, cools a little, and is drawn up again by the pump pickup.', notes: ['Baffles inside stop oil surging away from the pickup under cornering or braking.', 'Cast aluminum pans add stiffness to the crankcase; stamped steel ones are cheaper and quieter.'], block: { capacity: '4.5 L', material: 'Cast aluminum' } },
  panGasket: { desc: 'Seals the pan to the crankcase rail. Rubber in a steel carrier, or simply a bead of RTV silicone.' },
  panBolt: { desc: 'Oil pan bolt. Tightened lightly and in a spiral pattern from the centre outward so the flange stays flat.', block: { size: 'M6', torque: '10 N·m' } },
  drainPlug: { desc: 'The drain plug at the lowest point of the pan. A fresh crush washer each oil change is what keeps it from weeping.', block: { size: 'M14 × 1.5', washer: 'Aluminum crush washer' } },
  oil: { desc: 'Engine oil at rest in the sump. Running, about a litre of it is in flight at any moment: in the galleries, on the cylinder walls, in the head, draining back.', block: { grade: '0W-20 or 5W-30', volume: '4.5 L', temperature: '90–120 °C' } },
  oilPump: { desc: 'A gerotor oil pump on the crankshaft nose, inside the front cover. It pressurises oil to about 4 bar and sends it through the filter to the bearings, then up to the valvetrain.', notes: ['Driven directly by the crank, so it delivers more than needed at high rpm; a relief valve dumps the excess back to the pan.', 'Variable-displacement versions save a few percent of fuel by pumping only what the engine asks for.'], block: { type: 'Gerotor, crank-driven', pressure: '≈ 4 bar hot at 2,000 rpm', flow: '≈ 30 L/min' } },
  rotorIn: { desc: 'The inner gerotor rotor, keyed to the crankshaft. Its four lobes roll inside the five-lobed outer rotor; the gaps between them grow on the inlet side and shrink on the outlet side, pumping the oil.', block: { lobes: '4', speed: 'crank speed' } },
  rotorOut: { desc: 'The outer gerotor rotor, five lobes, running in a bore offset from the crank axis. It is driven round by the inner rotor at four-fifths of its speed.', block: { lobes: '5', speed: '⅘ crank speed' } },
  pickup: { desc: 'The pickup tube draws oil from the bottom of the sump through a mesh strainer that catches anything big enough to damage the pump.', block: { strainer: '1 mm mesh', submerged: '≈ 25 mm below the oil level' } },
  filter: { desc: 'The full-flow oil filter traps particles down to about 20 µm before the oil reaches the bearings. A bypass valve opens if the element clogs, because dirty oil is better than none.', block: { rating: '20–25 µm', bypass: 'opens at 1 bar differential' } },
  dipstick: { desc: 'A rod that shows the oil level in the sump between two marks. Still fitted because the level sensor is cheaper to ignore than the engine.', block: { range: 'min–max ≈ 1 L' } },
  waterPump: { desc: 'The belt-driven centrifugal water pump circulates coolant through the block, the head and out to the radiator. Its impeller spins at 1.5 times crank speed.', block: { drive: 'Serpentine belt, 1.5 : 1', flow: '≈ 150 L/min at 6,000 rpm' } },
  impeller: { desc: 'The pump impeller: a disc of curved vanes that flings coolant outward. Shown inside its housing.', block: { vanes: '6, backward-curved' } },
  wpPulley: { desc: 'The pulley driving the water pump shaft from the serpentine belt.', block: { diameter: '100 mm' } },
  thermostat: { desc: 'The thermostat housing at the head’s coolant outlet. Inside, a wax capsule opens a valve at about 88 °C, sending coolant to the radiator only once the engine is warm.', block: { opening: '88 °C', fullyOpen: '100 °C' } },
  alternator: { desc: 'The alternator generates the car’s electricity. Belt-driven at about 2.3 times crank speed, it produces three-phase AC that is rectified to 14 V inside.', block: { output: '120–150 A at 14 V', ratio: '2.3 : 1', speed: 'up to 18,000 rpm' } },
  altPulley: { desc: 'The alternator pulley. Many are overrunning clutch pulleys that let the heavy rotor freewheel when the crank slows, protecting the belt.', block: { diameter: '64 mm', type: 'Overrunning decoupler' } },
  ac: { desc: 'The air-conditioning compressor, driven by the belt through an electromagnetic clutch that engages only when cooling is requested.', block: { type: 'Swash-plate, variable', drive: 'Electromagnetic clutch' } },
  acPulley: { desc: 'The compressor clutch pulley, freewheeling on a bearing until the clutch coil pulls the drive plate onto it.', block: { diameter: '110 mm' } },
  beltTensioner: { desc: 'A spring-loaded tensioner pulley on the slack side of the serpentine belt keeps it taut as the belt stretches and the engine speed pulses.', block: { force: '≈ 300 N belt tension' } },
  belt: { desc: 'The serpentine belt drives the water pump, alternator and compressor from the crank damper. Six ribs on its inner face grip the pulleys; its back runs over the tensioner.', notes: ['EPDM rubber with polyester cords; typical life 100,000 km.'], block: { profile: '6PK', length: '≈ 1,150 mm' } },
  starter: { desc: 'The starter motor spins the engine to about 250 rpm for starting. A solenoid throws its pinion into the flywheel ring gear and closes the 150 A circuit.', block: { power: '1.4 kW', current: 'up to 200 A', ratio: '120 : 21' } },
  pinion: { desc: 'The starter pinion, thrown forward by the solenoid to mesh with the ring gear. An overrunning clutch lets the engine spin it once it fires.', block: { teeth: '21' } },
  knock: { desc: 'A piezoelectric knock sensor bolted to the block. It listens for the 6–8 kHz ring of detonation so the controller can retard the spark on that cylinder.', block: { band: '6–8 kHz' } },
  camSensor: { desc: 'A Hall sensor reading a target on the camshaft end. Combined with the crank sensor it tells the controller which of the two crank revolutions the engine is on.', block: { type: 'Hall effect' } },
};

// ---------- kinematics helpers ----------
const liftAt = g => (Math.abs(g) < CAM_HALF ? LIFT * 0.5 * (1 + Math.cos(Math.PI * g / CAM_HALF)) : 0);   // g = cam rad from nose
// crank-angle centre of valve events (local cycle angle, degrees): intake 450, exhaust 270
const IN_CENTER = 450, EX_CENTER = 270;
function valveLift(thetaDeg, k, intake) {
  let phi = ((thetaDeg - FIRE_DEG[k]) % 720 + 720) % 720;
  const c = intake ? IN_CENTER : EX_CENTER;
  let d = phi - c; if (d > 360) d -= 720; if (d < -360) d += 720;
  return liftAt(d * DEG / 2);
}
function pistonY(theta, k) { const phi = theta + PIN_PHASE[k]; const s = R * Math.sin(phi); return R * Math.cos(phi) + Math.sqrt(ROD * ROD - s * s); }

// ---------- build ----------
function* build(P) {
  const parts = P.refs;
  const add = (spec, kind) => { const info = INFO[kind] || {}; return P.add({ desc: info.desc, notes: info.notes, block: info.block, ...spec }); };

  // ===== Block & crankcase =====
  yield 'cylinder block';
  {
    const deck = G.rectShape(440, 200); CYL_X.forEach(x => G.circleHole(deck, 46, x, 0));
    const walls = G.rectShape(440, 236); G.rectHole(walls, 424, 220);
    const bh = new THREE.Shape(); bh.moveTo(-100, 0); bh.lineTo(-30, 0); bh.absarc(0, 0, 30, Math.PI, 0, true); bh.lineTo(100, 0); bh.lineTo(100, 100); bh.lineTo(-100, 100); bh.closePath();
    const bulk = JOURNAL_X.map(x => G.place(G.extrudeX(bh, 24), { x }));
    const geo = G.merge([G.extrudeY(deck, 116, { y: 158 }), G.extrudeY(walls, 155, { y: 22.5 }), ...bulk,
      G.box(440, 6, 236, { y: -52 })]);
    parts.block = add({ id: 'block', name: 'Cylinder block', system: 'block', geo, mat: 'castAlu', ex: [0, 0, 0] }, 'block');
    CYL_X.forEach((x, i) => add({ id: `liner-${i + 1}`, name: `Cylinder liner · cylinder ${i + 1}`, system: 'block', geo: G.annulus(46, 43, 126, { x, y: 153 }), mat: 'castIron', ex: [0, 150, 0] }, 'liner'));
    const jk = G.rectShape(400, 150); CYL_X.forEach(x => G.circleHole(jk, 49, x, 0));
    add({ id: 'jacket', name: 'Coolant jacket (cavity)', system: 'cooling', geo: G.extrudeY(jk, 90, { y: 163 }), mat: 'coolant', ex: [0, 0, 0], pick: true }, 'jacket');
  }
  yield 'main bearings';
  {
    const cs = new THREE.Shape(); cs.moveTo(-45, -45); cs.lineTo(45, -45); cs.lineTo(45, 0); cs.lineTo(30, 0); cs.absarc(0, 0, 30, 0, Math.PI, true); cs.lineTo(-45, 0); cs.closePath();
    JOURNAL_X.forEach((x, i) => {
      add({ id: `main-cap-${i + 1}`, name: `Main bearing cap ${i + 1}`, system: 'block', geo: G.extrudeX(cs, 24, { x }), mat: 'darkSteel', ex: [0, -260, 0] }, 'mainCap');
      [-38, 38].forEach((z, j) => add({ id: `main-bolt-${i + 1}-${j}`, name: `Main cap bolt ${i + 1}${j ? 'b' : 'a'}`, system: 'block', geo: G.place(G.bolt(10, 90), { rx: Math.PI, x, y: -45, z }), mat: 'darkSteel', ex: [0, -340, 0] }, 'mainBolt'));
      add({ id: `main-shell-u-${i + 1}`, name: `Main bearing shell ${i + 1} (upper)`, system: 'block', geo: G.place(G.halfShellX(30, 28, 22), { x }), mat: 'babbitt', ex: [0, -60, 0] }, 'mainShell');
      add({ id: `main-shell-l-${i + 1}`, name: `Main bearing shell ${i + 1} (lower)`, system: 'block', geo: G.place(G.halfShellX(30, 28, 22, true), { x }), mat: 'babbitt', ex: [0, -200, 0] }, 'mainShell');
    });
    add({ id: 'thrust-a', name: 'Thrust washer (front)', system: 'block', geo: G.place(G.halfShellX(40, 31, 2.5), { x: -13 }), mat: 'bronze', ex: [0, -100, 0] }, 'thrust');
    add({ id: 'thrust-b', name: 'Thrust washer (rear)', system: 'block', geo: G.place(G.halfShellX(40, 31, 2.5), { x: 13 }), mat: 'bronze', ex: [0, -100, 0] }, 'thrust');
    add({ id: 'seal-front', name: 'Front crankshaft seal', system: 'block', geo: G.annulus(26, 16, 8, { axis: 'x', x: -262 }), mat: 'rubber', ex: [-360, 0, 0] }, 'frontSeal');
    add({ id: 'seal-rear', name: 'Rear main seal', system: 'block', geo: G.annulus(58, 50, 8, { axis: 'x', x: 204 }), mat: 'rubber', ex: [140, 0, 0] }, 'rearSeal');
  }

  // ===== Crankshaft =====
  yield 'crankshaft';
  {
    const web = G.roundedPoly([[-33, -12, 10], [33, -12, 10], [30, 50, 12], [-30, 50, 12]]);
    const cw = G.roundedPoly([[-56, -8, 6], [56, -8, 6], [66, -46, 14], [0, -80, 20], [-66, -46, 14]]);
    const list = [];
    JOURNAL_X.forEach(x => list.push(G.cyl(28, 26, { axis: 'x', x })));
    CYL_X.forEach((x, k) => {
      const ph = PIN_PHASE[k];
      list.push(G.cyl(24, 28, { axis: 'x', x, y: R * Math.cos(ph), z: R * Math.sin(ph) }));
      [-24, 24].forEach(dx => {
        list.push(G.place(G.merge([G.extrudeX(web, 22), G.extrudeX(cw, 22)]), { rx: ph, x: x + dx }));
      });
    });
    list.push(G.cyl(18, 42, { axis: 'x', x: -221 }), G.cyl(16, 82, { axis: 'x', x: -281 }), G.cyl(50, 12, { axis: 'x', x: 206 }), G.cyl(20, 10, { axis: 'x', x: 195 }));
    parts.crank = add({ id: 'crank', name: 'Crankshaft', system: 'crank', geo: G.merge(list), mat: 'steel', ex: [0, -130, 0] }, 'crank');
    // attached to the crank (children rotate with it)
    add({ id: 'crank-sprocket', name: 'Crankshaft timing sprocket', system: 'timing', parent: 'crank', geo: G.place(G.gear(20, 2.55, 8, { bore: 18 }), { ry: Math.PI / 2, x: CHAIN_X }), mat: 'hardened', ex: [-120, 0, 0] }, 'crankSprocket');
    add({ id: 'rotor-in', name: 'Oil pump inner rotor', system: 'lube', parent: 'crank', geo: G.extrudeX(gerotorShape(4, 22, 5), 12, { x: -248 }), mat: 'hardened', ex: [-260, 0, 0] }, 'rotorIn');
    add({ id: 'tone-wheel', name: 'Crank position tone wheel', system: 'crank', parent: 'crank', geo: G.place(G.gear(36, 3.7, 4, { bore: 16 }), { ry: Math.PI / 2, x: -275 }), mat: 'darkSteel', ex: [-300, 0, 0] }, 'toneWheel');
    const damperPts = [[16, -15], [75, -15], [75, -12], [70, -10], [75, -8], [70, -6], [75, -4], [70, -2], [75, 0], [70, 2], [75, 4], [70, 6], [75, 8], [70, 10], [75, 12], [75, 15], [40, 15], [40, 10], [30, 10], [30, 15], [16, 15]];
    add({ id: 'damper', name: 'Harmonic damper / crank pulley', system: 'crank', parent: 'crank', geo: G.lathe(damperPts, { axis: 'x', x: BELT_X, seg: 64 }), mat: 'darkSteel', ex: [-400, 0, 0] }, 'damper');
    add({ id: 'crank-bolt', name: 'Crankshaft bolt', system: 'crank', parent: 'crank', geo: G.place(G.bolt(16, 40, { washer: true }), { rz: Math.PI / 2, x: -322 }), mat: 'darkSteel', ex: [-520, 0, 0] }, 'crankBolt');
    parts.flywheel = add({ id: 'flywheel', name: 'Flywheel', system: 'crank', parent: 'crank', geo: G.lathe([[0, -14], [130, -14], [130, 14], [112, 14], [112, 9], [60, 9], [60, 14], [0, 14]], { axis: 'x', x: 226, seg: 96 }), mat: 'castIron', ex: [260, 0, 0] }, 'flywheel');
    add({ id: 'ring-gear', name: 'Starter ring gear', system: 'crank', parent: 'flywheel', geo: G.place(G.gear(120, 2.33, 12, { bore: 130 }), { ry: Math.PI / 2, x: 226 }), mat: 'hardened', ex: [70, 0, 0] }, 'ringGear');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.2; add({ id: `fly-bolt-${i}`, name: `Flywheel bolt ${i + 1}`, system: 'crank', parent: 'flywheel', geo: G.place(G.bolt(12, 30), { axis: 'x', x: 240, y: 36 * Math.cos(a), z: 36 * Math.sin(a) }), mat: 'darkSteel', ex: [130, 0, 0] }, 'flyBolt'); }
  }

  // ===== Connecting rods & pistons =====
  yield 'pistons and rods';
  {
    const rodUpper = (() => {
      const half = G.halfShellX(38, 26, 22);
      const web = G.box(6, 112, 16, { y: 78 }), fl1 = G.box(20, 112, 4, { y: 78, z: 9 }), fl2 = G.box(20, 112, 4, { y: 78, z: -9 });
      const small = G.annulus(18, 13, 22, { axis: 'x', y: ROD });
      const bossL = G.rbox(22, 14, 14, 3, { z: -31, y: 7 }), bossR = G.rbox(22, 14, 14, 3, { z: 31, y: 7 });
      return G.merge([half, web, fl1, fl2, small, bossL, bossR]);
    })();
    const capGeo = G.merge([G.halfShellX(38, 26, 22, true), G.rbox(22, 14, 14, 3, { z: -31, y: -7 }), G.rbox(22, 14, 14, 3, { z: 31, y: -7 })]);
    const pistonPts = [[0, 30], [43, 30], [43, 25.5], [39, 25.5], [39, 24], [43, 24], [43, 20.8], [39, 20.8], [39, 19], [43, 19], [43, 15.8], [39, 15.8], [39, 13], [43, 13], [43, -28], [37, -28], [37, 22], [0, 22]];
    CYL_X.forEach((x, k) => {
      const rod = add({ id: `rod-${k + 1}`, name: `Connecting rod · cylinder ${k + 1}`, system: 'crank', geo: rodUpper.clone(), mat: 'steel', pos: [x, 0, 0], ex: [0, 0, 0] }, 'rod');
      parts[`rod${k}`] = rod;
      add({ id: `rod-cap-${k + 1}`, name: `Rod cap · cylinder ${k + 1}`, system: 'crank', parent: rod.id, geo: capGeo.clone(), mat: 'steel', ex: [0, -70, 0] }, 'rodCap');
      [-31, 31].forEach((z, j) => add({ id: `rod-bolt-${k + 1}-${j}`, name: `Rod bolt · cylinder ${k + 1}${j ? 'b' : 'a'}`, system: 'crank', parent: rod.id, geo: G.place(G.bolt(9, 40), { rx: Math.PI, y: -14, z }), mat: 'darkSteel', ex: [0, -120, 0] }, 'rodBolt'));
      add({ id: `rod-shell-u-${k + 1}`, name: `Rod bearing shell · cylinder ${k + 1} (upper)`, system: 'crank', parent: rod.id, geo: G.halfShellX(26, 24, 20), mat: 'babbitt', ex: [0, 40, 0] }, 'rodShell');
      add({ id: `rod-shell-l-${k + 1}`, name: `Rod bearing shell · cylinder ${k + 1} (lower)`, system: 'crank', parent: rod.id, geo: G.halfShellX(26, 24, 20, true), mat: 'babbitt', ex: [0, -40, 0] }, 'rodShell');
      add({ id: `bush-${k + 1}`, name: `Small-end bush · cylinder ${k + 1}`, system: 'crank', parent: rod.id, geo: G.annulus(13, 11, 22, { axis: 'x', y: ROD }), mat: 'bronze', ex: [0, 60, 0] }, 'bush');
      const piston = add({ id: `piston-${k + 1}`, name: `Piston · cylinder ${k + 1}`, system: 'crank', geo: G.merge([G.lathe(pistonPts, { seg: 64 }), G.cyl(14, 62, { axis: 'z', y: -2 })]), mat: 'aluminum', pos: [x, R + ROD, 0], ex: [0, 90, 0] }, 'piston');
      parts[`piston${k}`] = piston;
      add({ id: `pin-${k + 1}`, name: `Piston pin · cylinder ${k + 1}`, system: 'crank', parent: piston.id, geo: G.annulus(11, 6, 66, { axis: 'z' }), mat: 'polished', ex: [0, 0, 70] }, 'pin');
      [-34, 34].forEach((z, j) => add({ id: `clip-${k + 1}-${j}`, name: `Pin circlip · cylinder ${k + 1}${j ? 'b' : 'a'}`, system: 'crank', parent: piston.id, geo: G.torus(11.5, 0.9, { axis: 'z', z, seg: 32, tube: 8 }), mat: 'hardened', ex: [0, 0, z > 0 ? 110 : -40] }, 'clip'));
      add({ id: `ring-1-${k + 1}`, name: `Top compression ring · cylinder ${k + 1}`, system: 'crank', parent: piston.id, geo: G.annulus(43.2, 39.7, 1.2, { y: 24.75, seg: 64 }), mat: 'hardened', ex: [0, 40, 0] }, 'ringTop');
      add({ id: `ring-2-${k + 1}`, name: `Second compression ring · cylinder ${k + 1}`, system: 'crank', parent: piston.id, geo: G.annulus(43.2, 39.7, 1.5, { y: 19.9, seg: 64 }), mat: 'castIron', ex: [0, 30, 0] }, 'ringSecond');
      add({ id: `ring-3-${k + 1}`, name: `Oil control ring · cylinder ${k + 1}`, system: 'crank', parent: piston.id, geo: G.annulus(43.2, 39.7, 2.5, { y: 14.4, seg: 64 }), mat: 'hardened', ex: [0, 20, 0] }, 'ringOil');
    });
  }

  // ===== Cylinder head =====
  yield 'cylinder head';
  {
    const roofZ = 43, roofEdge = faceY(roofZ);
    const prof = new THREE.Shape(); prof.moveTo(-105, HEAD_Y); prof.lineTo(-roofZ, HEAD_Y); prof.lineTo(-roofZ, roofEdge); prof.lineTo(0, ROOF_Y); prof.lineTo(roofZ, roofEdge); prof.lineTo(roofZ, HEAD_Y); prof.lineTo(105, HEAD_Y); prof.lineTo(105, CAM_Y); prof.lineTo(-105, CAM_Y); prof.closePath();
    const sep = G.polyShape([[-roofZ, HEAD_Y], [-roofZ, roofEdge], [0, ROOF_Y], [roofZ, roofEdge], [roofZ, HEAD_Y]]);
    const geo = G.merge([G.extrudeX(prof, 440), G.extrudeX(sep, 36, { x: -202 }), G.extrudeX(sep, 36, { x: 202 }), G.extrudeX(sep, 8, { x: -94 }), G.extrudeX(sep, 8, { x: 0 }), G.extrudeX(sep, 8, { x: 94 })]);
    add({ id: 'head', name: 'Cylinder head', system: 'head', geo, mat: 'castAlu', ex: [0, 320, 0] }, 'head');
    const gk = G.rectShape(440, 210); CYL_X.forEach(x => G.circleHole(gk, 44, x, 0));
    add({ id: 'head-gasket', name: 'Head gasket', system: 'head', geo: G.extrudeY(gk, 2, { y: 217 }), mat: 'gasket', ex: [0, 240, 0] }, 'headGasket');
    JOURNAL_X.forEach((x, i) => [-72, 72].forEach((z, j) => add({ id: `head-bolt-${i}-${j}`, name: `Head bolt ${i * 2 + j + 1}`, system: 'head', geo: G.place(G.bolt(11, 150, { washer: true }), { x, y: CAM_Y + 1, z }), mat: 'darkSteel', ex: [0, 520, 0] }, 'headBolt')));
    CYL_X.forEach((x, k) => {
      const ch = G.merge([G.extrudeX(sep, 86, { x }), G.cyl(43, 22, { x, y: 207 })]);
      parts[`fire${k}`] = add({ id: `chamber-${k + 1}`, name: `Combustion chamber · cylinder ${k + 1}`, system: 'fuel', geo: ch, mat: 'fire', ex: [0, 320, 0], pick: true }, 'chamber');
      add({ id: `port-in-${k + 1}`, name: `Intake port · cylinder ${k + 1}`, system: 'intake', geo: G.pipe([[x, 292, 108], [x, 284, 78], [x, 258, 44], [x, 236, 24]], 18), mat: 'air', ex: [0, 320, 0] }, 'portIn');
      add({ id: `port-ex-${k + 1}`, name: `Exhaust port · cylinder ${k + 1}`, system: 'exhaust', geo: G.pipe([[x, 235, -24], [x, 252, -46], [x, 266, -80], [x, 270, -108]], 15), mat: 'air', matOpts: { color: 0xffa060 }, ex: [0, 320, 0] }, 'portEx');
      add({ id: `plug-${k + 1}`, name: `Spark plug · cylinder ${k + 1}`, system: 'fuel', obj: sparkPlug(), pos: [x, ROOF_Y - 2, 0], ex: [0, 720, 0] }, 'plug');
      add({ id: `coil-${k + 1}`, name: `Ignition coil · cylinder ${k + 1}`, system: 'fuel', geo: G.merge([G.cyl(11, 110, { y: 350 }), G.rbox(38, 46, 46, 5, { y: 428 }), G.rbox(30, 8, 60, 2, { y: 452, z: 30 })]), mat: 'plastic', pos: [x, 0, 0], ex: [0, 800, 0] }, 'coil');
    });
  }

  // ===== Valvetrain =====
  yield 'valves and springs';
  {
    const valveGeo = dia => G.lathe([[0, 0], [dia / 2, 0], [dia / 2, 1.2], [dia / 2 - 2.4, 3.6], [2.75, 6], [2.75, 95.5], [3.3, 95.5], [3.3, 98.5], [2.75, 98.5], [2.75, 104], [0, 104]], { seg: 40 });
    const retainerGeo = G.lathe([[0, 0], [14, 0], [14, 2.5], [5, 2.5], [4, 6], [0, 6]], { seg: 32 });
    const keeperGeo = G.cone(3.2, 4.6, 6.5, { seg: 24 });
    const tappetGeo = G.lathe([[0, 26], [15.5, 26], [15.5, 0], [14, 0], [14, 21], [0, 21]], { seg: 48 });
    const springGeo = G.spring(13, 2, SPRING_FREE, 5.5);
    CYL_X.forEach((x, k) => {
      [['in', dI, 18, 33, 'valveIn', 'seatIn'], ['ex', dE, -18, 28, 'valveEx', 'seatEx']].forEach(([side, d, z, dia, kind, seatKind]) => {
        [-19, 19].forEach((dx, j) => {
          const id = `${side}-${k + 1}${j ? 'b' : 'a'}`;
          const face = V3(x + dx, faceY(z), z);
          const q = G.quatToDir(d);
          const at = s => face.clone().addScaledVector(d, s);
          const label = `${side === 'in' ? 'Intake' : 'Exhaust'} valve ${j + 1} · cylinder ${k + 1}`;
          const seatP = at(1);
          add({ id: `seat-${id}`, name: `Valve seat (${side === 'in' ? 'intake' : 'exhaust'}) · cylinder ${k + 1}`, system: 'head', geo: G.annulus(dia / 2 + 2, dia / 2 - 3, 2.4), mat: 'hardened', pos: [seatP.x, seatP.y, seatP.z], quat: q, ex: [0, 320, 0] }, seatKind);
          const gP = at(52); add({ id: `guide-${id}`, name: `Valve guide · ${label.toLowerCase()}`, system: 'head', geo: G.annulus(5.5, 3, 44), mat: 'bronze', pos: [gP.x, gP.y, gP.z], quat: q, ex: [0, 320, 0] }, 'guide');
          const sP = at(77); add({ id: `seal-${id}`, name: `Valve stem seal · ${label.toLowerCase()}`, system: 'head', geo: G.annulus(5.2, 2.9, 6), mat: 'rubber', pos: [sP.x, sP.y, sP.z], quat: q, ex: [0, 350, 0] }, 'stemSeal');
          const valve = add({ id: `valve-${id}`, name: label, system: 'valvetrain', geo: valveGeo(dia).clone(), mat: side === 'in' ? 'hardened' : 'inconel', pos: [face.x, face.y, face.z], quat: q, ex: [0, 150, 0] }, kind);
          valve.userData = { d, k, intake: side === 'in', face };
          parts[`valve-${id}`] = valve;
          add({ id: `retainer-${id}`, name: `Spring retainer · ${label.toLowerCase()}`, system: 'valvetrain', parent: valve.id, geo: retainerGeo.clone(), mat: 'hardened', pos: [0, 95, 0], ex: [0, 80, 0] }, 'retainer');
          add({ id: `keepers-${id}`, name: `Valve keepers · ${label.toLowerCase()}`, system: 'valvetrain', parent: valve.id, geo: keeperGeo.clone(), mat: 'hardened', pos: [0, 98.5, 0], ex: [0, 110, 0] }, 'keepers');
          add({ id: `tappet-${id}`, name: `Bucket tappet · ${label.toLowerCase()}`, system: 'valvetrain', parent: valve.id, geo: tappetGeo.clone(), mat: 'polished', pos: [0, 83, 0], ex: [0, 150, 0] }, 'tappet');
          const spP = at(55 + SPRING_FREE / 2);
          const spring = add({ id: `spring-${id}`, name: `Valve spring · ${label.toLowerCase()}`, system: 'valvetrain', geo: springGeo.clone(), mat: 'darkSteel', pos: [spP.x, spP.y, spP.z], quat: q, ex: [0, 200, 0] }, 'spring');
          spring.userData = { d, seat: at(55), valve };
          parts[`spring-${id}`] = spring;
        });
      });
    });
  }
  yield 'camshafts';
  {
    const lobeShape = G.camLobeShape(CAM_RB, liftAt);
    const camGeo = (intake) => {
      const list = [G.cyl(12, 430, { axis: 'x', x: -10 })];
      JOURNAL_X.forEach(x => list.push(G.cyl(14, 20, { axis: 'x', x })));
      const dir = intake ? dI : dE; const beta = Math.atan2(-dir.z, -dir.y); // nose direction (from +Y toward +Z) at peak
      const center = intake ? IN_CENTER : EX_CENTER;
      CYL_X.forEach((x, k) => [-19, 19].forEach(dx => {
        const peak = (center + FIRE_DEG[k]) * DEG;            // crank angle of peak lift
        const rho0 = beta - peak / 2;                         // lobe angle baked in; cam rotates by theta/2
        list.push(G.place(G.extrudeX(lobeShape, 14), { rx: rho0, x: x + dx }));
      }));
      return G.merge(list);
    };
    parts.camIn = add({ id: 'cam-in', name: 'Intake camshaft', system: 'valvetrain', geo: camGeo(true), mat: 'darkSteel', pos: [0, CAM_Y, CAM_Z], ex: [0, 420, 60] }, 'camIn');
    parts.camEx = add({ id: 'cam-ex', name: 'Exhaust camshaft', system: 'valvetrain', geo: camGeo(false), mat: 'darkSteel', pos: [0, CAM_Y, -CAM_Z], ex: [0, 420, -60] }, 'camEx');
    const vvt = G.merge([G.place(G.gear(40, 2.55, 8, { bore: 12 }), { ry: Math.PI / 2, x: CHAIN_X }), G.cyl(46, 22, { axis: 'x', x: CHAIN_X - 4 }), G.cyl(20, 30, { axis: 'x', x: CHAIN_X - 14 })]);
    add({ id: 'vvt', name: 'Intake cam sprocket (VVT phaser)', system: 'timing', parent: 'cam-in', geo: vvt, mat: 'hardened', pos: [0, 0, 0], ex: [-130, 0, 0] }, 'vvt');
    add({ id: 'ex-sprocket', name: 'Exhaust cam sprocket', system: 'timing', parent: 'cam-ex', geo: G.merge([G.place(G.gear(40, 2.55, 8, { bore: 12 }), { ry: Math.PI / 2, x: CHAIN_X }), G.cyl(20, 14, { axis: 'x', x: CHAIN_X - 8 })]), mat: 'hardened', ex: [-130, 0, 0] }, 'exSprocket');
    const cap = new THREE.Shape(); cap.moveTo(-18, 22); cap.lineTo(-18, 0); cap.lineTo(-14, 0); cap.absarc(0, 0, 14, Math.PI, 0, true); cap.lineTo(18, 0); cap.lineTo(18, 22); cap.closePath();
    JOURNAL_X.forEach((x, i) => [CAM_Z, -CAM_Z].forEach((z, s) => {
      add({ id: `cam-cap-${s}-${i}`, name: `Cam bearing cap ${i + 1} (${s ? 'exhaust' : 'intake'})`, system: 'valvetrain', geo: G.extrudeX(cap, 18, { x, y: CAM_Y, z }), mat: 'castAlu', ex: [0, 520, s ? -60 : 60] }, 'camCap');
      [-13, 13].forEach((dz, j) => add({ id: `cap-bolt-${s}-${i}-${j}`, name: `Cam cap bolt ${i + 1}${j ? 'b' : 'a'} (${s ? 'exhaust' : 'intake'})`, system: 'valvetrain', geo: G.place(G.bolt(6, 34), { x, y: CAM_Y + 22, z: z + dz }), mat: 'darkSteel', ex: [0, 600, s ? -60 : 60] }, 'camCapBolt'));
    }));
    [CAM_Z, -CAM_Z].forEach((z, s) => add({ id: `cam-sensor-${s}`, name: `Camshaft position sensor (${s ? 'exhaust' : 'intake'})`, system: 'fuel', geo: G.merge([G.cyl(8, 26, { axis: 'x', x: 233, y: CAM_Y + 20, z }), G.rbox(10, 22, 30, 3, { x: 244, y: CAM_Y + 20, z })]), mat: 'plastic', ex: [160, 320, 0] }, 'camSensor'));
  }

  // ===== Timing chain =====
  yield 'timing chain';
  {
    const basis = { o: V3(CHAIN_X, 0, 0), U: V3(0, 1, 0), V: V3(0, 0, 1) };
    const pulleys = [{ c: [0, 0], r: 25.6 }, { c: [212, -84], r: 22, inside: true }, { c: [CAM_Y, -CAM_Z], r: 51 }, { c: [CAM_Y, CAM_Z], r: 51 }];
    const bp = G.beltPath(pulleys, basis);
    const n = Math.round(bp.length / 8); const pitch = bp.length / n;
    const chain = parts.chain = { path: bp.path, length: bp.length, n, pitch, links: [], rCrank: 25.6 };
    const innerGeo = G.merge([G.rbox(12, 7, 1.2, 3, { z: 2.4 }), G.rbox(12, 7, 1.2, 3, { z: -2.4 }), G.cyl(2.6, 4, { axis: 'z', x: 4 }), G.cyl(2.6, 4, { axis: 'z', x: -4 })]);
    const outerGeo = G.merge([G.rbox(12, 7, 1.2, 3, { z: 3.7 }), G.rbox(12, 7, 1.2, 3, { z: -3.7 }), G.cyl(1.5, 8.6, { axis: 'z', x: 4 }), G.cyl(1.5, 8.6, { axis: 'z', x: -4 })]);
    for (let i = 0; i < n; i++) {
      const p = add({ id: `link-${i}`, name: `Timing chain link ${i + 1} (${i % 2 ? 'outer' : 'inner'})`, system: 'timing', geo: (i % 2 ? outerGeo : innerGeo).clone(), mat: i % 2 ? 'darkSteel' : 'steel', ex: [-120, 0, 0] }, 'chainLink');
      chain.links.push(p);
    }
    // guides and tensioner
    add({ id: 'chain-guide', name: 'Timing chain guide (fixed)', system: 'timing', geo: G.place(G.rbox(12, 250, 8, 3), { rx: 11.2 * DEG, x: CHAIN_X, y: 175, z: 68 }), mat: 'plastic', ex: [-120, 0, 60] }, 'chainGuide');
    const armDir = Math.atan2(-84 + 52, 212 - 30);
    add({ id: 'tensioner-arm', name: 'Chain tensioner arm', system: 'timing', geo: G.merge([G.place(G.rbox(12, 190, 8, 3), { rx: armDir, x: CHAIN_X, y: 121, z: -68 }), G.cyl(22, 12, { axis: 'x', x: CHAIN_X, y: 212, z: -84 }), G.cyl(6, 14, { axis: 'x', x: CHAIN_X, y: 30, z: -52 })]), mat: 'plastic', ex: [-120, 0, -60] }, 'tensionerArm');
    add({ id: 'tensioner', name: 'Hydraulic chain tensioner', system: 'timing', geo: G.merge([G.cyl(11, 40, { axis: 'z', x: CHAIN_X, y: 200, z: -125 }), G.cyl(5, 22, { axis: 'z', x: CHAIN_X, y: 200, z: -97 })]), mat: 'steel', ex: [-120, 0, -120] }, 'tensioner');
  }

  // ===== Covers =====
  yield 'covers';
  {
    const plate = G.rectShape(224, 470, 10); const flange = G.rectShape(224, 470, 10); G.rectHole(flange, 208, 454);
    const pump = G.cyl(64, 20, { axis: 'x', x: -256 });
    const cover = G.merge([G.place(G.extrudeX(plate, 8), { x: -262, y: 180 }), G.place(G.extrudeX(flange, 38), { x: -239, y: 180 }), pump]);
    add({ id: 'timing-cover', name: 'Timing cover (front cover)', system: 'covers', geo: cover, mat: 'castAlu', ex: [-260, 0, 0] }, 'timingCover');
    add({ id: 'oil-pump', name: 'Oil pump (gerotor)', system: 'lube', geo: G.annulus(54, 40, 20, { axis: 'x', x: -252 }), mat: 'castAlu', ex: [-260, 0, 0] }, 'oilPump');
    add({ id: 'rotor-out', name: 'Oil pump outer rotor', system: 'lube', geo: (() => { const s = G.circleShape(38); const inner = gerotorShape(5, 27, 5).getPoints(); s.holes.push(new THREE.Path(inner.reverse())); return G.extrudeX(s, 12); })(), mat: 'hardened', pos: [-248, 4, 0], ex: [-260, 0, 0] }, 'rotorOut');
    const vc = new THREE.Shape(); vc.moveTo(-108, CAM_Y); vc.lineTo(108, CAM_Y); vc.lineTo(108, CAM_Y + 19); vc.quadraticCurveTo(108, CAM_Y + 52, 60, CAM_Y + 52); vc.lineTo(-60, CAM_Y + 52); vc.quadraticCurveTo(-108, CAM_Y + 52, -108, CAM_Y + 19); vc.closePath();
    const vcHole = new THREE.Path(); vcHole.moveTo(-103, CAM_Y - 0.1); vcHole.lineTo(-103, CAM_Y + 17); vcHole.quadraticCurveTo(-103, CAM_Y + 47, -60, CAM_Y + 47); vcHole.lineTo(60, CAM_Y + 47); vcHole.quadraticCurveTo(103, CAM_Y + 47, 103, CAM_Y + 17); vcHole.lineTo(103, CAM_Y - 0.1); vcHole.closePath();
    const vcOuter = vc.clone(); vc.holes.push(vcHole);
    const vcGeo = G.merge([G.extrudeX(vc, 440), G.extrudeX(vcOuter, 6, { x: -217 }), G.extrudeX(vcOuter, 6, { x: 217 })]);
    add({ id: 'valve-cover', name: 'Cam cover (valve cover)', system: 'covers', geo: vcGeo, mat: 'castAlu', ex: [0, 640, 0] }, 'valveCover');
    const vg = G.rectShape(440, 216); G.rectHole(vg, 430, 206);
    add({ id: 'vc-gasket', name: 'Cam cover gasket', system: 'covers', geo: G.extrudeY(vg, 2, { y: CAM_Y + 1 }), mat: 'rubber', ex: [0, 600, 0] }, 'vcGasket');
    [[-190, 100], [-95, 100], [0, 100], [95, 100], [190, 100], [-190, -100], [-95, -100], [0, -100], [95, -100], [190, -100]].forEach(([x, z], i) => add({ id: `vc-bolt-${i}`, name: `Cam cover bolt ${i + 1}`, system: 'covers', geo: G.place(G.bolt(6, 30, { washer: true }), { x, y: CAM_Y + 24, z }), mat: 'darkSteel', ex: [0, 700, 0] }, 'vcBolt'));
    CYL_X.forEach((x, k) => add({ id: `plug-tube-${k + 1}`, name: `Spark plug tube · cylinder ${k + 1}`, system: 'covers', geo: G.annulus(15, 13, 56, { x, y: CAM_Y + 26 }), mat: 'aluminum', ex: [0, 640, 0] }, 'plugTube'));
  }

  // ===== Intake & fuel =====
  yield 'intake';
  {
    const plenum = G.merge([G.cyl(46, 370, { axis: 'x', y: 312, z: 208, seg: 48 }), G.sphere(46, { x: -185, y: 312, z: 208 }), G.sphere(46, { x: 185, y: 312, z: 208 })]);
    add({ id: 'plenum', name: 'Intake manifold plenum', system: 'intake', geo: plenum, mat: 'plastic', ex: [0, 40, 320], ghost: true }, 'plenum');
    CYL_X.forEach((x, k) => {
      add({ id: `runner-${k + 1}`, name: `Intake runner · cylinder ${k + 1}`, system: 'intake', geo: G.pipe([[x, 300, 195], [x, 292, 160], [x, 290, 130], [x, 291, 104]], 21), mat: 'plastic', ex: [0, 20, 220] }, 'runner');
      add({ id: `injector-${k + 1}`, name: `Fuel injector · cylinder ${k + 1}`, system: 'fuel', geo: G.lathe([[0, 0], [4, 0], [4, 8], [7.5, 12], [7.5, 40], [9, 44], [9, 52], [0, 52]]), mat: 'plasticGray', pos: [x, 298, 121], quat: G.quatToDir(V3(0, 0.95, 0.31)), ex: [0, 90, 200] }, 'injector');
    });
    add({ id: 'fuel-rail', name: 'Fuel rail', system: 'fuel', geo: G.merge([G.cyl(10, 350, { axis: 'x', y: 347, z: 137 }), G.cyl(5, 60, { axis: 'z', x: 175, y: 347, z: 160 })]), mat: 'steel', ex: [0, 120, 260] }, 'fuelRail');
    const tb = G.merge([G.annulus(34, 30, 60, { axis: 'x', x: -218, y: 312, z: 208 }), G.rbox(40, 30, 26, 4, { x: -218, y: 312, z: 246 })]);
    add({ id: 'throttle', name: 'Throttle body', system: 'intake', geo: tb, mat: 'castAlu', ex: [-120, 40, 320] }, 'throttle');
    add({ id: 'throttle-plate', name: 'Throttle plate (butterfly)', system: 'intake', geo: G.merge([G.cyl(29, 1.5, { axis: 'x' }), G.cyl(3, 70, { axis: 'y' })]), mat: 'brass', pos: [-218, 312, 208], rot: [0, 0, 30 * DEG], ex: [-160, 40, 320] }, 'throttlePlate');
    const ig = G.rectShape(400, 60); CYL_X.forEach(x => G.circleHole(ig, 20, x, 0));
    add({ id: 'intake-gasket', name: 'Intake manifold gasket', system: 'intake', geo: G.place(G.extrude(ig, 2), { y: 290, z: 106 }), mat: 'rubber', ex: [0, 10, 130] }, 'intakeGasket');
  }

  // ===== Exhaust =====
  yield 'exhaust';
  {
    CYL_X.forEach((x, k) => add({ id: `ex-runner-${k + 1}`, name: `Exhaust runner · cylinder ${k + 1}`, system: 'exhaust', geo: G.pipe([[x, 270, -108], [x, 262, -150], [x * 0.55 + 14, 205, -178], [30, 165, -180]], 19, { seg: 40 }), mat: 'exhaust', ex: [0, -20, -300] }, 'exRunner'));
    add({ id: 'collector', name: 'Exhaust collector', system: 'exhaust', geo: G.merge([G.cyl(32, 150, { x: 30, y: 95, z: -180 }), G.sphere(32, { x: 30, y: 168, z: -180 })]), mat: 'exhaust', ex: [0, -60, -320] }, 'collector');
    add({ id: 'ex-flange', name: 'Exhaust flange', system: 'exhaust', geo: G.merge([G.annulus(52, 30, 10, { x: 30, y: 18, z: -180 }), ...[0, 1, 2].map(i => G.place(G.bolt(10, 30), { x: 30 + 44 * Math.cos(i * TAU / 3), y: 26, z: -180 + 44 * Math.sin(i * TAU / 3) }))]), mat: 'darkSteel', ex: [0, -140, -340] }, 'exFlange');
    const eg = G.rectShape(400, 50); CYL_X.forEach(x => G.circleHole(eg, 17, x, 0));
    add({ id: 'exhaust-gasket', name: 'Exhaust manifold gasket', system: 'exhaust', geo: G.place(G.extrude(eg, 2), { y: 270, z: -106 }), mat: 'gasket', ex: [0, 0, -120] }, 'exGasket');
    add({ id: 'o2', name: 'Oxygen sensor (upstream)', system: 'exhaust', geo: G.merge([G.cyl(9, 40, { axis: 'z' }), G.cyl(11, 8, { axis: 'z', z: -22, seg: 6 }), G.cyl(4, 40, { axis: 'z', z: -45 })]), mat: 'steel', pos: [30, 120, -212], rot: [0, 0, 0], ex: [0, -60, -420] }, 'o2');
    add({ id: 'heat-shield', name: 'Exhaust heat shield', system: 'exhaust', geo: G.place(G.rbox(400, 2, 150, 4), { rx: -0.9, y: 262, z: -160 }), mat: 'aluminum', ex: [0, 60, -420] }, 'heatShield');
  }

  // ===== Lubrication =====
  yield 'oil pan';
  {
    const walls = G.rectShape(430, 236, 8); G.rectHole(walls, 420, 226);
    const rim = G.rectShape(462, 262, 10); G.rectHole(rim, 430, 236);
    const pan = G.merge([G.extrudeY(walls, 75, { y: -92.5 }), G.box(430, 5, 236, { y: -127.5 }), G.extrudeY(rim, 6, { y: -58 })]);
    add({ id: 'pan', name: 'Oil pan (sump)', system: 'lube', geo: pan, mat: 'castAlu', ex: [0, -500, 0], ghost: true }, 'pan');
    add({ id: 'oil', name: 'Engine oil (at rest)', system: 'lube', geo: G.box(412, 32, 218, { y: -108 }), mat: 'oil', ex: [0, -500, 0] }, 'oil');
    const pg = G.rectShape(462, 262, 10); G.rectHole(pg, 424, 230);
    add({ id: 'pan-gasket', name: 'Oil pan gasket', system: 'lube', geo: G.extrudeY(pg, 2, { y: -54 }), mat: 'rubber', ex: [0, -440, 0] }, 'panGasket');
    const pb = [[-190, 123], [-95, 123], [0, 123], [95, 123], [190, 123], [-190, -123], [-95, -123], [0, -123], [95, -123], [190, -123], [-223, 60], [-223, -60], [223, 60], [223, -60]];
    pb.forEach(([x, z], i) => add({ id: `pan-bolt-${i}`, name: `Oil pan bolt ${i + 1}`, system: 'lube', geo: G.place(G.bolt(6, 24), { rx: Math.PI, x, y: -61, z }), mat: 'darkSteel', ex: [0, -600, 0] }, 'panBolt'));
    add({ id: 'drain-plug', name: 'Oil drain plug', system: 'lube', geo: G.place(G.bolt(14, 14, { washer: true }), { rx: Math.PI, x: 150, y: -130, z: 0 }), mat: 'darkSteel', ex: [0, -650, 0] }, 'drainPlug');
    add({ id: 'pickup', name: 'Oil pickup tube and strainer', system: 'lube', geo: G.merge([G.pipe([[-236, -20, -30], [-225, -60, -30], [-190, -95, -10], [-130, -108, 0]], 8), G.cyl(30, 6, { x: -125, y: -114 })]), mat: 'steel', ex: [0, -300, 0] }, 'pickup');
    add({ id: 'filter', name: 'Oil filter', system: 'lube', geo: G.merge([G.cyl(38, 88, { axis: 'z', x: 150, y: 40, z: -160, seg: 48 }), G.cyl(30, 10, { axis: 'z', x: 150, y: 40, z: -112 })]), mat: 'paintBlue', ex: [0, -40, -240] }, 'filter');
    add({ id: 'dipstick', name: 'Dipstick and tube', system: 'lube', geo: G.merge([G.pipe([[100, -70, 100], [100, 80, 118], [100, 250, 138], [100, 320, 150]], 5), G.torus(12, 3, { x: 100, y: 335, z: 154, seg: 32 })]), mat: 'steel', ex: [0, 60, 200] }, 'dipstick');
  }

  // ===== Cooling =====
  yield 'cooling';
  {
    const wpPulley = add({ id: 'wp-pulley', name: 'Water pump pulley', system: 'belt', geo: G.lathe([[0, -10], [50, -10], [50, -6], [46, -4], [50, -2], [46, 0], [50, 2], [46, 4], [50, 6], [50, 10], [0, 10]], { axis: 'x', x: BELT_X, seg: 64 }), mat: 'darkSteel', pos: [0, 150, -40], ex: [-360, 0, 0] }, 'wpPulley');
    add({ id: 'water-pump', name: 'Water pump', system: 'cooling', geo: G.merge([G.cyl(45, 26, { axis: 'x', x: -279 }), G.cyl(12, 12, { axis: 'x', x: -297 }), G.cyl(16, 40, { axis: 'z', x: -279, z: -50 })]), mat: 'castAlu', pos: [0, 150, -40], ex: [-220, 0, -40] }, 'waterPump');
    const vanes = []; for (let i = 0; i < 6; i++) vanes.push(G.place(G.box(3, 20, 8), { y: 20, ry: 0, rx: (i / 6) * TAU }));
    add({ id: 'impeller', name: 'Water pump impeller', system: 'cooling', parent: 'wp-pulley', geo: G.merge([G.cyl(30, 4, { axis: 'x', x: -272 }), ...vanes.map(v => G.place(v, { x: -278 }))]), mat: 'plastic', ex: [-160, 0, 0] }, 'impeller');
    add({ id: 'thermostat', name: 'Thermostat housing', system: 'cooling', geo: G.merge([G.rbox(30, 50, 50, 5, { x: 235, y: 300, z: 60 }), G.cyl(17, 50, { axis: 'x', x: 272, y: 300, z: 60 })]), mat: 'castAlu', ex: [160, 60, 0] }, 'thermostat');
    add({ id: 'knock', name: 'Knock sensor', system: 'fuel', geo: G.merge([G.cyl(15, 18, { axis: 'z', z: -112 }), G.place(G.bolt(8, 30), { axis: 'z', z: -121 })]), mat: 'plastic', pos: [0, 130, 0], ex: [0, 0, -160] }, 'knock');
    add({ id: 'crank-sensor', name: 'Crankshaft position sensor', system: 'fuel', geo: G.merge([G.cyl(6, 26, { y: -13 }), G.rbox(14, 12, 24, 3, { y: -30 })]), mat: 'plastic', pos: [-275, -76, 0], ex: [-300, -120, 0] }, 'crankSensor');
  }

  // ===== Belt drive & accessories =====
  yield 'belt drive';
  {
    const basis = { o: V3(BELT_X, 0, 0), U: V3(0, 1, 0), V: V3(0, 0, 1) };
    const pulleys = [{ c: [0, 0], r: 75 }, { c: [-7, -128], r: 35, inside: true }, { c: [30, -190], r: 32 }, { c: [150, -40], r: 50 }, { c: [60, 190], r: 55 }];
    const bp = G.beltPath(pulleys, basis);
    add({ id: 'belt', name: 'Serpentine belt', system: 'belt', geo: G.sweep(bp.path, [[-2.25, -11], [2.25, -11], [2.25, 11], [-2.25, 11]], V3(1, 0, 0), 240), mat: 'rubber', ex: [-420, 0, 0] }, 'belt');
    add({ id: 'alt-pulley', name: 'Alternator pulley', system: 'belt', geo: G.lathe([[0, -10], [32, -10], [32, -6], [28, -4], [32, -2], [28, 0], [32, 2], [28, 4], [32, 6], [32, 10], [0, 10]], { axis: 'x', x: BELT_X, seg: 48 }), mat: 'steel', pos: [0, 30, -190], ex: [-380, 0, 0] }, 'altPulley');
    add({ id: 'alternator', name: 'Alternator', system: 'belt', geo: G.merge([G.cyl(65, 140, { axis: 'x', x: -220, seg: 48 }), G.cyl(60, 30, { axis: 'x', x: -140, seg: 48 }), G.cyl(11, 20, { axis: 'x', x: -288 }), G.rbox(80, 24, 14, 3, { x: -200, z: 69 })]), mat: 'castAlu', pos: [0, 30, -190], ex: [-220, -40, -140] }, 'alternator');
    add({ id: 'ac-pulley', name: 'A/C compressor clutch pulley', system: 'belt', geo: G.lathe([[0, -10], [55, -10], [55, -6], [51, -4], [55, -2], [51, 0], [55, 2], [51, 4], [55, 6], [55, 10], [0, 10], [0, -10]], { axis: 'x', x: BELT_X, seg: 64 }), mat: 'darkSteel', pos: [0, 60, 190], ex: [-380, 0, 0] }, 'acPulley');
    add({ id: 'ac', name: 'A/C compressor', system: 'belt', geo: G.merge([G.cyl(60, 140, { axis: 'x', x: -220, seg: 48 }), G.cyl(12, 20, { axis: 'x', x: -288 }), G.rbox(80, 24, 14, 3, { x: -200, z: -66 })]), mat: 'castAlu', pos: [0, 60, 190], ex: [-220, -20, 160] }, 'ac');
    add({ id: 'belt-tensioner', name: 'Belt tensioner pulley', system: 'belt', geo: G.cyl(35, 20, { axis: 'x', x: BELT_X, seg: 48 }), mat: 'darkSteel', pos: [0, -7, -128], ex: [-420, 0, -60] }, 'beltTensioner');
    add({ id: 'tensioner-body', name: 'Belt tensioner (spring arm)', system: 'belt', geo: G.merge([G.cyl(20, 30, { axis: 'x', x: -280, y: -7, z: -128 }), G.rbox(30, 14, 60, 4, { x: -278, y: -7, z: -100 })]), mat: 'castAlu', ex: [-300, 0, -60] }, 'beltTensioner');
    add({ id: 'starter', name: 'Starter motor', system: 'belt', geo: G.merge([G.cyl(37, 140, { axis: 'x', x: 312, y: -40, z: 160, seg: 48 }), G.cyl(24, 90, { axis: 'x', x: 295, y: 10, z: 175, seg: 32 }), G.cyl(6, 20, { axis: 'x', x: 236, y: -40, z: 160 })]), mat: 'paintBlack', ex: [220, 0, 140] }, 'starter');
    add({ id: 'pinion', name: 'Starter pinion', system: 'belt', geo: G.place(G.gear(21, 2.33, 14, { bore: 6 }), { ry: Math.PI / 2, x: 226, y: -40, z: 160 }), mat: 'hardened', ex: [200, 0, 140] }, 'pinion');
  }
}

function gerotorShape(lobes, r0, a, n = 96) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) { const t = (i / n) * TAU; const r = r0 + a * Math.cos(lobes * t); const x = r * Math.cos(t), y = r * Math.sin(t); if (i === 0) s.moveTo(x, y); else s.lineTo(x, y); }
  s.closePath(); return s;
}
function sparkPlug() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(G.merge([G.cyl(7, 20, { y: 10 }), G.cyl(11, 10, { y: 27, seg: 6 }), G.cyl(2.5, 10, { y: 71 })]), makeMaterial('steel'));
  const ins = new THREE.Mesh(G.lathe([[0, 30], [6.5, 30], [6.5, 40], [5, 44], [5, 66], [2.5, 68], [0, 68]], { seg: 32 }), makeMaterial('ceramic'));
  const tip = new THREE.Mesh(G.merge([G.cyl(1.2, 5, { y: -1 }), G.box(2, 1.2, 6, { y: -4, z: 2 }), G.box(1.2, 4, 1.2, { y: -2.5, z: 4.5 })]), makeMaterial('inconel'));
  g.add(shell, ins, tip); return g;
}

// ---------- animate ----------
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _t = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3(1, 0, 0);
function animate(ctx) {
  const parts = ctx.refs, chain = parts.chain;
  const th = ctx.theta; const deg = th / DEG;
  parts.crank.obj.rotation.x = th;
  for (let k = 0; k < 4; k++) {
    const phi = th + PIN_PHASE[k];
    const py = pistonY(th, k);
    const pist = parts[`piston${k}`], rod = parts[`rod${k}`];
    pist.obj.position.y = py;
    const cy = R * Math.cos(phi), cz = R * Math.sin(phi);
    rod.obj.position.set(CYL_X[k], cy, cz);
    rod.obj.rotation.x = Math.atan2(-cz, py - cy);
    // combustion glow
    const fire = parts[`fire${k}`];
    let phase = ((deg - FIRE_DEG[k]) % 720 + 720) % 720; if (phase > 700) phase -= 720;
    const glow = phase > -6 && phase < 70 ? 1 - (phase + 6) / 76 : 0;
    for (const m of fire.mats) { m.emissiveIntensity = glow * 2.2; m.opacity = glow * 0.85; }
  }
  parts.camIn.obj.rotation.x = th / 2; parts.camEx.obj.rotation.x = th / 2;
  for (const id in parts) {
    if (!id.startsWith('valve-')) continue;
    const v = parts[id]; const { d, k, intake } = v.userData;
    const L = valveLift(deg, k, intake);
    v.obj.position.copy(v.base.p).addScaledVector(d, -L);
    const sp = parts['spring-' + id.slice(6)];
    const len = SPRING_FREE - L;
    sp.obj.position.copy(sp.userData.seat).addScaledVector(d, len / 2);
    sp.obj.scale.set(1, len / SPRING_FREE, 1);
  }
  if (chain) {
    const shift = th * chain.rCrank;
    for (let i = 0; i < chain.n; i++) {
      let s = (i * chain.pitch + shift) % chain.length; if (s < 0) s += chain.length;
      const u = s / chain.length;
      const link = chain.links[i];
      chain.path.getPointAt(u, link.obj.position);
      chain.path.getTangentAt(u, _t).normalize();
      _b.crossVectors(_n, _t);
      _m.makeBasis(_t, _b, _n); link.obj.quaternion.setFromRotationMatrix(_m);
    }
  }
  const o = ctx.obj;
  o('wp-pulley').rotation.x = th * 1.5; o('alt-pulley').rotation.x = th * 75 / 32; o('ac-pulley').rotation.x = th * 75 / 55; o('belt-tensioner').rotation.x = -th * 75 / 35;
  o('rotor-out').rotation.x = th * 0.8 + 0.3;
}

function cycle(theta) {
  const deg = ((theta / DEG) % 720 + 720) % 720;
  const idx = deg < 180 ? 2 : deg < 360 ? 3 : deg < 540 ? 0 : 1;
  return { title: 'Cylinder 1', labels: ['Intake', 'Compression', 'Power', 'Exhaust'], active: idx, color: ['#3b82f6', '#d9a300', '#e2571f', '#7a8794'][idx] };
}

export default {
  id: 'inline4', name: 'Inline-four engine', shortName: 'the inline-four', sub: '2.0 L DOHC 16-valve · 86 × 86 mm · firing order 1-3-4-2', color: '#e2571f',
  pieces: 520, explodeScale: 0.8, defaultView: 'iso', sectionDefault: -0.16, sectionAxis: 'x',
  views: { iso: [-1, 0.55, 1.35], front: [-1, 0.12, 0.05], side: [0.05, 0.12, 1], top: [0.001, 1, 0.001] },
  drive: { label: 'Crankshaft', revPerSec: 0.35 },
  hint: 'Drag to orbit · Space runs the engine · X for x-ray · S to section',
  systems: [
    { id: 'block', name: 'Block & crankcase', color: '#8a929c', kind: 'static', housing: true, blurb: 'The structural core: block, liners, main bearings and seals.' },
    { id: 'crank', name: 'Crank train', color: '#e2571f', kind: 'moving', blurb: 'Crankshaft, rods, pistons, flywheel and damper: the parts that turn pressure into rotation.' },
    { id: 'head', name: 'Cylinder head', color: '#7f9dc4', kind: 'static', housing: true, blurb: 'The head casting with its combustion chambers, ports, seats and guides.' },
    { id: 'valvetrain', name: 'Valvetrain', color: '#2fb27a', kind: 'moving', blurb: 'Camshafts, tappets, springs and sixteen valves that breathe for the engine.' },
    { id: 'timing', name: 'Timing drive', color: '#f2b632', kind: 'moving', blurb: 'The chain and sprockets that keep the cams in step with the crank.' },
    { id: 'intake', name: 'Intake', color: '#3aa6d8', kind: 'static', blurb: 'Throttle, plenum, runners and ports: the air path in.' },
    { id: 'fuel', name: 'Fuel & ignition', color: '#c9509d', kind: 'static', blurb: 'Fuel rail, injectors, plugs, coils, sensors, and the combustion volume itself.' },
    { id: 'exhaust', name: 'Exhaust', color: '#b0574a', kind: 'static', blurb: 'Ports, runners and collector: the hot gas path out.' },
    { id: 'lube', name: 'Lubrication', color: '#8f6b3a', kind: 'static', blurb: 'Pan, pump, pickup and filter: the oil circuit.' },
    { id: 'cooling', name: 'Cooling', color: '#2ab0b5', kind: 'static', blurb: 'Water pump, jacket and thermostat: the coolant circuit.' },
    { id: 'belt', name: 'Belt drive & accessories', color: '#5f6d9b', kind: 'moving', blurb: 'Serpentine belt, alternator, compressor, pulleys and the starter.' },
    { id: 'covers', name: 'Covers', color: '#b8bec6', kind: 'static', housing: true, blurb: 'Timing cover, cam cover and their gaskets.' },
  ],
  about: `<p>A 2.0-litre, four-cylinder, double-overhead-cam petrol engine of the kind fitted to most family cars built since 1990. Bore and stroke are both 86 mm (a “square” engine), giving 1,998 cm³. Each cylinder has two intake valves and two exhaust valves in a pent-roof chamber with a central spark plug.</p>
  <p>Every piston follows the slider-crank equation <em>y = r cos θ + √(l² − r² sin² θ)</em> with r = 43 mm and l = 143 mm. Valve lift follows a cosine lift curve of 9 mm over 320° of crank, and each cam lobe outline is derived from that curve as the envelope for a flat follower, so lobes and valves agree exactly. The timing chain runs at crank-pulley speed along a tangent-and-arc path around the three sprockets.</p>`,
  build, animate, cycle,
};
