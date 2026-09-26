import { Viewer } from './viewer.js';
import { MACHINES } from './machines-index.js';

// ---------- small shared helpers ----------
const byId = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');
const escapeHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// localStorage isn't guaranteed (private browsing, quota, etc.), so every
// read/write goes through this pair instead of a bare try/catch each time.
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
};

// DOM element ids grouped roughly by the panel they belong to; built into
// one flat `el` lookup so the rest of the file can keep writing el.xyz.
const ELEMENT_GROUPS = {
  chrome: ['stage', 'machineBtn', 'machineName', 'machineMenu', 'pieceCount', 'machineSub', 'search', 'searchResults', 'themeBtn', 'aboutBtn'],
  systems: ['systemsPanel', 'systemCount', 'systemsCollapse', 'systemTabs', 'systemList', 'visibleCount', 'toggleAll'],
  inspector: ['infoPanel', 'infoSystem', 'infoSystemName', 'infoClose', 'infoName', 'infoDesc', 'infoBlock', 'infoNotes', 'isolateBtn', 'focusBtn', 'clearBtn'],
  rail: ['viewRail', 'sectionBtn', 'xrayBtn', 'colorBtn', 'resetView', 'sectionCtl', 'sectionAxis', 'sectionPos', 'sectionFlip'],
  console: ['playBtn', 'driveLabel', 'rpmReadout', 'rpmUnit', 'angleReadout', 'speed', 'speedNote', 'cycleStrip'],
  explode: ['explode', 'explodeReadout', 'assembleBtn'],
  loader: ['loader', 'loaderTitle', 'loaderSub', 'loaderBar', 'tooltip'],
  about: ['about', 'aboutClose', 'aboutBody', 'creditsLink', 'hint'],
};
const el = Object.fromEntries(Object.values(ELEMENT_GROUPS).flat().map((id) => [id, byId(id)]));

let current = null;
let tab = 'all';
let cycleSpans = [];
let lastCycle = -1;
let pendingPart = null;

// ============================================================
// Theme
// ============================================================
const docRoot = document.documentElement;
function isDark() {
  const explicit = docRoot.getAttribute('data-theme');
  if (explicit) return explicit === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme() {
  viewer.setTheme(isDark());
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', isDark() ? '#14171b' : '#eceef1');
}
(function initTheme() {
  const saved = storage.get('atlas-theme');
  if (saved) docRoot.setAttribute('data-theme', saved);
})();
el.themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  docRoot.setAttribute('data-theme', next);
  storage.set('atlas-theme', next);
  applyTheme();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ============================================================
// Viewer instance
// ============================================================
function handleProgress(p, label) {
  el.loaderBar.style.width = `${Math.round(p * 100)}%`;
  el.loaderSub.textContent = `${Math.round(p * 100)}% · ${label || 'preparing'}`;
}
function handleLoaded() {
  el.loader.classList.add('fade');
  setTimeout(() => el.loader.classList.add('hidden'), 400);
  el.pieceCount.textContent = `${fmt(viewer.pieceCount())} modeled pieces`;
  renderSystems();
  updateVisibleCount();
  updateURL();
  const wanted = pendingPart;
  pendingPart = null;
  if (wanted && viewer.parts.has(wanted)) { viewer.select(wanted); viewer.focus(wanted); }
}
function handleHover(part, xy) {
  if (!part || !xy) { el.tooltip.classList.add('hidden'); return; }
  const sys = current.systems.find((s) => s.id === part.system);
  el.tooltip.innerHTML = `${escapeHTML(part.name)}<small>${escapeHTML(sys?.name || '')}</small>`;
  el.tooltip.style.left = `${xy.x}px`;
  el.tooltip.style.top = `${xy.y}px`;
  el.tooltip.classList.remove('hidden');
}
function handleFrame(st) {
  const deg = (st.theta * 180) / Math.PI;
  const period = current?.cycle ? 720 : 360;
  el.angleReadout.textContent = Math.floor(((deg % period) + period) % period);
  if (!current?.cycle) return;
  const c = current.cycle(st.theta);
  if (!c || c.active === lastCycle) return;
  lastCycle = c.active;
  cycleSpans.forEach((span, i) => span.classList.toggle('on', i === c.active));
  el.cycleStrip.style.setProperty('--cyc', c.color || 'var(--ink)');
}

const viewer = new Viewer(el.stage, {
  onProgress: handleProgress,
  onLoaded: handleLoaded,
  onHover: handleHover,
  onSelect(part) { renderInfo(part); updateURL(); },
  onVisibility() { updateVisibleCount(); },
  onFrame: handleFrame,
});
applyTheme();
window.atlas = { viewer, get machine() { return current; } };
window.addEventListener('error', (e) => {
  console.error('ATLAS', (performance.now() | 0) + 'ms', e.message, e.error && e.error.stack);
});

// ============================================================
// Machine switching
// ============================================================
function renderMachineMenu() {
  el.machineMenu.innerHTML = '';
  for (const m of MACHINES) {
    const btn = document.createElement('button');
    btn.className = 'menu-item' + (current?.id === m.id ? ' current' : '');
    btn.setAttribute('role', 'option');
    btn.innerHTML = `<span class="mi-dot" style="background:${m.color}"></span><span class="mi-main"><span class="mi-name">${escapeHTML(m.name)}</span><span class="mi-sub">${escapeHTML(m.sub)}</span></span><span class="mi-count">${m.pieces ? '~' + fmt(m.pieces) : ''}</span>`;
    btn.addEventListener('click', () => { closeMenus(); if (current?.id !== m.id) loadMachine(m.id); });
    el.machineMenu.appendChild(btn);
  }
}
function resetLoaderUI(def) {
  el.loader.classList.remove('hidden', 'fade');
  el.loaderBar.style.width = '0%';
  el.loaderTitle.textContent = `Machining ${def.shortName || def.name}`;
  el.loaderSub.textContent = '0% · preparing';
}
function setupCycleStrip(def) {
  el.cycleStrip.innerHTML = '';
  cycleSpans = [];
  if (!def.cycle) { el.cycleStrip.classList.add('hidden'); return; }
  const c = def.cycle(0);
  const title = document.createElement('span');
  title.className = 'cycle-title';
  title.textContent = c.title || 'Cycle';
  el.cycleStrip.appendChild(title);
  for (const label of c.labels) {
    const span = document.createElement('span');
    span.textContent = label;
    el.cycleStrip.appendChild(span);
    cycleSpans.push(span);
  }
  el.cycleStrip.classList.remove('hidden');
}
function setupModes(def) {
  const modeStrip = byId('modeStrip'), modeButtons = byId('modeButtons');
  modeButtons.innerHTML = '';
  if (!def.modes) { modeStrip.classList.add('hidden'); return; }
  byId('modeLabel').textContent = def.modes.label;
  viewer.state.mode = def.modes.default ?? 0;
  def.modes.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.classList.toggle('on', i === viewer.state.mode);
    btn.addEventListener('click', () => {
      viewer.state.mode = i;
      modeButtons.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j === i));
    });
    modeButtons.appendChild(btn);
  });
  modeStrip.classList.remove('hidden');
}
function resetTransientControls(def) {
  el.explode.value = 0;
  el.explodeReadout.textContent = '0';
  viewer.setExplode(0);
  el.sectionBtn.classList.remove('on');
  el.xrayBtn.classList.remove('on');
  el.sectionCtl.classList.add('hidden');
  el.sectionPos.value = def.sectionDefault ?? 0;
  el.sectionAxis.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.axis === (def.sectionAxis || 'x')));
  el.viewRail.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === (def.defaultView || 'iso')));
  el.hint.textContent = def.hint || 'Drag to orbit · Scroll to zoom · Click a part to inspect';
}
async function loadMachine(id) {
  const def = MACHINES.find((m) => m.id === id) || MACHINES[0];
  current = def;
  lastCycle = -1;

  resetLoaderUI(def);
  el.machineName.textContent = def.name;
  el.machineSub.textContent = def.sub;
  document.title = `${def.name} · Engine-X`;
  el.driveLabel.textContent = def.drive?.label || 'Drive';

  setupCycleStrip(def);
  setupModes(def);
  renderInfo(null);
  renderMachineMenu();
  resetTransientControls(def);

  await viewer.loadMachine(def);
  setSpeedFromSlider();
  if (def.autoRun !== false) setRunning(true);
}
el.machineBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = el.machineMenu.classList.toggle('hidden');
  el.machineBtn.setAttribute('aria-expanded', String(!open));
  el.searchResults.classList.add('hidden');
});
function closeMenus() {
  el.machineMenu.classList.add('hidden');
  el.searchResults.classList.add('hidden');
  el.machineBtn.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu') && !e.target.closest('.search') && !e.target.closest('#machineBtn')) closeMenus();
});

// ============================================================
// Systems panel
// ============================================================
function systemsForTab() {
  return current.systems.filter((s) => tab === 'all' || (tab === 'moving' ? s.kind === 'moving' : s.kind !== 'moving'));
}
function renderSystems() {
  el.systemList.innerHTML = '';
  const systems = systemsForTab();
  el.systemCount.textContent = current.systems.length;

  for (const s of systems) {
    const row = document.createElement('li');
    row.className = 'system-row' + (viewer.systemOn[s.id] ? '' : ' off');
    row.dataset.id = s.id;
    row.innerHTML = `<span class="sys-dot" style="background:${s.color}"></span><button class="sys-name" title="${escapeHTML(s.blurb || '')}">${escapeHTML(s.name)}</button><span class="sys-count">${fmt(viewer.countBySystem(s.id))}</span><button class="switch ${viewer.systemOn[s.id] ? 'on' : ''}" role="switch" aria-checked="${!!viewer.systemOn[s.id]}" aria-label="Show ${escapeHTML(s.name)}" style="--sw-on:${s.color}"></button>`;

    row.querySelector('.switch').addEventListener('click', () => {
      viewer.setSystemVisible(s.id, !viewer.systemOn[s.id]);
      syncSystemRows();
    });
    row.querySelector('.sys-name').addEventListener('click', () => {
      // solo this system (click again to restore all)
      const others = current.systems.filter((o) => o.id !== s.id);
      const soloed = viewer.systemOn[s.id] && others.every((o) => !viewer.systemOn[o.id]);
      viewer.setAllSystems(soloed);
      if (!soloed) viewer.setSystemVisible(s.id, true);
      syncSystemRows();
    });
    el.systemList.appendChild(row);
  }
  syncSystemRows();
}
function syncSystemRows() {
  el.systemList.querySelectorAll('.system-row').forEach((row) => {
    const on = !!viewer.systemOn[row.dataset.id];
    row.classList.toggle('off', !on);
    const sw = row.querySelector('.switch');
    sw.classList.toggle('on', on);
    sw.setAttribute('aria-checked', String(on));
  });
  const anyOn = current.systems.some((s) => viewer.systemOn[s.id]);
  el.toggleAll.textContent = anyOn ? 'Hide all' : 'Show all';
  updateVisibleCount();
}
function updateVisibleCount() {
  if (current) el.visibleCount.textContent = `${fmt(viewer.countVisible())} pieces visible`;
}
el.toggleAll.addEventListener('click', () => {
  const anyOn = current.systems.some((s) => viewer.systemOn[s.id]);
  viewer.setAllSystems(!anyOn);
  syncSystemRows();
});
el.systemTabs.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  el.systemTabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  renderSystems();
});
el.systemsCollapse.addEventListener('click', () => el.systemsPanel.classList.toggle('collapsed'));
if (window.innerWidth < 680) el.systemsPanel.classList.add('collapsed');

// ============================================================
// Inspector
// ============================================================
function renderInfoBlock(part) {
  el.infoBlock.innerHTML = '';
  const rows = Object.entries(part.block || {});
  if (part.count > 1 && !part.block.qty) rows.push(['qty', `${part.count} in this part`]);
  if (!rows.length) { el.infoBlock.classList.add('hidden'); return; }
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    el.infoBlock.append(dt, dd);
  }
  el.infoBlock.classList.remove('hidden');
}
function renderInfoNotes(part) {
  el.infoNotes.innerHTML = '';
  for (const note of part.notes || []) {
    const li = document.createElement('li');
    li.textContent = note;
    el.infoNotes.appendChild(li);
  }
  el.infoNotes.classList.toggle('hidden', !(part.notes && part.notes.length));
}
function renderInfo(part) {
  if (!part) {
    el.infoPanel.classList.add('hidden');
    el.isolateBtn.classList.remove('on');
    return;
  }
  const sys = current.systems.find((s) => s.id === part.system);
  el.infoSystemName.textContent = sys?.name || '';
  el.infoSystem.querySelector('.chip-dot').style.background = sys?.color || 'var(--accent)';
  el.infoName.textContent = part.name;
  el.infoDesc.textContent = part.desc || sys?.blurb || '';

  renderInfoBlock(part);
  renderInfoNotes(part);

  const isolatedHere = viewer.isolated === part.id;
  el.isolateBtn.classList.toggle('on', isolatedHere);
  el.isolateBtn.textContent = isolatedHere ? 'Show everything' : 'Isolate part';
  el.infoPanel.classList.remove('hidden');
  el.infoPanel.scrollTop = 0;
}
el.infoClose.addEventListener('click', () => viewer.select(null));
el.clearBtn.addEventListener('click', () => viewer.select(null));
el.isolateBtn.addEventListener('click', () => {
  if (!viewer.selected) return;
  const iso = viewer.isolate(viewer.selected.id);
  el.isolateBtn.classList.toggle('on', !!iso);
  el.isolateBtn.textContent = iso ? 'Show everything' : 'Isolate part';
  if (iso) viewer.focus(iso);
});
el.focusBtn.addEventListener('click', () => viewer.selected && viewer.focus(viewer.selected.id));

// ============================================================
// View rail (camera views, section, x-ray, color mode)
// ============================================================
el.viewRail.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  viewer.setView(b.dataset.view, true);
  el.viewRail.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('on', x === b));
}));
el.resetView.addEventListener('click', () => {
  viewer.setView(current.defaultView || 'iso', true);
  viewer.select(null);
  viewer.setExplode(0);
  el.explode.value = 0;
  el.explodeReadout.textContent = '0';
  viewer.setAllSystems(true);
  syncSystemRows();
});
el.sectionBtn.addEventListener('click', () => {
  const on = !viewer.section.on;
  viewer.setSection(on);
  el.sectionBtn.classList.toggle('on', on);
  el.sectionCtl.classList.toggle('hidden', !on);
});
el.xrayBtn.addEventListener('click', () => {
  const on = !viewer.xray;
  viewer.setXray(on);
  el.xrayBtn.classList.toggle('on', on);
});
function setColorMode(mode) {
  viewer.setColorMode(mode);
  el.colorBtn.classList.toggle('on', mode === 'system');
  storage.set('atlas-colors', mode);
}
el.colorBtn.addEventListener('click', () => setColorMode(viewer.colorMode === 'system' ? 'material' : 'system'));
(function restoreColorMode() {
  if (storage.get('atlas-colors') === 'material') {
    viewer.colorMode = 'material';
    el.colorBtn.classList.remove('on');
  }
})();
el.sectionAxis.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  viewer.setSectionAxis(b.dataset.axis);
  el.sectionAxis.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
});
el.sectionPos.addEventListener('input', () => viewer.setSectionPos(parseFloat(el.sectionPos.value)));
el.sectionFlip.addEventListener('click', () => viewer.flipSection());

// ============================================================
// Console (run/pause, speed, explode)
// ============================================================
function setRunning(on) {
  viewer.setRunning(on);
  el.playBtn.classList.toggle('on', on);
  el.playBtn.setAttribute('aria-label', on ? 'Pause the machine' : 'Run the machine');
}
el.playBtn.addEventListener('click', () => setRunning(!viewer.state.running));
function setSpeedFromSlider() {
  const v = parseFloat(el.speed.value);
  const rps = 0.05 * Math.pow(200, v); // 0.05 … 10 rev/s
  const mult = current?.drive?.speedScale ?? 1;
  viewer.setSpeed(rps * mult);
  const shownRpm = rps * mult * 60;
  el.rpmReadout.textContent = shownRpm < 100 ? shownRpm.toFixed(1) : fmt(Math.round(shownRpm));
  el.rpmUnit.textContent = current?.drive?.unit || 'rpm on screen';
  el.speedNote.textContent = rps < 1 ? `1 rev every ${(1 / rps).toFixed(1)} s` : `${rps.toFixed(1)} rev / s`;
}
el.speed.addEventListener('input', setSpeedFromSlider);
el.explode.addEventListener('input', () => {
  const k = parseFloat(el.explode.value);
  viewer.setExplode(k);
  el.explodeReadout.textContent = Math.round(k * 100);
});
el.assembleBtn.addEventListener('click', () => {
  el.explode.value = 0;
  viewer.setExplode(0);
  el.explodeReadout.textContent = '0';
});

// ============================================================
// Search
// ============================================================
function searchParts(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const matches = [];
  for (const p of viewer.order) {
    const sys = current.systems.find((s) => s.id === p.system);
    const haystack = `${p.name} ${sys?.name || ''}`.toLowerCase();
    if (terms.every((t) => haystack.includes(t))) matches.push(p);
    if (matches.length >= 14) break;
  }
  return matches;
}
function renderSearch() {
  const results = searchParts(el.search.value);
  el.searchResults.innerHTML = '';
  if (!el.search.value.trim()) { el.searchResults.classList.add('hidden'); return; }
  if (!results.length) {
    el.searchResults.innerHTML = '<div class="menu-empty">No part matches. Try “piston”, “valve”, or a system name.</div>';
    el.searchResults.classList.remove('hidden');
    return;
  }
  results.forEach((p, i) => {
    const sys = current.systems.find((s) => s.id === p.system);
    const btn = document.createElement('button');
    btn.className = 'menu-item' + (i === 0 ? ' active' : '');
    btn.setAttribute('role', 'option');
    btn.innerHTML = `<span class="mi-dot" style="background:${sys?.color}"></span><span class="mi-main"><span class="mi-name">${escapeHTML(p.name)}</span><span class="mi-sub">${escapeHTML(sys?.name || '')}</span></span>`;
    btn.addEventListener('click', () => pickSearch(p));
    el.searchResults.appendChild(btn);
  });
  el.searchResults.classList.remove('hidden');
}
function pickSearch(p) {
  if (!viewer.systemOn[p.system]) { viewer.setSystemVisible(p.system, true); syncSystemRows(); }
  viewer.select(p.id);
  viewer.focus(p.id);
  el.search.value = '';
  closeMenus();
  el.search.blur();
  document.querySelector('.search').classList.remove('open');
}
el.search.addEventListener('input', renderSearch);
el.search.addEventListener('focus', () => { document.querySelector('.search').classList.add('open'); renderSearch(); });
el.search.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const first = searchParts(el.search.value)[0]; if (first) pickSearch(first); }
  if (e.key === 'Escape') {
    el.search.value = '';
    closeMenus();
    el.search.blur();
    document.querySelector('.search').classList.remove('open');
  }
});
document.querySelector('.search').addEventListener('click', () => {
  document.querySelector('.search').classList.add('open');
  el.search.focus();
});

// ============================================================
// Keyboard shortcuts
// ============================================================
const KEY_ACTIONS = {
  x: () => el.xrayBtn.click(),
  c: () => el.colorBtn.click(),
  s: () => el.sectionBtn.click(),
  e: () => { el.explode.value = viewer.state.explode > 0.05 ? 0 : 0.7; el.explode.dispatchEvent(new Event('input')); },
  f: () => { if (viewer.selected) viewer.focus(viewer.selected.id); },
};
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;

  if (e.key === '/') { e.preventDefault(); el.search.focus(); return; }
  if (e.key === ' ') { e.preventDefault(); setRunning(!viewer.state.running); return; }
  if (e.key === 'Escape') {
    if (!el.about.classList.contains('hidden')) el.about.classList.add('hidden');
    else { viewer.select(null); closeMenus(); }
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    viewer.setRunning(false);
    el.playBtn.classList.remove('on');
    viewer.state.theta += (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 30 : 5) * Math.PI / 180;
    return;
  }
  KEY_ACTIONS[e.key]?.();
});

// ============================================================
// About panel
// ============================================================
function renderAbout() {
  el.aboutBody.innerHTML = `
    <p>Engine-X is an interactive anatomy of engines and heavy machinery. Every part is modeled procedurally in the browser from its engineering dimensions and driven by real kinematics: the crank turns, the pistons follow the slider-crank equation, valves follow their cam lobes, and gear trains turn at their true ratios.</p>
    ${current?.about ? `<h3>${escapeHTML(current.name)}</h3>${current.about}` : ''}
    <h3>Controls</h3>
    <ul>
      <li>Drag to orbit, scroll to zoom, right-drag to pan. Click a part to read what it does and why it looks the way it does.</li>
      <li><kbd>Space</kbd> run / pause · <kbd>←</kbd> <kbd>→</kbd> step the shaft (hold <kbd>Shift</kbd> for 30°)</li>
      <li><kbd>S</kbd> section view · <kbd>X</kbd> x-ray housings · <kbd>C</kbd> colour by system or by material · <kbd>E</kbd> explode · <kbd>F</kbd> focus the selected part · <kbd>/</kbd> search</li>
      <li>Click a system's name to view it alone; click again to restore everything. Parts are coloured by system (the dots in the panel); housings stay neutral so the mechanisms stand out. Press <kbd>C</kbd> for realistic materials instead.</li>
    </ul>
    <h3>Method</h3>
    <p>Geometry is generated with Three.js from parametric descriptions: lathes for turned parts, involute profiles for gears, lofted airfoil sections for blades, tangent-and-arc paths for belts and chains, and epitrochoids for rotary housings. Dimensions follow typical production values and are stated on each part where they matter. Descriptions are written for engineers and curious people alike; treat them as an orientation, not a service manual.</p>
    <p>Inspired by the Human Atlas. Built with Three.js. No external models or textures are loaded.</p>`;
}
el.aboutBtn.addEventListener('click', () => { renderAbout(); el.about.classList.remove('hidden'); });
el.creditsLink.addEventListener('click', (e) => { e.preventDefault(); renderAbout(); el.about.classList.remove('hidden'); });
el.aboutClose.addEventListener('click', () => el.about.classList.add('hidden'));
el.about.addEventListener('click', (e) => { if (e.target === el.about) el.about.classList.add('hidden'); });

// ============================================================
// URL state
// ============================================================
function updateURL() {
  if (!current) return;
  const params = new URLSearchParams();
  params.set('m', current.id);
  if (viewer.selected) params.set('p', viewer.selected.id);
  try { history.replaceState(null, '', '#' + params.toString()); } catch { /* ignore */ }
}
function readURL() {
  const params = new URLSearchParams(location.hash.slice(1));
  return { m: params.get('m'), p: params.get('p') };
}
window.addEventListener('hashchange', () => {
  const target = readURL();
  if (target.m && target.m !== current?.id) { pendingPart = target.p; loadMachine(target.m); }
});

// ============================================================
// Boot
// ============================================================
(function boot() {
  const target = readURL();
  pendingPart = target.p;
  loadMachine(target.m || MACHINES[0].id);
})();

// ============================================================
// Trailer mode (guided autoplay, "watch the trailer")
// ============================================================
(function trailerMode() {
  const params = new URLSearchParams(location.search);
  if (params.get('trailer') !== '1') return;

  let idx = Math.max(0, MACHINES.findIndex((m) => m.id === current?.id));
  let active = true;

  viewer.controls.autoRotate = true;
  viewer.controls.autoRotateSpeed = 1.1;

  const badge = document.createElement('div');
  badge.id = 'trailerBadge';
  badge.innerHTML = `
    <style>
      #trailerBadge{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:9999;
        display:flex;align-items:center;gap:10px;padding:9px 18px;border-radius:999px;
        background:rgba(7,11,20,0.72);backdrop-filter:blur(10px);
        border:1px solid rgba(94,167,255,0.35);
        font:500 11px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.18em;
        color:#8fc4ff;text-transform:uppercase;box-shadow:0 12px 30px -14px rgba(0,0,0,0.6);}
      #trailerBadge .dot{width:6px;height:6px;border-radius:50%;background:#ff5f5f;animation:trailerBlink 1.2s ease-in-out infinite;}
      @keyframes trailerBlink{0%,100%{opacity:1;}50%{opacity:.25;}}
      #trailerBadge .name{color:#eaf1ff;}
      #trailerExit{margin-left:6px;border:1px solid rgba(143,161,188,0.4);background:transparent;
        color:#8fa1bc;font:inherit;letter-spacing:.14em;border-radius:999px;padding:4px 12px;cursor:pointer;}
      #trailerExit:hover{color:#eaf1ff;border-color:#5ea7ff;}
      @media (max-width:640px){ #trailerBadge{ font-size:9.5px; padding:7px 12px; gap:7px; } }
    </style>
    <span class="dot"></span> Trailer · <span class="name" id="trailerName"></span>
    <button id="trailerExit" type="button">Take control</button>
  `;
  document.body.appendChild(badge);
  const nameEl = badge.querySelector('#trailerName');

  function showName() {
    if (nameEl && current) nameEl.textContent = current.name;
  }
  showName();

  function nextMachine() {
    if (!active) return;
    idx = (idx + 1) % MACHINES.length;
    viewer.select(null);
    loadMachine(MACHINES[idx].id).then(() => {
      showName();
      // vary the look each stop, like a trailer cutting between shots
      const wantXray = Math.random() < 0.5;
      viewer.setXray(wantXray);
      el.xrayBtn.classList.toggle('on', wantXray);
      viewer.setView(current.defaultView || 'iso', true);
    });
  }
  const cycleTimer = setInterval(nextMachine, 7000);

  function stop() {
    active = false;
    clearInterval(cycleTimer);
    viewer.controls.autoRotate = false;
    badge.remove();
    try { history.replaceState(null, '', location.pathname + location.hash); } catch { /* ignore */ }
  }
  badge.querySelector('#trailerExit').addEventListener('click', stop);
  // any manual drag/zoom/click on the model hands control back to the visitor
  el.stage.addEventListener('pointerdown', stop, { once: true });
  window.addEventListener('wheel', stop, { once: true, passive: true });
})();
