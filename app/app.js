'use strict';

/* GTA 6 Trophy Guide — app logic.
 * Loads trophy data at runtime from app/data/trophies.json and renders
 * the grid, filters, checklist, roadmap, counters, missables, guide
 * pane and detail pane. No trophy data is hard-coded here.
 */

var DATA_URL = 'app/data/trophies.json';
var DATA_URL_FALLBACK = 'data/trophies.json';
var STORAGE_KEY = 'gta6-trophy-guide-earned-v1';
var SPOILER_KEY = 'gta6-trophy-guide-spoiler-free-v1';
var TOTAL_EXPECTED = 55;

var GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];
var GRADE_LABELS = {
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze'
};

var ROADMAP_STAGES = [
  {
    grade: 'bronze',
    title: 'Stage 1 — Bronze Foundation',
    text: 'Knock out the bronze trophies first: early story beats, introductions and first-time actions. They build momentum and unlock the systems the later stages need.'
  },
  {
    grade: 'silver',
    title: 'Stage 2 — Silver Push',
    text: 'Work through the silver trophies: longer story arcs, side activities and mid-game challenges. Clear these before the endgame so nothing is left behind.'
  },
  {
    grade: 'gold',
    title: 'Stage 3 — Gold Grind',
    text: 'Tackle the gold trophies: the hardest challenges, completions and skill-based goals. Check the missable trophy first — it is the only one that can be locked out.'
  },
  {
    grade: 'platinum',
    title: 'Stage 4 — Platinum Finale',
    text: 'Earn every other trophy to unlock the platinum. Do a final sweep of the checklist, finish any remaining gold goals, and the platinum pops.'
  }
];

var trophies = [];
var earned = new Set();
var selectedName = null;
var spoilerFree = true;
var searchQuery = '';
var gradeFilter = 'all';
var kindFilter = 'all';

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trophyKey(trophy) {
  return trophy && trophy.name ? String(trophy.name) : '';
}

function loadEarned() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    var parsed = JSON.parse(raw);
    var list = Array.isArray(parsed) ? parsed : parsed.earned;
    if (!Array.isArray(list)) return new Set();
    return new Set(list.map(function (name) { return String(name); }));
  } catch (e) {
    return new Set();
  }
}

function saveEarned() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(earned)));
  } catch (e) {
    /* storage unavailable (private mode, etc.) — checklist still works in memory */
  }
}

function loadSpoiler() {
  try {
    var raw = localStorage.getItem(SPOILER_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch (e) {
    return true;
  }
}

function saveSpoiler() {
  try {
    localStorage.setItem(SPOILER_KEY, spoilerFree ? 'true' : 'false');
  } catch (e) {
    /* ignore */
  }
}

function isHidden(trophy) {
  return trophy.hidden === true || trophy.hidden === 'true';
}

function isMissable(trophy) {
  return trophy.missable === true || trophy.missable === 'true';
}

function isEarned(trophy) {
  return earned.has(trophyKey(trophy));
}

function displayName(trophy) {
  if (spoilerFree && isHidden(trophy)) return 'Hidden Trophy';
  return trophy.name || 'Untitled Trophy';
}

function displayDescription(trophy) {
  if (spoilerFree && isHidden(trophy)) {
    return 'Hidden trophy — turn off spoiler-free mode to reveal its name and description.';
  }
  return trophy.description || '';
}

function gradeLabel(grade) {
  var key = String(grade || '').toLowerCase();
  return GRADE_LABELS[key] || (grade ? String(grade) : 'Unknown');
}

function normalizeData(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      if (Array.isArray(data[keys[i]])) return data[keys[i]];
    }
  }
  return [];
}

function applyFilters(list) {
  var q = searchQuery.trim().toLowerCase();
  return list.filter(function (trophy) {
    if (gradeFilter !== 'all' && String(trophy.grade || '').toLowerCase() !== gradeFilter) {
      return false;
    }
    if (kindFilter !== 'all' && String(trophy.kind || '') !== kindFilter) {
      return false;
    }
    if (q && String(trophy.name || '').toLowerCase().indexOf(q) === -1) {
      return false;
    }
    return true;
  });
}

function renderGrid() {
  var grid = $('trophy-grid');
  if (!grid) return;
  var filtered = applyFilters(trophies);

  var countEl = $('trophy-count');
  if (countEl) {
    countEl.textContent = 'Showing ' + filtered.length + ' of ' + trophies.length +
      ' trophies · ' + earned.size + ' earned';
  }

  if (!trophies.length) {
    grid.innerHTML = '<p>Loading trophies…</p>';
    return;
  }
  if (!filtered.length) {
    grid.innerHTML = '<p>No trophies match your search and filters.</p>';
    return;
  }

  var html = filtered.map(function (trophy) {
    var key = trophyKey(trophy);
    var done = isEarned(trophy);
    var hidden = isHidden(trophy);
    var missable = isMissable(trophy);
    var classes = 'trophy-card grade-' + escapeHtml(String(trophy.grade || '').toLowerCase());
    if (done) classes += ' is-earned';
    if (hidden) classes += ' is-hidden';
    if (missable) classes += ' is-missable';
    var selected = selectedName === key ? ' aria-selected="true"' : '';
    return '<article class="' + classes + '" data-name="' + escapeHtml(key) +
      '" tabindex="0" role="button" aria-pressed="' + done + '"' + selected + '>' +
      '<div class="trophy-card-top">' +
        '<span class="grade-badge grade-' + escapeHtml(String(trophy.grade || '').toLowerCase()) + '">' +
          escapeHtml(gradeLabel(trophy.grade)) + '</span>' +
        (hidden ? '<span class="hidden-badge">Hidden</span>' : '') +
        (missable ? '<span class="missable-badge">Missable</span>' : '') +
        '<span class="earned-mark" aria-hidden="true">' + (done ? '✓ Earned' : '○ Not earned') + '</span>' +
      '</div>' +
      '<h3>' + escapeHtml(displayName(trophy)) + '</h3>' +
      '<p>' + escapeHtml(displayDescription(trophy)) + '</p>' +
      '<div class="trophy-card-meta"><span>' + escapeHtml(trophy.kind || '') + '</span></div>' +
      '</article>';
  }).join('');

  grid.innerHTML = html;

  var cards = grid.querySelectorAll('.trophy-card');
  Array.prototype.forEach.call(cards, function (card) {
    card.addEventListener('click', function () {
      var name = card.getAttribute('data-name');
      var trophy = trophies.find(function (t) { return trophyKey(t) === name; });
      if (!trophy) return;
      selectTrophy(trophy);
      toggleEarned(trophy);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.click();
      }
    });
  });
}

function renderProgress() {
  var total = trophies.length || TOTAL_EXPECTED;
  var done = earned.size;
  var pct = total ? Math.round((done / total) * 100) : 0;

  var bar = $('progress-bar');
  if (bar) {
    bar.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
  }
  var text = $('progress-text');
  if (text) {
    text.textContent = done + ' / ' + total + ' earned (' + pct + '%)';
  }
}

function renderGradeCounters() {
  var el = $('grade-counters');
  if (!el) return;
  var html = GRADE_ORDER.map(function (grade) {
    var inGrade = trophies.filter(function (t) {
      return String(t.grade || '').toLowerCase() === grade;
    });
    var done = inGrade.filter(isEarned).length;
    return '<div class="grade-counter grade-' + grade + '">' +
      '<span class="grade-counter-label">' + GRADE_LABELS[grade] + '</span>' +
      '<span class="grade-counter-value">' + done + ' / ' + inGrade.length + '</span>' +
      '</div>';
  }).join('');
  el.innerHTML = html;
}

function renderRoadmap() {
  var el = $('roadmap');
  if (!el) return;
  var html = ROADMAP_STAGES.map(function (stage, index) {
    var inGrade = trophies.filter(function (t) {
      return String(t.grade || '').toLowerCase() === stage.grade;
    });
    var done = inGrade.filter(isEarned).length;
    var pct = inGrade.length ? Math.round((done / inGrade.length) * 100) : 0;
    var names = inGrade.map(function (t) {
      return '<li' + (isEarned(t) ? ' class="is-earned"' : '') + '>' +
        escapeHtml(displayName(t)) + '</li>';
    }).join('');
    return '<section class="roadmap-stage" data-stage="' + (index + 1) + '">' +
      '<h3>' + escapeHtml(stage.title) + '</h3>' +
      '<p>' + escapeHtml(stage.text) + '</p>' +
      '<p class="roadmap-stage-progress">' + done + ' / ' + inGrade.length +
        ' earned (' + pct + '%)</p>' +
      '<div class="roadmap-stage-bar"><span style="width:' + pct + '%"></span></div>' +
      (names ? '<ul>' + names + '</ul>' : '<p>No trophies in this grade.</p>') +
      '</section>';
  }).join('');
  el.innerHTML = html;
}

function renderMissables() {
  var el = $('missables');
  if (!el) return;
  var missable = trophies.filter(isMissable);
  if (!trophies.length) {
    el.innerHTML = '<p>Loading…</p>';
    return;
  }
  if (!missable.length) {
    el.innerHTML = '<p>No missable trophies in this guide.</p>';
    return;
  }
  var html = '<p class="missables-warning">Do these before the point of no return — ' +
    'they cannot be earned afterwards without a new playthrough or an earlier save.</p>' +
    missable.map(function (trophy) {
      return '<article class="missable-card">' +
        '<h3>' + escapeHtml(displayName(trophy)) + '</h3>' +
        '<p>' + escapeHtml(displayDescription(trophy)) + '</p>' +
        '<p><span class="grade-badge grade-' +
          escapeHtml(String(trophy.grade || '').toLowerCase()) + '">' +
          escapeHtml(gradeLabel(trophy.grade)) + '</span> ' +
          '<span>' + escapeHtml(trophy.kind || '') + '</span> ' +
          '<span>' + (isEarned(trophy) ? '✓ Earned' : '○ Not earned yet') + '</span></p>' +
        '</article>';
    }).join('');
  el.innerHTML = html;
}

function renderGuide() {
  var el = $('guide-pane');
  if (!el) return;
  var trophy = trophies.find(function (t) { return trophyKey(t) === selectedName; });
  if (!trophy) {
    el.innerHTML = '<p>Select a trophy from the grid to see its step-by-step guide and sources.</p>';
    return;
  }
  if (spoilerFree && isHidden(trophy)) {
    el.innerHTML = '<h3>Hidden Trophy</h3>' +
      '<p>This trophy is hidden. Turn off spoiler-free mode to reveal its steps and sources.</p>';
    return;
  }
  var steps = Array.isArray(trophy.steps) ? trophy.steps : (Array.isArray(trophy.guide) ? trophy.guide : (trophy.guide && typeof trophy.guide === 'object' ? Object.values(trophy.guide) : []));
  var sources = Array.isArray(trophy.sources) ? trophy.sources : [];
  var stepsHtml = steps.length
    ? '<ol>' + steps.map(function (step) {
        return '<li>' + escapeHtml(step) + '</li>';
      }).join('') + '</ol>'
    : '<p>No steps listed for this trophy.</p>';
  var sourcesHtml = sources.length
    ? '<ul>' + sources.map(function (url) {
        return '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(url) + '</a></li>';
      }).join('') + '</ul>'
    : '<p>No sources listed for this trophy.</p>';
  el.innerHTML = '<h3>' + escapeHtml(trophy.name || '') + '</h3>' +
    '<h4>Steps</h4>' + stepsHtml +
    '<h4>Sources</h4>' + sourcesHtml;
}

function renderDetail() {
  var el = $('trophy-detail');
  if (!el) return;
  var trophy = trophies.find(function (t) { return trophyKey(t) === selectedName; });
  if (!trophy) {
    el.innerHTML = '<p>Select a trophy from the grid to see its details.</p>';
    return;
  }
  var steps = Array.isArray(trophy.steps) ? trophy.steps : (Array.isArray(trophy.guide) ? trophy.guide : (trophy.guide && typeof trophy.guide === 'object' ? Object.values(trophy.guide) : []));
  var sources = Array.isArray(trophy.sources) ? trophy.sources : [];
  el.innerHTML =
    '<h3>' + escapeHtml(displayName(trophy)) + '</h3>' +
    '<p>' +
      '<span class="grade-badge grade-' + escapeHtml(String(trophy.grade || '').toLowerCase()) + '">' +
        escapeHtml(gradeLabel(trophy.grade)) + '</span> ' +
      '<span>' + escapeHtml(trophy.kind || '') + '</span> ' +
      (isHidden(trophy) ? '<span class="hidden-badge">Hidden</span> ' : '') +
      (isMissable(trophy) ? '<span class="missable-badge">Missable</span> ' : '') +
    '</p>' +
    '<p>' + escapeHtml(displayDescription(trophy)) + '</p>' +
    '<p>Status: ' + (isEarned(trophy) ? '✓ Earned' : '○ Not earned yet') + '</p>' +
    '<p>' + steps.length + ' step(s) · ' + sources.length + ' source(s)</p>' +
    '<button type="button" data-action="toggle-earned">' +
      (isEarned(trophy) ? 'Mark as not earned' : 'Mark as earned') +
    '</button>';

  var btn = el.querySelector('[data-action="toggle-earned"]');
  if (btn) {
    btn.addEventListener('click', function () {
      toggleEarned(trophy);
    });
  }
}

function renderAll() {
  renderGrid();
  renderProgress();
  renderGradeCounters();
  renderRoadmap();
  renderMissables();
  renderGuide();
  renderDetail();
}

function selectTrophy(trophy) {
  selectedName = trophyKey(trophy);
  renderGuide();
  renderDetail();
  renderGrid();
}

function toggleEarned(trophy) {
  var key = trophyKey(trophy);
  if (!key) return;
  if (earned.has(key)) {
    earned.delete(key);
  } else {
    earned.add(key);
  }
  saveEarned();
  renderAll();
}

function buildKindFilter() {
  var select = $('kind-filter');
  if (!select) return;
  var kinds = [];
  trophies.forEach(function (trophy) {
    var kind = String(trophy.kind || '').trim();
    if (kind && kinds.indexOf(kind) === -1) kinds.push(kind);
  });
  kinds.sort();
  var current = kindFilter;
  select.innerHTML = '<option value="all">All kinds</option>' +
    kinds.map(function (kind) {
      return '<option value="' + escapeHtml(kind) + '"' +
        (kind === current ? ' selected' : '') + '>' + escapeHtml(kind) + '</option>';
    }).join('');
  if (kinds.indexOf(current) === -1) kindFilter = 'all';
  select.value = kindFilter;
}

function exportChecklist() {
  var payload = {
    game: 'GTA 6',
    exportedAt: new Date().toISOString(),
    total: trophies.length || TOTAL_EXPECTED,
    earnedCount: earned.size,
    earned: Array.from(earned).sort()
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'gta6-trophy-checklist.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function importChecklist(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var parsed = JSON.parse(String(reader.result));
      var list = null;
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && Array.isArray(parsed.earned)) {
        list = parsed.earned;
      } else if (parsed && Array.isArray(parsed.checklist)) {
        list = parsed.checklist;
      }
      if (!list) {
        alert('Could not import: the file does not contain a checklist array.');
        return;
      }
      var known = new Set(trophies.map(trophyKey));
      var next = new Set();
      list.forEach(function (name) {
        var key = String(name);
        if (!trophies.length || known.has(key)) next.add(key);
      });
      earned = next;
      saveEarned();
      renderAll();
      alert('Imported ' + earned.size + ' earned trophies.');
    } catch (e) {
      alert('Could not import: invalid JSON file.');
    }
  };
  reader.readAsText(file);
}

function resetChecklist() {
  if (!window.confirm('Reset the checklist? All earned trophies will be marked as not earned.')) {
    return;
  }
  earned = new Set();
  saveEarned();
  renderAll();
}

function bindControls() {
  var search = $('search');
  if (search) {
    search.addEventListener('input', function () {
      searchQuery = search.value;
      renderGrid();
    });
  }

  var gradeFilterEl = $('grade-filter');
  if (gradeFilterEl) {
    gradeFilterEl.addEventListener('change', function () {
      gradeFilter = gradeFilterEl.value;
      renderGrid();
    });
  }

  var kindFilterEl = $('kind-filter');
  if (kindFilterEl) {
    kindFilterEl.addEventListener('change', function () {
      kindFilter = kindFilterEl.value;
      renderGrid();
    });
  }

  var spoilerToggle = $('spoiler-toggle');
  if (spoilerToggle) {
    spoilerToggle.checked = spoilerFree;
    spoilerToggle.addEventListener('change', function () {
      spoilerFree = spoilerToggle.checked;
      saveSpoiler();
      renderAll();
    });
  }

  var exportBtn = $('export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportChecklist);

  var importBtn = $('import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) importChecklist(input.files[0]);
        if (input.parentNode) input.parentNode.removeChild(input);
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  var resetBtn = $('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetChecklist);
}

function loadData() {
  return fetch(DATA_URL)
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .catch(function () {
      return fetch(DATA_URL_FALLBACK).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      });
    })
    .then(function (data) {
      trophies = normalizeData(data);
      buildKindFilter();
      renderAll();
    })
    .catch(function () {
      var grid = $('trophy-grid');
      if (grid) {
        grid.innerHTML = '<p>Could not load the trophy data. Please check your connection and reload the page.</p>';
      }
    });
}

function init() {
  earned = loadEarned();
  spoilerFree = loadSpoiler();
  bindControls();
  renderAll();
  loadData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
