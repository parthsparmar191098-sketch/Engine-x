// Viewer: scene, camera, progressive part building, picking, explode, section, x-ray, kinematic loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterial } from './materials.js';

const TAU = Math.PI * 2;
const HIGHLIGHT = new THREE.Color(0xfff1e0);
/** Hue and saturation from the system, lightness from the material, so parts of one system share a colour but stay distinguishable. */
function tintColor(matColor, sysHex, k) {
  const sys = new THREE.Color(sysHex); const hm = { h: 0, s: 0, l: 0 }, hs = { h: 0, s: 0, l: 0 };
  matColor.getHSL(hm); sys.getHSL(hs);
  const sat = hs.s * k + hm.s * (1 - k);
  const light = hm.l * (1 - 0.35 * k) + hs.l * 0.35 * k;
  return new THREE.Color().setHSL(hs.h, sat, light);
}
const easeInOut = t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

export class Viewer {
  constructor(container, cb = {}) {
    this.container = container; this.cb = cb;
    this.parts = new Map(); this.order = []; this.def = null; this.root = null;
    this.systemOn = {}; this.isolated = null; this.selected = null; this.hovered = null;
    this.state = { theta: 0, running: false, revPerSec: 0.3, t: 0, dt: 0, explode: 0, mode: 0 };
    this.section = { on: false, axis: 'x', pos: 0, flip: false };
    this.xray = false; this.dark = false; this.colorMode = 'system';
    this.pickTargets = []; this.pointer = new THREE.Vector2(-9, -9); this.hoverDirty = false;
    this.bounds = new THREE.Box3(); this.radius = 500; this.center = new THREE.Vector3();
    this.tween = null; this.frame = 0;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    this.mobile = Math.min(window.innerWidth, window.innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
    r.shadowMap.enabled = !this.mobile; r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);

    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 20000);
    this.camera.position.set(900, 500, 1200);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = 0.08; c.rotateSpeed = 0.7; c.zoomSpeed = 0.9; c.panSpeed = 0.8;
    c.minDistance = 20; c.maxDistance = 15000; c.screenSpacePanning = true;

    const pm = new THREE.PMREMGenerator(r);
    s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    s.environmentIntensity = 0.85;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8892a0, 0.55); s.add(this.hemi);
    const key = this.key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(600, 1100, 700);
    key.castShadow = !this.mobile; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0008; key.shadow.normalBias = 2; key.shadow.radius = 4;
    s.add(key); s.add(key.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45); fill.position.set(-800, 300, -500); s.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.35); rim.position.set(200, -400, -900); s.add(rim);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.16, transparent: true }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; s.add(this.ground);

    this.clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.raycaster = new THREE.Raycaster(); this.raycaster.firstHitOnly = false;

    this.setTheme(false);
    this._bindPointer();
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    r.setAnimationLoop(now => this.tick(now));
  }

  // ---------- setup ----------
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  setTheme(dark) {
    this.dark = dark;
    this.scene.background = new THREE.Color(dark ? 0x14171b : 0xeceef1);
    this.scene.environmentIntensity = dark ? 0.7 : 0.85;
    this.hemi.intensity = dark ? 0.4 : 0.55;
    this.ground.material.opacity = dark ? 0.35 : 0.16;
    this.renderer.toneMappingExposure = dark ? 0.95 : 1.0;
  }

  // ---------- machine loading ----------
  async loadMachine(def) {
    this.unload();
    this.def = def; this.root = new THREE.Group(); this.scene.add(this.root); this.ready = false;
    this.systemOn = {}; def.systems.forEach(sy => (this.systemOn[sy.id] = true));
    this.state.theta = 0; this.state.explode = 0; this.isolated = null; this.selected = null; this.hovered = null;
    if (def.drive?.revPerSec) this.state.revPerSec = def.drive.revPerSec;
    const P = this._factory(def); this.refs = P.refs;
    const est = def.pieces || 300;
    let count = 0, label = '';
    const gen = def.build(P);
    const iter = gen && typeof gen.next === 'function' ? gen : null;
    const report = () => this.cb.onProgress?.(Math.min(0.98, this.parts.size / est), label);
    if (iter) {
      await new Promise(resolve => {
        const step = () => {
          const t0 = performance.now();
          let done = false;
          while (performance.now() - t0 < 14) {
            const r = iter.next();
            if (r.done) { done = true; break; }
            if (typeof r.value === 'string') label = r.value;
          }
          report();
          if (done) resolve(); else setTimeout(step, 0);
        };
        step();
      });
    }
    this._finalize();
    this.ready = true;
    this.cb.onProgress?.(1, 'ready');
    this.cb.onLoaded?.(def);
  }
  unload() {
    if (!this.root) return;
    this.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    this.scene.remove(this.root); this.root = null; this.parts.clear(); this.order = []; this.pickTargets = []; this.def = null;
  }
  _factory(def) {
    const self = this;
    const sysIds = new Set(def.systems.map(s => s.id));
    return {
      def, refs: {},
      mat: (key, o) => makeMaterial(key, o),
      add(spec) {
        if (!spec.id) throw new Error('part needs id');
        if (self.parts.has(spec.id)) throw new Error('duplicate part id ' + spec.id);
        if (!sysIds.has(spec.system)) throw new Error(`part ${spec.id}: unknown system ${spec.system}`);
        let obj;
        if (spec.obj) obj = spec.obj;
        else {
          const material = spec.mat instanceof THREE.Material ? spec.mat : makeMaterial(spec.mat || 'steel', spec.matOpts);
          obj = new THREE.Mesh(spec.geo, material);
        }
        const part = {
          id: spec.id, name: spec.name, system: spec.system, obj, meshes: [], mats: [],
          desc: spec.desc || '', notes: spec.notes || [], block: spec.block || {}, count: spec.count ?? 1,
          parent: spec.parent || null, children: [], glow: !!spec.glow, ghost: spec.ghost, pick: spec.pick !== false,
          base: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, ex: new THREE.Vector3(), exAuto: !spec.ex,
        };
        if (spec.pos) obj.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
        if (spec.rot) obj.rotation.set(spec.rot[0] || 0, spec.rot[1] || 0, spec.rot[2] || 0);
        if (spec.quat) obj.quaternion.copy(spec.quat);
        part.base.p.copy(obj.position); part.base.q.copy(obj.quaternion);
        if (spec.ex) part.ex.set(spec.ex[0], spec.ex[1], spec.ex[2]);
        obj.traverse(o => {
          if (!o.isMesh) return;
          if (o.userData.part && o.userData.part !== part) return; // belongs to a nested part
          o.userData.part = part; o.castShadow = true; o.receiveShadow = false;
          if (Array.isArray(o.material)) o.material = o.material.map(m => m.clone());
          else if (o.material.userData.owner && o.material.userData.owner !== part.id) o.material = o.material.clone();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const sys = def.systems.find(sy => sy.id === spec.system);
          mats.forEach(m => {
            m.userData.owner = part.id;
            if (m.userData.baseOpacity === undefined) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; m.userData.baseEmissive = m.emissive.getHex(); m.userData.baseEmissiveIntensity = m.emissiveIntensity; }
            if (!m.userData.matColor) {
              m.userData.matColor = m.color.clone();
              const k = spec.tint ?? sys.tint ?? (sys.housing ? 0.35 : 0.85);
              m.userData.sysColor = m.transparent || k === 0 ? m.color.clone() : tintColor(m.userData.matColor, sys.color, k);
            }
            m.color.copy(self.colorMode === 'system' ? m.userData.sysColor : m.userData.matColor);
          });
          part.meshes.push(o); part.mats.push(...mats);
        });
        obj.userData.part = part;
        const parentPart = part.parent ? self.parts.get(part.parent) : null;
        if (part.parent && !parentPart) throw new Error(`part ${spec.id}: unknown parent ${part.parent}`);
        (parentPart ? parentPart.obj : self.root).add(obj);
        if (parentPart) parentPart.children.push(part);
        self.parts.set(part.id, part); self.order.push(part);
        return part;
      },
      get: id => self.parts.get(id),
    };
  }
  _finalize() {
    const def = this.def;
    this.root.updateMatrixWorld(true);
    this.bounds.makeEmpty();
    const bb = new THREE.Box3();
    for (const part of this.order) {
      if (part.system && def.systems.find(s => s.id === part.system)?.noBounds) continue;
      for (const m of part.meshes) { m.geometry.computeBoundingBox(); bb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); this.bounds.union(bb); }
    }
    this.bounds.getCenter(this.center);
    const size = this.bounds.getSize(new THREE.Vector3());
    this.radius = size.length() / 2;
    // automatic explode vectors: radial from center, for top-level parts without explicit ex
    const scale = def.explodeScale ?? 0.9;
    const c = new THREE.Vector3(), w = new THREE.Vector3();
    for (const part of this.order) {
      if (!part.exAuto) continue;
      if (part.parent) { part.ex.set(0, 0, 0); continue; }
      bb.makeEmpty();
      for (const m of part.meshes) { c.copy(m.geometry.boundingBox.getCenter(w)).applyMatrix4(m.matrixWorld); bb.expandByPoint(c); }
      bb.getCenter(c).sub(this.center);
      part.ex.copy(c).multiplyScalar(scale);
    }
    // ground & shadow camera
    this.ground.position.set(this.center.x, this.bounds.min.y - this.radius * 0.02, this.center.z);
    this.ground.scale.set(this.radius * 8, this.radius * 8, 1);
    const sc = this.key.shadow.camera; const R = this.radius * 1.6;
    sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 10; sc.far = this.radius * 8; sc.updateProjectionMatrix();
    this.key.position.copy(this.center).add(new THREE.Vector3(0.5, 1.0, 0.6).multiplyScalar(this.radius * 3));
    this.key.target.position.copy(this.center);
    this.camera.near = Math.max(0.5, this.radius * 0.01); this.camera.far = this.radius * 40; this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.radius * 0.15; this.controls.maxDistance = this.radius * 8;
    this.pickTargets = this.order.filter(p => p.pick).flatMap(p => p.meshes);
    this.applyVisibility();
    this.setView(def.defaultView || 'iso', false);
    this.section.pos = def.sectionDefault ?? 0; this.section.axis = def.sectionAxis || 'x'; this.section.flip = false;
    this.setSection(false); this.setXray(false);
  }

  // ---------- visibility ----------
  applyVisibility() {
    const iso = this.isolated ? this.parts.get(this.isolated) : null;
    for (const part of this.order) {
      let vis = this.systemOn[part.system] !== false;
      if (iso) vis = vis && (part === iso || this._descends(part, iso));
      part.obj.visible = vis;
    }
    this.cb.onVisibility?.();
  }
  _descends(part, anc) { let p = part; while (p.parent) { p = this.parts.get(p.parent); if (p === anc) return true; } return false; }
  setSystemVisible(id, on) { this.systemOn[id] = on; this.applyVisibility(); }
  setAllSystems(on) { for (const k of Object.keys(this.systemOn)) this.systemOn[k] = on; this.applyVisibility(); }
  countVisible() { let n = 0; for (const p of this.order) if (p.obj.visible && this._parentsVisible(p)) n += p.count; return n; }
  _parentsVisible(part) { let p = part; while (p.parent) { p = this.parts.get(p.parent); if (!p.obj.visible) return false; } return true; }
  countBySystem(id) { let n = 0; for (const p of this.order) if (p.system === id) n += p.count; return n; }
  pieceCount() { let n = 0; for (const p of this.order) n += p.count; return n; }

  // ---------- selection ----------
  _setHighlight(part, level) {
    if (!part) return;
    for (const m of part.mats) {
      if (level === 0) { m.emissive.setHex(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEmissiveIntensity; }
      else { m.emissive.copy(HIGHLIGHT); m.emissiveIntensity = level === 1 ? 0.16 : 0.4; }
    }
  }
  hover(part) {
    if (part === this.hovered) return;
    if (this.hovered && this.hovered !== this.selected) this._setHighlight(this.hovered, 0);
    this.hovered = part;
    if (part && part !== this.selected) this._setHighlight(part, 1);
    this.container.classList.toggle('pick', !!part);
  }
  select(id) {
    const part = id ? this.parts.get(id) : null;
    if (this.selected && this.selected !== part) { this._setHighlight(this.selected, 0); if (this.selected.ghosted) this._applyGhost(this.selected); }
    this.selected = part || null;
    if (part) { this._setHighlight(part, 2); if (part.ghosted) part.mats.forEach(m => { m.opacity = 0.65; }); }
    if (this.isolated && (!part || this.isolated !== part.id)) { this.isolated = null; this.applyVisibility(); }
    this.cb.onSelect?.(this.selected);
  }
  isolate(id) { this.isolated = this.isolated === id ? null : id; this.applyVisibility(); return this.isolated; }
  partCenter(part, out = new THREE.Vector3()) {
    const bb = new THREE.Box3(); const t = new THREE.Box3();
    part.obj.updateMatrixWorld(true);
    for (const m of part.meshes) { t.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); bb.union(t); }
    for (const ch of part.children) for (const m of ch.meshes) { t.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); bb.union(t); }
    bb.getCenter(out); out.userData = { r: bb.getSize(new THREE.Vector3()).length() / 2 };
    return out;
  }
  focus(id) {
    const part = this.parts.get(id); if (!part) return;
    const c = this.partCenter(part); const r = Math.max(c.userData.r, this.radius * 0.03);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = (r * 1.4) / Math.sin((this.camera.fov / 2) * Math.PI / 180);
    this._tweenTo(c.clone().addScaledVector(dir, Math.max(dist, this.controls.minDistance * 1.2)), c, 650);
  }

  // ---------- camera ----------
  fitDistance() { return (this.radius * 1.05) / Math.sin((this.camera.fov / 2) * Math.PI / 180); }
  setView(name, animate = true) {
    const defaults = { iso: [1, 0.55, 1.35], front: [0, 0.12, 1], side: [1, 0.12, 0], top: [0.001, 1, 0.001] };
    const dirs = Object.assign({}, defaults, this.def?.views || {});
    const d = new THREE.Vector3(...(dirs[name] || dirs.iso)).normalize();
    const pos = this.center.clone().addScaledVector(d, this.fitDistance());
    if (animate) this._tweenTo(pos, this.center.clone(), 600);
    else { this.camera.position.copy(pos); this.controls.target.copy(this.center); this.controls.update(); }
    this.view = name;
  }
  _tweenTo(pos, target, dur) {
    this.tween = { p0: this.camera.position.clone(), p1: pos, t0: this.controls.target.clone(), t1: target, start: performance.now(), dur };
  }

  // ---------- section & x-ray ----------
  setSection(on) { this.section.on = on; if (on) this._autoSide(); this._applySection(); }
  setSectionAxis(a) { this.section.axis = a; this._autoSide(); this._applySection(); }
  _sectionAt() { const s = this.section; const min = this.bounds.min[s.axis], max = this.bounds.max[s.axis]; return (min + max) / 2 + (s.pos * (max - min)) / 2; }
  _autoSide() { const s = this.section; s.removeNeg = this.camera.position[s.axis] < this._sectionAt(); s.flip = false; }
  setSectionPos(v) { this.section.pos = v; this._applySection(); }
  flipSection() { this.section.flip = !this.section.flip; this._applySection(); }
  _applySection() {
    const s = this.section;
    if (!this.def) return;
    const side = THREE.DoubleSide;
    if (!s.on) { this.renderer.clippingPlanes = []; for (const p of this.order) for (const m of p.mats) m.side = p.side ?? THREE.FrontSide; return; }
    const n = new THREE.Vector3(s.axis === 'x' ? 1 : 0, s.axis === 'y' ? 1 : 0, s.axis === 'z' ? 1 : 0);
    const removeNeg = !!s.removeNeg !== !!s.flip;   // remove the side the camera is on, unless flipped
    if (!removeNeg) n.negate();
    const at = this._sectionAt();
    // keep points with dot(n, p) + c >= 0  ->  c = -dot(n, at*axis)
    this.clipPlane.normal.copy(n); this.clipPlane.constant = -n[s.axis] * at;
    this.renderer.clippingPlanes = [this.clipPlane];
    for (const p of this.order) for (const m of p.mats) m.side = side;
  }
  setXray(on) {
    this.xray = on;
    for (const part of this.order) {
      const sys = this.def.systems.find(s => s.id === part.system);
      const ghostable = part.ghost ?? sys?.housing;
      if (!ghostable) continue;
      part.ghosted = on; this._applyGhost(part);
    }
  }
  _applyGhost(part) {
    for (const m of part.mats) {
      if (part.ghosted) { m.transparent = true; m.opacity = this.def?.ghostOpacity ?? 0.14; m.depthWrite = false; }
      else { m.transparent = m.userData.baseTransparent; m.opacity = m.userData.baseOpacity; m.depthWrite = true; }
    }
  }

  // ---------- pointer ----------
  _bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', e => {
      if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y, dt = performance.now() - down.t; down = null;
      if (Math.hypot(dx, dy) > 6 || dt > 500) return;
      const part = this._pick(e.clientX, e.clientY);
      this.select(part ? part.id : null);
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const rect = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.hoverXY = { x: e.clientX, y: e.clientY }; this.hoverDirty = true;
    });
    el.addEventListener('pointerleave', () => { this.hover(null); this.cb.onHover?.(null); });
  }
  _pick(cx, cy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    return this._raycast(v);
  }
  _raycast(v) {
    this.raycaster.setFromCamera(v, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickTargets, false);
    const plane = this.section.on ? this.clipPlane : null;
    for (const h of hits) {
      const part = h.object.userData.part;
      if (!part || !part.obj.visible || !this._parentsVisible(part)) continue;
      if (plane && plane.distanceToPoint(h.point) < 0) continue;
      if (part.ghosted && !this.selected) continue; // see through ghosted housings when x-ray is on
      return part;
    }
    return null;
  }

  // ---------- controls for UI ----------
  setColorMode(mode) {
    this.colorMode = mode;
    for (const p of this.order) for (const m of p.mats) if (m.userData.matColor) m.color.copy(mode === 'system' ? m.userData.sysColor : m.userData.matColor);
  }
  setExplode(k) {
    const prev = this.state.explode; this.state.explode = k;
    // pull the camera back as the assembly spreads, relative to where the user left it
    const dir = this.camera.position.clone().sub(this.controls.target); const dist = dir.length(); dir.normalize();
    const d0 = dist / (1 + 0.8 * prev);
    this.camera.position.copy(this.controls.target).addScaledVector(dir, d0 * (1 + 0.8 * k));
  }
  setRunning(on) { this.state.running = on; }
  setSpeed(rps) { this.state.revPerSec = rps; }

  // ---------- frame ----------
  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const st = this.state; st.dt = dt; st.t += dt;
    if (st.running) st.theta = (st.theta + st.revPerSec * TAU * dt) % (TAU * 1260);
    if (this.tween) {
      const tw = this.tween; const u = Math.min(1, (now - tw.start) / tw.dur); const e = easeInOut(u);
      this.camera.position.lerpVectors(tw.p0, tw.p1, e); this.controls.target.lerpVectors(tw.t0, tw.t1, e);
      if (u >= 1) this.tween = null;
    }
    this.controls.update();
    if (this.def && this.root && this.ready) {
      for (const p of this.order) { p.obj.position.copy(p.base.p); p.obj.quaternion.copy(p.base.q); }
      this.def.animate?.({ theta: st.theta, dt, t: st.t, running: st.running, revPerSec: st.revPerSec, get: id => this.parts.get(id), obj: id => this.parts.get(id)?.obj, refs: this.refs, mode: st.mode, viewer: this });
      if (st.explode > 0) { const k = st.explode; for (const p of this.order) if (p.ex.lengthSq() > 0) p.obj.position.addScaledVector(p.ex, k); }
      if (this.hoverDirty && !this.mobile) { this.hoverDirty = false; const part = this._raycast(this.pointer); this.hover(part); this.cb.onHover?.(part, this.hoverXY); }
    }
    this.renderer.render(this.scene, this.camera);
    if ((this.frame++ & 1) === 0) this.cb.onFrame?.(st);
  }
}
