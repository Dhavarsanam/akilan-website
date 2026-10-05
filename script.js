/* =========================================================
   Akilan — interactions, animations & 3D hero
   ========================================================= */
(() => {
  "use strict";

  const doc = document.documentElement;
  doc.classList.remove("no-js");
  doc.classList.add("js");

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };

  /* ---------- Split text into animated words ---------- */
  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            const inner = document.createElement("span");
            inner.className = "w__i";
            inner.style.setProperty("--i", i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(el);
  }
  $$("[data-split]").forEach(splitWords);

  /* ---------- Preloader ---------- */
  const preloader = $("#preloader");
  const loadCount = $("#loadCount");
  const loadBar = $("#loadBar");
  let pageLoaded = document.readyState === "complete";
  window.addEventListener("load", () => { pageLoaded = true; });
  document.body.classList.add("is-locked");

  (function runLoader() {
    const start = performance.now();
    const minDuration = reduceMotion ? 200 : 2000;
    let done = false;
    // Time-based (not frame-based) so it finishes on schedule even if rAF is throttled
    const update = () => {
      if (done) return;
      const p = clamp((performance.now() - start) / minDuration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const shown = pageLoaded ? eased * 100 : eased * 90;
      loadCount.textContent = Math.round(shown);
      loadBar.style.width = shown + "%";
      if (pageLoaded && p >= 1) { done = true; setTimeout(finishLoader, 250); }
    };
    const tick = () => { update(); if (!done) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const timer = setInterval(() => { update(); if (done) clearInterval(timer); }, 100);
    // Safety net if load never fires (e.g. a slow CDN)
    setTimeout(() => { pageLoaded = true; }, 4000);
  })();

  let loaderFinished = false;
  function finishLoader() {
    if (loaderFinished) return;
    loaderFinished = true;
    document.body.classList.add("loaded");
    setTimeout(() => {
      preloader.classList.add("is-done");
      maybeShowDisclaimer();
    }, 1500);
  }

  /* ---------- Bar Council disclaimer ---------- */
  const disclaimer = $("#disclaimer");
  function maybeShowDisclaimer() {
    if (store.get("akilan-disclaimer") === "agreed") { document.body.classList.remove("is-locked"); return; }
    disclaimer.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => disclaimer.classList.add("is-open")));
    $("#disclaimerAgree").focus({ preventScroll: true });
  }
  $("#disclaimerAgree").addEventListener("click", () => {
    store.set("akilan-disclaimer", "agreed");
    disclaimer.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    setTimeout(() => { disclaimer.hidden = true; }, 600);
  });
  $("#disclaimerLeave").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = "about:blank";
  });

  /* ---------- Reveal on scroll ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal, [data-split], .footer__giant").forEach((el) => revealIO.observe(el));

  /* ---------- Counters ---------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = +el.dataset.count;
      const dur = reduceMotion ? 1 : 2200;
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(end * eased).toLocaleString("en-IN");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- Custom cursor ---------- */
  if (finePointer && !reduceMotion) {
    const dot = $(".cursor-dot");
    const ring = $(".cursor-ring");
    const label = $(".cursor-ring__label");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    let started = false;

    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (!started) { started = true; rx = mx; ry = my; document.body.classList.add("has-cursor"); }
    }, { passive: true });
    document.addEventListener("mouseleave", () => document.body.classList.remove("has-cursor"));
    document.addEventListener("mouseenter", () => { if (started) document.body.classList.add("has-cursor"); });
    window.addEventListener("mousedown", () => ring.classList.add("is-down"));
    window.addEventListener("mouseup", () => ring.classList.remove("is-down"));

    (function loop() {
      rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    })();

    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest("a, button, [data-cursor], .card, .stage, label.check");
      ring.classList.remove("is-hover", "is-label");
      if (!t) return;
      const text = t.dataset.cursor || (t.classList.contains("stage") ? "Drag" : "");
      if (text) { label.textContent = text; ring.classList.add("is-label"); }
      else ring.classList.add("is-hover");
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- 3D tilt + spotlight ---------- */
  if (finePointer && !reduceMotion) {
    $$("[data-tilt]").forEach((el) => {
      const max = +(el.dataset.tiltMax || 8);
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.transition = "transform .15s ease-out, border-color .5s, box-shadow .5s, opacity 1.2s";
        el.style.setProperty("--ry", `${(px - 0.5) * max * 2}deg`);
        el.style.setProperty("--rx", `${(0.5 - py) * max * 2}deg`);
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
      });
      el.addEventListener("mouseleave", () => {
        el.style.transition = "transform .9s cubic-bezier(.22,1,.36,1), border-color .5s, box-shadow .5s, opacity 1.2s";
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Header, nav, progress ---------- */
  const header = $("#header");
  const progress = $(".scroll-progress span");
  const toTop = $("#toTopProgress");
  const navLinks = $$(".nav__link");
  const heroImg = $(".hero__arch img");
  let lastY = scrollY;

  function onScroll() {
    const y = scrollY;
    const max = doc.scrollHeight - innerHeight;
    const p = max > 0 ? y / max : 0;
    progress.style.transform = `scaleX(${p})`;
    toTop.style.strokeDashoffset = 144.5 * (1 - p);

    header.classList.toggle("is-scrolled", y > 40);
    const menuOpen = $("#mobileMenu").classList.contains("is-open");
    header.classList.toggle("is-hidden", !menuOpen && y > lastY && y > 500);
    lastY = y;

    if (heroImg && y < innerHeight * 1.2) heroImg.style.setProperty("--py", `${y * 0.12}px`);
    updateProcess();
    updateTimeline();
  }

  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$("main section[id]").forEach((s) => sectionIO.observe(s));

  /* ---------- Mobile menu ---------- */
  const burger = $("#burger");
  const menu = $("#mobileMenu");
  function setMenu(open) {
    burger.classList.toggle("is-open", open);
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.setAttribute("aria-hidden", !open);
    document.body.classList.toggle("is-locked", open);
    document.body.classList.toggle("menu-open", open);
  }
  burger.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false); });

  /* ---------- Horizontal process ---------- */
  const processSec = $("#process");
  const processTrack = $("#processTrack");
  const processBar = $("#processBar");
  const desktopMQ = matchMedia("(min-width: 901px)");

  function updateProcess() {
    if (!desktopMQ.matches) { processTrack.style.transform = ""; return; }
    const r = processSec.getBoundingClientRect();
    const total = processSec.offsetHeight - innerHeight;
    const p = clamp(-r.top / total, 0, 1);
    const distance = processTrack.scrollWidth - innerWidth;
    processTrack.style.transform = `translate3d(${-distance * p}px, 0, 0)`;
    processBar.style.transform = `scaleX(${p})`;
  }

  /* ---------- Timeline fill ---------- */
  const timeline = $("#timeline");
  const timelineFill = $("#timelineFill");
  const tlItems = $$(".tl-item");
  function updateTimeline() {
    const r = timeline.getBoundingClientRect();
    const mid = innerHeight * 0.6;
    const p = clamp((mid - r.top) / r.height, 0, 1);
    timelineFill.style.height = p * 100 + "%";
    tlItems.forEach((item) => {
      const dot = item.querySelector(".tl-item__dot").getBoundingClientRect();
      item.classList.toggle("is-lit", dot.top < mid);
    });
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ---------- 3D principles carousel ---------- */
  (function carousel() {
    const stage = $("#stage");
    const ring = $("#ring");
    const cards = $$(".ring__card", ring);
    const n = cards.length;
    const step = 360 / n;
    let rot = 0, vel = 0, dragging = false, lastX = 0, radius = 400, visible = false;

    function layout() {
      const w = ring.offsetWidth;
      radius = Math.round(w / 2 / Math.tan(Math.PI / n)) + 40;
    }
    function render() {
      ring.style.transform = `translateZ(${-radius}px) rotateY(${rot}deg)`;
      cards.forEach((c, i) => {
        const a = ((i * step + rot) % 360 + 360) % 360;
        const facing = (Math.cos((a * Math.PI) / 180) + 1) / 2;
        c.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`;
        c.style.opacity = (0.25 + facing * 0.75).toFixed(3);
        c.style.filter = `brightness(${(0.5 + facing * 0.6).toFixed(3)})`;
      });
    }
    function loop() {
      if (visible) {
        if (!dragging) {
          vel = lerp(vel, reduceMotion ? 0 : -0.12, 0.03);
          rot += vel;
        }
        render();
      }
      requestAnimationFrame(loop);
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

    stage.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; vel = 0;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      vel = dx * 0.25;
      rot += vel;
    });
    const end = () => { dragging = false; };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);

    layout(); render(); loop();
    window.addEventListener("resize", () => { layout(); render(); });
  })();

  /* ---------- FAQ accordion ---------- */
  $$(".acc").forEach((acc) => {
    const btn = $(".acc__q", acc);
    btn.addEventListener("click", () => {
      const open = !acc.classList.contains("is-open");
      $$(".acc.is-open").forEach((o) => { o.classList.remove("is-open"); $(".acc__q", o).setAttribute("aria-expanded", "false"); });
      acc.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open);
    });
  });

  /* ---------- Contact form (front-end only) ---------- */
  const form = $("#contactForm");
  const toast = $("#toast");
  const submitBtn = $("#submitBtn");

  function validateField(input) {
    const field = input.closest(".field");
    let ok = input.checkValidity();
    if (input.required && !input.value.trim()) ok = false;
    if (input.type === "tel" && input.value) ok = /^[0-9+\s-]{10,15}$/.test(input.value.trim());
    field && field.classList.toggle("is-invalid", !ok);
    return ok;
  }
  $$("input, textarea, select", form).forEach((el) => {
    if (el.type === "checkbox") return;
    el.addEventListener("blur", () => { if (el.value) validateField(el); });
    el.addEventListener("input", () => { if (el.closest(".field").classList.contains("is-invalid")) validateField(el); });
    el.addEventListener("change", () => validateField(el));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fields = $$("input:not([type=checkbox]), textarea, select", form);
    const okFields = fields.map(validateField).every(Boolean);
    const agree = $("#fAgree");
    agree.closest(".check").classList.toggle("is-invalid", !agree.checked);
    if (!okFields || !agree.checked) {
      const firstBad = form.querySelector(".is-invalid input, .is-invalid textarea, .is-invalid select") || agree;
      firstBad.focus();
      return;
    }

    // No backend: simulate sending. Hook up Formspree / EmailJS / your API here.
    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;
    setTimeout(() => {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
      form.reset();
      $$(".is-invalid", form).forEach((f) => f.classList.remove("is-invalid"));
      toast.classList.add("is-show");
      setTimeout(() => toast.classList.remove("is-show"), 4500);
    }, 1400);
  });

  /* ---------- Footer year ---------- */
  $("#year").textContent = new Date().getFullYear();

  /* =========================================================
     HERO DEPTH — gold dust + halo rings behind Lady Justice (Three.js)
     ========================================================= */
  function initHero3D() {
    const canvas = $("#hero3d");
    if (!canvas || typeof THREE === "undefined") return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 13);

    const root = new THREE.Group();
    scene.add(root);

    // Halo rings orbiting the statue
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xd4ae62, transparent: true, opacity: 0.25 });
    const halo1 = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.008, 8, 256), haloMat);
    const halo2 = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.006, 8, 256), haloMat.clone());
    halo2.material.opacity = 0.14;
    root.add(halo1, halo2);

    // Gold dust
    const COUNT = innerWidth < 900 ? 350 : 800;
    const dustPos = new Float32Array(COUNT * 3);
    const dustSpeed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 16;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
      dustSpeed[i] = 0.002 + Math.random() * 0.006;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const sprite = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const x = c.getContext("2d");
      const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, "rgba(255,235,190,1)"); rg.addColorStop(0.3, "rgba(230,190,110,.6)"); rg.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = rg; x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size: 0.09, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9,
    }));
    scene.add(dust);

    // Keep the rings centred on the photo frame
    const visual = $(".hero__visual");
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const cr = canvas.getBoundingClientRect();
      const vr = visual.getBoundingClientRect();
      const ndcX = ((vr.left + vr.width / 2 - cr.left) / w) * 2 - 1;
      const ndcY = -(((vr.top + vr.height / 2 - cr.top) / h) * 2 - 1);
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      root.position.set(ndcX * halfH * camera.aspect, ndcY * halfH, 0);
      root.scale.setScalar(clamp(vr.height / h, 0.4, 1) * 1.15);
    }
    resize();
    window.addEventListener("resize", resize);

    let tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener("pointermove", (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });

    let active = true;
    new IntersectionObserver(([e]) => { active = e.isIntersecting; }).observe($(".hero"));

    const clock = new THREE.Clock();
    let intro = 0;
    function frame() {
      requestAnimationFrame(frame);
      if (!active) return;
      const t = clock.getElapsedTime();
      if (document.body.classList.contains("loaded")) intro = Math.min(1, intro + 0.01);
      const ei = 1 - Math.pow(1 - intro, 3);
      cx = lerp(cx, tx, 0.05); cy = lerp(cy, ty, 0.05);

      halo1.rotation.set(Math.PI * 0.5 + cy * 0.2 + Math.sin(t * 0.3) * 0.15, t * 0.1 + cx * 0.3, 0);
      halo2.rotation.set(Math.PI * 0.42 - cy * 0.2, -t * 0.07, Math.sin(t * 0.2) * 0.2);
      haloMat.opacity = 0.25 * ei;
      halo2.material.opacity = 0.14 * ei;

      for (let i = 0; i < COUNT; i++) {
        dustPos[i * 3 + 1] += dustSpeed[i];
        dustPos[i * 3] += Math.sin(t * 0.5 + i) * 0.0015;
        if (dustPos[i * 3 + 1] > 5) dustPos[i * 3 + 1] = -5;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dust.rotation.y = cx * 0.15;
      dust.material.opacity = 0.9 * ei;

      camera.position.x = lerp(camera.position.x, cx * 0.4, 0.05);
      camera.position.y = lerp(camera.position.y, -cy * 0.3, 0.05);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    frame();
  }

  if (typeof THREE !== "undefined") initHero3D();
  else window.addEventListener("load", initHero3D);
})();
