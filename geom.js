// Geometry toolkit for procedurally machined parts.
// Everything returns a THREE.BufferGeometry positioned in its own local frame; use place() to bake a transform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- transforms ----------
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
/** Bake a transform into a geometry. opts: {x,y,z, rx,ry,rz (rad), axis:'x'|'y'|'z'} — axis re-aims a Y-axis primitive. */
export function place(geo, opts = {}) {
  if (opts.axis === 'x') geo.rotateZ(-Math.PI / 2);
  else if (opts.axis === 'z') geo.rotateX(Math.PI / 2);
  if (opts.rx) geo.rotateX(opts.rx);
  if (opts.ry) geo.rotateY(opts.ry);
  if (opts.rz) geo.rotateZ(opts.rz);
  if (opts.x || opts.y || opts.z) geo.translate(opts.x || 0, opts.y || 0, opts.z || 0);
  return geo;
}
export function merge(list) {
  const geos = list.filter(Boolean).map(g => (g.index ? g.toNonIndexed() : g));
  for (const g of geos) { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); }
  const out = mergeGeometries(geos, false);
  return out;
}
/** Rotate copies of a geometry about an axis ('x'|'y'|'z') n times and merge. */
export function radial(geo, n, axis = 'z', offset = 0) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const g = geo.clone();
    const a = offset + (i / n) * TAU;
    if (axis === 'x') g.rotateX(a); else if (axis === 'y') g.rotateY(a); else g.rotateZ(a);
    list.push(g);
  }
  return merge(list);
}

// ---------- primitives ----------
export function cyl(r, h, opts = {}) {
  const g = new THREE.CylinderGeometry(opts.rTop ?? r, r, h, opts.seg ?? 48, 1, !!opts.open);
  return place(g, opts);
}
export function cone(rBottom, rTop, h, opts = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, opts.seg ?? 48, 1, !!opts.open);
  return place(g, opts);
}
export function box(w, h, d, opts = {}) { return place(new THREE.BoxGeometry(w, h, d), opts); }
export function rbox(w, h, d, r = 2, opts = {}) { return place(new RoundedBoxGeometry(w, h, d, opts.seg ?? 3, Math.min(r, w / 2, h / 2, d / 2)), opts); }
export function sphere(r, opts = {}) { return place(new THREE.SphereGeometry(r, opts.seg ?? 32, opts.seg ? Math.round(opts.seg * 0.6) : 20), opts); }
export function torus(R, r, opts = {}) { return place(new THREE.TorusGeometry(R, r, opts.tube ?? 12, opts.seg ?? 64, opts.arc ?? TAU), opts); }
/** Solid of revolution from [[r, y], ...] points (r >= 0), axis Y by default. */
export function lathe(pts, opts = {}) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), opts.seg ?? 48, opts.phiStart ?? 0, opts.phiLength ?? TAU);
  return place(g, opts);
}
/** Tube/annulus: outer radius R, inner r, height h, along Y (use opts.axis). */
export function annulus(R, r, h, opts = {}) {
  const s = new THREE.Shape(); s.absarc(0, 0, R, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, r, 0, TAU, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: opts.seg ?? 48 });
  g.translate(0, 0, -h / 2);
  g.rotateX(-Math.PI / 2); // extrude along Y
  return place(g, opts);
}
/** Extrude a 2D shape (in XY) along Z, centered. opts: depth, bevel, steps, twist (rad over full depth), taper (scale at +z end). */
export function extrude(shape, depth, opts = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: !!opts.bevel, bevelThickness: opts.bevel || 0, bevelSize: opts.bevel || 0, bevelSegments: 2,
    steps: opts.steps ?? 1, curveSegments: opts.seg ?? 24,
  });
  g.translate(0, 0, -depth / 2);
  if (opts.twist) twist(g, opts.twist / depth);
  if (opts.taper !== undefined) taper(g, opts.taper, depth);
  return place(g, opts);
}
/** Twist a geometry about Z: rotation angle = z * radPerUnit. Needs subdivided sides (extrude steps). */
export function twist(g, radPerUnit) {
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = v.z * radPerUnit, c = Math.cos(a), s = Math.sin(a);
    p.setXY(i, v.x * c - v.y * s, v.x * s + v.y * c);
  }
  g.computeVertexNormals(); return g;
}
/** Scale XY linearly from 1 at z=-depth/2 to `scaleEnd` at z=+depth/2. */
export function taper(g, scaleEnd, depth) {
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (v.z + depth / 2) / depth; const s = 1 + (scaleEnd - 1) * t;
    p.setXY(i, v.x * s, v.y * s);
  }
  g.computeVertexNormals(); return g;
}

// ---------- 2D shapes ----------
export function rectShape(w, h, r = 0) {
  const s = new THREE.Shape();
  if (r <= 0) { s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath(); return s; }
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(w / 2, h / 2 - r); s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, h / 2); s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-w / 2, -h / 2 + r); s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
  s.closePath(); return s;
}
export function circleShape(r, cx = 0, cy = 0) { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, TAU, false); return s; }
export function circleHole(shape, r, cx = 0, cy = 0) { const h = new THREE.Path(); h.absarc(cx, cy, r, 0, TAU, true); shape.holes.push(h); return shape; }
export function rectHole(shape, w, h, cx = 0, cy = 0) { const p = new THREE.Path(); p.moveTo(cx - w / 2, cy - h / 2); p.lineTo(cx - w / 2, cy + h / 2); p.lineTo(cx + w / 2, cy + h / 2); p.lineTo(cx + w / 2, cy - h / 2); p.closePath(); shape.holes.push(p); return shape; }
export function polyShape(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
/** Rounded polygon: pts [[x,y,r?],...] with optional corner radius. */
export function roundedPoly(pts, rDefault = 0) {
  const n = pts.length; const s = new THREE.Shape();
  const P = pts.map(p => new THREE.Vector2(p[0], p[1]));
  const first = [];
  for (let i = 0; i < n; i++) {
    const r = pts[i][2] ?? rDefault;
    const prev = P[(i + n - 1) % n], cur = P[i], next = P[(i + 1) % n];
    const d1 = prev.clone().sub(cur).normalize(), d2 = next.clone().sub(cur).normalize();
    const ang = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1));
    const rr = Math.min(r, Math.min(prev.distanceTo(cur), next.distanceTo(cur)) * 0.49 * Math.tan(ang / 2));
    if (rr <= 0.01) { const pt = cur; if (i === 0) s.moveTo(pt.x, pt.y); else s.lineTo(pt.x, pt.y); continue; }
    const t = rr / Math.tan(ang / 2);
    const a = cur.clone().addScaledVector(d1, t), b = cur.clone().addScaledVector(d2, t);
    if (i === 0) s.moveTo(a.x, a.y); else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  s.closePath(); return s;
}

// ---------- gears ----------
function inv(a) { return Math.tan(a) - a; }
/** Involute spur-gear outline. N teeth, module m (mm). opts: {pa (pressure angle deg), bore, addendum, dedendum} */
export function gearShape(N, m, opts = {}) {
  const pa = (opts.pa ?? 20) * DEG;
  const rp = m * N / 2, ra = rp + (opts.addendum ?? 1) * m, rr = rp - (opts.dedendum ?? 1.25) * m, rb = rp * Math.cos(pa);
  const halfPitch = Math.PI / (2 * N) + inv(pa);
  const half = r => { if (r <= rb) return halfPitch; return halfPitch - inv(Math.acos(rb / r)); };
  const rStart = Math.max(rb, rr);
  const pts = [];
  const K = 5;
  for (let k = 0; k < N; k++) {
    const c = (k / N) * TAU;
    pts.push([rr, c - Math.PI / N]);
    pts.push([rr, c - half(rStart)]);
    if (rStart > rr + 1e-6) pts.push([rStart, c - half(rStart)]);
    for (let i = 1; i <= K; i++) { const r = rStart + (ra - rStart) * (i / K); pts.push([r, c - half(r)]); }
    for (let i = K; i >= 1; i--) { const r = rStart + (ra - rStart) * (i / K); pts.push([r, c + half(r)]); }
    if (rStart > rr + 1e-6) pts.push([rStart, c + half(rStart)]);
    pts.push([rr, c + half(rStart)]);
  }
  const s = new THREE.Shape();
  pts.forEach(([r, a], i) => { const x = r * Math.cos(a), y = r * Math.sin(a); if (i === 0) s.moveTo(x, y); else s.lineTo(x, y); });
  s.closePath();
  if (opts.bore) circleHole(s, opts.bore);
  return s;
}
/** Spur/helical gear solid along Z, centered. opts: {bore, helix (deg), pa, hub:{r,h}, web?} */
export function gear(N, m, thick, opts = {}) {
  const shape = gearShape(N, m, { pa: opts.pa, bore: opts.bore });
  const helix = (opts.helix ?? 0) * DEG;
  const rp = m * N / 2;
  const twistAng = helix ? (thick * Math.tan(helix)) / rp : 0;
  const g = extrude(shape, thick, { steps: helix ? 6 : 1, twist: twistAng, seg: 8 });
  const parts = [g];
  if (opts.hub) { parts.push(annulus(opts.hub.r, opts.bore || 0.01, opts.hub.h, { axis: 'z' })); }
  return parts.length > 1 ? merge(parts) : g;
}
/** Straight bevel gear along Z: tapered so the +Z face is smaller. coneScale ~0.8. */
export function bevelGear(N, m, thick, coneScale = 0.75, opts = {}) {
  const shape = gearShape(N, m, { pa: opts.pa, bore: opts.bore });
  return extrude(shape, thick, { steps: 4, taper: coneScale, seg: 8 });
}
/** Internal (ring) gear: teeth pointing inward. Rout outer wall radius. */
export function ringGear(N, m, thick, Rout, opts = {}) {
  const outer = circleShape(Rout);
  const inner = gearShape(N, m, { pa: opts.pa, addendum: 1.25, dedendum: 1 });
  // holes must be Paths; convert
  const hole = new THREE.Path(inner.getPoints().reverse());
  outer.holes.push(hole);
  return extrude(outer, thick, { seg: 8 });
}

// ---------- springs & curves ----------
class HelixCurve extends THREE.Curve {
  constructor(r, len, turns, r2) { super(); this.r = r; this.r2 = r2 ?? r; this.len = len; this.turns = turns; }
  getPoint(t, out = new THREE.Vector3()) {
    const a = t * this.turns * TAU; const r = this.r + (this.r2 - this.r) * t;
    return out.set(r * Math.cos(a), t * this.len - this.len / 2, r * Math.sin(a));
  }
}
/** Coil spring along Y, centered. */
export function spring(rMean, wireR, len, turns, opts = {}) {
  const curve = new HelixCurve(rMean, len, turns, opts.rEnd);
  const g = new THREE.TubeGeometry(curve, Math.max(24, Math.round(turns * (opts.seg ?? 24))), wireR, 8, false);
  return place(g, opts);
}
/** 3D circular arc: center c, plane basis u,v (unit, orthogonal), radius r, from a0 to a1 (rad, signed sweep). */
export class Arc3 extends THREE.Curve {
  constructor(c, u, v, r, a0, a1) { super(); this.c = c; this.u = u; this.v = v; this.r = r; this.a0 = a0; this.a1 = a1; }
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
  const rho = pulleys.map(p => (p.inside ? -p.r : p.r));
  const tangents = [];
  for (let i = 0; i < n; i++) {
    const a = pulleys[i].c, b = pulleys[(i + 1) % n].c;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const th = Math.atan2(dy, dx) + Math.asin(THREE.MathUtils.clamp((rho[i] - rho[(i + 1) % n]) / L, -1, 1));
    const R = [Math.sin(th), -Math.cos(th)]; // right normal of travel direction
    tangents.push({
      from: [a[0] + rho[i] * R[0], a[1] + rho[i] * R[1]],
      to: [b[0] + rho[(i + 1) % n] * R[0], b[1] + rho[(i + 1) % n] * R[1]],
    });
  }
  const to3 = p => basis.o.clone().addScaledVector(basis.U, p[0]).addScaledVector(basis.V, p[1]);
  const path = new THREE.CurvePath();
  const info = [];
  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    path.add(new THREE.LineCurve3(to3(t.from), to3(t.to)));
    const j = (i + 1) % n; const pj = pulleys[j];
    const arrive = Math.atan2(t.to[1] - pj.c[1], t.to[0] - pj.c[0]);
    const tn = tangents[j];
    const depart = Math.atan2(tn.from[1] - pj.c[1], tn.from[0] - pj.c[0]);
    let sweep;
    if (rho[j] > 0) { sweep = depart - arrive; while (sweep < 0) sweep += TAU; }
    else { sweep = depart - arrive; while (sweep > 0) sweep -= TAU; }
    const c3 = to3(pj.c);
    path.add(new Arc3(c3, basis.U, basis.V, pj.r, arrive, arrive + sweep));
    info.push({ wrapStart: arrive, wrapEnd: arrive + sweep });
  }
  path.curves.forEach(c => { c.arcLengthDivisions = 200; });
  return { path, length: path.getLength(), pulleys: info };
}
/** Sweep a 2D profile [[a,b],...] (closed) along a path; N = plane normal (Vector3). Frame: a along N×tangent, b along N. */
export function sweep(path, profile, N, segments = 200, closed = true) {
  const sections = [];
  const T = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i < segments; i++) {
    const u = closed ? i / segments : i / (segments - 1);
    const p = path.getPointAt(u); path.getTangentAt(u, T).normalize();
    B.crossVectors(N, T).normalize();
    sections.push(profile.map(([a, b]) => p.clone().addScaledVector(B, a).addScaledVector(N, b)));
  }
  return loft(sections, { loop: closed, caps: !closed });
}

// ---------- lofting ----------
/**
 * Loft a list of sections (each an array of Vector3 of equal length, forming a closed ring) into a solid.
 * opts.loop: sections form a closed loop (torus-like); opts.caps: cap the two ends.
 */
export function loft(sections, opts = {}) {
  const S = sections.length, n = sections[0].length;
  const pos = [];
  for (const sec of sections) for (const p of sec) pos.push(p.x, p.y, p.z);
  const idx = [];
  const rows = opts.loop ? S : S - 1;
  for (let i = 0; i < rows; i++) {
    const i1 = (i + 1) % S;
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const a = i * n + j, b = i * n + j1, c = i1 * n + j, d = i1 * n + j1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (opts.caps === false || opts.loop) return g;
  // caps: fan from centroid, separate flat-shaded geometry
  const cap = (sec, flip) => {
    const c = new THREE.Vector3(); sec.forEach(p => c.add(p)); c.divideScalar(sec.length);
    const cp = [c.x, c.y, c.z]; const ci = [];
    for (const p of sec) cp.push(p.x, p.y, p.z);
    for (let j = 0; j < n; j++) { const j1 = (j + 1) % n; if (flip) ci.push(0, 1 + j1, 1 + j); else ci.push(0, 1 + j, 1 + j1); }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setIndex(ci); cg.computeVertexNormals();
    return cg;
  };
  return merge([g, cap(sections[0], true), cap(sections[S - 1], false)]);
}
/** Ring of n points: circle radius r in plane spanned by u,v at center c. */
export function ring(c, u, v, r, n, phase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = phase + (i / n) * TAU; out.push(c.clone().addScaledVector(u, r * Math.cos(a)).addScaledVector(v, r * Math.sin(a))); }
  return out;
}
/** Tube along a curve with radius r(t) (function or number). */
export function varTube(curve, rFn, segs = 64, rad = 24) {
  const sections = [];
  const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3();
  const up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; const p = curve.getPointAt(t); curve.getTangentAt(t, T).normalize();
    const ref = Math.abs(T.dot(up)) > 0.9 ? new THREE.Vector3(1, 0, 0) : up;
    B.crossVectors(T, ref).normalize(); Nn.crossVectors(B, T).normalize();
    const r = typeof rFn === 'function' ? rFn(t) : rFn;
    sections.push(ring(p, Nn, B, r, rad));
  }
  return loft(sections, { caps: true });
}

// ---------- blades ----------
/**
 * Axial-flow blade in its own frame: span along +Y from rRoot to rTip, rotor axis = Z, chord in the X–Z plane.
 * p: {rRoot, rTip, chordRoot, chordTip, staggerRoot, staggerTip (deg, from axial), camber (0..0.1), thick (0..0.2), nSpan, nChord, sweep(mm at tip), lean(mm at tip)}
 */
export function blade(p) {
  const nS = p.nSpan ?? 8, nC = p.nChord ?? 14;
  const sections = [];
  for (let i = 0; i <= nS; i++) {
    const s = i / nS;
    const r = p.rRoot + (p.rTip - p.rRoot) * s;
    const c = p.chordRoot + (p.chordTip - p.chordRoot) * s;
    const beta = ((p.staggerRoot ?? 30) + ((p.staggerTip ?? 60) - (p.staggerRoot ?? 30)) * s) * DEG;
    const camber = p.camber ?? 0.05, tc = p.thick ?? 0.08;
    const chordDir = new THREE.Vector3(Math.sin(beta), 0, Math.cos(beta));
    const perpDir = new THREE.Vector3(Math.cos(beta), 0, -Math.sin(beta));
    const origin = new THREE.Vector3((p.lean ?? 0) * s, r, (p.sweep ?? 0) * s);
    const loop = [];
    const pt = (x, y) => origin.clone().addScaledVector(chordDir, (x - 0.5) * c).addScaledVector(perpDir, y * c);
    for (let j = 0; j <= nC; j++) { // upper surface LE -> TE
      const x = 0.5 - 0.5 * Math.cos((j / nC) * Math.PI);
      const yc = 4 * camber * x * (1 - x);
      const yt = 5 * tc * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
      loop.push(pt(x, yc + yt));
    }
    for (let j = nC - 1; j >= 1; j--) { // lower surface TE -> LE
      const x = 0.5 - 0.5 * Math.cos((j / nC) * Math.PI);
      const yc = 4 * camber * x * (1 - x);
      const yt = 5 * tc * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
      loop.push(pt(x, yc - yt));
    }
    sections.push(loop);
  }
  return loft(sections, { caps: true });
}
/** Ring of N axial blades around Z. */
export function bladeRow(N, p, phase = 0) { return radial(blade(p), N, 'z', phase); }
/**
 * Radial-flow (centrifugal) blade wrapping a hub. Rotor axis Z, flow enters at -Z (inducer) and leaves radially.
 * p: {rHubIn, rHubOut, rShroudIn, rShroudOut, zIn, zOut, wrap (deg, total angular sweep along the blade), thick, nM, backsweep(deg)}
 */
export function radialBlade(p) {
  const nM = p.nM ?? 16, nSpan = p.nSpan ?? 6;
  const sections = [];
  const hub = t => { // quarter-ellipse from (rHubIn, zIn) axial to (rHubOut, zOut) radial
    const a = t * Math.PI / 2;
    return [p.rHubIn + (p.rHubOut - p.rHubIn) * (1 - Math.cos(a)), p.zIn + (p.zOut - p.zIn) * Math.sin(a)];
  };
  const shr = t => {
    const a = t * Math.PI / 2;
    return [p.rShroudIn + (p.rShroudOut - p.rShroudIn) * (1 - Math.cos(a)), p.zIn + (p.zOut - p.zIn) * Math.sin(a) * (p.shroudZ ?? 0.75)];
  };
  const wrap = (p.wrap ?? 60) * DEG;
  for (let i = 0; i <= nM; i++) {
    const m = i / nM;
    const h = hub(m), s = shr(m);
    const phi = -wrap * (1 - Math.pow(1 - m, 2)) ; // more wrap near the exit
    const loop = [];
    const side = sign => {
      const arr = [];
      for (let k = 0; k <= nSpan; k++) {
        const sp = k / nSpan;
        const r = h[0] + (s[0] - h[0]) * sp, z = h[1] + (s[1] - h[1]) * sp;
        const dphi = sign * (p.thick ?? 1.2) / (2 * Math.max(r, 1));
        arr.push(new THREE.Vector3(r * Math.cos(phi + dphi), r * Math.sin(phi + dphi), z));
      }
      return arr;
    };
    const a = side(1), b = side(-1).reverse();
    sections.push(a.concat(b));
  }
  return loft(sections, { caps: true });
}

// ---------- volute (spiral scroll housing) ----------
/** Spiral scroll around Z: center path radius R0 + Rg*phi/TAU, tube radius rho0 + rho1*phi/TAU, then straight outlet. */
export function volute(p) {
  const turns = p.turns ?? 1, N = p.segs ?? 96, rad = 28;
  const sections = [];
  const phase = p.phase ?? 0;
  if (p.inlet) { // straight tangential extension before the scroll starts
    const R = p.R0, rho = p.rho0, K = 6;
    const tangent = new THREE.Vector3(-Math.sin(phase), Math.cos(phase), 0);
    const u = new THREE.Vector3(Math.cos(phase), Math.sin(phase), 0), v = new THREE.Vector3(0, 0, 1);
    const c0 = new THREE.Vector3(R * Math.cos(phase), R * Math.sin(phase), 0);
    for (let i = K; i >= 1; i--) sections.push(ring(c0.clone().addScaledVector(tangent, -(i / K) * p.inlet), u, v, rho * (1 + 0.1 * (i / K)), rad));
  }
  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * turns * TAU;
    const f = phi / TAU;
    const R = p.R0 + (p.Rg ?? 0) * f, rho = p.rho0 + (p.rho1 ?? 0) * f;
    const c = new THREE.Vector3(R * Math.cos(phi + phase), R * Math.sin(phi + phase), 0);
    const u = new THREE.Vector3(Math.cos(phi + phase), Math.sin(phi + phase), 0); // radial
    const v = new THREE.Vector3(0, 0, 1);
    sections.push(ring(c, u, v, rho, rad));
  }
  // outlet: straight tangential extension
  if (p.outlet) {
    const phi = turns * TAU, f = turns;
    const R = p.R0 + (p.Rg ?? 0) * f, rho = p.rho0 + (p.rho1 ?? 0) * f;
    const tangent = new THREE.Vector3(-Math.sin(phi + phase), Math.cos(phi + phase), 0);
    const u = new THREE.Vector3(Math.cos(phi + phase), Math.sin(phi + phase), 0), v = new THREE.Vector3(0, 0, 1);
    const c0 = new THREE.Vector3(R * Math.cos(phi + phase), R * Math.sin(phi + phase), 0);
    const K = 6;
    for (let i = 1; i <= K; i++) {
      const c = c0.clone().addScaledVector(tangent, (i / K) * p.outlet);
      sections.push(ring(c, u, v, rho * (1 + 0.15 * (i / K)), rad));
    }
  }
  return loft(sections, { caps: true });
}

// ---------- fasteners & small hardware ----------
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
export function nut(d, opts = {}) { return merge([annulus(d * 0.95, d * 0.5, d * 0.8, { seg: 6 })]); }
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
    const x = e * Math.cos(3 * a) + R * Math.cos(a), y = e * Math.sin(3 * a) + R * Math.sin(a);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath(); return s;
}
/** Wankel rotor outline: three circular-arc flanks between apexes at radius R (approximation of the inner envelope). */
export function rotorShape(R, e, n = 40) {
  const s = new THREE.Shape();
  const apex = k => [R * Math.cos(k * TAU / 3 + Math.PI / 6 * 0 ), R * Math.sin(k * TAU / 3)];
  // flank as arc through two apexes with a bulge; bulge chosen so the flank clears the housing by ~e/2
  const bulge = 1.05 * e;
  const pts = [];
  for (let k = 0; k < 3; k++) {
    const A = new THREE.Vector2(R * Math.cos(k * TAU / 3), R * Math.sin(k * TAU / 3));
    const B = new THREE.Vector2(R * Math.cos((k + 1) * TAU / 3), R * Math.sin((k + 1) * TAU / 3));
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const out = mid.clone().normalize();
    const chord = A.distanceTo(B);
    const sag = bulge;
    const rArc = (chord * chord) / (8 * sag) + sag / 2;
    const center = mid.clone().addScaledVector(out, sag - rArc);
    const a0 = Math.atan2(A.y - center.y, A.x - center.x), a1 = Math.atan2(B.y - center.y, B.x - center.x);
    let d = a1 - a0; while (d < 0) d += TAU; while (d > Math.PI) d -= TAU;
    for (let i = 0; i < n; i++) { const a = a0 + d * (i / n); pts.push([center.x + rArc * Math.cos(a), center.y + rArc * Math.sin(a)]); }
  }
  pts.forEach((p, i) => (i === 0 ? s.moveTo(p[0], p[1]) : s.lineTo(p[0], p[1])));
  s.closePath(); return s;
}
/** Geometry bounding-sphere helper */
export function centerOf(geo) { geo.computeBoundingBox(); return geo.boundingBox.getCenter(new THREE.Vector3()); }

/** Extrude a 2D shape (u,v) along X: maps u -> Z, v -> Y, centered in X. */
export function extrudeX(shape, depth, opts = {}) { const { x, y, z, rx, ry, rz, ...rest } = opts; const g = extrude(shape, depth, rest); g.rotateY(-Math.PI / 2); return place(g, { x, y, z, rx, ry, rz }); }
/** Extrude a 2D shape (u,v) along Y: maps u -> X, v -> -Z, centered in Y. */
export function extrudeY(shape, depth, opts = {}) { const { x, y, z, rx, ry, rz, ...rest } = opts; const g = extrude(shape, depth, rest); g.rotateX(-Math.PI / 2); return place(g, { x, y, z, rx, ry, rz }); }
/** Half-annulus shell (upper half, v >= 0) in the (u,v) plane, extruded along X by w. */
export function halfShellX(Rout, Rin, w, lower = false) {
  const s = new THREE.Shape();
  s.moveTo(Rout, 0); s.absarc(0, 0, Rout, 0, Math.PI, false); s.lineTo(-Rin, 0); s.absarc(0, 0, Rin, Math.PI, 0, true); s.closePath();
  const g = extrudeX(s, w, { seg: 32 });
  if (lower) g.rotateX(Math.PI);
  return g;
}
/** Flat-tappet cam lobe outline from a lift function L(gamma) (mm, gamma in rad from the nose), base radius rb. Nose points +v. */
export function camLobeShape(rb, liftFn, n = 120) {
  const s = new THREE.Shape(); const h = 1e-3;
  for (let i = 0; i <= n; i++) {
    const g = -Math.PI + (i / n) * TAU;
    const L = liftFn(g), dL = (liftFn(g + h) - liftFn(g - h)) / (2 * h);
    const u = (rb + L) * Math.sin(g) + dL * Math.cos(g), v = (rb + L) * Math.cos(g) - dL * Math.sin(g);
    if (i === 0) s.moveTo(u, v); else s.lineTo(u, v);
  }
  s.closePath(); return s;
}
/** Quaternion rotating +Y onto direction d. */
export function quatToDir(d) { return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); }
/** Tube along Catmull-Rom points [[x,y,z],...]. */
export function pipe(points, r, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal', opts.tension ?? 0.5);
  return new THREE.TubeGeometry(curve, opts.seg ?? 32, r, opts.rad ?? 16, false);
}
