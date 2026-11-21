/* Leonida Ledger — GTA VI trophy checklist logic (round 5, fresh build).
 *
 * Plain browser JavaScript. No build step, no dependencies, no network
 * calls except fetching the local data file "data/trophies.json".
 * Data shape: { game, platform, trophies: [{ id, name, description, grade,
 * kind, hidden, missable, newlyConfirmed, guide, steps[], sources[] }] }.
 * Checklist persisted in localStorage under "gta6-trophy-checklist-v1".
 *
 * Spoiler-free mode: the #spoiler-toggle checkbox means spoiler-free mode
 * is ON while checked (its label in the shell). While on, hidden trophies
 * show placeholder text instead of their real name / description, and
 * their guide pane stays closed. Uncheck it to reveal everything.
 * URL state: ?q= ?grade= ?kind= ?new=1 ?spoiler=show|hide — read on load
 * and kept in sync (history.replaceState) as the user filters. */
(function () {
  "use strict";

  var STORAGE_KEY = "gta6-trophy-checklist-v1";
  var DATA_URL = "data/trophies.json";
  var EXPORT_NAME = "gta6-trophy-checklist.json";

  var GRADE_ORDER = ["platinum", "gold", "silver", "bronze"];

  var trophies = [];
  var byId = {};
  var earned = {};
  var spoilerFree = true;
  var selectedId = null;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isHttpUrl(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url);
  }

  function titleCase(word) {
    word = String(word || "");
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  /* ---------- checklist storage ---------- */

  function loadEarned() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      var ids = null;
      if (Array.isArray(parsed)) ids = parsed;
      else if (parsed && Array.isArray(parsed.earned)) ids = parsed.earned;
      if (!ids) return;
      ids.forEach(function (id) { earned[String(id)] = true; });
    } catch (e) { /* unreadable storage: start with an empty checklist */ }
  }

  function saveEarned() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(earnedIds()));
    } catch (e) { /* storage unavailable: checklist lives in memory only */ }
  }

  function earnedIds() {
    return Object.keys(earned).filter(function (id) { return earned[id]; }).sort();
  }

  function earnedCount() {
    var n = 0;
    trophies.forEach(function (t) { if (earned[String(t.id)]) n++; });
    return n;
  }

  /* ---------- filter controls + URL state ---------- */

  function readFilters() {
    var search = $("search-input");
    var grade = $("grade-filter");
    var kind = $("kind-filter");
    var newly = $("newly-filter");
    return {
      q: search ? search.value : "",
      grade: grade ? grade.value : "all",
      kind: kind ? kind.value : "all",
      newly: !!(newly && newly.checked)
    };
  }

  function applyToControls(f) {
    if ($("search-input")) $("search-input").value = f.q;
    if ($("grade-filter")) $("grade-filter").value = f.grade;
    if ($("kind-filter")) $("kind-filter").value = f.kind;
    if ($("newly-filter")) $("newly-filter").checked = f.newly;
    if ($("spoiler-toggle")) $("spoiler-toggle").checked = spoilerFree;
  }

  function readUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var f = { q: "", grade: "all", kind: "all", newly: false };
    if (params.has("q")) f.q = params.get("q") || "";
    if (params.has("grade")) f.grade = params.get("grade") || "all";
    if (params.has("kind")) f.kind = params.get("kind") || "all";
    if (params.has("new")) {
      var n = String(params.get("new")).toLowerCase();
      f.newly = n === "1" || n === "true" || n === "yes";
    }
    if (params.has("spoiler")) {
      var s = String(params.get("spoiler")).toLowerCase();
      spoilerFree = !(s === "show" || s === "1" || s === "true" || s === "off");
    }
    return f;
  }

  function syncUrl() {
    var f = readFilters();
    var params = new URLSearchParams();
    if (f.q) params.set("q", f.q);
    if (f.grade && f.grade !== "all") params.set("grade", f.grade);
    if (f.kind && f.kind !== "all") params.set("kind", f.kind);
    if (f.newly) params.set("new", "1");
    if (!spoilerFree) params.set("spoiler", "show");
    var query = params.toString();
    var url = window.location.pathname + (query ? "?" + query : "");
    try { window.history.replaceState(null, "", url); } catch (e) { /* ignore */ }
  }

  /* ---------- filtering ---------- */

  function matches(t, f) {
    if (f.grade && f.grade !== "all" &&
        String(t.grade || "").toLowerCase() !== f.grade.toLowerCase()) return false;
    if (f.kind && f.kind !== "all" &&
        String(t.kind || "").toLowerCase() !== f.kind.toLowerCase()) return false;
    if (f.newly && !t.newlyConfirmed) return false;
    if (f.q) {
      var needle = f.q.toLowerCase();
      var haystack = [t.name, t.description, t.guide]
        .map(function (v) { return String(v || "").toLowerCase(); })
        .join(" ");
      if (haystack.indexOf(needle) === -1) return false;
    }
    return true;
  }

  function isMasked(t) {
    return !!t.hidden && spoilerFree;
  }

  /* ---------- rendering: trophy list ---------- */

  function cardHtml(t) {
    var id = String(t.id);
    var got = !!earned[id];
    var masked = isMasked(t);
    var steps = Array.isArray(t.steps) ? t.steps : [];
    var sources = Array.isArray(t.sources) ? t.sources : [];

    var badges = "";
    if (t.missable) badges += ' <span class="missable-badge">Missable</span>';
    if (t.newlyConfirmed) badges += ' <span class="new-badge">New</span>';

    var name = masked ? "Hidden Trophy" : String(t.name || id);
    var desc = masked
      ? "Hidden trophy — turn spoiler-free mode off to reveal it."
      : String(t.description || "");

    var guideHtml = "";
    if (!masked) {
      var parts = [];
      if (t.guide) parts.push('<p class="trophy-guide">' + escapeHtml(t.guide) + "</p>");
      if (steps.length) {
        parts.push('<ol class="trophy-steps">' +
          steps.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") +
          "</ol>");
      }
      if (sources.length) {
        parts.push('<ul class="trophy-sources">' + sources.map(function (s) {
          var label = escapeHtml(s.name || s.url || "Source");
          if (isHttpUrl(s.url)) {
            return '<li><a href="' + escapeHtml(s.url) +
              '" target="_blank" rel="noopener">' + label + "</a></li>";
          }
          return "<li>" + label + "</li>";
        }).join("") + "</ul>");
      }
      guideHtml =
        '<button type="button" class="trophy-toggle" aria-expanded="false" ' +
        'aria-controls="guide-' + escapeHtml(id) + '">Show guide</button>' +
        '<div class="trophy-guide-pane" id="guide-' + escapeHtml(id) + '" hidden>' +
        parts.join("") + "</div>";
    } else {
      guideHtml = '<p class="spoiler-note">Guide hidden in spoiler-free mode.</p>';
    }

    return '<article class="trophy-card' + (got ? " earned" : "") +
      '" data-trophy-id="' + escapeHtml(id) + '">' +
      '<div class="trophy-head">' +
      '<h3 class="trophy-name">' + escapeHtml(name) + badges + "</h3>" +
      '<span class="trophy-grade">' + escapeHtml(t.grade || "") + "</span> " +
      '<span class="trophy-kind">' + escapeHtml(t.kind || "") + "</span>" +
      "</div>" +
      '<p class="trophy-desc">' + escapeHtml(desc) + "</p>" +
      '<label><input type="checkbox" class="trophy-check" data-trophy-id="' +
      escapeHtml(id) + '"' + (got ? " checked" : "") + "> Earned</label>" +
      guideHtml +
      "</article>";
  }

  function renderList() {
    var list = $("trophy-list");
    if (!list) return;
    var f = readFilters();
    var shown = trophies.filter(function (t) { return matches(t, f); });

    var countEl = $("trophy-count");
    if (countEl) {
      countEl.textContent = shown.length === trophies.length
        ? trophies.length + " trophies shown"
        : shown.length + " of " + trophies.length + " trophies shown";
    }

    if (shown.length === 0) {
      list.innerHTML = '<p class="trophy-empty">No trophies match your filters.</p>';
      return;
    }
    list.innerHTML = shown.map(cardHtml).join("");
  }

  /* ---------- rendering: progress + stats ---------- */

  function renderProgress() {
    var total = trophies.length;
    var got = earnedCount();
    var pct = total ? Math.round((got / total) * 100) : 0;

    var text = $("progress-text");
    if (text) text.textContent = got + " of " + total + " trophies earned";

    var bar = $("progress-bar");
    if (bar) {
      bar.style.width = pct + "%";
      bar.setAttribute("aria-valuenow", String(pct));
      bar.setAttribute("aria-valuemax", "100");
      var track = bar.parentElement;
      if (track) track.setAttribute("aria-valuenow", String(pct));
    }
  }

  function renderGradeCounters() {
    GRADE_ORDER.forEach(function (grade) {
      var gradeTotal = 0;
      var gradeGot = 0;
      trophies.forEach(function (t) {
        if (String(t.grade || "").toLowerCase() === grade) {
          gradeTotal++;
          if (earned[String(t.id)]) gradeGot++;
        }
      });
      var el = $("count-" + grade);
      if (el) el.textContent = gradeGot + "/" + gradeTotal;
    });
  }

  function renderStats() {
    var el = $("stats");
    if (!el) return;
    var total = trophies.length;
    var got = earnedCount();
    var blocks = [
      '<div class="stat"><span class="stat-value">' + got + "/" + total +
      '</span><span class="stat-label">Trophies earned</span></div>'
    ];
    GRADE_ORDER.forEach(function (grade) {
      var gradeTotal = 0;
      var gradeGot = 0;
      trophies.forEach(function (t) {
        if (String(t.grade || "").toLowerCase() === grade) {
          gradeTotal++;
          if (earned[String(t.id)]) gradeGot++;
        }
      });
      if (gradeTotal > 0) {
        blocks.push('<div class="stat"><span class="stat-value">' + gradeGot + "/" + gradeTotal +
          '</span><span class="stat-label">' + titleCase(grade) + " earned</span></div>");
      }
    });
    el.innerHTML = blocks.join("");
  }

  /* ---------- rendering: guide pane (side column) ---------- */

  function guidePaneHtml(t) {
    var id = String(t.id);
    var steps = Array.isArray(t.steps) ? t.steps : [];
    var sources = Array.isArray(t.sources) ? t.sources : [];
    var parts = [];
    parts.push('<h3 class="guide-pane-title">' + escapeHtml(t.name || id) + "</h3>");
    if (t.description) {
      parts.push('<p class="guide-pane-desc">' + escapeHtml(t.description) + "</p>");
    }
    if (t.guide) {
      parts.push('<p class="guide-pane-text">' + escapeHtml(t.guide) + "</p>");
    }
    if (steps.length) {
      parts.push('<ol class="guide-pane-steps">' +
        steps.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") +
        "</ol>");
    }
    if (sources.length) {
      parts.push('<ul class="guide-pane-sources">' + sources.map(function (s) {
        var label = escapeHtml(s.name || s.url || "Source");
        if (isHttpUrl(s.url)) {
          return '<li><a href="' + escapeHtml(s.url) +
            '" target="_blank" rel="noopener">' + label + "</a></li>";
        }
        return "<li>" + label + "</li>";
      }).join("") + "</ul>");
    }
    return parts.join("");
  }

  function renderGuidePane() {
    var pane = $("guide-pane");
    var content = $("guide-pane-content");
    if (!pane || !content) return;
    var empty = pane.querySelector(".guide-pane-empty");
    if (!selectedId || !byId[selectedId]) {
      content.innerHTML = "";
      if (empty) empty.style.display = "";
      return;
    }
    var t = byId[selectedId];
    if (empty) empty.style.display = "none";
    if (isMasked(t)) {
      content.innerHTML = '<p class="spoiler-note">Guide hidden in spoiler-free mode. ' +
        "Turn spoiler-free mode off to reveal this trophy's guide.</p>";
      return;
    }
    content.innerHTML = guidePaneHtml(t);
  }

  function selectTrophy(id) {
    if (!id || !byId[id]) return;
    selectedId = String(id);
    renderGuidePane();
  }

  /* ---------- rendering: missables ---------- */

  function renderMissables() {
    var el = $("missables");
    if (!el) return;
    var missable = trophies.filter(function (t) { return t.missable; });
    if (missable.length === 0) {
      el.innerHTML = '<p class="missables-empty">No missable trophies in this list.</p>';
      return;
    }
    el.innerHTML = missable.map(function (t) {
      var id = String(t.id);
      var name = isMasked(t) ? "Hidden Trophy" : String(t.name || id);
      var why = isMasked(t)
        ? "Hidden trophy — turn spoiler-free mode off to reveal why it is missable."
        : String(t.guide || t.description || "This trophy can be missed — check its guide before you pass the story point.");
      return '<article class="missable-card" data-trophy-id="' + escapeHtml(id) + '">' +
        '<h3 class="missable-name">' + escapeHtml(name) +
        ' <span class="missable-badge">Missable</span></h3>' +
        '<p class="missable-why">' + escapeHtml(why) + "</p>" +
        '<button type="button" class="missable-jump" data-trophy-id="' + escapeHtml(id) + '">' +
        "See guide for " + escapeHtml(name) + "</button>" +
        "</article>";
    }).join("");
  }

  /* ---------- rendering: roadmap ----------
     Stage 1 — Story: all story trophies (12).
     Stage 2 — Early activities: the first 3 activity trophies in data order.
     Stage 3 — Exploration & collectibles: exploration + collectible trophies
       plus the remaining activity trophies (3 + 3 + 7 = 13).
     Stage 4 — Cleanup & misc: all misc trophies (27) plus the missable
       trophy as a reminder entry (28 items). The missable trophy is an
       activity, so it already appears in Stage 3; the Stage 4 entry is an
       extra reminder, not a second trophy. Counts: 12 / 3 / 13 / 28. */
  function buildStages() {
    var story = [];
    var activities = [];
    var exploreCollect = [];
    var misc = [];
    trophies.forEach(function (t) {
      var kind = String(t.kind || "").toLowerCase();
      if (kind === "story") story.push(t);
      else if (kind === "activity") activities.push(t);
      else if (kind === "exploration" || kind === "collectible") exploreCollect.push(t);
      else misc.push(t);
    });
    var stage1 = story;
    var stage2 = activities.slice(0, 3);
    var stage3 = exploreCollect.concat(activities.slice(3));
    var stage4 = misc.slice();
    var missable = trophies.filter(function (t) { return t.missable; });
    var reminders = missable.filter(function (t) {
      return !stage4.some(function (m) { return String(m.id) === String(t.id); });
    });
    return { stages: [stage1, stage2, stage3, stage4], reminders: reminders };
  }

  function renderRoadmap() {
    var el = $("roadmap");
    if (!el) return;
    var built = buildStages();
    var stages = built.stages;
    var reminderIds = {};
    built.reminders.forEach(function (t) { reminderIds[String(t.id)] = true; });

    var titles = [
      "Stage 1 — Story",
      "Stage 2 — Early activities",
      "Stage 3 — Exploration & collectibles",
      "Stage 4 — Cleanup & misc"
    ];

    var html = stages.map(function (items, i) {
      var entries = items.map(function (t) {
        var label = isMasked(t) ? "Hidden Trophy" : String(t.name || t.id);
        var extra = "";
        if (t.missable) extra += ' <span class="missable-badge">Missable</span>';
        return '<li class="roadmap-trophy' + (earned[String(t.id)] ? " earned" : "") +
          '" data-trophy-id="' + escapeHtml(t.id) + '">' +
          escapeHtml(label) + extra + "</li>";
      });
      if (i === 3) {
        built.reminders.forEach(function (t) {
          var label = isMasked(t) ? "Hidden Trophy" : String(t.name || t.id);
          entries.push('<li class="roadmap-trophy roadmap-reminder-item' +
            (earned[String(t.id)] ? " earned" : "") +
            '" data-trophy-id="' + escapeHtml(t.id) + '">' +
            escapeHtml(label) +
            ' <span class="missable-badge">Missable</span>' +
            ' <span class="roadmap-reminder">(missable — also in Stage 3; don\'t miss it)</span></li>');
        });
      }
      var total = entries.length;
      return '<section class="roadmap-stage"><h3>' + titles[i] + " (" + total +
        ")</h3><ul>" + entries.join("") + "</ul></section>";
    }).join("");
    el.innerHTML = html;
  }

  function markRoadmapEarned(id, got) {
    var el = $("roadmap");
    if (!el) return;
    var items = el.querySelectorAll('[data-trophy-id="' + id + '"]');
    Array.prototype.forEach.call(items, function (li) {
      li.classList.toggle("earned", got);
    });
  }

  function renderAll() {
    renderList();
    renderProgress();
    renderGradeCounters();
    renderStats();
    renderRoadmap();
    renderMissables();
    renderGuidePane();
  }

  /* ---------- export / import / reset ---------- */

  function exportProgress() {
    var payload = {
      app: "leonida-ledger",
      game: "Grand Theft Auto VI",
      exportedAt: new Date().toISOString(),
      total: trophies.length,
      earnedCount: earnedCount(),
      earned: earnedIds()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = EXPORT_NAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importProgress(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var ids = null;
        if (Array.isArray(parsed)) ids = parsed;
        else if (parsed && Array.isArray(parsed.earned)) ids = parsed.earned;
        else if (parsed && Array.isArray(parsed.checked)) ids = parsed.checked;
        else if (parsed && Array.isArray(parsed.ids)) ids = parsed.ids;
        else if (parsed && Array.isArray(parsed.trophies)) ids = parsed.trophies;
        if (!ids) throw new Error("expected a JSON array of trophy ids");
        var next = {};
        var accepted = 0;
        ids.forEach(function (rawId) {
          var id = String(rawId);
          if (byId[id]) { next[id] = true; accepted++; }
        });
        earned = next;
        saveEarned();
        renderAll();
        if (accepted === 0) {
          window.alert("Import finished, but no trophy ids in the file matched this guide.");
        }
      } catch (e) {
        window.alert("Could not import that file: " + (e && e.message ? e.message : String(e)));
      }
    };
    reader.onerror = function () {
      window.alert("Could not read that file. Please try again.");
    };
    reader.readAsText(file);
  }

  function resetProgress() {
    if (!window.confirm("Clear all earned trophies? This cannot be undone.")) return;
    earned = {};
    saveEarned();
    renderAll();
  }

  /* ---------- events ---------- */

  function scrollToTrophyCard(id) {
    var card = document.querySelector('#trophy-list .trophy-card[data-trophy-id="' + id + '"]');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: "nearest" });
  }

  function bindEvents() {
    var search = $("search-input");
    if (search) {
      search.addEventListener("input", function () { syncUrl(); renderList(); });
    }
    ["grade-filter", "kind-filter", "newly-filter"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("change", function () { syncUrl(); renderList(); });
    });
    var spoiler = $("spoiler-toggle");
    if (spoiler) {
      spoiler.addEventListener("change", function () {
        spoilerFree = spoiler.checked;
        syncUrl();
        renderAll();
      });
    }

    var list = $("trophy-list");
    if (list) {
      list.addEventListener("change", function (event) {
        var box = event.target;
        if (!box || !box.classList || !box.classList.contains("trophy-check")) return;
        var id = box.getAttribute("data-trophy-id");
        if (!id) return;
        if (box.checked) earned[id] = true; else delete earned[id];
        saveEarned();
        var card = box.closest ? box.closest(".trophy-card") : null;
        if (card) card.classList.toggle("earned", box.checked);
        markRoadmapEarned(id, box.checked);
        renderProgress();
        renderGradeCounters();
        renderStats();
      });
      list.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var btn = target.closest(".trophy-toggle");
        if (btn) {
          var paneId = btn.getAttribute("aria-controls");
          var pane = paneId ? document.getElementById(paneId) : null;
          if (!pane) return;
          var open = pane.hasAttribute("hidden");
          if (open) pane.removeAttribute("hidden"); else pane.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", open ? "true" : "false");
          btn.textContent = open ? "Hide guide" : "Show guide";
          return;
        }
        if (target.closest(".trophy-check") || target.closest("label")) return;
        var card = target.closest(".trophy-card");
        if (card) selectTrophy(card.getAttribute("data-trophy-id"));
      });
    }

    var missables = $("missables");
    if (missables) {
      missables.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var jump = target.closest(".missable-jump");
        if (!jump) return;
        var id = jump.getAttribute("data-trophy-id");
        if (!id) return;
        selectTrophy(id);
        scrollToTrophyCard(id);
      });
    }

    var roadmap = $("roadmap");
    if (roadmap) {
      roadmap.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var item = target.closest("[data-trophy-id]");
        if (item) selectTrophy(item.getAttribute("data-trophy-id"));
      });
    }

    var exportBtn = $("export-btn");
    if (exportBtn) exportBtn.addEventListener("click", exportProgress);
    var importBtn = $("import-btn");
    var importFile = $("import-file");
    if (importBtn && importFile) {
      importBtn.addEventListener("click", function () { importFile.click(); });
    }
    if (importFile) {
      importFile.addEventListener("change", function () {
        if (importFile.files && importFile.files[0]) importProgress(importFile.files[0]);
        importFile.value = "";
      });
    }
    var resetBtn = $("reset-btn");
    if (resetBtn) resetBtn.addEventListener("click", resetProgress);
  }

  /* ---------- boot ---------- */

  function showLoadError(message) {
    var list = $("trophy-list");
    if (list) {
      list.innerHTML = '<p class="trophy-error">Could not load trophy data: ' +
        escapeHtml(message) + ". Please reload the page.</p>";
    }
    var countEl = $("trophy-count");
    if (countEl) countEl.textContent = "Could not load trophy data.";
  }

  function init() {
    loadEarned();
    applyToControls(readUrlParams());
    bindEvents();
    renderGradeCounters();
    window.fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " loading " + DATA_URL);
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.trophies)) {
          throw new Error("trophies.json is missing a trophies array");
        }
        trophies = data.trophies;
        byId = {};
        trophies.forEach(function (t) { byId[String(t.id)] = t; });
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
