// Geometry toolkit for procedurally machined parts.
// Everything returns a THREE.BufferGeometry positioned in its own local frame; use place() to bake a transform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ============================================================
// Transforms
// ============================================================
// A transform request is applied as an ordered pipeline (axis re-aim, then
// rotation, then translation) rather than a chain of independent if-blocks.
const AXIS_REAIM = {
  x: (geo) => geo.rotateZ(-Math.PI / 2),
  z: (geo) => geo.rotateX(Math.PI / 2),
};

/** Bake a transform into a geometry. opts: {x,y,z, rx,ry,rz (rad), axis:'x'|'y'|'z'} — axis re-aims a Y-axis primitive. */
export function place(geo, opts = {}) {
  const reaim = AXIS_REAIM[opts.axis];
  if (reaim) reaim(geo);

  if (opts.rx) geo.rotateX(opts.rx);
  if (opts.ry) geo.rotateY(opts.ry);
  if (opts.rz) geo.rotateZ(opts.rz);

  const dx = opts.x || 0, dy = opts.y || 0, dz = opts.z || 0;
  if (dx || dy || dz) geo.translate(dx, dy, dz);

  return geo;
}

const MERGE_KEEP_ATTRS = new Set(['position', 'normal']);

export function merge(list) {
  const stripped = list
    .filter(Boolean)
    .map((g) => (g.index ? g.toNonIndexed() : g))
    .map((g) => {
      for (const attr of Object.keys(g.attributes)) {
        if (!MERGE_KEEP_ATTRS.has(attr)) g.deleteAttribute(attr);
      }
      return g;
    });
  return mergeGeometries(stripped, false);
}

const ROTATE_ON_AXIS = {
  x: (geo, angle) => geo.rotateX(angle),
  y: (geo, angle) => geo.rotateY(angle),
  z: (geo, angle) => geo.rotateZ(angle),
};

/** Rotate copies of a geometry about an axis ('x'|'y'|'z') n times and merge. */
export function radial(geo, n, axis = 'z', offset = 0) {
  const spin = ROTATE_ON_AXIS[axis] || ROTATE_ON_AXIS.z;
  const copies = Array.from({ length: n }, (_, i) => {
    const g = geo.clone();
    spin(g, offset + (i / n) * TAU);
    return g;
  });
  return merge(copies);
}

// ============================================================
// Primitives
// ============================================================

// cyl() and cone() both wrap CylinderGeometry with the two radii in a
// different order, so they share one internal builder.
function cylinderLike(radiusA, radiusB, h, opts) {
  return place(new THREE.CylinderGeometry(radiusA, radiusB, h, opts.seg ?? 48, 1, !!opts.open), opts);
}

export function cyl(r, h, opts = {}) {
  return cylinderLike(opts.rTop ?? r, r, h, opts);
}
export function cone(rBottom, rTop, h, opts = {}) {
  return cylinderLike(rTop, rBottom, h, opts);
}
export function box(w, h, d, opts = {}) {
  return place(new THREE.BoxGeometry(w, h, d), opts);
}
export function rbox(w, h, d, r = 2, opts = {}) {
  const corner = Math.min(r, w / 2, h / 2, d / 2);
  return place(new RoundedBoxGeometry(w, h, d, opts.seg ?? 3, corner), opts);
}
export function sphere(r, opts = {}) {
  const widthSeg = opts.seg ?? 32;
  const heightSeg = opts.seg ? Math.round(opts.seg * 0.6) : 20;
  return place(new THREE.SphereGeometry(r, widthSeg, heightSeg), opts);
}
export function torus(R, r, opts = {}) {
  return place(new THREE.TorusGeometry(R, r, opts.tube ?? 12, opts.seg ?? 64, opts.arc ?? TAU), opts);
}
/** Solid of revolution from [[r, y], ...] points (r >= 0), axis Y by default. */
export function lathe(pts, opts = {}) {
  const profile = pts.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(profile, opts.seg ?? 48, opts.phiStart ?? 0, opts.phiLength ?? TAU);
  return place(g, opts);
}
/** Tube/annulus: outer radius R, inner r, height h, along Y (use opts.axis). */
export function annulus(R, r, h, opts = {}) {
  const outline = new THREE.Shape();
  outline.absarc(0, 0, R, 0, TAU, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, r, 0, TAU, true);
  outline.holes.push(bore);

  const g = new THREE.ExtrudeGeometry(outline, { depth: h, bevelEnabled: false, curveSegments: opts.seg ?? 48 });
  g.translate(0, 0, -h / 2);
  g.rotateX(-Math.PI / 2); // extrude along Y
  return place(g, opts);
}
/** Extrude a 2D shape (in XY) along Z, centered. opts: depth, bevel, steps, twist (rad over full depth), taper (scale at +z end). */
export function extrude(shape, depth, opts = {}) {
  const bevelAmount = opts.bevel || 0;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: !!opts.bevel,
    bevelThickness: bevelAmount,
    bevelSize: bevelAmount,
    bevelSegments: 2,
    steps: opts.steps ?? 1,
    curveSegments: opts.seg ?? 24,
  });
  g.translate(0, 0, -depth / 2);
  if (opts.twist) twist(g, opts.twist / depth);
  if (opts.taper !== undefined) taper(g, opts.taper, depth);
  return place(g, opts);
}

// twist() and taper() both walk every vertex and rewrite its X/Y from a
// per-vertex scalar derived from Z; that shared shape is factored out here.
function remapXY(g, fn) {
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const [nx, ny] = fn(v);
    p.setXY(i, nx, ny);
  }
  g.computeVertexNormals();
  return g;
}

/** Twist a geometry about Z: rotation angle = z * radPerUnit. Needs subdivided sides (extrude steps). */
export function twist(g, radPerUnit) {
  return remapXY(g, (v) => {
    const a = v.z * radPerUnit, c = Math.cos(a), s = Math.sin(a);
    return [v.x * c - v.y * s, v.x * s + v.y * c];
  });
}
/** Scale XY linearly from 1 at z=-depth/2 to `scaleEnd` at z=+depth/2. */
export function taper(g, scaleEnd, depth) {
  return remapXY(g, (v) => {
    const t = (v.z + depth / 2) / depth;
    const s = 1 + (scaleEnd - 1) * t;
    return [v.x * s, v.y * s];
  });
}

// ============================================================
// 2D shapes
// ============================================================

export function rectShape(w, h, r = 0) {
  const s = new THREE.Shape();
  if (r <= 0) {
    s.moveTo(-w / 2, -h / 2);
    s.lineTo(w / 2, -h / 2);
    s.lineTo(w / 2, h / 2);
    s.lineTo(-w / 2, h / 2);
    s.closePath();
    return s;
  }
  const rc = Math.min(r, w / 2, h / 2);
  // Walk the four corners in order, drawing the straight edge into each
  // corner then arcing around it — same outline, expressed as one loop
  // over corner descriptors instead of four hand-written edge/arc pairs.
  const corners = [
    { edgeTo: [w / 2 - rc, -h / 2], arcCenter: [w / 2 - rc, -h / 2 + rc], from: -Math.PI / 2, to: 0 },
    { edgeTo: [w / 2, h / 2 - rc], arcCenter: [w / 2 - rc, h / 2 - rc], from: 0, to: Math.PI / 2 },
    { edgeTo: [-w / 2 + rc, h / 2], arcCenter: [-w / 2 + rc, h / 2 - rc], from: Math.PI / 2, to: Math.PI },
    { edgeTo: [-w / 2, -h / 2 + rc], arcCenter: [-w / 2 + rc, -h / 2 + rc], from: Math.PI, to: Math.PI * 1.5 },
  ];
  s.moveTo(-w / 2 + rc, -h / 2);
  for (const c of corners) {
    s.lineTo(c.edgeTo[0], c.edgeTo[1]);
    s.absarc(c.arcCenter[0], c.arcCenter[1], rc, c.from, c.to, false);
  }
  s.closePath();
  return s;
}
export function circleShape(r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, TAU, false);
  return s;
}
export function circleHole(shape, r, cx = 0, cy = 0) {
  const hole = new THREE.Path();
  hole.absarc(cx, cy, r, 0, TAU, true);
  shape.holes.push(hole);
  return shape;
}
export function rectHole(shape, w, h, cx = 0, cy = 0) {
  const corners = [
    [cx - w / 2, cy - h / 2],
    [cx - w / 2, cy + h / 2],
    [cx + w / 2, cy + h / 2],
    [cx + w / 2, cy - h / 2],
  ];
  const hole = new THREE.Path();
  corners.forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}
export function polyShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}
/** Rounded polygon: pts [[x,y,r?],...] with optional corner radius. */
export function roundedPoly(pts, rDefault = 0) {
  const n = pts.length;
  const verts = pts.map(([x, y]) => new THREE.Vector2(x, y));
  const s = new THREE.Shape();

  for (let i = 0; i < n; i++) {
    const wantR = pts[i][2] ?? rDefault;
    const prev = verts[(i + n - 1) % n], cur = verts[i], next = verts[(i + 1) % n];
    const toPrev = prev.clone().sub(cur).normalize();
    const toNext = next.clone().sub(cur).normalize();
    const interiorAngle = Math.acos(THREE.MathUtils.clamp(toPrev.dot(toNext), -1, 1));
    const maxFit = Math.min(prev.distanceTo(cur), next.distanceTo(cur)) * 0.49 * Math.tan(interiorAngle / 2);
    const cornerR = Math.min(wantR, maxFit);

    if (cornerR <= 0.01) {
      if (i === 0) s.moveTo(cur.x, cur.y); else s.lineTo(cur.x, cur.y);
      continue;
    }
    const setback = cornerR / Math.tan(interiorAngle / 2);
    const enter = cur.clone().addScaledVector(toPrev, setback);
    const exit = cur.clone().addScaledVector(toNext, setback);
    if (i === 0) s.moveTo(enter.x, enter.y); else s.lineTo(enter.x, enter.y);
    s.quadraticCurveTo(cur.x, cur.y, exit.x, exit.y);
  }
  s.closePath();
  return s;
}

// ============================================================
// Gears
// ============================================================
const involuteAngle = (a) => Math.tan(a) - a;

/** Involute spur-gear outline. N teeth, module m (mm). opts: {pa (pressure angle deg), bore, addendum, dedendum} */
export function gearShape(N, m, opts = {}) {
  const pressureAngle = (opts.pa ?? 20) * DEG;
  const pitchR = (m * N) / 2;
  const outerR = pitchR + (opts.addendum ?? 1) * m;
  const rootR = pitchR - (opts.dedendum ?? 1.25) * m;
  const baseR = pitchR * Math.cos(pressureAngle);
  const halfToothAtPitch = Math.PI / (2 * N) + involuteAngle(pressureAngle);

  const halfWidthAt = (r) => (r <= baseR ? halfToothAtPitch : halfToothAtPitch - involuteAngle(Math.acos(baseR / r)));
  const flankStartR = Math.max(baseR, rootR);
  const SAMPLES = 5;

  const outline = [];
  for (let tooth = 0; tooth < N; tooth++) {
    const center = (tooth / N) * TAU;
    outline.push([rootR, center - Math.PI / N]);
    outline.push([rootR, center - halfWidthAt(flankStartR)]);
    if (flankStartR > rootR + 1e-6) outline.push([flankStartR, center - halfWidthAt(flankStartR)]);
    for (let i = 1; i <= SAMPLES; i++) {
      const r = flankStartR + (outerR - flankStartR) * (i / SAMPLES);
      outline.push([r, center - halfWidthAt(r)]);
    }
    for (let i = SAMPLES; i >= 1; i--) {
      const r = flankStartR + (outerR - flankStartR) * (i / SAMPLES);
      outline.push([r, center + halfWidthAt(r)]);
    }
    if (flankStartR > rootR + 1e-6) outline.push([flankStartR, center + halfWidthAt(flankStartR)]);
    outline.push([rootR, center + halfWidthAt(flankStartR)]);
  }

  const s = new THREE.Shape();
  outline.forEach(([r, a], i) => {
    const x = r * Math.cos(a), y = r * Math.sin(a);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  });
  s.closePath();
  if (opts.bore) circleHole(s, opts.bore);
  return s;
}
/** Spur/helical gear solid along Z, centered. opts: {bore, helix (deg), pa, hub:{r,h}, web?} */
export function gear(N, m, thick, opts = {}) {
  const shape = gearShape(N, m, { pa: opts.pa, bore: opts.bore });
  const helixAngle = (opts.helix ?? 0) * DEG;
  const pitchR = (m * N) / 2;
  const twistAngle = helixAngle ? (thick * Math.tan(helixAngle)) / pitchR : 0;

  const body = extrude(shape, thick, { steps: helixAngle ? 6 : 1, twist: twistAngle, seg: 8 });
  if (!opts.hub) return body;

  const hub = annulus(opts.hub.r, opts.bore || 0.01, opts.hub.h, { axis: 'z' });
  return merge([body, hub]);
}
/** Straight bevel gear along Z: tapered so the +Z face is smaller. coneScale ~0.8. */
export function bevelGear(N, m, thick, coneScale = 0.75, opts = {}) {
  const shape = gearShape(N, m, { pa: opts.pa, bore: opts.bore });
  return extrude(shape, thick, { steps: 4, taper: coneScale, seg: 8 });
}
/** Internal (ring) gear: teeth pointing inward. Rout outer wall radius. */
export function ringGear(N, m, thick, Rout, opts = {}) {
  const outerWall = circleShape(Rout);
  const teeth = gearShape(N, m, { pa: opts.pa, addendum: 1.25, dedendum: 1 });
  const teethAsHole = new THREE.Path(teeth.getPoints().reverse());
  outerWall.holes.push(teethAsHole);
  return extrude(outerWall, thick, { seg: 8 });
}

// ============================================================
// Springs & curves
// ============================================================
class HelixCurve extends THREE.Curve {
  constructor(r, len, turns, r2) {
    super();
    this.r = r;
    this.r2 = r2 ?? r;
    this.len = len;
    this.turns = turns;
  }
  getPoint(t, out = new THREE.Vector3()) {
    const angle = t * this.turns * TAU;
    const radius = this.r + (this.r2 - this.r) * t;
    return out.set(radius * Math.cos(angle), t * this.len - this.len / 2, radius * Math.sin(angle));
  }
}
/** Coil spring along Y, centered. */
export function spring(rMean, wireR, len, turns, opts = {}) {
  const curve = new HelixCurve(rMean, len, turns, opts.rEnd);
  const tubularSegs = Math.max(24, Math.round(turns * (opts.seg ?? 24)));
  const g = new THREE.TubeGeometry(curve, tubularSegs, wireR, 8, false);
  return place(g, opts);
}
/** 3D circular arc: center c, plane basis u,v (unit, orthogonal), radius r, from a0 to a1 (rad, signed sweep). */
export class Arc3 extends THREE.Curve {
  constructor(c, u, v, r, a0, a1) {
    super();
    this.c = c;
    this.u = u;
    this.v = v;
    this.r = r;
    this.a0 = a0;
    this.a1 = a1;
  }
  getPoint(t, out = new THREE.Vector3()) {
    const a = this.a0 + (this.a1 - this.a0) * t;
    return out.copy(this.c).addScaledVector(this.u, this.r * Math.cos(a)).addScaledVector(this.v, this.r * Math.sin(a));
  }
}
/**
 * Belt/chain path around pulleys in order. Each pulley: {c:[u,v] (plane coords), r, inside?:bool}.
 * The loop travels counter-clockwise in the (U,V) plane; an `inside` pulley presses on the back of the belt.
 * basis: {o:Vector3 origin, U:Vector3, V:Vector3}. Returns {path: CurvePath, length, pulleys:[{wrapStart, wrapEnd}]}
 */
export function beltPath(pulleys, basis) {
  const n = pulleys.length;
  const signedR = pulleys.map((p) => (p.inside ? -p.r : p.r));
  const to3 = (p) => basis.o.clone().addScaledVector(basis.U, p[0]).addScaledVector(basis.V, p[1]);

  // Straight tangent segment that connects each pulley to the next.
  const tangents = pulleys.map((pulley, i) => {
    const a = pulley.c, b = pulleys[(i + 1) % n].c;
    const dx = b[0] - a[0], dy = b[1] - a[1], span = Math.hypot(dx, dy);
    const heading = Math.atan2(dy, dx) + Math.asin(THREE.MathUtils.clamp((signedR[i] - signedR[(i + 1) % n]) / span, -1, 1));
    const normal = [Math.sin(heading), -Math.cos(heading)]; // right normal of travel direction
    return {
      from: [a[0] + signedR[i] * normal[0], a[1] + signedR[i] * normal[1]],
      to: [b[0] + signedR[(i + 1) % n] * normal[0], b[1] + signedR[(i + 1) % n] * normal[1]],
    };
  });

  const path = new THREE.CurvePath();
  const wrapInfo = [];
  for (let i = 0; i < n; i++) {
    const seg = tangents[i];
    path.add(new THREE.LineCurve3(to3(seg.from), to3(seg.to)));

    const j = (i + 1) % n;
    const pulleyJ = pulleys[j];
    const arriveAngle = Math.atan2(seg.to[1] - pulleyJ.c[1], seg.to[0] - pulleyJ.c[0]);
    const departAngle = Math.atan2(tangents[j].from[1] - pulleyJ.c[1], tangents[j].from[0] - pulleyJ.c[0]);

    let sweep = departAngle - arriveAngle;
    if (signedR[j] > 0) { while (sweep < 0) sweep += TAU; }
    else { while (sweep > 0) sweep -= TAU; }

    path.add(new Arc3(to3(pulleyJ.c), basis.U, basis.V, pulleyJ.r, arriveAngle, arriveAngle + sweep));
    wrapInfo.push({ wrapStart: arriveAngle, wrapEnd: arriveAngle + sweep });
  }
  path.curves.forEach((c) => { c.arcLengthDivisions = 200; });
  return { path, length: path.getLength(), pulleys: wrapInfo };
}
/** Sweep a 2D profile [[a,b],...] (closed) along a path; N = plane normal (Vector3). Frame: a along N×tangent, b along N. */
export function sweep(path, profile, N, segments = 200, closed = true) {
  const tangent = new THREE.Vector3(), binormal = new THREE.Vector3();
  const sections = Array.from({ length: segments }, (_, i) => {
    const u = closed ? i / segments : i / (segments - 1);
    const point = path.getPointAt(u);
    path.getTangentAt(u, tangent).normalize();
    binormal.crossVectors(N, tangent).normalize();
    return profile.map(([a, b]) => point.clone().addScaledVector(binormal, a).addScaledVector(N, b));
  });
  return loft(sections, { loop: closed, caps: !closed });
}

// ============================================================
// Lofting
// ============================================================
/**
 * Loft a list of sections (each an array of Vector3 of equal length, forming a closed ring) into a solid.
 * opts.loop: sections form a closed loop (torus-like); opts.caps: cap the two ends.
 */
export function loft(sections, opts = {}) {
  const ringCount = sections.length, ringSize = sections[0].length;

  const pos = [];
  for (const ring of sections) for (const p of ring) pos.push(p.x, p.y, p.z);

  const idx = [];
  const bands = opts.loop ? ringCount : ringCount - 1;
  for (let i = 0; i < bands; i++) {
    const iNext = (i + 1) % ringCount;
    for (let j = 0; j < ringSize; j++) {
      const jNext = (j + 1) % ringSize;
      const a = i * ringSize + j, b = i * ringSize + jNext;
      const c = iNext * ringSize + j, d = iNext * ringSize + jNext;
      idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (opts.caps === false || opts.loop) return g;

  const capFrom = (ring, flip) => {
    const centroid = ring.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(ring.length);
    const capPos = [centroid.x, centroid.y, centroid.z];
    for (const p of ring) capPos.push(p.x, p.y, p.z);
    const capIdx = [];
    for (let j = 0; j < ringSize; j++) {
      const jNext = (j + 1) % ringSize;
      if (flip) capIdx.push(0, 1 + jNext, 1 + j);
      else capIdx.push(0, 1 + j, 1 + jNext);
    }
    const capGeo = new THREE.BufferGeometry();
    capGeo.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
    capGeo.setIndex(capIdx);
    capGeo.computeVertexNormals();
    return capGeo;
  };

  return merge([g, capFrom(sections[0], true), capFrom(sections[ringCount - 1], false)]);
}
/** Ring of n points: circle radius r in plane spanned by u,v at center c. */
export function ring(c, u, v, r, n, phase = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * TAU;
    return c.clone().addScaledVector(u, r * Math.cos(a)).addScaledVector(v, r * Math.sin(a));
  });
}
/** Tube along a curve with radius r(t) (function or number). */
export function varTube(curve, rFn, segs = 64, rad = 24) {
  const tangent = new THREE.Vector3(), normal = new THREE.Vector3(), binormal = new THREE.Vector3();
  const upRef = new THREE.Vector3(0, 0, 1);
  const altRef = new THREE.Vector3(1, 0, 0);

  const sections = Array.from({ length: segs + 1 }, (_, i) => {
    const t = i / segs;
    const p = curve.getPointAt(t);
    curve.getTangentAt(t, tangent).normalize();
    const ref = Math.abs(tangent.dot(upRef)) > 0.9 ? altRef : upRef;
    binormal.crossVectors(tangent, ref).normalize();
    normal.crossVectors(binormal, tangent).normalize();
    const r = typeof rFn === 'function' ? rFn(t) : rFn;
    return ring(p, normal, binormal, r, rad);
  });
  return loft(sections, { caps: true });
}

// ============================================================
// Blades
// ============================================================
// NACA-4-style camber/thickness sampling shared by the blade profile below.
function naca4Point(x, camber, thicknessRatio) {
  const yCamber = 4 * camber * x * (1 - x);
  const yThick = 5 * thicknessRatio * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  return { yCamber, yThick };
}

/**
 * Axial-flow blade in its own frame: span along +Y from rRoot to rTip, rotor axis = Z, chord in the X–Z plane.
 * p: {rRoot, rTip, chordRoot, chordTip, staggerRoot, staggerTip (deg, from axial), camber (0..0.1), thick (0..0.2), nSpan, nChord, sweep(mm at tip), lean(mm at tip)}
 */
export function blade(p) {
  const nSpan = p.nSpan ?? 8, nChord = p.nChord ?? 14;
  const camber = p.camber ?? 0.05, thicknessRatio = p.thick ?? 0.08;

  const sections = [];
  for (let i = 0; i <= nSpan; i++) {
    const spanFrac = i / nSpan;
    const r = p.rRoot + (p.rTip - p.rRoot) * spanFrac;
    const chord = p.chordRoot + (p.chordTip - p.chordRoot) * spanFrac;
    const staggerRoot = p.staggerRoot ?? 30, staggerTip = p.staggerTip ?? 60;
    const stagger = (staggerRoot + (staggerTip - staggerRoot) * spanFrac) * DEG;

    const chordDir = new THREE.Vector3(Math.sin(stagger), 0, Math.cos(stagger));
    const perpDir = new THREE.Vector3(Math.cos(stagger), 0, -Math.sin(stagger));
    const origin = new THREE.Vector3((p.lean ?? 0) * spanFrac, r, (p.sweep ?? 0) * spanFrac);
    const toPoint = (x, y) => origin.clone().addScaledVector(chordDir, (x - 0.5) * chord).addScaledVector(perpDir, y * chord);

    const loop = [];
    for (let j = 0; j <= nChord; j++) { // upper surface, leading edge -> trailing edge
      const x = 0.5 - 0.5 * Math.cos((j / nChord) * Math.PI);
      const { yCamber, yThick } = naca4Point(x, camber, thicknessRatio);
      loop.push(toPoint(x, yCamber + yThick));
    }
    for (let j = nChord - 1; j >= 1; j--) { // lower surface, trailing edge -> leading edge
      const x = 0.5 - 0.5 * Math.cos((j / nChord) * Math.PI);
      const { yCamber, yThick } = naca4Point(x, camber, thicknessRatio);
      loop.push(toPoint(x, yCamber - yThick));
    }
    sections.push(loop);
  }
  return loft(sections, { caps: true });
}
/** Ring of N axial blades around Z. */
export function bladeRow(N, p, phase = 0) {
  return radial(blade(p), N, 'z', phase);
}
/**
 * Radial-flow (centrifugal) blade wrapping a hub. Rotor axis Z, flow enters at -Z (inducer) and leaves radially.
 * p: {rHubIn, rHubOut, rShroudIn, rShroudOut, zIn, zOut, wrap (deg, total angular sweep along the blade), thick, nM, backsweep(deg)}
 */
export function radialBlade(p) {
  const nMeridional = p.nM ?? 16, nSpan = p.nSpan ?? 6;
  const wrap = (p.wrap ?? 60) * DEG;

  // Hub and shroud each trace a quarter-ellipse from the inlet (axial) to the
  // outlet (radial) face; the shroud additionally scales its axial travel.
  const hubProfile = (t) => {
    const a = t * Math.PI / 2;
    return [p.rHubIn + (p.rHubOut - p.rHubIn) * (1 - Math.cos(a)), p.zIn + (p.zOut - p.zIn) * Math.sin(a)];
  };
  const shroudProfile = (t) => {
    const a = t * Math.PI / 2;
    return [p.rShroudIn + (p.rShroudOut - p.rShroudIn) * (1 - Math.cos(a)), p.zIn + (p.zOut - p.zIn) * Math.sin(a) * (p.shroudZ ?? 0.75)];
  };

  const sections = [];
  for (let i = 0; i <= nMeridional; i++) {
    const m = i / nMeridional;
    const [rHub, zHub] = hubProfile(m);
    const [rShroud, zShroud] = shroudProfile(m);
    const phi = -wrap * (1 - Math.pow(1 - m, 2)); // more wrap near the exit

    const faceAtOffset = (sign) => Array.from({ length: nSpan + 1 }, (_, k) => {
      const sp = k / nSpan;
      const r = rHub + (rShroud - rHub) * sp, z = zHub + (zShroud - zHub) * sp;
      const dphi = sign * (p.thick ?? 1.2) / (2 * Math.max(r, 1));
      return new THREE.Vector3(r * Math.cos(phi + dphi), r * Math.sin(phi + dphi), z);
    });

    sections.push(faceAtOffset(1).concat(faceAtOffset(-1).reverse()));
  }
  return loft(sections, { caps: true });
}

// ============================================================
// Volute (spiral scroll housing)
// ============================================================
/** Spiral scroll around Z: center path radius R0 + Rg*phi/TAU, tube radius rho0 + rho1*phi/TAU, then straight outlet. */
export function volute(p) {
  const turns = p.turns ?? 1, N = p.segs ?? 96, ringRes = 28;
  const phase = p.phase ?? 0;
  const sections = [];

  if (p.inlet) { // straight tangential extension before the scroll starts
    const R = p.R0, rho = p.rho0, STEPS = 6;
    const tangent = new THREE.Vector3(-Math.sin(phase), Math.cos(phase), 0);
    const u = new THREE.Vector3(Math.cos(phase), Math.sin(phase), 0), v = new THREE.Vector3(0, 0, 1);
    const start = new THREE.Vector3(R * Math.cos(phase), R * Math.sin(phase), 0);
    for (let i = STEPS; i >= 1; i--) {
      const frac = i / STEPS;
      sections.push(ring(start.clone().addScaledVector(tangent, -frac * p.inlet), u, v, rho * (1 + 0.1 * frac), ringRes));
    }
  }

  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * turns * TAU;
    const f = phi / TAU;
    const R = p.R0 + (p.Rg ?? 0) * f, rho = p.rho0 + (p.rho1 ?? 0) * f;
    const center = new THREE.Vector3(R * Math.cos(phi + phase), R * Math.sin(phi + phase), 0);
    const u = new THREE.Vector3(Math.cos(phi + phase), Math.sin(phi + phase), 0); // radial
    const v = new THREE.Vector3(0, 0, 1);
    sections.push(ring(center, u, v, rho, ringRes));
  }

  if (p.outlet) { // straight tangential extension after the scroll ends
    const phi = turns * TAU, f = turns;
    const R = p.R0 + (p.Rg ?? 0) * f, rho = p.rho0 + (p.rho1 ?? 0) * f;
    const tangent = new THREE.Vector3(-Math.sin(phi + phase), Math.cos(phi + phase), 0);
    const u = new THREE.Vector3(Math.cos(phi + phase), Math.sin(phi + phase), 0), v = new THREE.Vector3(0, 0, 1);
    const start = new THREE.Vector3(R * Math.cos(phi + phase), R * Math.sin(phi + phase), 0);
    const STEPS = 6;
    for (let i = 1; i <= STEPS; i++) {
      const frac = i / STEPS;
      sections.push(ring(start.clone().addScaledVector(tangent, frac * p.outlet), u, v, rho * (1 + 0.15 * frac), ringRes));
    }
  }
  return loft(sections, { caps: true });
}

// ============================================================
// Fasteners & small hardware
// ============================================================
/** Hex bolt along -Y from the head at y=0 (head above, shank down). */
export function bolt(d, len, opts = {}) {
  const headH = opts.headH ?? d * 0.65, headR = opts.headR ?? d * 0.95;
  const head = opts.socket
    ? cyl(d * 0.75, d, { y: d / 2, seg: 32 })
    : cyl(headR, headH, { y: headH / 2, seg: 6 });
  const shank = cyl(d / 2, len, { y: -len / 2, seg: 20 });

  const parts = [head, shank];
  if (opts.washer) parts.push(annulus(d * 1.1, d * 0.5, d * 0.15, { y: -d * 0.075 }));
  return merge(parts);
}
export function nut(d, opts = {}) {
  return merge([annulus(d * 0.95, d * 0.5, d * 0.8, { seg: 6 })]);
}
/** Finned cylinder (air-cooled) along Y. */
export function finnedProfile(rBore, rWall, h, nFins, finR, finT) {
  const pts = [[rBore, 0], [rWall, 0]];
  const gap = h / nFins;
  for (let i = 0; i < nFins; i++) {
    const y0 = i * gap + (gap - finT) / 2;
    pts.push([rWall, y0], [finR, y0], [finR, y0 + finT], [rWall, y0 + finT]);
  }
  pts.push([rWall, h], [rBore, h]);
  return pts;
}
/** Epitrochoid outline points (Wankel housing): R generating radius, e eccentricity; 2-lobe. */
export function epitrochoidShape(R, e, n = 180) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const x = e * Math.cos(3 * a) + R * Math.cos(a);
    const y = e * Math.sin(3 * a) + R * Math.sin(a);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}
/** Wankel rotor outline: three circular-arc flanks between apexes at radius R (approximation of the inner envelope). */
export function rotorShape(R, e, n = 40) {
  const s = new THREE.Shape();
  const bulge = 1.05 * e;
  const pts = [];

  for (let k = 0; k < 3; k++) {
    const A = new THREE.Vector2(R * Math.cos((k * TAU) / 3), R * Math.sin((k * TAU) / 3));
    const B = new THREE.Vector2(R * Math.cos(((k + 1) * TAU) / 3), R * Math.sin(((k + 1) * TAU) / 3));
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const outward = mid.clone().normalize();
    const chord = A.distanceTo(B);
    const sag = bulge;
    const arcR = (chord * chord) / (8 * sag) + sag / 2;
    const center = mid.clone().addScaledVector(outward, sag - arcR);

    const startAngle = Math.atan2(A.y - center.y, A.x - center.x);
    const endAngle = Math.atan2(B.y - center.y, B.x - center.x);
    let sweep = endAngle - startAngle;
    while (sweep < 0) sweep += TAU;
    while (sweep > Math.PI) sweep -= TAU;

    for (let i = 0; i < n; i++) {
      const a = startAngle + sweep * (i / n);
      pts.push([center.x + arcR * Math.cos(a), center.y + arcR * Math.sin(a)]);
    }
  }
  pts.forEach((p, i) => (i === 0 ? s.moveTo(p[0], p[1]) : s.lineTo(p[0], p[1])));
  s.closePath();
  return s;
}
/** Geometry bounding-sphere helper */
export function centerOf(geo) {
  geo.computeBoundingBox();
  return geo.boundingBox.getCenter(new THREE.Vector3());
}

/** Extrude a 2D shape (u,v) along X: maps u -> Z, v -> Y, centered in X. */
export function extrudeX(shape, depth, opts = {}) {
  const { x, y, z, rx, ry, rz, ...extrudeOpts } = opts;
  const g = extrude(shape, depth, extrudeOpts);
  g.rotateY(-Math.PI / 2);
  return place(g, { x, y, z, rx, ry, rz });
}
/** Extrude a 2D shape (u,v) along Y: maps u -> X, v -> -Z, centered in Y. */
export function extrudeY(shape, depth, opts = {}) {
  const { x, y, z, rx, ry, rz, ...extrudeOpts } = opts;
  const g = extrude(shape, depth, extrudeOpts);
  g.rotateX(-Math.PI / 2);
  return place(g, { x, y, z, rx, ry, rz });
}
/** Half-annulus shell (upper half, v >= 0) in the (u,v) plane, extruded along X by w. */
export function halfShellX(Rout, Rin, w, lower = false) {
  const s = new THREE.Shape();
  s.moveTo(Rout, 0);
  s.absarc(0, 0, Rout, 0, Math.PI, false);
  s.lineTo(-Rin, 0);
  s.absarc(0, 0, Rin, Math.PI, 0, true);
  s.closePath();
  const g = extrudeX(s, w, { seg: 32 });
  if (lower) g.rotateX(Math.PI);
  return g;
}
/** Flat-tappet cam lobe outline from a lift function L(gamma) (mm, gamma in rad from the nose), base radius rb. Nose points +v. */
export function camLobeShape(rb, liftFn, n = 120) {
  const s = new THREE.Shape();
  const h = 1e-3;
  for (let i = 0; i <= n; i++) {
    const gamma = -Math.PI + (i / n) * TAU;
    const lift = liftFn(gamma);
    const slope = (liftFn(gamma + h) - liftFn(gamma - h)) / (2 * h);
    const u = (rb + lift) * Math.sin(gamma) + slope * Math.cos(gamma);
    const v = (rb + lift) * Math.cos(gamma) - slope * Math.sin(gamma);
    if (i === 0) s.moveTo(u, v); else s.lineTo(u, v);
  }
  s.closePath();
  return s;
}
/** Quaternion rotating +Y onto direction d. */
export function quatToDir(d) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
}
/** Tube along Catmull-Rom points [[x,y,z],...]. */
export function pipe(points, r, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
    opts.tension ?? 0.5,
  );
  return new THREE.TubeGeometry(curve, opts.seg ?? 32, r, opts.rad ?? 16, false);
}
