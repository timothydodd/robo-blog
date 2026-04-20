(function () {
  // ---------------------------------------------------------------------------
  // Copy-to-clipboard on code blocks
  // ---------------------------------------------------------------------------
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".copy-button");
    if (!btn) return;
    const wrapper = btn.closest(".pre-wrapper");
    const code = wrapper && wrapper.querySelector("pre");
    if (!code) return;
    const text = code.innerText;
    const done = function () {
      btn.classList.add("copied");
      const label = btn.querySelector(".copied-text");
      const prev = label && label.textContent;
      if (label) label.textContent = "Copied";
      setTimeout(function () {
        btn.classList.remove("copied");
        if (label && prev) label.textContent = prev;
      }, 1400);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "-10000px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch {}
      document.body.removeChild(ta);
    }
  });

  // ---------------------------------------------------------------------------
  // Reading progress bar — tracks scroll through the .post-full article only.
  // CSS fills .reading-progress-bar via the --progress custom property.
  // ---------------------------------------------------------------------------
  (function () {
    const article = document.querySelector(".post-full");
    const root = document.documentElement;
    if (!article) { root.style.setProperty("--progress", "0"); return; }

    let ticking = false;
    function update() {
      ticking = false;
      const rect = article.getBoundingClientRect();
      const viewH = window.innerHeight || root.clientHeight;
      // Start counting when the top of the article crosses the top of the
      // viewport; finish when the bottom crosses the bottom of the viewport.
      const total = Math.max(1, rect.height - viewH);
      const scrolled = Math.min(total, Math.max(0, -rect.top));
      const p = Math.min(1, Math.max(0, scrolled / total));
      root.style.setProperty("--progress", p.toFixed(4));
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  })();

  // ---------------------------------------------------------------------------
  // TOC scroll-spy — highlights the TOC entry for the section currently in view.
  // Uses IntersectionObserver to track h2/h3 targets. No-op if no .post-toc.
  // ---------------------------------------------------------------------------
  (function () {
    const toc = document.querySelector(".post-toc");
    if (!toc || !("IntersectionObserver" in window)) return;

    const links = new Map(); // id -> <a>
    toc.querySelectorAll("a[data-toc-link]").forEach((a) => {
      const id = decodeURIComponent((a.getAttribute("href") || "").replace(/^#/, ""));
      if (id) links.set(id, a);
    });
    if (!links.size) return;

    const targets = [];
    links.forEach((_, id) => {
      const el = document.getElementById(id);
      if (el) targets.push(el);
    });

    const visible = new Set();
    function updateActive() {
      // Pick the visible target closest to the top of the viewport.
      let best = null;
      let bestTop = Infinity;
      visible.forEach((el) => {
        const t = el.getBoundingClientRect().top;
        if (t < bestTop) { bestTop = t; best = el; }
      });
      links.forEach((a) => a.classList.remove("is-active"));
      if (best) {
        const a = links.get(best.id);
        if (a) a.classList.add("is-active");
      }
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      updateActive();
    }, { rootMargin: "-72px 0px -70% 0px", threshold: 0 });

    targets.forEach((t) => io.observe(t));
  })();

  // ---------------------------------------------------------------------------
  // Sidebar layout mode — picks between pinning the TOC (when it fits in the
  // viewport) and pinning the Related list (when the TOC is too tall and
  // should scroll with the page). Toggled via classes on .post-sidebar.
  // ---------------------------------------------------------------------------
  (function () {
    const sidebar = document.querySelector(".post-sidebar");
    if (!sidebar) return;

    let ticking = false;
    function update() {
      ticking = false;
      const viewH = window.innerHeight || document.documentElement.clientHeight;
      // 5rem top offset + 1rem breathing room.
      const available = viewH - 96;
      const fits = sidebar.scrollHeight <= available;
      sidebar.classList.toggle("toc-fits", fits);
      sidebar.classList.toggle("toc-overflow", !fits);
    }
    function onResize() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener("resize", onResize, { passive: true });
    if ("ResizeObserver" in window) {
      new ResizeObserver(onResize).observe(sidebar);
    }
    update();
  })();

  // ---------------------------------------------------------------------------
  // Smooth-scroll in-page anchor links
  // ---------------------------------------------------------------------------
  document.addEventListener("click", function (e) {
    const a = e.target.closest("a[href^='#']");
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", "#" + id);
  });

  // ---------------------------------------------------------------------------
  // Image lightbox
  // Clicks any <img data-zoom> inside .gh-content. If the clicked image lives
  // inside a .kg-gallery-card, the group is that gallery; otherwise the group
  // is all zoomable images in the article.
  // ---------------------------------------------------------------------------
  const lb = createLightbox();

  document.addEventListener("click", function (e) {
    const img = e.target.closest("img[data-zoom]");
    if (!img) return;
    const content = img.closest(".gh-content");
    if (!content) return;

    const gallery = img.closest(".kg-gallery-card");
    const scope = gallery || content;
    const group = Array.from(scope.querySelectorAll("img[data-zoom]"));
    const index = group.indexOf(img);
    if (index === -1) return;

    e.preventDefault();
    lb.open(group.map(i => ({ src: i.currentSrc || i.src, alt: i.alt || "" })), index);
  });

  // Make zoomable images visually cue-able
  const style = document.createElement("style");
  style.textContent = "img[data-zoom] { cursor: zoom-in; }";
  document.head.appendChild(style);

  function createLightbox() {
    const root = document.createElement("div");
    root.className = "lightbox";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML =
      '<button class="lightbox-close" aria-label="Close">✕</button>' +
      '<button class="lightbox-prev" aria-label="Previous image">‹</button>' +
      '<button class="lightbox-next" aria-label="Next image">›</button>' +
      '<figure class="lightbox-stage"><img alt=""><figcaption class="lightbox-caption"></figcaption></figure>' +
      '<div class="lightbox-counter"></div>';

    const stage = root.querySelector(".lightbox-stage");
    const imgEl = root.querySelector(".lightbox-stage img");
    const captionEl = root.querySelector(".lightbox-caption");
    const counterEl = root.querySelector(".lightbox-counter");
    const prevBtn = root.querySelector(".lightbox-prev");
    const nextBtn = root.querySelector(".lightbox-next");
    const closeBtn = root.querySelector(".lightbox-close");

    let items = [];
    let cursor = 0;
    let scrollY = 0;

    function render() {
      const item = items[cursor];
      if (!item) return;
      imgEl.src = item.src;
      imgEl.alt = item.alt;
      captionEl.textContent = item.alt || "";
      captionEl.style.display = item.alt ? "" : "none";
      counterEl.textContent = items.length > 1 ? `${cursor + 1} / ${items.length}` : "";
      prevBtn.style.visibility = items.length > 1 ? "" : "hidden";
      nextBtn.style.visibility = items.length > 1 ? "" : "hidden";
      preload(cursor + 1);
      preload(cursor - 1);
    }
    function preload(i) {
      if (i < 0 || i >= items.length) return;
      const im = new Image();
      im.src = items[i].src;
    }
    function open(list, startIndex) {
      items = list;
      cursor = startIndex;
      scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = scrollbarWidth() + "px";
      root.setAttribute("aria-hidden", "false");
      root.classList.add("is-open");
      render();
      closeBtn.focus();
    }
    function close() {
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
    function step(delta) {
      if (items.length <= 1) return;
      cursor = (cursor + delta + items.length) % items.length;
      render();
    }
    function scrollbarWidth() {
      return window.innerWidth - document.documentElement.clientWidth;
    }

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => step(-1));
    nextBtn.addEventListener("click", () => step(1));
    root.addEventListener("click", (e) => {
      if (e.target === root) close();
    });
    stage.addEventListener("click", (e) => {
      // Clicking the image itself advances (feels natural in a gallery).
      if (e.target === imgEl && items.length > 1) step(1);
    });
    document.addEventListener("keydown", (e) => {
      if (!root.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });

    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(root));
    if (document.body) document.body.appendChild(root);

    return { open };
  }
})();
