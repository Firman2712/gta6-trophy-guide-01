/* GTA 6 Trophy Guide — checklist logic (round 4, fresh build).
   Plain browser JS, no build step, no dependencies.
   Data: fetch("data/trophies.json") -> { game, platform, trophies: [...] }
   Checklist persisted in localStorage under "gta6-trophy-checklist-v1". */
(function () {
  "use strict";

  var STORAGE_KEY = "gta6-trophy-checklist-v1";
  var DATA_URL = "data/trophies.json";

  var trophies = [];
  var checked = new Set();
  var showSpoilers = false;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- checklist persistence ---------- */

  function loadChecked() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(function (id) { checked.add(String(id)); });
      }
    } catch (e) { /* corrupted storage: start empty */ }
  }

  function saveChecked() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(checked)));
    } catch (e) { /* storage unavailable: checklist lives in memory only */ }
  }

  /* ---------- controls ---------- */

  function readFilters() {
    var q = $("search-input") ? $("search-input").value : "";
    var grade = $("grade-filter") ? $("grade-filter").value : "";
    var kind = $("kind-filter") ? $("kind-filter").value : "";
    var newlyEl = $("newly-filter");
    var newly = false;
    if (newlyEl) {
      if (newlyEl.type === "checkbox") newly = newlyEl.checked;
      else newly = newlyEl.value === "yes" || newlyEl.value === "true" || newlyEl.value === "only";
    }
    return { q: q, grade: grade, kind: kind, newly: newly };
  }

  function readToggleState() {
    var el = $("spoiler-toggle");
    if (!el) return showSpoilers;
    if (el.type === "checkbox") return el.checked;
    var pressed = el.getAttribute("aria-pressed");
    if (pressed !== null) return pressed === "true";
    return el.classList.contains("active") || el.classList.contains("on");
  }

  function setToggleState(value) {
    var el = $("spoiler-toggle");
    if (!el) return;
    if (el.type === "checkbox") { el.checked = value; return; }
    el.setAttribute("aria-pressed", value ? "true" : "false");
    el.classList.toggle("active", value);
  }

  /* ---------- URL params ---------- */

  function readUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var f = readFilters();
    if (params.has("q")) f.q = params.get("q") || "";
    if (params.has("grade")) f.grade = params.get("grade") || "";
    if (params.has("kind")) f.kind = params.get("kind") || "";
    if (params.has("new")) {
      var n = params.get("new");
      f.newly = n === "1" || n === "true" || n === "yes";
    }
    if (params.has("spoiler")) {
      var s = params.get("spoiler");
      showSpoilers = s === "1" || s === "true" || s === "show";
    }
    return f;
  }

  function applyFiltersToControls(f) {
    if ($("search-input")) $("search-input").value = f.q;
    if ($("grade-filter")) $("grade-filter").value = f.grade;
    if ($("kind-filter")) $("kind-filter").value = f.kind;
    var newlyEl = $("newly-filter");
    if (newlyEl) {
      if (newlyEl.type === "checkbox") newlyEl.checked = f.newly;
      else newlyEl.value = f.newly ? "yes" : "all";
    }
    setToggleState(showSpoilers);
  }

  function syncUrl() {
    var f = readFilters();
    var params = new URLSearchParams();
    if (f.q) params.set("q", f.q);
    if (f.grade && f.grade !== "all") params.set("grade", f.grade);
    if (f.kind && f.kind !== "all") params.set("kind", f.kind);
    if (f.newly) params.set("new", "1");
    params.set("spoiler", showSpoilers ? "show" : "hide");
    var query = params.toString();
    var url = window.location.pathname + (query ? "?" + query : "");
    try { window.history.replaceState(null, "", url); } catch (e) { /* ignore */ }
  }

  /* ---------- filtering ---------- */

  function trophyMatches(t, f) {
    if (f.grade && f.grade !== "all" &&
        String(t.grade || "").toLowerCase() !== f.grade.toLowerCase()) return false;
    if (f.kind && f.kind !== "all" &&
        String(t.kind || "").toLowerCase() !== f.kind.toLowerCase()) return false;
    if (f.newly && !t.newlyConfirmed) return false;
    if (f.q) {
      var q = f.q.toLowerCase();
      var hay = [t.name, t.description, t.guide]
        .map(function (v) { return String(v || "").toLowerCase(); })
        .join(" ");
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  /* ---------- rendering ---------- */

  function spoilerHidden(t) {
    return t.hidden && !showSpoilers;
  }

  function renderList() {
    var list = $("trophy-list");
    if (!list) return;
    var f = readFilters();
    var visible = trophies.filter(function (t) { return trophyMatches(t, f); });

    var countEl = $("trophy-count");
    if (countEl) {
      countEl.textContent = visible.length === trophies.length
        ? trophies.length + " trophies"
        : visible.length + " of " + trophies.length + " trophies";
    }

    if (visible.length === 0) {
      list.innerHTML = '<p class="trophy-empty">No trophies match your filters.</p>';
      return;
    }

    var html = visible.map(function (t) {
      var isEarned = checked.has(String(t.id));
      var hidden = spoilerHidden(t);
      var steps = Array.isArray(t.steps) ? t.steps : [];
      var sources = Array.isArray(t.sources) ? t.sources : [];

      var stepsHtml = "";
      if (steps.length) {
        stepsHtml = '<ol class="trophy-steps"' + (hidden ? ' style="display:none"' : "") + ">" +
          steps.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") +
          "</ol>";
      }

      var sourcesHtml = "";
      if (sources.length) {
        sourcesHtml = '<ul class="trophy-sources">' +
          sources.map(function (s) {
            return '<li><a href="' + escapeHtml(s.url || "#") +
              '" target="_blank" rel="noopener">' + escapeHtml(s.name || s.url || "") + "</a></li>";
          }).join("") + "</ul>";
      }

      var badges = "";
      if (t.missable) badges += ' <span class="missable-badge">Missable</span>';
      if (t.newlyConfirmed) badges += ' <span class="new-badge">New</span>';

      return '<article class="trophy-card' + (isEarned ? " earned" : "") +
        '" data-trophy-id="' + escapeHtml(t.id) + '">' +
        '<label><input type="checkbox" class="trophy-check" data-trophy-id="' +
        escapeHtml(t.id) + '"' + (isEarned ? " checked" : "") + "> Earned</label>" +
        '<h3 class="trophy-name">' + escapeHtml(t.name) + badges + "</h3>" +
        '<p><span class="trophy-grade">' + escapeHtml(t.grade || "") + "</span> " +
        '<span class="trophy-kind">' + escapeHtml(t.kind || "") + "</span></p>" +
        '<p class="trophy-desc hidden-spoiler"' + (hidden ? ' style="display:none"' : "") + ">" +
        escapeHtml(t.description) + "</p>" +
        (hidden
          ? '<p class="spoiler-note">Hidden trophy — enable spoilers to reveal the guide.</p>'
          : "") +
        '<p class="trophy-guide hidden-spoiler"' + (hidden ? ' style="display:none"' : "") + ">" +
        escapeHtml(t.guide) + "</p>" +
        stepsHtml + sourcesHtml +
        "</article>";
    }).join("");

    list.innerHTML = html;

    list.querySelectorAll(".trophy-check").forEach(function (box) {
      box.addEventListener("change", function () {
        var id = box.getAttribute("data-trophy-id");
        if (box.checked) checked.add(id); else checked.delete(id);
        saveChecked();
        var card = box.closest(".trophy-card");
        if (card) card.classList.toggle("earned", box.checked);
        renderProgress();
        renderStats();
      });
    });
  }

  function renderProgress() {
    var total = trophies.length;
    var earned = 0;
    trophies.forEach(function (t) { if (checked.has(String(t.id))) earned++; });
    var bar = $("progress-bar");
    if (bar) {
      bar.style.width = total ? Math.round((earned / total) * 100) + "%" : "0%";
      bar.setAttribute("aria-valuenow", String(earned));
      bar.setAttribute("aria-valuemax", String(total));
    }
    var text = $("progress-text");
    if (text) text.textContent = earned + "/" + total + " trophies earned";
  }

  function renderStats() {
    var el = $("stats");
    if (!el) return;
    var total = trophies.length;
    var earned = 0;
    var byGrade = {};
    trophies.forEach(function (t) {
      var g = String(t.grade || "unknown").toLowerCase();
      byGrade[g] = (byGrade[g] || 0) + 1;
      if (checked.has(String(t.id))) earned++;
    });
    var gradeParts = Object.keys(byGrade).sort().map(function (g) {
      return byGrade[g] + " " + g;
    });
    el.textContent = total + " trophies · " + earned + " earned · " +
      (total - earned) + " remaining" +
      (gradeParts.length ? " · " + gradeParts.join(", ") : "");
  }

  /* Roadmap: 4 stages, union = all 55 trophies.
     Stage 1 story (12), stage 2 early activities (3),
     stage 3 exploration / collectibles (13), stage 4 cleanup / misc (28 items).
     The missable trophy is also listed in stage 4 as a cleanup reminder,
     so stage 4 holds 27 unique trophies + 1 reminder = 28 items. */
  function stageOf(t) {
    var kind = String(t.kind || "").toLowerCase();
    if (kind.indexOf("story") !== -1) return 1;
    if (kind.indexOf("activ") !== -1 || kind.indexOf("minigame") !== -1 ||
        kind.indexOf("sport") !== -1) return 2;
    if (kind.indexOf("explor") !== -1 || kind.indexOf("collect") !== -1) return 3;
    return 4;
  }

  function renderRoadmap() {
    var el = $("roadmap");
    if (!el) return;
    var stages = [[], [], [], []];
    trophies.forEach(function (t) { stages[stageOf(t) - 1].push(t); });

    var missable = trophies.filter(function (t) { return t.missable; })[0];
    var reminderAdded = false;
    if (missable) {
      var alreadyInStage4 = stages[3].some(function (t) { return t.id === missable.id; });
      if (!alreadyInStage4) {
        stages[3].push(missable);
        reminderAdded = true;
      }
    }

    var titles = [
      "Stage 1 — Story",
      "Stage 2 — Early activities",
      "Stage 3 — Exploration & collectibles",
      "Stage 4 — Cleanup & misc"
    ];
    var html = stages.map(function (items, i) {
      var itemsHtml = items.map(function (t) {
        var isReminder = reminderAdded && i === 3 && t.id === missable.id;
        var isMissableInStage4 = !reminderAdded && i === 3 && missable && t.id === missable.id;
        var label = escapeHtml(t.name);
        if (isReminder) label += ' <span class="roadmap-reminder">(missable — cleanup reminder)</span>';
        else if (isMissableInStage4) label += ' <span class="roadmap-reminder">(missable)</span>';
        return '<li class="roadmap-trophy' + (isReminder ? " roadmap-reminder-item" : "") +
          '" data-trophy-id="' + escapeHtml(t.id) + '">' + label + "</li>";
      }).join("");
      return '<section class="roadmap-stage"><h3>' + titles[i] + " (" + items.length +
        ')</h3><ul>' + itemsHtml + "</ul></section>";
    }).join("");
    el.innerHTML = html;
  }

  function renderAll() {
    renderList();
    renderProgress();
    renderStats();
    renderRoadmap();
  }

  /* ---------- export / import / reset ---------- */

  function exportChecklist() {
    var data = JSON.stringify(Array.from(checked).sort(), null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "gta6-trophy-checklist.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importChecklist(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var ids = null;
        if (Array.isArray(parsed)) ids = parsed;
        else if (parsed && Array.isArray(parsed.checked)) ids = parsed.checked;
        else if (parsed && Array.isArray(parsed.ids)) ids = parsed.ids;
        else if (parsed && Array.isArray(parsed.trophies)) ids = parsed.trophies;
        if (!ids) throw new Error("expected a JSON array of trophy ids");
        var known = new Set(trophies.map(function (t) { return String(t.id); }));
        var next = new Set();
        ids.forEach(function (id) {
          if (known.has(String(id))) next.add(String(id));
        });
        checked = next;
        saveChecked();
        renderAll();
      } catch (e) {
        alert("Could not import that file: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  function resetChecklist() {
    if (!window.confirm("Clear all earned trophies? This cannot be undone.")) return;
    checked = new Set();
    saveChecked();
    renderAll();
  }

  /* ---------- events ---------- */

  function bindEvents() {
    var search = $("search-input");
    if (search) search.addEventListener("input", function () { syncUrl(); renderList(); });
    ["grade-filter", "kind-filter", "newly-filter"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("change", function () { syncUrl(); renderList(); });
    });
    var spoiler = $("spoiler-toggle");
    if (spoiler) {
      spoiler.addEventListener("change", function () {
        showSpoilers = readToggleState();
        syncUrl();
        renderList();
      });
      spoiler.addEventListener("click", function () {
        if (spoiler.type === "checkbox") return;
        showSpoilers = !showSpoilers;
        setToggleState(showSpoilers);
        syncUrl();
        renderList();
      });
    }
    var exportBtn = $("export-btn");
    if (exportBtn) exportBtn.addEventListener("click", exportChecklist);
    var importBtn = $("import-btn");
    var importFile = $("import-file");
    if (importBtn && importFile) {
      importBtn.addEventListener("click", function () { importFile.click(); });
    }
    if (importFile) {
      importFile.addEventListener("change", function () {
        if (importFile.files && importFile.files[0]) importChecklist(importFile.files[0]);
        importFile.value = "";
      });
    }
    var resetBtn = $("reset-btn");
    if (resetBtn) resetBtn.addEventListener("click", resetChecklist);
  }

  /* ---------- boot ---------- */

  function showLoadError(message) {
    var list = $("trophy-list");
    if (list) {
      list.innerHTML = '<p class="trophy-error">Could not load trophy data: ' +
        escapeHtml(message) + ". Please check your connection and reload.</p>";
    }
    var countEl = $("trophy-count");
    if (countEl) countEl.textContent = "Failed to load trophy data.";
  }

  function init() {
    loadChecked();
    var initial = readUrlParams();
    applyFiltersToControls(initial);
    bindEvents();
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " loading " + DATA_URL);
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.trophies)) {
          throw new Error("trophies.json is missing a trophies array");
        }
        trophies = data.trophies;
        renderAll();
      })
      .catch(function (err) {
        showLoadError(err && err.message ? err.message : String(err));
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
