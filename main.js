import { Viewer } from './viewer.js';
import { MACHINES } from './machines/index.js';

const $ = id => document.getElementById(id);
const el = {
  stage: $('stage'), machineBtn: $('machineBtn'), machineName: $('machineName'), machineMenu: $('machineMenu'), pieceCount: $('pieceCount'), machineSub: $('machineSub'),
  search: $('search'), searchResults: $('searchResults'), themeBtn: $('themeBtn'), aboutBtn: $('aboutBtn'),
  systemsPanel: $('systemsPanel'), systemCount: $('systemCount'), systemsCollapse: $('systemsCollapse'), systemTabs: $('systemTabs'), systemList: $('systemList'), visibleCount: $('visibleCount'), toggleAll: $('toggleAll'),
  infoPanel: $('infoPanel'), infoSystem: $('infoSystem'), infoSystemName: $('infoSystemName'), infoClose: $('infoClose'), infoName: $('infoName'), infoDesc: $('infoDesc'), infoBlock: $('infoBlock'), infoNotes: $('infoNotes'), isolateBtn: $('isolateBtn'), focusBtn: $('focusBtn'), clearBtn: $('clearBtn'),
  viewRail: $('viewRail'), sectionBtn: $('sectionBtn'), xrayBtn: $('xrayBtn'), colorBtn: $('colorBtn'), resetView: $('resetView'), sectionCtl: $('sectionCtl'), sectionAxis: $('sectionAxis'), sectionPos: $('sectionPos'), sectionFlip: $('sectionFlip'),
  playBtn: $('playBtn'), driveLabel: $('driveLabel'), rpmReadout: $('rpmReadout'), rpmUnit: $('rpmUnit'), angleReadout: $('angleReadout'), speed: $('speed'), speedNote: $('speedNote'), cycleStrip: $('cycleStrip'),
  explode: $('explode'), explodeReadout: $('explodeReadout'), assembleBtn: $('assembleBtn'),
  loader: $('loader'), loaderTitle: $('loaderTitle'), loaderSub: $('loaderSub'), loaderBar: $('loaderBar'), tooltip: $('tooltip'),
  about: $('about'), aboutClose: $('aboutClose'), aboutBody: $('aboutBody'), creditsLink: $('creditsLink'), hint: $('hint'),
};
const fmt = n => n.toLocaleString('en-US');
let current = null; let tab = 'all'; let cycleSpans = []; let lastCycle = -1;

// ---------- theme ----------
const root = document.documentElement;
function isDark() {
  const t = root.getAttribute('data-theme');
  if (t) return t === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme() { viewer.setTheme(isDark()); document.querySelector('meta[name=theme-color]')?.setAttribute('content', isDark() ? '#14171b' : '#eceef1'); }
try { const saved = localStorage.getItem('atlas-theme'); if (saved) root.setAttribute('data-theme', saved); } catch {}
el.themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', next);
  try { localStorage.setItem('atlas-theme', next); } catch {}
  applyTheme();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------- viewer ----------
const viewer = new Viewer(el.stage, {
  onProgress(p, label) {
    el.loaderBar.style.width = `${Math.round(p * 100)}%`;
    el.loaderSub.textContent = `${Math.round(p * 100)}% · ${label || 'preparing'}`;
  },
  onLoaded(def) {
    el.loader.classList.add('fade'); setTimeout(() => el.loader.classList.add('hidden'), 400);
    el.pieceCount.textContent = `${fmt(viewer.pieceCount())} modeled pieces`;
    renderSystems(); updateVisibleCount(); updateURL();
    const wanted = pendingPart; pendingPart = null;
    if (wanted && viewer.parts.has(wanted)) { viewer.select(wanted); viewer.focus(wanted); }
  },
  onHover(part, xy) {
    if (!part || !xy) { el.tooltip.classList.add('hidden'); return; }
    const sys = current.systems.find(s => s.id === part.system);
    el.tooltip.innerHTML = `${escapeHTML(part.name)}<small>${escapeHTML(sys?.name || '')}</small>`;
    el.tooltip.style.left = `${xy.x}px`; el.tooltip.style.top = `${xy.y}px`; el.tooltip.classList.remove('hidden');
  },
  onSelect(part) { renderInfo(part); updateURL(); },
  onVisibility() { updateVisibleCount(); },
  onFrame(st) {
    const deg = (st.theta * 180 / Math.PI);
    const period = current?.cycle ? 720 : 360;
    el.angleReadout.textContent = Math.floor(((deg % period) + period) % period);
    if (current?.cycle) {
      const c = current.cycle(st.theta);
      if (c && c.active !== lastCycle) { lastCycle = c.active; cycleSpans.forEach((s, i) => s.classList.toggle('on', i === c.active)); el.cycleStrip.style.setProperty('--cyc', c.color || 'var(--ink)'); }
    }
  },
});
applyTheme();
window.atlas = { viewer, get machine() { return current; } };
window.addEventListener('error', e => { console.error('ATLAS', (performance.now()|0) + 'ms', e.message, e.error && e.error.stack); });
function escapeHTML(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- machine switching ----------
let pendingPart = null;
function renderMachineMenu() {
  el.machineMenu.innerHTML = '';
  for (const m of MACHINES) {
    const b = document.createElement('button'); b.className = 'menu-item' + (current?.id === m.id ? ' current' : ''); b.setAttribute('role', 'option');
    b.innerHTML = `<span class="mi-dot" style="background:${m.color}"></span><span class="mi-main"><span class="mi-name">${escapeHTML(m.name)}</span><span class="mi-sub">${escapeHTML(m.sub)}</span></span><span class="mi-count">${m.pieces ? '~' + fmt(m.pieces) : ''}</span>`;
    b.addEventListener('click', () => { closeMenus(); if (current?.id !== m.id) loadMachine(m.id); });
    el.machineMenu.appendChild(b);
  }
}
async function loadMachine(id) {
  const def = MACHINES.find(m => m.id === id) || MACHINES[0];
  current = def; lastCycle = -1;
  el.loader.classList.remove('hidden', 'fade'); el.loaderBar.style.width = '0%';
  el.loaderTitle.textContent = `Machining ${def.shortName || def.name}`; el.loaderSub.textContent = '0% · preparing';
  el.machineName.textContent = def.name; el.machineSub.textContent = def.sub; document.title = `${def.name} · Machine Atlas`;
  el.driveLabel.textContent = def.drive?.label || 'Drive';
  // cycle strip
  el.cycleStrip.innerHTML = ''; cycleSpans = [];
  if (def.cycle) {
    const c = def.cycle(0);
    const t = document.createElement('span'); t.className = 'cycle-title'; t.textContent = c.title || 'Cycle'; el.cycleStrip.appendChild(t);
    for (const lab of c.labels) { const s = document.createElement('span'); s.textContent = lab; el.cycleStrip.appendChild(s); cycleSpans.push(s); }
    el.cycleStrip.classList.remove('hidden');
  } else el.cycleStrip.classList.add('hidden');
  // machine modes (gear selection, scenarios)
  const modeStrip = $('modeStrip'), modeButtons = $('modeButtons');
  modeButtons.innerHTML = '';
  if (def.modes) {
    $('modeLabel').textContent = def.modes.label;
    viewer.state.mode = def.modes.default ?? 0;
    def.modes.options.forEach((opt, i) => { const b = document.createElement('button'); b.textContent = opt; b.classList.toggle('on', i === viewer.state.mode); b.addEventListener('click', () => { viewer.state.mode = i; modeButtons.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j === i)); }); modeButtons.appendChild(b); });
    modeStrip.classList.remove('hidden');
  } else modeStrip.classList.add('hidden');
  renderInfo(null); renderMachineMenu();
  el.explode.value = 0; el.explodeReadout.textContent = '0'; viewer.setExplode(0);
  el.sectionBtn.classList.remove('on'); el.xrayBtn.classList.remove('on'); el.sectionCtl.classList.add('hidden');
  el.sectionPos.value = def.sectionDefault ?? 0; el.sectionAxis.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.axis === (def.sectionAxis || 'x')));
  el.viewRail.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === (def.defaultView || 'iso')));
  el.hint.textContent = def.hint || 'Drag to orbit · Scroll to zoom · Click a part to inspect';
  await viewer.loadMachine(def);
  setSpeedFromSlider();
  if (def.autoRun !== false) setRunning(true);
}
el.machineBtn.addEventListener('click', e => { e.stopPropagation(); const open = el.machineMenu.classList.toggle('hidden'); el.machineBtn.setAttribute('aria-expanded', String(!open)); el.searchResults.classList.add('hidden'); });
function closeMenus() { el.machineMenu.classList.add('hidden'); el.searchResults.classList.add('hidden'); el.machineBtn.setAttribute('aria-expanded', 'false'); }
document.addEventListener('click', e => { if (!e.target.closest('.menu') && !e.target.closest('.search') && !e.target.closest('#machineBtn')) closeMenus(); });

// ---------- systems panel ----------
function renderSystems() {
  el.systemList.innerHTML = '';
  const systems = current.systems.filter(s => tab === 'all' || (tab === 'moving' ? s.kind === 'moving' : s.kind !== 'moving'));
  el.systemCount.textContent = current.systems.length;
  for (const s of systems) {
    const li = document.createElement('li'); li.className = 'system-row' + (viewer.systemOn[s.id] ? '' : ' off'); li.dataset.id = s.id;
    li.innerHTML = `<span class="sys-dot" style="background:${s.color}"></span><button class="sys-name" title="${escapeHTML(s.blurb || '')}">${escapeHTML(s.name)}</button><span class="sys-count">${fmt(viewer.countBySystem(s.id))}</span><button class="switch ${viewer.systemOn[s.id] ? 'on' : ''}" role="switch" aria-checked="${!!viewer.systemOn[s.id]}" aria-label="Show ${escapeHTML(s.name)}" style="--sw-on:${s.color}"></button>`;
    li.querySelector('.switch').addEventListener('click', () => { viewer.setSystemVisible(s.id, !viewer.systemOn[s.id]); syncSystemRows(); });
    li.querySelector('.sys-name').addEventListener('click', () => { // solo this system (click again to restore all)
      const others = current.systems.filter(o => o.id !== s.id);
      const soloed = viewer.systemOn[s.id] && others.every(o => !viewer.systemOn[o.id]);
      viewer.setAllSystems(soloed); if (!soloed) viewer.setSystemVisible(s.id, true); syncSystemRows();
    });
    el.systemList.appendChild(li);
  }
  syncSystemRows();
}
function syncSystemRows() {
  el.systemList.querySelectorAll('.system-row').forEach(li => { const on = !!viewer.systemOn[li.dataset.id]; li.classList.toggle('off', !on); const sw = li.querySelector('.switch'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); });
  const anyOn = current.systems.some(s => viewer.systemOn[s.id]);
  el.toggleAll.textContent = anyOn ? 'Hide all' : 'Show all';
  updateVisibleCount();
}
function updateVisibleCount() { if (current) el.visibleCount.textContent = `${fmt(viewer.countVisible())} pieces visible`; }
el.toggleAll.addEventListener('click', () => { const anyOn = current.systems.some(s => viewer.systemOn[s.id]); viewer.setAllSystems(!anyOn); syncSystemRows(); });
el.systemTabs.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; el.systemTabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); renderSystems(); });
el.systemsCollapse.addEventListener('click', () => el.systemsPanel.classList.toggle('collapsed'));
if (window.innerWidth < 680) el.systemsPanel.classList.add('collapsed');

// ---------- inspector ----------
function renderInfo(part) {
  if (!part) { el.infoPanel.classList.add('hidden'); el.isolateBtn.classList.remove('on'); return; }
  const sys = current.systems.find(s => s.id === part.system);
  el.infoSystemName.textContent = sys?.name || ''; el.infoSystem.querySelector('.chip-dot').style.background = sys?.color || 'var(--accent)';
  el.infoName.textContent = part.name; el.infoDesc.textContent = part.desc || sys?.blurb || '';
  el.infoBlock.innerHTML = '';
  const rows = Object.entries(part.block || {});
  if (part.count > 1 && !part.block.qty) rows.push(['qty', `${part.count} in this part`]);
  if (rows.length) { for (const [k, v] of rows) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; el.infoBlock.append(dt, dd); } el.infoBlock.classList.remove('hidden'); }
  else el.infoBlock.classList.add('hidden');
  el.infoNotes.innerHTML = ''; for (const n of part.notes || []) { const li = document.createElement('li'); li.textContent = n; el.infoNotes.appendChild(li); }
  el.infoNotes.classList.toggle('hidden', !(part.notes && part.notes.length));
  el.isolateBtn.classList.toggle('on', viewer.isolated === part.id); el.isolateBtn.textContent = viewer.isolated === part.id ? 'Show everything' : 'Isolate part';
  el.infoPanel.classList.remove('hidden'); el.infoPanel.scrollTop = 0;
}
el.infoClose.addEventListener('click', () => viewer.select(null));
el.clearBtn.addEventListener('click', () => viewer.select(null));
el.isolateBtn.addEventListener('click', () => { if (!viewer.selected) return; const iso = viewer.isolate(viewer.selected.id); el.isolateBtn.classList.toggle('on', !!iso); el.isolateBtn.textContent = iso ? 'Show everything' : 'Isolate part'; if (iso) viewer.focus(iso); });
el.focusBtn.addEventListener('click', () => viewer.selected && viewer.focus(viewer.selected.id));

// ---------- rail ----------
el.viewRail.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { viewer.setView(b.dataset.view, true); el.viewRail.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === b)); }));
el.resetView.addEventListener('click', () => { viewer.setView(current.defaultView || 'iso', true); viewer.select(null); viewer.setExplode(0); el.explode.value = 0; el.explodeReadout.textContent = '0'; viewer.setAllSystems(true); syncSystemRows(); });
el.sectionBtn.addEventListener('click', () => { const on = !viewer.section.on; viewer.setSection(on); el.sectionBtn.classList.toggle('on', on); el.sectionCtl.classList.toggle('hidden', !on); });
el.xrayBtn.addEventListener('click', () => { const on = !viewer.xray; viewer.setXray(on); el.xrayBtn.classList.toggle('on', on); });
function setColorMode(mode) { viewer.setColorMode(mode); el.colorBtn.classList.toggle('on', mode === 'system'); try { localStorage.setItem('atlas-colors', mode); } catch {} }
el.colorBtn.addEventListener('click', () => setColorMode(viewer.colorMode === 'system' ? 'material' : 'system'));
try { const savedColors = localStorage.getItem('atlas-colors'); if (savedColors === 'material') { viewer.colorMode = 'material'; el.colorBtn.classList.remove('on'); } } catch {}
el.sectionAxis.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; viewer.setSectionAxis(b.dataset.axis); el.sectionAxis.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
el.sectionPos.addEventListener('input', () => viewer.setSectionPos(parseFloat(el.sectionPos.value)));
el.sectionFlip.addEventListener('click', () => viewer.flipSection());

// ---------- console ----------
function setRunning(on) { viewer.setRunning(on); el.playBtn.classList.toggle('on', on); el.playBtn.setAttribute('aria-label', on ? 'Pause the machine' : 'Run the machine'); }
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
el.explode.addEventListener('input', () => { const k = parseFloat(el.explode.value); viewer.setExplode(k); el.explodeReadout.textContent = Math.round(k * 100); });
el.assembleBtn.addEventListener('click', () => { el.explode.value = 0; viewer.setExplode(0); el.explodeReadout.textContent = '0'; });

// ---------- search ----------
function searchParts(q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const terms = q.split(/\s+/);
  const out = [];
  for (const p of viewer.order) {
    const sys = current.systems.find(s => s.id === p.system);
    const hay = `${p.name} ${sys?.name || ''}`.toLowerCase();
    if (terms.every(t => hay.includes(t))) out.push(p);
    if (out.length >= 14) break;
  }
  return out;
}
function renderSearch() {
  const res = searchParts(el.search.value);
  el.searchResults.innerHTML = '';
  if (!el.search.value.trim()) { el.searchResults.classList.add('hidden'); return; }
  if (!res.length) { el.searchResults.innerHTML = '<div class="menu-empty">No part matches. Try “piston”, “valve”, or a system name.</div>'; el.searchResults.classList.remove('hidden'); return; }
  res.forEach((p, i) => {
    const sys = current.systems.find(s => s.id === p.system);
    const b = document.createElement('button'); b.className = 'menu-item' + (i === 0 ? ' active' : ''); b.setAttribute('role', 'option');
    b.innerHTML = `<span class="mi-dot" style="background:${sys?.color}"></span><span class="mi-main"><span class="mi-name">${escapeHTML(p.name)}</span><span class="mi-sub">${escapeHTML(sys?.name || '')}</span></span>`;
    b.addEventListener('click', () => pickSearch(p));
    el.searchResults.appendChild(b);
  });
  el.searchResults.classList.remove('hidden');
}
function pickSearch(p) {
  if (!viewer.systemOn[p.system]) { viewer.setSystemVisible(p.system, true); syncSystemRows(); }
  viewer.select(p.id); viewer.focus(p.id); el.search.value = ''; closeMenus(); el.search.blur();
  document.querySelector('.search').classList.remove('open');
}
el.search.addEventListener('input', renderSearch);
el.search.addEventListener('focus', () => { document.querySelector('.search').classList.add('open'); renderSearch(); });
el.search.addEventListener('keydown', e => {
  if (e.key === 'Enter') { const first = searchParts(el.search.value)[0]; if (first) pickSearch(first); }
  if (e.key === 'Escape') { el.search.value = ''; closeMenus(); el.search.blur(); document.querySelector('.search').classList.remove('open'); }
});
document.querySelector('.search').addEventListener('click', () => { document.querySelector('.search').classList.add('open'); el.search.focus(); });

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === '/') { e.preventDefault(); el.search.focus(); }
  else if (e.key === ' ') { e.preventDefault(); setRunning(!viewer.state.running); }
  else if (e.key === 'Escape') { if (!el.about.classList.contains('hidden')) el.about.classList.add('hidden'); else { viewer.select(null); closeMenus(); } }
  else if (e.key === 'x') el.xrayBtn.click();
  else if (e.key === 'c') el.colorBtn.click();
  else if (e.key === 's') el.sectionBtn.click();
  else if (e.key === 'e') { el.explode.value = viewer.state.explode > 0.05 ? 0 : 0.7; el.explode.dispatchEvent(new Event('input')); }
  else if (e.key === 'f' && viewer.selected) viewer.focus(viewer.selected.id);
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { viewer.setRunning(false); el.playBtn.classList.remove('on'); viewer.state.theta += (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 30 : 5) * Math.PI / 180; }
});

// ---------- about ----------
function renderAbout() {
  el.aboutBody.innerHTML = `
    <p>Machine Atlas is an interactive anatomy of engines and heavy machinery. Every part is modeled procedurally in the browser from its engineering dimensions and driven by real kinematics: the crank turns, the pistons follow the slider-crank equation, valves follow their cam lobes, and gear trains turn at their true ratios.</p>
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
el.creditsLink.addEventListener('click', e => { e.preventDefault(); renderAbout(); el.about.classList.remove('hidden'); });
el.aboutClose.addEventListener('click', () => el.about.classList.add('hidden'));
el.about.addEventListener('click', e => { if (e.target === el.about) el.about.classList.add('hidden'); });

// ---------- URL state ----------
function updateURL() {
  if (!current) return;
  const p = new URLSearchParams(); p.set('m', current.id); if (viewer.selected) p.set('p', viewer.selected.id);
  try { history.replaceState(null, '', '#' + p.toString()); } catch {}
}
function readURL() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { m: p.get('m'), p: p.get('p') };
}
window.addEventListener('hashchange', () => { const u = readURL(); if (u.m && u.m !== current?.id) { pendingPart = u.p; loadMachine(u.m); } });

// ---------- boot ----------
const u = readURL(); pendingPart = u.p;
loadMachine(u.m || MACHINES[0].id);
