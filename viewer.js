// Viewer: scene, camera, progressive part building, picking, explode, section, x-ray, kinematic loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterial } from './materials.js';

const TAU = Math.PI * 2;
const HIGHLIGHT_COLOR = new THREE.Color(0xfff1e0);

/** Hue and saturation from the system, lightness from the material, so parts of one system share a colour but stay distinguishable. */
function tintColor(materialColor, systemHex, weight) {
  const systemColor = new THREE.Color(systemHex);
  const matHSL = { h: 0, s: 0, l: 0 };
  const sysHSL = { h: 0, s: 0, l: 0 };
  materialColor.getHSL(matHSL);
  systemColor.getHSL(sysHSL);

  const saturation = sysHSL.s * weight + matHSL.s * (1 - weight);
  const lightness = matHSL.l * (1 - 0.35 * weight) + sysHSL.l * 0.35 * weight;
  return new THREE.Color().setHSL(sysHSL.h, saturation, lightness);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export class Viewer {
  constructor(container, cb = {}) {
    this.container = container;
    this.cb = cb;
    this._initState();
    this._initRenderer(container);
    this._initSceneAndCamera();
    this._initLighting();
    this._initGroundAndClipping();

    this.setTheme(false);
    this._bindPointer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    this.renderer.setAnimationLoop((now) => this.tick(now));
  }

  // ---------- construction helpers ----------
  _initState() {
    this.parts = new Map();
    this.order = [];
    this.def = null;
    this.root = null;
    this.systemOn = {};
    this.isolated = null;
    this.selected = null;
    this.hovered = null;
    this.state = { theta: 0, running: false, revPerSec: 0.3, t: 0, dt: 0, explode: 0, mode: 0 };
    this.section = { on: false, axis: 'x', pos: 0, flip: false };
    this.xray = false;
    this.dark = false;
    this.colorMode = 'system';
    this.pickTargets = [];
    this.pointer = new THREE.Vector2(-9, -9);
    this.hoverDirty = false;
    this.bounds = new THREE.Box3();
    this.radius = 500;
    this.center = new THREE.Vector3();
    this.tween = null;
    this.frame = 0;
  }
  _initRenderer(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    this.mobile = Math.min(window.innerWidth, window.innerHeight) < 700 || /Mobi|Android/i.test(navigator.userAgent);
    renderer.shadowMap.enabled = !this.mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
  }
  _initSceneAndCamera() {
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 20000);
    this.camera.position.set(900, 500, 1200);

    const controls = this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.8;
    controls.minDistance = 20;
    controls.maxDistance = 15000;
    controls.screenSpacePanning = true;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environmentIntensity = 0.85;
  }
  _initLighting() {
    const scene = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8892a0, 0.55);
    scene.add(this.hemi);

    const key = this.key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(600, 1100, 700);
    key.castShadow = !this.mobile;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 2;
    key.shadow.radius = 4;
    scene.add(key);
    scene.add(key.target);

    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45);
    fill.position.set(-800, 300, -500);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.35);
    rim.position.set(200, -400, -900);
    scene.add(rim);
  }
  _initGroundAndClipping() {
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.16, transparent: true }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = false;
  }

  // ---------- setup ----------
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
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
    this.def = def;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.ready = false;

    this.systemOn = {};
    def.systems.forEach((sy) => (this.systemOn[sy.id] = true));
    this.state.theta = 0;
    this.state.explode = 0;
    this.isolated = null;
    this.selected = null;
    this.hovered = null;
    if (def.drive?.revPerSec) this.state.revPerSec = def.drive.revPerSec;

    const factory = this._factory(def);
    this.refs = factory.refs;
    await this._runBuilder(def, factory);

    this._finalize();
    this.ready = true;
    this.cb.onProgress?.(1, 'ready');
    this.cb.onLoaded?.(def);
  }
  // Runs def.build(factory) — a generator that yields progress labels — a
  // slice at a time (~14ms per tick) so the tab stays responsive while a
  // large machine's parts are constructed.
  async _runBuilder(def, factory) {
    const estimate = def.pieces || 300;
    let label = '';
    const generator = def.build(factory);
    const iter = generator && typeof generator.next === 'function' ? generator : null;
    if (!iter) return;

    const reportProgress = () => this.cb.onProgress?.(Math.min(0.98, this.parts.size / estimate), label);

    await new Promise((resolve) => {
      const runSlice = () => {
        const sliceStart = performance.now();
        let finished = false;
        while (performance.now() - sliceStart < 14) {
          const step = iter.next();
          if (step.done) { finished = true; break; }
          if (typeof step.value === 'string') label = step.value;
        }
        reportProgress();
        if (finished) resolve(); else setTimeout(runSlice, 0);
      };
      runSlice();
    });
  }
  unload() {
    if (!this.root) return;
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    this.scene.remove(this.root);
    this.root = null;
    this.parts.clear();
    this.order = [];
    this.pickTargets = [];
    this.def = null;
  }
  _factory(def) {
    const viewer = this;
    const systemIds = new Set(def.systems.map((s) => s.id));

    return {
      def,
      refs: {},
      mat: (key, o) => makeMaterial(key, o),
      add(spec) {
        viewer._validatePartSpec(spec, systemIds);
        const obj = spec.obj || viewer._buildMeshFromSpec(spec);
        const part = viewer._makePartRecord(spec, obj);

        viewer._applySpecTransform(obj, spec, part);
        viewer._wirePartMeshes(obj, part, spec, def);

        obj.userData.part = part;
        viewer._attachToParent(part, obj);
        viewer.parts.set(part.id, part);
        viewer.order.push(part);
        return part;
      },
      get: (id) => viewer.parts.get(id),
    };
  }
  _validatePartSpec(spec, systemIds) {
    if (!spec.id) throw new Error('part needs id');
    if (this.parts.has(spec.id)) throw new Error('duplicate part id ' + spec.id);
    if (!systemIds.has(spec.system)) throw new Error(`part ${spec.id}: unknown system ${spec.system}`);
  }
  _buildMeshFromSpec(spec) {
    const material = spec.mat instanceof THREE.Material ? spec.mat : makeMaterial(spec.mat || 'steel', spec.matOpts);
    return new THREE.Mesh(spec.geo, material);
  }
  _makePartRecord(spec, obj) {
    return {
      id: spec.id, name: spec.name, system: spec.system, obj, meshes: [], mats: [],
      desc: spec.desc || '', notes: spec.notes || [], block: spec.block || {}, count: spec.count ?? 1,
      parent: spec.parent || null, children: [], glow: !!spec.glow, ghost: spec.ghost, pick: spec.pick !== false,
      base: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, ex: new THREE.Vector3(), exAuto: !spec.ex,
    };
  }
  _applySpecTransform(obj, spec, part) {
    if (spec.pos) obj.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    if (spec.rot) obj.rotation.set(spec.rot[0] || 0, spec.rot[1] || 0, spec.rot[2] || 0);
    if (spec.quat) obj.quaternion.copy(spec.quat);
    part.base.p.copy(obj.position);
    part.base.q.copy(obj.quaternion);
    if (spec.ex) part.ex.set(spec.ex[0], spec.ex[1], spec.ex[2]);
  }
  _wirePartMeshes(obj, part, spec, def) {
    const sys = def.systems.find((sy) => sy.id === spec.system);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.part && o.userData.part !== part) return; // belongs to a nested part
      o.userData.part = part;
      o.castShadow = true;
      o.receiveShadow = false;

      if (Array.isArray(o.material)) o.material = o.material.map((m) => m.clone());
      else if (o.material.userData.owner && o.material.userData.owner !== part.id) o.material = o.material.clone();

      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => this._prepareMaterialForPart(m, part, spec, sys));
      part.meshes.push(o);
      part.mats.push(...mats);
    });
  }
  _prepareMaterialForPart(m, part, spec, sys) {
    m.userData.owner = part.id;
    if (m.userData.baseOpacity === undefined) {
      m.userData.baseOpacity = m.opacity;
      m.userData.baseTransparent = m.transparent;
      m.userData.baseEmissive = m.emissive.getHex();
      m.userData.baseEmissiveIntensity = m.emissiveIntensity;
    }
    if (!m.userData.matColor) {
      m.userData.matColor = m.color.clone();
      const weight = spec.tint ?? sys.tint ?? (sys.housing ? 0.35 : 0.85);
      m.userData.sysColor = m.transparent || weight === 0 ? m.color.clone() : tintColor(m.userData.matColor, sys.color, weight);
    }
    m.color.copy(this.colorMode === 'system' ? m.userData.sysColor : m.userData.matColor);
  }
  _attachToParent(part, obj) {
    const parentPart = part.parent ? this.parts.get(part.parent) : null;
    if (part.parent && !parentPart) throw new Error(`part ${part.id}: unknown parent ${part.parent}`);
    (parentPart ? parentPart.obj : this.root).add(obj);
    if (parentPart) parentPart.children.push(part);
  }
  _finalize() {
    this.root.updateMatrixWorld(true);
    this._computeBounds();
    this._computeAutoExplode();
    this._placeGroundAndShadowCamera();
    this._configureCameraAndControlLimits();

    this.pickTargets = this.order.filter((p) => p.pick).flatMap((p) => p.meshes);
    this.applyVisibility();
    this.setView(this.def.defaultView || 'iso', false);

    this.section.pos = this.def.sectionDefault ?? 0;
    this.section.axis = this.def.sectionAxis || 'x';
    this.section.flip = false;
    this.setSection(false);
    this.setXray(false);
  }
  _computeBounds() {
    const def = this.def;
    this.bounds.makeEmpty();
    const scratch = new THREE.Box3();
    for (const part of this.order) {
      if (part.system && def.systems.find((s) => s.id === part.system)?.noBounds) continue;
      for (const m of part.meshes) {
        m.geometry.computeBoundingBox();
        scratch.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
        this.bounds.union(scratch);
      }
    }
    this.bounds.getCenter(this.center);
    const size = this.bounds.getSize(new THREE.Vector3());
    this.radius = size.length() / 2;
  }
  // Automatic explode vectors: radial from the assembly center, for
  // top-level parts that didn't specify their own explosion direction.
  _computeAutoExplode() {
    const scale = this.def.explodeScale ?? 0.9;
    const scratchBox = new THREE.Box3();
    const centroid = new THREE.Vector3(), worldPoint = new THREE.Vector3();

    for (const part of this.order) {
      if (!part.exAuto) continue;
      if (part.parent) { part.ex.set(0, 0, 0); continue; }

      scratchBox.makeEmpty();
      for (const m of part.meshes) {
        centroid.copy(m.geometry.boundingBox.getCenter(worldPoint)).applyMatrix4(m.matrixWorld);
        scratchBox.expandByPoint(centroid);
      }
      scratchBox.getCenter(centroid).sub(this.center);
      part.ex.copy(centroid).multiplyScalar(scale);
    }
  }
  _placeGroundAndShadowCamera() {
    this.ground.position.set(this.center.x, this.bounds.min.y - this.radius * 0.02, this.center.z);
    this.ground.scale.set(this.radius * 8, this.radius * 8, 1);

    const shadowCam = this.key.shadow.camera;
    const extent = this.radius * 1.6;
    shadowCam.left = -extent; shadowCam.right = extent; shadowCam.top = extent; shadowCam.bottom = -extent;
    shadowCam.near = 10; shadowCam.far = this.radius * 8;
    shadowCam.updateProjectionMatrix();

    this.key.position.copy(this.center).add(new THREE.Vector3(0.5, 1.0, 0.6).multiplyScalar(this.radius * 3));
    this.key.target.position.copy(this.center);
  }
  _configureCameraAndControlLimits() {
    this.camera.near = Math.max(0.5, this.radius * 0.01);
    this.camera.far = this.radius * 40;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.radius * 0.15;
    this.controls.maxDistance = this.radius * 8;
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
  _descends(part, ancestor) {
    let p = part;
    while (p.parent) {
      p = this.parts.get(p.parent);
      if (p === ancestor) return true;
    }
    return false;
  }
  setSystemVisible(id, on) { this.systemOn[id] = on; this.applyVisibility(); }
  setAllSystems(on) { for (const k of Object.keys(this.systemOn)) this.systemOn[k] = on; this.applyVisibility(); }
  countVisible() {
    let n = 0;
    for (const p of this.order) if (p.obj.visible && this._parentsVisible(p)) n += p.count;
    return n;
  }
  _parentsVisible(part) {
    let p = part;
    while (p.parent) {
      p = this.parts.get(p.parent);
      if (!p.obj.visible) return false;
    }
    return true;
  }
  countBySystem(id) {
    let n = 0;
    for (const p of this.order) if (p.system === id) n += p.count;
    return n;
  }
  pieceCount() {
    let n = 0;
    for (const p of this.order) n += p.count;
    return n;
  }

  // ---------- selection ----------
  _setHighlight(part, level) {
    if (!part) return;
    for (const m of part.mats) {
      if (level === 0) {
        m.emissive.setHex(m.userData.baseEmissive);
        m.emissiveIntensity = m.userData.baseEmissiveIntensity;
      } else {
        m.emissive.copy(HIGHLIGHT_COLOR);
        m.emissiveIntensity = level === 1 ? 0.16 : 0.4;
      }
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
    if (this.selected && this.selected !== part) {
      this._setHighlight(this.selected, 0);
      if (this.selected.ghosted) this._applyGhost(this.selected);
    }
    this.selected = part || null;
    if (part) {
      this._setHighlight(part, 2);
      if (part.ghosted) part.mats.forEach((m) => { m.opacity = 0.65; });
    }
    if (this.isolated && (!part || this.isolated !== part.id)) {
      this.isolated = null;
      this.applyVisibility();
    }
    this.cb.onSelect?.(this.selected);
  }
  isolate(id) {
    this.isolated = this.isolated === id ? null : id;
    this.applyVisibility();
    return this.isolated;
  }
  partCenter(part, out = new THREE.Vector3()) {
    const bounds = new THREE.Box3(), scratch = new THREE.Box3();
    part.obj.updateMatrixWorld(true);
    for (const m of part.meshes) {
      scratch.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      bounds.union(scratch);
    }
    for (const child of part.children) {
      for (const m of child.meshes) {
        scratch.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
        bounds.union(scratch);
      }
    }
    bounds.getCenter(out);
    out.userData = { r: bounds.getSize(new THREE.Vector3()).length() / 2 };
    return out;
  }
  focus(id) {
    const part = this.parts.get(id);
    if (!part) return;
    const c = this.partCenter(part);
    const r = Math.max(c.userData.r, this.radius * 0.03);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = (r * 1.4) / Math.sin(((this.camera.fov / 2) * Math.PI) / 180);
    this._tweenTo(c.clone().addScaledVector(dir, Math.max(dist, this.controls.minDistance * 1.2)), c, 650);
  }

  // ---------- camera ----------
  fitDistance() {
    return (this.radius * 1.05) / Math.sin(((this.camera.fov / 2) * Math.PI) / 180);
  }
  setView(name, animate = true) {
    const defaultDirs = { iso: [1, 0.55, 1.35], front: [0, 0.12, 1], side: [1, 0.12, 0], top: [0.001, 1, 0.001] };
    const dirs = Object.assign({}, defaultDirs, this.def?.views || {});
    const dir = new THREE.Vector3(...(dirs[name] || dirs.iso)).normalize();
    const pos = this.center.clone().addScaledVector(dir, this.fitDistance());

    if (animate) {
      this._tweenTo(pos, this.center.clone(), 600);
    } else {
      this.camera.position.copy(pos);
      this.controls.target.copy(this.center);
      this.controls.update();
    }
    this.view = name;
  }
  _tweenTo(pos, target, dur) {
    this.tween = {
      p0: this.camera.position.clone(), p1: pos,
      t0: this.controls.target.clone(), t1: target,
      start: performance.now(), dur,
    };
  }

  // ---------- section & x-ray ----------
  setSection(on) {
    this.section.on = on;
    if (on) this._autoSide();
    this._applySection();
  }
  setSectionAxis(axis) {
    this.section.axis = axis;
    this._autoSide();
    this._applySection();
  }
  _sectionAt() {
    const s = this.section;
    const min = this.bounds.min[s.axis], max = this.bounds.max[s.axis];
    return (min + max) / 2 + (s.pos * (max - min)) / 2;
  }
  _autoSide() {
    const s = this.section;
    s.removeNeg = this.camera.position[s.axis] < this._sectionAt();
    s.flip = false;
  }
  setSectionPos(v) { this.section.pos = v; this._applySection(); }
  flipSection() { this.section.flip = !this.section.flip; this._applySection(); }
  _applySection() {
    const s = this.section;
    if (!this.def) return;
    if (!s.on) {
      this.renderer.clippingPlanes = [];
      for (const p of this.order) for (const m of p.mats) m.side = p.side ?? THREE.FrontSide;
      return;
    }
    const normal = new THREE.Vector3(s.axis === 'x' ? 1 : 0, s.axis === 'y' ? 1 : 0, s.axis === 'z' ? 1 : 0);
    const removeNeg = !!s.removeNeg !== !!s.flip; // remove the side the camera is on, unless flipped
    if (!removeNeg) normal.negate();

    const at = this._sectionAt();
    // keep points with dot(n, p) + c >= 0  ->  c = -dot(n, at*axis)
    this.clipPlane.normal.copy(normal);
    this.clipPlane.constant = -normal[s.axis] * at;
    this.renderer.clippingPlanes = [this.clipPlane];
    for (const p of this.order) for (const m of p.mats) m.side = THREE.DoubleSide;
  }
  setXray(on) {
    this.xray = on;
    for (const part of this.order) {
      const sys = this.def.systems.find((s) => s.id === part.system);
      const ghostable = part.ghost ?? sys?.housing;
      if (!ghostable) continue;
      part.ghosted = on;
      this._applyGhost(part);
    }
  }
  _applyGhost(part) {
    for (const m of part.mats) {
      if (part.ghosted) {
        m.transparent = true;
        m.opacity = this.def?.ghostOpacity ?? 0.14;
        m.depthWrite = false;
      } else {
        m.transparent = m.userData.baseTransparent;
        m.opacity = m.userData.baseOpacity;
        m.depthWrite = true;
      }
    }
  }

  // ---------- pointer ----------
  _bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y, dt = performance.now() - down.t;
      down = null;
      if (Math.hypot(dx, dy) > 6 || dt > 500) return;
      const part = this._pick(e.clientX, e.clientY);
      this.select(part ? part.id : null);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const rect = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.hoverXY = { x: e.clientX, y: e.clientY };
      this.hoverDirty = true;
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
    for (const hit of hits) {
      const part = hit.object.userData.part;
      if (!part || !part.obj.visible || !this._parentsVisible(part)) continue;
      if (plane && plane.distanceToPoint(hit.point) < 0) continue;
      if (part.ghosted && !this.selected) continue; // see through ghosted housings when x-ray is on
      return part;
    }
    return null;
  }

  // ---------- controls for UI ----------
  setColorMode(mode) {
    this.colorMode = mode;
    for (const p of this.order) {
      for (const m of p.mats) {
        if (m.userData.matColor) m.color.copy(mode === 'system' ? m.userData.sysColor : m.userData.matColor);
      }
    }
  }
  setExplode(k) {
    const prev = this.state.explode;
    this.state.explode = k;
    // pull the camera back as the assembly spreads, relative to where the user left it
    const offset = this.camera.position.clone().sub(this.controls.target);
    const dist = offset.length();
    offset.normalize();
    const baseDist = dist / (1 + 0.8 * prev);
    this.camera.position.copy(this.controls.target).addScaledVector(offset, baseDist * (1 + 0.8 * k));
  }
  setRunning(on) { this.state.running = on; }
  setSpeed(rps) { this.state.revPerSec = rps; }

  // ---------- frame ----------
  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this._advanceClock(dt);
    this._advanceCameraTween(now);
    this.controls.update();

    if (this.def && this.root && this.ready) {
      this._applyKinematics(dt);
      this._applyExplodeOffsets();
      this._updateHoverIfDirty();
    }
    this.renderer.render(this.scene, this.camera);
    if ((this.frame++ & 1) === 0) this.cb.onFrame?.(this.state);
  }
  _advanceClock(dt) {
    const st = this.state;
    st.dt = dt;
    st.t += dt;
    if (st.running) st.theta = (st.theta + st.revPerSec * TAU * dt) % (TAU * 1260);
  }
  _advanceCameraTween(now) {
    if (!this.tween) return;
    const tw = this.tween;
    const u = Math.min(1, (now - tw.start) / tw.dur);
    const eased = easeInOut(u);
    this.camera.position.lerpVectors(tw.p0, tw.p1, eased);
    this.controls.target.lerpVectors(tw.t0, tw.t1, eased);
    if (u >= 1) this.tween = null;
  }
  _applyKinematics(dt) {
    const st = this.state;
    for (const p of this.order) {
      p.obj.position.copy(p.base.p);
      p.obj.quaternion.copy(p.base.q);
    }
    this.def.animate?.({
      theta: st.theta, dt, t: st.t, running: st.running, revPerSec: st.revPerSec,
      get: (id) => this.parts.get(id), obj: (id) => this.parts.get(id)?.obj,
      refs: this.refs, mode: st.mode, viewer: this,
    });
  }
  _applyExplodeOffsets() {
    const k = this.state.explode;
    if (k <= 0) return;
    for (const p of this.order) if (p.ex.lengthSq() > 0) p.obj.position.addScaledVector(p.ex, k);
  }
  _updateHoverIfDirty() {
    if (!this.hoverDirty || this.mobile) return;
    this.hoverDirty = false;
    const part = this._raycast(this.pointer);
    this.hover(part);
    this.cb.onHover?.(part, this.hoverXY);
  }
}
