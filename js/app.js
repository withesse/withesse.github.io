/* ============================================================
   terminal theme — client interactions (vanilla JS)
   Ported from the React prototype: theme toggle, ⌘K search,
   TOC scrollspy, reading progress, copy-code, home layout
   switcher, mobile nav.
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var LS = window.localStorage;
  var store = {
    get: function (k) { try { return LS.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { LS.setItem(k, v); } catch (e) {} },
  };

  /* ---------- Theme ---------- */
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    store.set("zt-theme", t);
    document.querySelectorAll("[data-theme-icon]").forEach(function (el) {
      el.querySelectorAll("[data-icon]").forEach(function (ic) {
        ic.style.display = ic.getAttribute("data-icon") === (t === "dark" ? "sun" : "moon") ? "" : "none";
      });
    });
    var hl = document.getElementById("hljs-theme");
    if (hl) {
      var u = t === "dark" ? hl.getAttribute("data-dark") : hl.getAttribute("data-light");
      var sri = t === "dark" ? hl.getAttribute("data-dark-sri") : hl.getAttribute("data-light-sri");
      if (u && hl.getAttribute("href") !== u) {
        if (sri) hl.setAttribute("integrity", sri); else hl.removeAttribute("integrity");
        hl.setAttribute("href", u);
      }
    }
    if (window.__rerenderMermaid) window.__rerenderMermaid();
  }
  function initTheme() {
    var saved = store.get("zt-theme");
    var def = root.getAttribute("data-default-scheme") || "dark";
    applyTheme(saved || def);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    });
  }

  /* ---------- Mobile nav ---------- */
  function initNav() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  /* ---------- Home layout variant switcher ---------- */
  function initHomeVariant() {
    var sw = document.querySelector("[data-vswitch]");
    if (!sw) return;
    var def = sw.getAttribute("data-default") || "stream";
    var current = store.get("zt-home-variant") || def;

    function show(v) {
      var panels = document.querySelectorAll("[data-variant]");
      if (!Array.prototype.some.call(panels, function (p) { return p.getAttribute("data-variant") === v; })) {
        v = def; // stored variant not on this page
      }
      panels.forEach(function (p) { p.classList.toggle("hidden", p.getAttribute("data-variant") !== v); });
      sw.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === v); });
      store.set("zt-home-variant", v);
    }
    sw.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-v")); });
    });
    show(current);
  }

  /* ---------- Reading progress ---------- */
  function initProgress() {
    var bar = document.querySelector("[data-progress]");
    if (!bar) return;
    function update() {
      var max = root.scrollHeight - root.clientHeight;
      bar.style.width = (max > 0 ? (root.scrollTop / max) * 100 : 0) + "%";
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------- TOC scrollspy ---------- */
  function initToc() {
    var toc = document.querySelector("[data-toc]");
    if (!toc) return;
    var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
    if (!links.length) return;
    var targets = links.map(function (a) {
      var id = decodeURIComponent((a.getAttribute("href") || "").replace(/^#/, ""));
      return { a: a, el: document.getElementById(id) };
    }).filter(function (t) { return t.el; });

    function update() {
      var cur = null;
      targets.forEach(function (t) {
        if (t.el.getBoundingClientRect().top < 120) cur = t.a;
      });
      links.forEach(function (a) { a.classList.toggle("active", a === cur); });
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ---------- Copy-code buttons ---------- */
  function initCopy() {
    document.querySelectorAll(".prose figure.highlight").forEach(function (fig) {
      if (fig.querySelector(".code-bar")) return;
      var lang = "";
      fig.classList.forEach(function (c) { if (c !== "highlight") lang = lang || c; });
      var bar = document.createElement("div");
      bar.className = "code-bar";
      var label = document.createElement("span");
      label.className = "code-lang";
      label.textContent = lang || "code";
      var btn = document.createElement("button");
      btn.className = "code-copy";
      btn.type = "button";
      btn.textContent = "copy";
      btn.addEventListener("click", function () {
        var codeCell = fig.querySelector(".code") || fig;
        var text = codeCell.innerText.replace(/\n$/, "");
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        btn.textContent = "copied";
        setTimeout(function () { btn.textContent = "copy"; }, 1400);
      });
      bar.appendChild(label);
      bar.appendChild(btn);
      fig.insertBefore(bar, fig.firstChild);
    });
  }

  /* ---------- Search modal (⌘K / Ctrl+K / "/") ---------- */
  function initSearch() {
    var overlay = document.getElementById("search-overlay");
    if (!overlay) return;
    var input = overlay.querySelector(".search-input");
    var results = overlay.querySelector(".search-results");
    var foot = overlay.querySelector("[data-search-count]");
    var index = null, loading = false, opener = null;
    var sel = 0, view = [];

    function fmtDate(d) { return (d || "").replace(/-/g, "."); }

    function loadIndex() {
      if (index || loading) return;
      loading = true;
      fetch(overlay.getAttribute("data-index") || "/search-index.json")
        .then(function (r) { return r.json(); })
        .then(function (data) { index = data || []; loading = false; render(); })
        .catch(function () { index = []; loading = false; results.innerHTML = '<div class="search-empty mono">搜索索引加载失败</div>'; });
    }

    function render() {
      if (!index) { results.innerHTML = '<div class="search-empty mono">加载中…</div>'; return; }
      var q = input.value.trim().toLowerCase();
      view = !q ? index.slice(0, 6) : index.filter(function (a) {
        return (a.title + " " + (a.tags || "") + " " + (a.cat || "") + " " + (a.excerpt || "")).toLowerCase().indexOf(q) > -1;
      });
      sel = 0;
      if (!view.length) {
        results.innerHTML = '<div class="search-empty mono">没有匹配 “' + escapeHtml(input.value) + '” 的结果</div>';
      } else {
        results.innerHTML = view.map(function (a, i) {
          return '<a class="search-item' + (i === 0 ? " sel" : "") + '" href="' + a.url + '" data-i="' + i + '">' +
            '<span class="catbadge" style="--ch:' + (a.hue || 152) + '"><span class="catdot"></span>' + escapeHtml(a.cat || "") + '</span>' +
            '<span class="si-title">' + escapeHtml(a.title) + '</span>' +
            '<span class="si-meta mono">' + fmtDate(a.date) + '</span></a>';
        }).join("");
      }
      if (foot) foot.textContent = q ? view.length + " 个结果" : "最近文章";
      highlight();
    }
    function highlight() {
      results.querySelectorAll(".search-item").forEach(function (el, i) {
        el.classList.toggle("sel", i === sel);
      });
      var cur = results.querySelector(".search-item.sel");
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
    }
    function open() {
      opener = document.activeElement;
      overlay.classList.remove("hidden");
      input.value = "";
      loadIndex();
      render();
      setTimeout(function () { input.focus(); }, 30);
    }
    function close() {
      overlay.classList.add("hidden");
      if (opener && opener.focus) { try { opener.focus(); } catch (e) {} }
    }

    input.addEventListener("input", render);
    results.addEventListener("mousemove", function (e) {
      var item = e.target.closest(".search-item");
      if (item) { sel = +item.getAttribute("data-i"); highlight(); }
    });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelectorAll("[data-search-close]").forEach(function (b) { b.addEventListener("click", close); });
    document.querySelectorAll("[data-search-open]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); open(); });
    });

    document.addEventListener("keydown", function (e) {
      var open_ = !overlay.classList.contains("hidden");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open_ ? close() : open(); return; }
      if (e.key === "/" && !open_ && !/INPUT|TEXTAREA/.test((e.target.tagName || ""))) { e.preventDefault(); open(); return; }
      if (!open_) return;
      if (e.key === "Escape") { close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, view.length - 1); highlight(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); highlight(); }
      else if (e.key === "Enter" && view[sel]) { window.location.href = view[sel].url; }
      else if (e.key === "Tab") {
        var f = overlay.querySelectorAll("input, button, a.search-item");
        if (f.length) {
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Fold tags ( {% fold %} ) ---------- */
  function initFold() {
    document.querySelectorAll(".fold-title[data-fold]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var body = document.getElementById(btn.getAttribute("data-fold"));
        if (!body) return;
        var open = !body.hasAttribute("hidden");
        if (open) { body.setAttribute("hidden", ""); } else { body.removeAttribute("hidden"); }
        btn.setAttribute("aria-expanded", String(!open));
        btn.classList.toggle("open", !open);
      });
    });
  }

  /* ---------- Responsive pager (show 3-8 page numbers by width) ---------- */
  function initPager() {
    var pager = document.querySelector(".pager");
    if (!pager) return;
    var nums = Array.prototype.slice.call(pager.querySelectorAll(".page-number"));
    if (nums.length <= 3) return;
    var curIdx = 0;
    nums.forEach(function (b, i) { if (b.classList.contains("current")) curIdx = i; });
    // page-number count by viewport width: phones 3 → desktop up to 9
    function countFor(w) {
      if (w < 480) return 3;
      if (w < 600) return 4;
      if (w < 720) return 5;
      if (w < 840) return 6;
      if (w < 960) return 7;
      if (w < 1080) return 8;
      return 9;
    }
    function apply() {
      var n = Math.min(countFor(window.innerWidth), nums.length);
      var start = Math.max(0, Math.min(curIdx - Math.floor(n / 2), nums.length - n));
      nums.forEach(function (b, i) { b.classList.toggle("hidden", i < start || i >= start + n); });
    }
    apply();
    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(apply, 120); });
  }

  /* ---------- Clickable post cards (without nesting links) ---------- */
  function initPostRows() {
    document.querySelectorAll(".post-row[data-href]").forEach(function (row) {
      function go(e) {
        if (e.target.closest("a")) return;          // let category / tag / title links work
        if (window.getSelection && String(window.getSelection())) return; // don't hijack text selection
        var href = row.getAttribute("data-href");
        if (href) window.location.href = href;
      }
      row.addEventListener("click", go);
      row.addEventListener("keydown", function (e) {    // Enter/Space activate the focused card
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); }
      });
    });
  }

  /* ---------- Mermaid diagrams ---------- */
  function initMermaid() {
    var blocks = document.querySelectorAll("pre.mermaid");
    if (!blocks.length) return;
    root.classList.add("mermaid-pending");
    blocks.forEach(function (el) { if (!el.dataset.src) el.dataset.src = el.textContent; });
    var loaded = false;
    // mermaid "base" theme variables mapped to the site's tokens (dark/light aware)
    function mermaidVars() {
      var dark = root.getAttribute("data-theme") === "dark";
      return dark ? {
        darkMode: true, background: "#0c0e10", primaryColor: "#161a1f", primaryBorderColor: "#3a444d",
        primaryTextColor: "#e7eaed", secondaryColor: "#1b2026", secondaryBorderColor: "#3a444d",
        tertiaryColor: "#1b2026", tertiaryBorderColor: "#3a444d", lineColor: "#5b656e", textColor: "#c7ccd1",
        mainBkg: "#161a1f", nodeBorder: "#3a444d", clusterBkg: "#101418", clusterBorder: "#2c333a",
        titleColor: "#e7eaed", edgeLabelBackground: "#0c0e10", nodeTextColor: "#e7eaed"
      } : {
        darkMode: false, background: "#f6f5f1", primaryColor: "#ffffff", primaryBorderColor: "#d2cdbf",
        primaryTextColor: "#1a1d1f", secondaryColor: "#faf9f5", secondaryBorderColor: "#d2cdbf",
        tertiaryColor: "#faf9f5", tertiaryBorderColor: "#d2cdbf", lineColor: "#9aa0a6", textColor: "#3a3f44",
        mainBkg: "#ffffff", nodeBorder: "#d2cdbf", clusterBkg: "#faf9f5", clusterBorder: "#e2dfd5",
        titleColor: "#1a1d1f", edgeLabelBackground: "#f6f5f1", nodeTextColor: "#1a1d1f"
      };
    }
    function reveal() { root.classList.remove("mermaid-pending"); }
    function render() {
      if (!window.mermaid) return;
      root.classList.add("mermaid-pending");
      blocks.forEach(function (el) { el.removeAttribute("data-processed"); el.textContent = el.dataset.src; });
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: mermaidVars(),
          securityLevel: "antiscript",
          fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        });
        Promise.resolve(window.mermaid.run({ querySelector: "pre.mermaid" })).then(reveal).catch(reveal);
      } catch (e) { reveal(); }
    }
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.min.js";
    s.integrity = "sha384-yQ4mmBBT+vhTAwjFH0toJXNYJ6O4usWnt6EPIdWwrRvx2V/n5lXuDZQwQFeSFydF";
    s.crossOrigin = "anonymous";
    s.onload = function () { loaded = true; render(); };
    s.onerror = reveal;
    document.head.appendChild(s);
    setTimeout(reveal, 6000); // safety: reveal source if mermaid never loads
    window.__rerenderMermaid = function () { if (loaded) render(); };
  }

  /* ---------- Hero phrase rotation ---------- */
  function initHero() {
    var el = document.querySelector("[data-typ]");
    if (!el) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var phrases = JSON.parse(el.getAttribute("data-typ") || "[]");
    if (phrases.length < 2) return;
    var i = 0;
    setInterval(function () {
      i = (i + 1) % phrases.length;
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "fadeIn 0.5s ease";
      el.textContent = "// " + phrases[i];
    }, 3200);
  }

  /* ---------- Heading anchor links ---------- */
  function initHeadingAnchors() {
    var hs = document.querySelectorAll(".prose h2[id], .prose h3[id], .prose h4[id]");
    hs.forEach(function (h) {
      var a = document.createElement("a");
      a.className = "head-anchor";
      a.href = "#" + h.id;
      a.setAttribute("aria-label", "复制本节链接");
      a.textContent = "#";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var url = location.origin + location.pathname + "#" + h.id;
        try { history.replaceState(null, "", "#" + h.id); } catch (err) {}
        h.scrollIntoView();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).catch(function () {});
        }
        a.textContent = "✓";                                  // ✓ copied feedback
        setTimeout(function () { a.textContent = "#"; }, 1200);
      });
      h.appendChild(a);
    });
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }
  ready(function () {
    initTheme();
    initNav();
    initHomeVariant();
    initProgress();
    initToc();
    initCopy();
    initSearch();
    initFold();
    initPager();
    initPostRows();
    initMermaid();
    initHero();
    initHeadingAnchors();
  });
})();
