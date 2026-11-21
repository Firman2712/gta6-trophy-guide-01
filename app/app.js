'use strict';
/* Leonida Ledger — GTA VI trophy guide (gta6-trophy-guide-01, round 4)
 * Plain browser JavaScript, no build step, no dependencies.
 * Data: fetch('data/trophies.json'); progress: localStorage 'leonida-ledger-v1'. */
var STORAGE_KEY = 'leonida-ledger-v1';
var DATA_URL = 'data/trophies.json';
var trophies = [];
var earned = new Set();
var expanded = new Set();
var spoilerOn = false;
var loaded = false;

function $(id) { return document.getElementById(id); }
function totalCount() { return trophies.length > 0 ? trophies.length : 55; }
function setStatus(msg) { var s = $('status'); if (s) s.textContent = msg; }
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
function validId(n) { return Number.isInteger(n) && n >= 1 && n <= 55; }
function sortedIds(set) { return Array.from(set).sort(function (a, b) { return a - b; }); }

function saveEarned() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedIds(earned))); }
  catch (e) { setStatus('Could not save progress in this browser.'); }
}
function loadSavedEarned() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === '') return null;
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter(validId));
  } catch (e) { return null; }
}
function isConcealed(t) { return spoilerOn && t.hidden === true && !earned.has(t.id); }
function displayName(t) { return isConcealed(t) ? 'Hidden trophy' : t.name; }
function gradeLabel(g) {
  return g === 'platinum' ? 'Platinum' : g === 'gold' ? 'Gold' :
    g === 'silver' ? 'Silver' : 'Bronze';
}
function kindLabel(k) {
  return k === 'story' ? 'Story' : k === 'collectible' ? 'Collectibles' :
    k === 'activity' ? 'Activity' : k === 'exploration' ? 'Exploration' : 'Misc';
}
function makeBadge(text, cls) { return el('span', 'badge ' + cls, text); }

function makeSourceLinks(t, container) {
  var sources = Array.isArray(t.src) ? t.src : [];
  if (sources.length === 0) return;
  var wrap = el('p', 'trophy-sources');
  wrap.appendChild(el('span', null, 'Sources: '));
  var first = true;
  sources.forEach(function (url) {
    if (typeof url !== 'string' || url === '') return;
    if (!first) wrap.appendChild(document.createTextNode(' · '));
    first = false;
    var a = el('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    try { a.textContent = new URL(url).hostname; } catch (e) { a.textContent = url; }
    wrap.appendChild(a);
  });
  container.appendChild(wrap);
}

function buildCard(t) {
  var concealed = isConcealed(t);
  var isEarned = earned.has(t.id);
  var isOpen = expanded.has(t.id);
  var card = el('article', 'trophy-card' + (isEarned ? ' earned' : '') + (isOpen ? ' open' : ''));
  card.dataset.trophyId = String(t.id);
  // Head: checkbox + name + badges
  var head = el('div', 'trophy-head');
  var checkbox = el('input', 'trophy-check');
  checkbox.type = 'checkbox'; checkbox.checked = isEarned;
  checkbox.setAttribute('aria-label', 'Mark ' + displayName(t) + ' as earned');
  checkbox.addEventListener('click', function (e) { e.stopPropagation(); });
  checkbox.addEventListener('change', function () { toggleEarned(t.id, checkbox.checked); });
  head.appendChild(checkbox);
  var titleWrap = el('div', 'trophy-title-wrap');
  titleWrap.appendChild(el('h3', 'trophy-name', displayName(t)));
  var badges = el('div', 'trophy-badges');
  badges.appendChild(makeBadge(gradeLabel(t.grade), 'badge-grade badge-' + t.grade));
  badges.appendChild(makeBadge(kindLabel(t.kind), 'badge-kind'));
  if (t.hidden === true) badges.appendChild(makeBadge('Hidden', 'badge-hidden'));
  if (t.missable === true) badges.appendChild(makeBadge('Missable', 'badge-missable'));
  if (t.fresh === true) badges.appendChild(makeBadge('Newly confirmed', 'badge-fresh'));
  titleWrap.appendChild(badges);
  head.appendChild(titleWrap);
  card.appendChild(head);
  // Body: desc + target (hidden in spoiler mode until earned)
  var body = el('div', 'trophy-body');
  if (concealed) {
    body.appendChild(el('p', 'trophy-desc', 'Earn it to reveal.'));
  } else {
    if (t.desc) body.appendChild(el('p', 'trophy-desc', t.desc));
    if (t.target) {
      var target = el('p', 'trophy-target');
      target.appendChild(el('strong', null, 'Target: '));
      target.appendChild(document.createTextNode(t.target));
      body.appendChild(target);
    }
  }
  card.appendChild(body);
  // Detail: guide + sources, collapsed by default
  var detail = el('div', 'trophy-detail');
  if (!isOpen) detail.hidden = true;
  if (concealed) {
    detail.appendChild(el('p', 'trophy-guide', 'Earn it to reveal.'));
  } else {
    if (t.guide) {
      var guide = el('p', 'trophy-guide');
      guide.appendChild(el('strong', null, 'Guide: '));
      guide.appendChild(document.createTextNode(t.guide));
      detail.appendChild(guide);
    }
    makeSourceLinks(t, detail);
  }
  card.appendChild(detail);
  // Clicking the card body toggles the detail view; checkbox/links stay inert.
  card.addEventListener('click', function (event) {
    if (event.target === checkbox) return;
    if (event.target.closest && event.target.closest('a, input, button, select, label')) return;
    toggleDetail(t.id);
  });
  return card;
}

function toggleDetail(id) {
  if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
  renderList();
}
function toggleEarned(id, value) {
  if (value) earned.add(id); else earned.delete(id);
  saveEarned(); renderStats(); renderList(); renderRoadmap();
}
function renderStats() {
  var total = totalCount();
  var count = earned.size;
  var pct = total > 0 ? Math.round((count / total) * 100) : 0;
  var countEl = $('earned-count');
  if (countEl) countEl.textContent = count + ' / ' + total;
  var pctEl = $('earned-pct');
  if (pctEl) pctEl.textContent = pct + '%';
  var fill = $('platinum-fill');
  if (fill) { fill.style.width = pct + '%'; fill.setAttribute('aria-valuenow', String(pct)); }
}
function getFiltered() {
  var q = $('q');
  var query = q ? q.value.trim().toLowerCase() : '';
  var grade = $('grade-filter') ? $('grade-filter').value : 'all';
  var kind = $('kind-filter') ? $('kind-filter').value : 'all';
  var freshOnly = $('fresh-toggle') ? $('fresh-toggle').checked : false;
  return trophies.filter(function (t) {
    if (grade !== 'all' && t.grade !== grade) return false;
    if (kind !== 'all' && t.kind !== kind) return false;
    if (freshOnly && t.fresh !== true) return false;
    if (query !== '') {
      var hay = [t.name, t.desc, t.guide, t.target]
        .filter(function (v) { return typeof v === 'string'; }).join(' ').toLowerCase();
      if (hay.indexOf(query) === -1) return false;
    }
    return true;
  });
}
function renderList() {
  var list = $('trophy-list');
  if (!list) return;
  list.textContent = '';
  var filtered = getFiltered();
  if (filtered.length === 0) {
    list.appendChild(el('p', 'empty-state',
      loaded ? 'No trophies match these filters.' : 'Loading trophies…'));
    return;
  }
  filtered.forEach(function (t) { list.appendChild(buildCard(t)); });
}
function stageTrophies(index) {
  if (index === 0) return trophies.filter(function (t) { return t.kind === 'story'; });
  if (index === 1) return trophies.filter(function (t) { return t.kind === 'collectible'; });
  if (index === 2) {
    return trophies.filter(function (t) { return t.kind === 'activity' || t.kind === 'exploration'; });
  }
  // Stage 4: missables, misc, and anything not covered by stages 1-3. A
  // missable trophy in an earlier stage also appears here as a cleanup
  // reminder, so stage counts can overlap on missables.
  var inEarlier = new Set();
  trophies.forEach(function (t) {
    if (t.kind === 'story' || t.kind === 'collectible' ||
        t.kind === 'activity' || t.kind === 'exploration') inEarlier.add(t.id);
  });
  return trophies.filter(function (t) {
    return t.missable === true || t.kind === 'misc' || !inEarlier.has(t.id);
  });
}
function renderRoadmap() {
  var container = $('roadmap-stages');
  if (!container) return;
  container.textContent = '';
  var stages = [
    { name: 'Stage 1 — Story — play through Leonida',
      desc: 'Follow Lucia and Jason through the main story; most story trophies unlock naturally as you finish missions.' },
    { name: 'Stage 2 — Collectibles',
      desc: 'Sweep Leonida for every hidden pickup and set — use the tracker to tick each one off as you find it.' },
    { name: 'Stage 3 — Activities & Exploration',
      desc: 'Try the side activities, minigames and far corners of the map; these reward curiosity, not speed.' },
    { name: 'Stage 4 — Cleanup & Missables',
      desc: 'Mop up anything missable or miscellaneous before the final stretch — check the Missable badges first.' }
  ];
  stages.forEach(function (stage, index) {
    var items = stageTrophies(index);
    var done = items.filter(function (t) { return earned.has(t.id); }).length;
    var section = el('section', 'roadmap-stage');
    section.appendChild(el('h3', null, stage.name));
    section.appendChild(el('p', 'roadmap-desc', stage.desc));
    section.appendChild(el('p', 'roadmap-count', done + ' / ' + items.length + ' earned'));
    var list = el('ul', 'roadmap-list');
    items.forEach(function (t) {
      var li = el('li', earned.has(t.id) ? 'roadmap-done' : '',
        (earned.has(t.id) ? '✓ ' : '○ ') + displayName(t));
      list.appendChild(li);
    });
    section.appendChild(list);
    container.appendChild(section);
  });
}
function renderAll() { renderStats(); renderList(); renderRoadmap(); }

function applyUrlParams() {
  var params = new URLSearchParams(window.location.search);
  var saved = loadSavedEarned();
  if (saved === null) {
    // ?earned= pre-seeds only when localStorage has no saved set.
    var earnedParam = params.get('earned');
    if (earnedParam) {
      var ids = earnedParam.split(',').map(function (s) { return parseInt(s.trim(), 10); })
        .filter(validId);
      if (ids.length > 0) { earned = new Set(ids); saveEarned(); }
    }
  } else {
    earned = saved;
  }
  var view = params.get('view');
  if (view === 'fresh') {
    var freshToggle = $('fresh-toggle');
    if (freshToggle) freshToggle.checked = true;
  }
  if (view === 'spoiler') {
    spoilerOn = true;
    var spoilerToggle = $('spoiler-toggle');
    if (spoilerToggle) spoilerToggle.checked = true;
  }
  if (view === 'roadmap') {
    var roadmap = $('roadmap');
    if (roadmap && roadmap.scrollIntoView) {
      setTimeout(function () { roadmap.scrollIntoView(); }, 0);
    }
  }
  var openId = parseInt(params.get('open') || '', 10);
  if (validId(openId)) expanded.add(openId);
}

function exportProgress() {
  var payload = { earned: sortedIds(earned) };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'leonida-ledger-progress.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  setStatus('Progress exported (' + payload.earned.length + ' trophies earned).');
}
function importProgress(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      if (!Array.isArray(parsed.earned)) throw new Error('missing earned array');
      if (!parsed.earned.every(validId)) throw new Error('earned must be numbers 1-55');
      earned = new Set(parsed.earned);
      saveEarned(); renderAll();
      setStatus('Progress imported (' + earned.size + ' trophies earned).');
    } catch (e) {
      setStatus('Import failed: file must be JSON like {"earned":[1,2,3]} with ids 1-55.');
    }
  };
  reader.onerror = function () { setStatus('Import failed: could not read that file.'); };
  reader.readAsText(file);
}
function wireEvents() {
  var q = $('q');
  if (q) q.addEventListener('input', renderList);
  var gradeFilter = $('grade-filter');
  if (gradeFilter) gradeFilter.addEventListener('change', renderList);
  var kindFilter = $('kind-filter');
  if (kindFilter) kindFilter.addEventListener('change', renderList);
  var freshToggle = $('fresh-toggle');
  if (freshToggle) freshToggle.addEventListener('change', renderList);
  var spoilerToggle = $('spoiler-toggle');
  if (spoilerToggle) {
    spoilerToggle.addEventListener('change', function () {
      spoilerOn = spoilerToggle.checked; renderAll();
    });
  }
  var exportBtn = $('export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportProgress);
  var importBtn = $('import-btn');
  var importFile = $('import-file');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', function () { importFile.click(); });
    importFile.addEventListener('change', function () {
      if (importFile.files && importFile.files.length > 0) importProgress(importFile.files[0]);
      importFile.value = '';
    });
  }
  var resetBtn = $('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (window.confirm('Clear all earned trophies? This cannot be undone.')) {
        earned = new Set(); saveEarned(); renderAll();
        setStatus('Progress cleared. 0 / ' + totalCount() + ' trophies earned.');
      }
    });
  }
}
function init() {
  var saved = loadSavedEarned();
  earned = saved !== null ? saved : new Set();
  spoilerOn = false;
  applyUrlParams();
  wireEvents();
  renderAll();
  setStatus('Loading trophies…');
  fetch(DATA_URL)
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      var list = Array.isArray(data) ? data : data.trophies;
      if (!Array.isArray(list) || list.length === 0) throw new Error('empty trophy list');
      trophies = list.filter(function (t) {
        return t && Number.isInteger(t.id) && typeof t.name === 'string';
      });
      if (trophies.length === 0) throw new Error('no valid trophies');
      loaded = true;
      renderAll();
      setStatus('Loaded ' + trophies.length + ' trophies. ' + earned.size + ' earned.');
    })
    .catch(function (err) {
      loaded = false;
      setStatus('Could not load trophies.json — check your connection and try again. (' + err.message + ')');
      renderList();
    });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
