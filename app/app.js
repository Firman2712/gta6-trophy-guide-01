// Leonida Ledger — offline GTA 6 trophy tracker.
// Loads data/trophies.json, renders the checklist, and keeps progress in
// localStorage. No network request is ever made at run time: the source
// links below open only when the reader follows them.

const DATA_URL = "data/trophies.json";
const STORE_KEY = "leonida-ledger-v3";

const SOURCE_BOOK = {
  pyx: { label: "PowerPyx — GTA 6 Trophy Guide & Roadmap", url: "https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/" },
  exo: { label: "Exophase — GTA 6 trophy list", url: "https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/" },
  psn: { label: "PSNProfiles — GTA 6 trophies", url: "https://psnprofiles.com/trophies/43531-grand-theft-auto-vi" },
};

const KIND_LABELS = {
  story: "Story", side: "Side quest", collectible: "Collectible",
  activity: "Activity", crime: "Crime",
  platinum: "Platinum", completion: "100% completion",
};

// Which trophies each roadmap stage covers (by id; the platinum covers itself).
const STAGE_SETS = {
  1: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 28],
  2: [14, 15, 16, 17, 18, 19, 29, 30, 31, 32, 35, 40, 42, 43],
  3: [20, 21, 22, 23, 24, 25, 26, 27],
  4: [33, 34, 36, 37, 38, 39, 41, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55],
};

const state = {
  trophies: [],
  earned: new Set(),
  spoiler: false,
  search: "",
  grade: "all",
  kind: "all",
  openId: null,
};

const listEl = document.getElementById("list");
const earnedLabel = document.getElementById("earnedLabel");
const percentLabel = document.getElementById("percentLabel");
const progressFill = document.getElementById("progressFill");
const resultLine = document.getElementById("resultLine");
const searchInput = document.getElementById("search");
const gradeSelect = document.getElementById("grade");
const spoilerBox = document.getElementById("spoiler");

function loadStored() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.earned)) state.earned = new Set(saved.earned.filter(Number.isInteger));
    if (typeof saved.spoiler === "boolean") state.spoiler = saved.spoiler;
  } catch (err) {
    // A damaged save is ignored; the tracker starts empty.
  }
}

function saveStored() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      earned: [...state.earned].sort((a, b) => a - b),
      spoiler: state.spoiler,
    }));
  } catch (err) {
    // Private mode or a full store: progress still works for this visit.
  }
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function trophyVisible(t) {
  if (state.kind === "missable" && !t.missable) return false;
  if (state.kind === "fresh" && !t.fresh) return false;
  if (state.kind !== "all" && state.kind !== "missable" && state.kind !== "fresh" && t.kind !== state.kind) return false;
  if (state.grade !== "all" && t.grade !== state.grade) return false;
  if (state.search) {
    const hay = (t.name + " " + t.desc + " " + t.guide + " " + (KIND_LABELS[t.kind] || "")).toLowerCase();
    if (!hay.includes(state.search)) return false;
  }
  return true;
}

function renderProgress() {
  const total = state.trophies.length;
  const got = state.earned.size;
  const pct = total ? Math.round((got / total) * 100) : 0;
  earnedLabel.textContent = got + " of " + total + " earned";
  percentLabel.textContent = pct + "%";
  progressFill.style.width = pct + "%";
  for (const [stage, ids] of Object.entries(STAGE_SETS)) {
    const done = ids.filter((id) => state.earned.has(id)).length;
    const slot = document.getElementById("stageCount" + stage);
    if (slot) slot.textContent = done + " of " + ids.length + " stage trophies earned";
  }
}

function renderList() {
  listEl.replaceChildren();
  const shown = state.trophies.filter(trophyVisible);
  resultLine.textContent = shown.length === state.trophies.length
    ? "Showing all " + shown.length + " trophies. Click a name to read its guide."
    : "Showing " + shown.length + " of " + state.trophies.length + " trophies.";
  if (!shown.length) {
    listEl.appendChild(el("p", "empty", "No trophies match those filters. Clear the search or pick another kind."));
    return;
  }
  for (const t of shown) {
    const earned = state.earned.has(t.id);
    const masked = state.spoiler && t.kind === "story" && !earned;
    const card = el("article", "trophy" + (earned ? " earned" : ""));
    const head = el("div", "trophyhead");
    const box = el("input");
    box.type = "checkbox";
    box.checked = earned;
    box.setAttribute("aria-label", "Mark " + t.name + " as earned");
    box.addEventListener("change", () => {
      if (box.checked) state.earned.add(t.id); else state.earned.delete(t.id);
      saveStored();
      renderProgress();
      renderList();
    });
    const nameWrap = el("div", "trophyname");
    const title = el("h3");
    const titleBtn = el("button", undefined, masked ? "Hidden story trophy" : t.name);
    titleBtn.type = "button";
    titleBtn.setAttribute("aria-expanded", String(state.openId === t.id));
    titleBtn.addEventListener("click", () => {
      state.openId = state.openId === t.id ? null : t.id;
      renderList();
    });
    title.appendChild(titleBtn);
    nameWrap.appendChild(title);
    nameWrap.appendChild(el("p", "trophydesc", masked
      ? "Story trophy — earn it to reveal its name and description."
      : t.desc));
    const badges = el("div", "badges");
    badges.appendChild(el("span", "badge " + t.grade, t.grade));
    if (t.kind !== "platinum") badges.appendChild(el("span", "badge", KIND_LABELS[t.kind] || t.kind));
    if (t.target) badges.appendChild(el("span", "badge target", "Target: " + t.target.toLocaleString("en-US")));
    if (t.hidden) badges.appendChild(el("span", "badge hidden", "Hidden on PSN"));
    if (t.missable) badges.appendChild(el("span", "badge missable", "Missable"));
    if (t.fresh) badges.appendChild(el("span", "badge fresh", "Newly confirmed"));
    if (t.id === 49) badges.appendChild(el("span", "badge unconfirmed", "Unconfirmed"));
    nameWrap.appendChild(badges);
    head.appendChild(box);
    head.appendChild(nameWrap);
    card.appendChild(head);
    if (state.openId === t.id) {
      const guide = el("div", "guidebox");
      if (masked) {
        guide.appendChild(el("p", undefined, "This guide stays hidden in spoiler-free mode until the trophy is earned."));
      } else {
        const how = el("p");
        how.appendChild(el("strong", undefined, "How to get it: "));
        how.appendChild(document.createTextNode(t.guide));
        guide.appendChild(how);
        const src = el("p", "sourceline", "Sources: ");
        t.src.forEach((key, i) => {
          const entry = SOURCE_BOOK[key];
          if (!entry) return;
          if (i > 0) src.appendChild(document.createTextNode(" · "));
          const link = el("a", undefined, entry.label);
          link.href = entry.url;
          link.target = "_blank";
          link.rel = "noopener";
          src.appendChild(link);
        });
        guide.appendChild(src);
      }
      card.appendChild(guide);
    }
    listEl.appendChild(card);
  }
}

function renderAll() {
  renderProgress();
  renderList();
}

function applyUrlState() {
  const params = new URLSearchParams(location.search);
  const earnedParam = params.get("earned");
  if (earnedParam) {
    for (const part of earnedParam.split(",")) {
      const id = Number.parseInt(part, 10);
      if (Number.isInteger(id)) state.earned.add(id);
    }
  }
  const openParam = Number.parseInt(params.get("open") || "", 10);
  if (Number.isInteger(openParam)) state.openId = openParam;
  if (params.get("view") === "fresh") setKind("fresh");
  if (params.get("view") === "spoiler") state.spoiler = true;
  if (params.get("view") === "roadmap") {
    const road = document.getElementById("roadmap");
    if (road) road.scrollIntoView();
  }
  spoilerBox.checked = state.spoiler;
}

function setKind(kind) {
  state.kind = kind;
  document.querySelectorAll("#kindChips .chip").forEach((chip) => {
    const on = chip.dataset.kind === kind;
    chip.classList.toggle("on", on);
    chip.setAttribute("aria-pressed", String(on));
  });
  renderList();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({
    app: "leonida-ledger",
    exported_at: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
    spoiler: state.spoiler,
  }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "gta6-trophy-progress.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data.earned)) throw new Error("bad file");
      const ids = new Set(state.trophies.map((t) => t.id));
      state.earned = new Set(data.earned.filter((id) => ids.has(id)));
      if (typeof data.spoiler === "boolean") state.spoiler = data.spoiler;
      spoilerBox.checked = state.spoiler;
      saveStored();
      renderAll();
      resultLine.textContent = "Imported " + state.earned.size + " earned trophies.";
    } catch (err) {
      resultLine.textContent = "That file could not be imported. Export progress first to get a valid file.";
    }
  };
  reader.readAsText(file);
}

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  renderList();
});
gradeSelect.addEventListener("change", () => {
  state.grade = gradeSelect.value;
  renderList();
});
document.querySelectorAll("#kindChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => setKind(chip.dataset.kind));
});
spoilerBox.addEventListener("change", () => {
  state.spoiler = spoilerBox.checked;
  saveStored();
  renderList();
});
document.getElementById("showFreshBtn").addEventListener("click", () => {
  setKind("fresh");
  document.getElementById("tracker").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("exportBtn").addEventListener("click", exportProgress);
document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) importProgress(file);
  event.target.value = "";
});
document.getElementById("resetBtn").addEventListener("click", () => {
  if (window.confirm("Clear all earned trophies and turn spoiler-free mode off?")) {
    state.earned.clear();
    state.spoiler = false;
    spoilerBox.checked = false;
    saveStored();
    renderAll();
  }
});

async function boot() {
  loadStored();
  applyUrlState();
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error("could not load " + DATA_URL);
  const data = await response.json();
  state.trophies = Array.isArray(data) ? data : data.trophies;
  renderAll();
  window.__shotReady = true;
}

boot().catch((err) => {
  resultLine.textContent = "The trophy list could not be loaded. Check that data/trophies.json sits beside this page.";
  window.__shotReady = true;
});
