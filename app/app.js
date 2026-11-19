// Leonida Trophy Guide — tracker logic. Loads the trophy data, renders the
// checklist and roadmap, and keeps earned trophies in localStorage. The app
// makes no network request at run time beyond loading its own data file, and
// the only links it ever shows are the citation links from the data file,
// which open only when the reader follows them.
const STORAGE_KEY = 'gta6-trophy-guide-progress-v1';
const params = new URLSearchParams(window.location.search);

// Demo preview (?demo=1): ticks a sample set of trophies in memory only, for
// screenshots. It never writes to localStorage and never changes real progress.
const DEMO_EARNED = [2, 3, 4, 8, 16, 20, 21, 33, 35, 41, 53, 55];

let trophies = [];
let roadmap = [];
let facts = {};
let earned = new Set(loadStored());
let kindFilter = params.get('filter') || 'all';
let gradeFilter = 'all';
let searchText = '';
let earnedOnly = false;
let spoilerMode = params.get('spoiler') === 'on';
let openId = Number(params.get('open')) || null;

const $ = (id) => document.getElementById(id);
const listEl = $('trophyList');
const factsEl = $('facts');
const roadmapEl = $('roadmapStages');

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

function saveStored() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
    $('savedNote').textContent = 'Progress saved in this browser.';
  } catch {
    $('savedNote').textContent = 'Could not save: this browser blocks local storage.';
  }
}

function gradeLabel(t) {
  return t.grade.charAt(0).toUpperCase() + t.grade.slice(1);
}

function kindLabel(t) {
  if (t.kind === 'story') return 'Story';
  if (t.kind === 'collectibles') return 'Collectibles';
  if (t.kind === 'activities') return 'Activities';
  return t.kind;
}

function isEarned(t) {
  if (params.get('demo') === '1' && DEMO_EARNED.includes(t.id)) return true;
  return earned.has(t.id);
}

function isHiddenFromSpoilers(t) {
  return spoilerMode && t.kind === 'story' && !isEarned(t);
}

function renderFacts() {
  const total = trophies.length;
  const earnedCount = trophies.filter(isEarned).length;
  factsEl.replaceChildren();
  const items = [
    ['55 trophies', `${facts.platinum || 1} platinum · ${facts.gold || 2} gold · ${facts.silver || 6} silver · ${facts.bronze || 46} bronze`],
    ['28 hidden', 'story trophies stay hidden until earned'],
    ['0 online', 'every trophy is single-player'],
    ['~200 hours', 'difficulty 4/10 (PowerPyx)'],
    ['1 playthrough', 'free roam after the story'],
  ];
  for (const [bold, rest] of items) {
    const span = document.createElement('span');
    span.className = 'fact';
    const b = document.createElement('b');
    b.textContent = bold + ' ';
    span.append(b, document.createTextNode(rest));
    factsEl.append(span);
  }
  $('progressText').textContent = `${earnedCount} of ${total} earned`;
  const pct = total ? Math.round((earnedCount / total) * 100) : 0;
  $('progressPct').textContent = `${pct}%`;
  $('progressFill').style.width = `${pct}%`;
  const platinum = trophies.find((t) => t.grade === 'platinum');
  const longRoad = trophies.find((t) => t.name === 'A Long Road');
  const sub = [];
  if (platinum && !isEarned(platinum)) sub.push('Platinum still locked.');
  if (longRoad && isEarned(longRoad)) sub.push('100% completion done — the hard part is behind you.');
  else if (longRoad) sub.push('The gold A Long Road (100% completion) is the hardest step.');
  sub.push('Tick a trophy off and it stays ticked in this browser.');
  $('progressSub').textContent = sub.join(' ');
}

function renderRoadmap() {
  roadmapEl.replaceChildren();
  for (const stage of roadmap) {
    const members = trophies.filter((t) => t.roadmap === stage.stage);
    const done = members.filter(isEarned).length;
    const box = document.createElement('div');
    box.className = 'stage';
    const h = document.createElement('h3');
    h.textContent = stage.title + ' ';
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = '· ' + stage.time;
    h.append(time);
    const p = document.createElement('p');
    p.textContent = stage.text;
    const chips = document.createElement('div');
    chips.className = 'stage-chips';
    for (const t of members) {
      const chip = document.createElement('span');
      chip.className = 'stage-chip' + (isEarned(t) ? ' earned' : '');
      chip.textContent = (isEarned(t) ? '✓ ' : '') + t.name;
      chips.append(chip);
    }
    const prog = document.createElement('p');
    prog.className = 'stage-progress';
    prog.textContent = `${done} of ${members.length} trophies in this stage earned.`;
    box.append(h, p, chips, prog);
    roadmapEl.append(box);
  }
}

function trophyMatches(t) {
  if (kindFilter === 'missable' && !t.missable) return false;
  if (kindFilter === 'online') return false; // no online trophies in GTA VI
  if (kindFilter !== 'all' && kindFilter !== 'missable' && t.kind !== kindFilter) return false;
  if (gradeFilter !== 'all' && t.grade !== gradeFilter) return false;
  if (earnedOnly && !isEarned(t)) return false;
  if (searchText) {
    const hay = `${t.name} ${t.description} ${t.guide} ${kindLabel(t)}`.toLowerCase();
    if (!hay.includes(searchText)) return false;
  }
  return true;
}

function renderList() {
  listEl.replaceChildren();
  const visible = trophies.filter(trophyMatches);
  $('emptyNote').hidden = visible.length > 0;
  const shown = visible.length;
  const earnedShown = visible.filter(isEarned).length;
  $('listNote').textContent = shown === trophies.length
    ? 'All 55 trophies. Tick one off when you earn it; click a trophy to open its guide and sources.'
    : `Showing ${shown} of ${trophies.length} trophies (${earnedShown} earned in this view).`;
  for (const t of visible) {
    const card = document.createElement('article');
    card.className = 'card' + (isEarned(t) ? ' earned' : '') + (t.missable ? ' missable-card' : '');
    card.dataset.trophyId = String(t.id);

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isEarned(t);
    box.setAttribute('aria-label', `Mark ${t.name} as earned`);
    box.addEventListener('change', () => {
      if (box.checked) earned.add(t.id);
      else earned.delete(t.id);
      saveStored();
      renderAll();
    });

    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'card-head';
    const title = document.createElement('h3');
    if (isHiddenFromSpoilers(t)) {
      title.textContent = 'Hidden story trophy — earn it to reveal';
    } else {
      title.textContent = t.name;
    }
    const grade = document.createElement('span');
    grade.className = 'badge ' + t.grade;
    grade.textContent = gradeLabel(t);
    head.append(title, grade);
    if (t.hidden) {
      const hb = document.createElement('span');
      hb.className = 'badge hidden-badge';
      hb.textContent = 'Hidden on PSN';
      head.append(hb);
    }
    if (t.missable) {
      const mb = document.createElement('span');
      mb.className = 'badge missable-badge';
      mb.textContent = 'Potentially missable';
      head.append(mb);
    }
    const kb = document.createElement('span');
    kb.className = 'badge kind-badge';
    kb.textContent = kindLabel(t);
    head.append(kb);
    body.append(head);

    const desc = document.createElement('p');
    if (isHiddenFromSpoilers(t)) {
      desc.className = 'spoiler-note';
      desc.textContent = 'Spoiler-free mode is on. This story trophy’s name and description stay hidden until you tick it as earned.';
    } else {
      desc.className = 'desc';
      desc.textContent = t.description;
    }
    body.append(desc);

    if (!isHiddenFromSpoilers(t)) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'guide-toggle';
      const guideBody = document.createElement('div');
      guideBody.className = 'guide-body';
      const guideP = document.createElement('p');
      guideP.textContent = t.guide;
      guideBody.append(guideP);
      if (Array.isArray(t.steps) && t.steps.length) {
        const ol = document.createElement('ol');
        for (const step of t.steps) {
          const li = document.createElement('li');
          li.textContent = step;
          ol.append(li);
        }
        guideBody.append(ol);
      }
      if (Array.isArray(t.sources) && t.sources.length) {
        const src = document.createElement('p');
        src.className = 'sources';
        const b = document.createElement('b');
        b.textContent = 'Sources: ';
        src.append(b);
        t.sources.forEach((s, i) => {
          if (i > 0) src.append(document.createTextNode(' · '));
          const a = document.createElement('a');
          a.href = s.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = s.name;
          src.append(a);
        });
        guideBody.append(src);
      }
      const open = openId === t.id;
      guideBody.hidden = !open;
      toggle.textContent = open ? 'Hide guide ▲' : 'Show guide — steps and sources ▼';
      toggle.addEventListener('click', () => {
        guideBody.hidden = !guideBody.hidden;
        toggle.textContent = guideBody.hidden ? 'Show guide — steps and sources ▼' : 'Hide guide ▲';
      });
      body.append(toggle, guideBody);
    }
    card.append(box, body);
    listEl.append(card);
  }
}

function renderAll() {
  renderFacts();
  renderRoadmap();
  renderList();
}

function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function init() {
  const response = await fetch('data/trophies.json');
  const doc = await response.json();
  trophies = doc.trophies || [];
  roadmap = doc.roadmap || [];
  facts = doc.facts || {};

  $('spoilerToggle').checked = spoilerMode;
  document.querySelectorAll('#kindFilters .kind-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.kind === kindFilter);
    btn.addEventListener('click', () => {
      kindFilter = btn.dataset.kind;
      document.querySelectorAll('#kindFilters .kind-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderAll();
    });
  });
  $('gradeFilter').addEventListener('change', (e) => {
    gradeFilter = e.target.value;
    renderAll();
  });
  $('search').addEventListener('input', (e) => {
    searchText = e.target.value.trim().toLowerCase();
    renderAll();
  });
  $('spoilerToggle').addEventListener('change', (e) => {
    spoilerMode = e.target.checked;
    renderAll();
  });
  $('earnedOnly').addEventListener('change', (e) => {
    earnedOnly = e.target.checked;
    renderAll();
  });
  $('showMissable').addEventListener('click', () => {
    kindFilter = 'missable';
    document.querySelectorAll('#kindFilters .kind-btn').forEach((b) => b.classList.toggle('active', b.dataset.kind === 'missable'));
    renderAll();
    const first = document.querySelector('.card.missable-card');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('exportBtn').addEventListener('click', () => {
    const payload = {
      game: 'Grand Theft Auto VI',
      exported: new Date().toISOString(),
      earned: [...earned].sort((a, b) => a - b),
    };
    download('gta6-trophy-progress.json', JSON.stringify(payload, null, 2));
  });
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const ids = Array.isArray(parsed) ? parsed : parsed.earned;
      if (!Array.isArray(ids)) throw new Error('bad file');
      const valid = new Set(trophies.map((t) => t.id));
      earned = new Set(ids.filter((n) => valid.has(n)));
      saveStored();
      renderAll();
      $('savedNote').textContent = `Imported ${earned.size} earned trophies.`;
    } catch {
      $('savedNote').textContent = 'Import failed: that file is not a progress export from this guide.';
    }
    e.target.value = '';
  });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Clear all earned trophies in this browser?')) return;
    earned = new Set();
    saveStored();
    renderAll();
  });

  renderAll();
  if (params.get('view') === 'roadmap') {
    $('roadmapSection').scrollIntoView();
  } else if (openId) {
    const card = document.querySelector(`[data-trophy-id="${openId}"]`);
    if (card) card.scrollIntoView({ block: 'center' });
  }
}

init();
