/* =============================================================================
   ROTOR — comportamiento
   -----------------------------------------------------------------------------
   Script clásico, sin módulos: funciona igual abierto desde el disco que
   servido por Apache. Cada init va envuelto en safe(): si uno falla, el resto
   sigue vivo.
   ========================================================================== */

(function () {
  "use strict";

  var data = window.__ROTOR__ || {};

  /* --- Ayudas ------------------------------------------------------------ */
  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(sel));
  };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  function escHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "]", e); }
  }

  var hasGSAP = !!(window.gsap && window.ScrollTrigger);

  /* =========================================================================
     Año del pie
     ====================================================================== */
  function initYear() {
    var el = $("[data-year]");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* =========================================================================
     Navegación: encogido, progreso, sección activa y menú móvil
     ====================================================================== */
  function initNav() {
    var nav = $("[data-nav]");
    var bar = $("[data-nav-progress] span");
    if (!nav) return;

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || 0;
        nav.classList.toggle("is-stuck", y > 40);
        if (bar) {
          var max = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.width = (max > 0 ? clamp(y / max, 0, 1) * 100 : 0) + "%";
        }
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* Menú móvil */
    var burger = $("[data-burger]");
    var menu = $("[data-menu]");
    if (burger && menu) {
      var setOpen = function (open) {
        burger.setAttribute("aria-expanded", String(open));
        burger.querySelector(".sr-only").textContent = open ? "Cerrar menú" : "Abrir menú";
        document.body.style.overflow = open ? "hidden" : "";
        if (open) {
          menu.hidden = false;
          requestAnimationFrame(function () { menu.classList.add("is-open"); });
        } else {
          menu.classList.remove("is-open");
          setTimeout(function () { if (!menu.classList.contains("is-open")) menu.hidden = true; }, 400);
        }
      };
      burger.addEventListener("click", function () {
        setOpen(burger.getAttribute("aria-expanded") !== "true");
      });
      menu.addEventListener("click", function (e) {
        if (e.target.closest("a")) setOpen(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") setOpen(false);
      });
      // Si se pasa a escritorio con el menú abierto, se cierra solo.
      matchMedia("(min-width: 960px)").addEventListener("change", function (e) {
        if (e.matches && burger.getAttribute("aria-expanded") === "true") setOpen(false);
      });
    }
  }

  /* Sección activa en el menú. Necesita ScrollTrigger. */
  function initScrollSpy() {
    var links = $$(".nav__links a");
    if (!links.length) return;
    links.forEach(function (a) {
      var id = a.getAttribute("href");
      if (!id || id.charAt(0) !== "#") return;
      var sec = document.querySelector(id);
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec,
        start: "top 45%",
        end: "bottom 45%",
        onToggle: function (self) { a.classList.toggle("is-current", self.isActive); }
      });
    });
  }

  /* =========================================================================
     Anclas. Scroll nativo, descontando la altura de la barra.
     ====================================================================== */
  function initAnchors() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();

      var offset = window.innerWidth >= 960 ? 90 : 74;
      var top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });

      // "Solicitar presupuesto" deja el cursor donde toca.
      if (a.dataset.prefill === "presupuesto") {
        setTimeout(function () {
          var sel = $("#f-presupuesto");
          if (sel) sel.focus({ preventScroll: true });
        }, reduced ? 60 : 750);
      }
    });
  }

  /* =========================================================================
     Cursor. Solo con puntero fino; en táctil ni se monta.
     ====================================================================== */
  function initCursor() {
    if (!fineHover || reduced) return;
    var root = $("[data-cursor]");
    if (!root) return;
    var dot = $(".cursor__dot", root);
    var ring = $(".cursor__ring", root);
    var mx = 0, my = 0, rx = 0, ry = 0, started = false, raf = 0;

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!started) {
        started = true;
        rx = mx; ry = my;
        root.classList.add("is-ready");
        loop();
      }
    }, { passive: true });

    function loop() {
      rx += (mx - rx) * 0.17;
      ry += (my - ry) * 0.17;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      raf = requestAnimationFrame(loop);
    }

    var HOT = "a, button, .proj, .card, .piece, .chip, input, select, textarea, [role='button']";
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest(HOT)) root.classList.add("is-hot");
    });
    document.addEventListener("mouseout", function (e) {
      var from = e.target.closest(HOT);
      if (from && !from.contains(e.relatedTarget)) root.classList.remove("is-hot");
    });
    document.addEventListener("mouseleave", function () { root.classList.remove("is-ready"); });
    document.addEventListener("mouseenter", function () { if (started) root.classList.add("is-ready"); });
  }

  /* =========================================================================
     Apariciones al entrar en pantalla. Umbral bajísimo y red de seguridad:
     a los 6 s se muestra todo lo que siga escondido.
     ====================================================================== */
  function initReveals() {
    var items = $$(".reveal");
    $$("[data-stagger]").forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.classList.add("reveal");
        child.style.setProperty("--i", i);
        items.push(child);
      });
    });
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        io.unobserve(en.target);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -4% 0px" });

    items.forEach(function (el) { io.observe(el); });

    setTimeout(function () {
      $$(".reveal:not(.is-in)").forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight * 1.4) el.classList.add("is-in");
      });
    }, 6000);
  }

  /* =========================================================================
     LA CINEMÁTICA
     -------------------------------------------------------------------------
     Secuencia de fotogramas sobre canvas, no un <video>. Buscar dentro de un
     MP4 fotograma a fotograma da tirones —el navegador solo puede saltar
     limpiamente a los fotogramas clave—, y hacia atrás es peor. Con imágenes
     sueltas cada posición de scroll tiene su fotograma exacto, en los dos
     sentidos, sin decodificador de por medio.
     ====================================================================== */
  function initCinema() {
    var section = $("[data-cinema]");
    var canvas = $("[data-cinema-canvas]");
    var poster = $("[data-cinema-poster]");
    if (!section || !canvas) return;

    var cfg = data.despiece || {};
    var total = cfg.total || 100;
    var FIN = cfg.finDelMovimiento || 0.88;
    var ctx = canvas.getContext("2d", { alpha: false });

    var hero = $("[data-hero]");
    var beats = $$(".beat");
    var rotulos = data.rotulos || [];
    var closeA = $("[data-close-a]");
    var closeB = $("[data-close-b]");
    var rail = $("[data-rail]");
    var railFill = $("[data-rail-fill]");
    var railPct = $("[data-rail-pct]");
    var loaderBox = $("[data-loader]");
    var loaderFill = loaderBox ? loaderBox.querySelector("i") : null;

    /* --- Elección de la secuencia ---------------------------------------- */
    var lowData = false;
    try {
      var conn = navigator.connection;
      lowData = !!(conn && (conn.saveData || /2g/.test(conn.effectiveType || "")));
    } catch (e) {}

    var narrow = window.innerWidth < (cfg.cortePorAncho || 900);
    var base = (cfg.rutas || {})[narrow || lowData ? "movil" : "escritorio"] || "assets/frames/d/";
    // Con datos limitados se carga una de cada dos: la mitad de peso.
    var stride = lowData ? 2 : 1;

    var imgs = new Array(total);
    var readyCount = 0;
    var firstDrawn = false;

    function pad(n) { return (n < 10 ? "00" : n < 100 ? "0" : "") + n; }

    /* Orden de descarga por subdivisión: en cualquier momento de la carga los
       fotogramas disponibles cubren la secuencia entera de forma pareja, en
       vez de tener el principio listo y el final vacío. */
    function buildOrder() {
      var order = [], seen = {};
      function push(i) { if (i >= 0 && i < total && !seen[i]) { seen[i] = 1; order.push(i); } }
      push(0); push(total - 1);
      var step = total - 1;
      while (step > 1) {
        step = Math.ceil(step / 2);
        for (var i = step; i < total - 1; i += step) push(i);
      }
      for (var j = 0; j < total; j += stride) push(j);
      return order;
    }

    var queue = buildOrder();
    var cursor = 0, active = 0;
    var CONC = cfg.descargasEnParalelo || 6;

    function pump() {
      while (active < CONC && cursor < queue.length) {
        (function (i) {
          active++;
          var img = new Image();
          img.decoding = "async";
          img.onload = img.onerror = function () {
            active--;
            if (img.naturalWidth) { imgs[i] = img; readyCount++; }
            if (!firstDrawn && imgs[0]) { firstDrawn = true; handoff(); }
            paintLoader();
            render(lastP, true);
            pump();
          };
          img.src = base + pad(i) + ".webp";
        })(queue[cursor++]);
      }
    }

    function paintLoader() {
      if (!loaderFill || !loaderBox) return;
      var pct = readyCount / Math.ceil(total / stride);
      loaderFill.style.width = clamp(pct, 0, 1) * 100 + "%";
      loaderBox.classList.toggle("is-on", pct < 0.995);
    }

    function handoff() {
      canvas.classList.add("is-live");
      if (poster) poster.classList.add("is-gone");
    }

    /* El fotograma pedido puede no haber llegado: se pinta el más cercano. */
    function pick(i) {
      if (imgs[i]) return imgs[i];
      for (var d = 1; d < total; d++) {
        if (imgs[i - d]) return imgs[i - d];
        if (imgs[i + d]) return imgs[i + d];
      }
      return null;
    }

    /* --- Lienzo ----------------------------------------------------------- */
    var cw = 0, ch = 0, mobileLayout = false;

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = Math.round(r.width * dpr);
      ch = Math.round(r.height * dpr);
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
      mobileLayout = window.innerWidth < 900;
      paint(lastFrame);
    }

    var lastFrame = -1;
    function paint(i) {
      var img = pick(i);
      if (!img || !cw || !ch) return;
      ctx.fillStyle = "#06070A";
      ctx.fillRect(0, 0, cw, ch);

      var ir = img.naturalWidth / img.naturalHeight;
      var dw, dh, dx, dy;

      if (mobileLayout) {
        /* En vertical el reloj se coloca arriba, entero, y el texto ocupa la
           mitad de abajo. Recortarlo a pantalla completa se comería las piezas
           que salen despedidas hacia los lados. */
        dw = cw * 1.12;
        dh = dw / ir;
        dx = (cw - dw) / 2;
        dy = ch * 0.31 - dh / 2;
      } else {
        /* Encuadre de base: cubrir el hueco entero, sin bordes. */
        var cr = cw / ch;
        var bw, bh;
        if (cr > ir) { bw = cw; bh = cw / ir; }
        else { bh = ch; bw = ch * ir; }

        /* Deriva de cámara. Al principio el reloj se corre a la derecha —lo
           que sobra de ancho al cubrir— para dejar limpia la columna del
           titular; en cuanto arranca el despiece vuelve al centro y se acerca
           un poco. Es el movimiento que hace un operador de cámara al abrir
           plano, y cuesta cero: son dos números en el drawImage. */
        var t = clamp(lastP / 0.30, 0, 1);
        t = t * t * (3 - 2 * t);
        var scale = 1 + 0.055 * clamp(lastP / 0.9, 0, 1);
        var slack = (bw - cw) / bw / 2;          // margen disponible, 0 → 0.5
        var cx = 0.5 + slack * (1 - t) * 0.96;

        dw = bw * scale;
        dh = bh * scale;
        dx = cw * cx - dw / 2;
        dy = ch * 0.5 - dh / 2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    /* --- Rótulos ---------------------------------------------------------- */
    function windowAlpha(p, a, b, edge) {
      if (p <= a || p >= b) return 0;
      var t = (p - a) / (b - a);
      var e = edge || 0.24;
      return clamp(Math.min(t / e, (1 - t) / e), 0, 1);
    }

    var lastP = 0;

    function render(p, force) {
      lastP = p;

      var frame = Math.round(clamp(p / FIN, 0, 1) * (total - 1));
      // Mientras la cámara deriva hay que repintar aunque el fotograma
      // repita: lo que cambia es el encuadre, no la imagen.
      if (frame !== lastFrame || force || p < 0.32) { lastFrame = frame; paint(frame); }

      /* Portada: se retira en cuanto arranca el scroll. */
      if (hero) {
        var ha = 1 - clamp(p / 0.075, 0, 1);
        hero.style.opacity = ha;
        hero.style.transform = "translate3d(0," + (-p * 90).toFixed(1) + "px,0)";
        hero.style.pointerEvents = ha > 0.06 ? "" : "none";
      }

      /* Los cinco conceptos, sincronizados con el despiece. */
      for (var i = 0; i < beats.length; i++) {
        var r = rotulos[i];
        if (!r) continue;
        var a = windowAlpha(p, r.desde, r.hasta);
        var t = clamp((p - r.desde) / (r.hasta - r.desde), 0, 1);
        beats[i].style.opacity = a;
        beats[i].style.transform = "translate3d(0," + ((0.5 - t) * 46).toFixed(1) + "px,0)";
      }

      /* Cierre. */
      if (closeA) {
        var aa = windowAlpha(p, 0.893, 0.968, 0.3);
        closeA.style.opacity = aa;
        closeA.style.transform = "scale(" + (0.985 + aa * 0.015).toFixed(4) + ")";
      }
      if (closeB) {
        var bb = clamp((p - 0.953) / 0.035, 0, 1);
        closeB.style.opacity = bb;
        closeB.style.transform = "translate3d(0," + ((1 - bb) * 22).toFixed(1) + "px,0)";
      }

      /* Indicador lateral. */
      if (railFill) railFill.style.height = clamp(p / FIN, 0, 1) * 100 + "%";
      if (railPct) {
        var n = Math.round(clamp(p / FIN, 0, 1) * 100);
        railPct.textContent = (n < 10 ? "0" : "") + n;
      }
      if (rail) rail.classList.toggle("is-on", p > 0.04 && p < 0.995);
    }

    /* --- Enganche al scroll ---------------------------------------------- */
    // La altura de la sección define cuánto scroll dura el despiece.
    if (reduced) section.style.height = narrow ? "320vh" : "380vh";

    window.addEventListener("resize", function () {
      resize();
      if (hasGSAP) ScrollTrigger.refresh();
    });

    resize();
    pump();
    render(0, true);

    if (!hasGSAP) {
      // Sin GSAP el despiece sigue funcionando, solo que sin suavizado.
      var raw = function () {
        var r = section.getBoundingClientRect();
        var dist = section.offsetHeight - window.innerHeight;
        render(dist > 0 ? clamp(-r.top / dist, 0, 1) : 0);
      };
      window.addEventListener("scroll", raw, { passive: true });
      raw();
      return;
    }

    /* El objeto `drive` lo mueve un tween con scrub: GSAP se encarga de
       perseguir la posición del scroll con inercia, así que el despiece no da
       saltos aunque la rueda del ratón sí los dé. */
    var drive = { p: 0 };
    gsap.to(drive, {
      p: 1,
      ease: "none",
      onUpdate: function () { render(drive.p); },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: reduced ? true : 0.55,
        invalidateOnRefresh: true
      }
    });
  }

  /* =========================================================================
     Plataformas: los dos teléfonos se mueven a distinta velocidad y responden
     levemente al ratón.
     ====================================================================== */
  function initDevices() {
    var root = $("[data-parallax-root]");
    if (!root) return;
    var devices = $$("[data-tilt]", root);
    if (!devices.length) return;

    if (hasGSAP && !reduced) {
      devices.forEach(function (d) {
        var depth = parseFloat(d.dataset.depth || "1");
        gsap.fromTo(d,
          { "--ty": 70 * depth + "px", "--rx": 7 + "deg" },
          {
            "--ty": -40 * depth + "px", "--rx": "0deg",
            ease: "none",
            scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: 0.6 }
          });
      });
    }

    if (!fineHover) return;
    var stage = $(".platforms__stage", root);
    if (!stage) return;
    stage.addEventListener("mousemove", function (e) {
      var r = stage.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5;
      var ny = (e.clientY - r.top) / r.height - 0.5;
      devices.forEach(function (d) {
        var depth = parseFloat(d.dataset.depth || "1");
        d.style.setProperty("--ry", (nx * 11 * depth).toFixed(2) + "deg");
        d.style.setProperty("--rz", (-nx * 1.6 * depth).toFixed(2) + "deg");
        d.style.setProperty("--my", (ny * -9 * depth).toFixed(2) + "px");
      });
    });
    stage.addEventListener("mouseleave", function () {
      devices.forEach(function (d) {
        d.style.setProperty("--ry", "0deg");
        d.style.setProperty("--rz", "0deg");
        d.style.setProperty("--my", "0px");
      });
    });
  }

  /* =========================================================================
     Piezas: entran descolocadas y se montan. Es el mismo gesto del despiece,
     al revés.
     ====================================================================== */
  function initPieces() {
    var list = $("[data-pieces]");
    if (!list) return;
    var pieces = $$(".piece", list);
    if (!pieces.length) return;

    if (!hasGSAP) { pieces.forEach(function (p) { p.style.opacity = 1; }); return; }

    // Semilla fija: el desorden es siempre el mismo, no cambia al recargar.
    var seed = 7;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }

    gsap.set(pieces, { opacity: 0 });
    gsap.fromTo(pieces,
      {
        opacity: 0,
        x: function () { return (rnd() * 2 - 1) * (reduced ? 20 : 110); },
        y: function () { return (rnd() * 2 - 1) * (reduced ? 12 : 70); },
        rotate: function () { return (rnd() * 2 - 1) * (reduced ? 2 : 12); },
        scale: 0.92
      },
      {
        opacity: 1, x: 0, y: 0, rotate: 0, scale: 1,
        duration: reduced ? 0.5 : 1.05,
        ease: "expo.out",
        stagger: { each: 0.04, from: "random" },
        scrollTrigger: { trigger: list, start: "top 80%", once: true }
      });
  }

  /* =========================================================================
     Proceso: el raíl se llena y cada etapa se enciende al llegar.
     ====================================================================== */
  function initProcess() {
    var list = $("[data-process]");
    if (!list || !hasGSAP) return;
    var fill = $("[data-process-fill]", list);
    var steps = $$(".step", list);

    if (fill) {
      ScrollTrigger.create({
        trigger: list,
        start: "top 72%",
        end: "bottom 72%",
        scrub: 0.4,
        onUpdate: function (self) { fill.style.height = (self.progress * 100).toFixed(2) + "%"; }
      });
    }
    steps.forEach(function (step) {
      ScrollTrigger.create({
        trigger: step,
        start: "top 72%",
        onEnter: function () { step.classList.add("is-on"); },
        onLeaveBack: function () { step.classList.remove("is-on"); }
      });
    });
  }

  /* =========================================================================
     Ficha ampliada de cada concepto
     ====================================================================== */
  function initSheet() {
    var sheet = $("[data-sheet]");
    var body = $("[data-sheet-body]");
    if (!sheet || !body || typeof sheet.showModal !== "function") return;

    var proyectos = data.proyectos || {};
    var opener = null;

    function open(card) {
      var key = card.dataset.proj;
      var info = proyectos[key];
      if (!info) return;

      var kicker = card.querySelector(".proj__kicker");
      var title = card.querySelector(".proj__title");
      var visual = card.querySelector(".proj__visual .phone");

      var piezas = (info.piezas || []).map(function (p) {
        return '<li><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg><span>' + escHTML(p) + "</span></li>";
      }).join("");

      body.innerHTML =
        '<p class="sheet__kicker">' + escHTML(kicker ? kicker.textContent : "") + "</p>" +
        '<h2 class="sheet__title">' + escHTML(title ? title.textContent : "") + "</h2>" +
        (visual ? '<div class="sheet__visual">' + visual.outerHTML + "</div>" : "") +
        '<p class="sheet__h">El punto de partida</p><p class="sheet__p">' + escHTML(info.reto) + "</p>" +
        '<p class="sheet__h">Lo que resolvería la app</p><p class="sheet__p">' + escHTML(info.respuesta) + "</p>" +
        '<p class="sheet__h">Piezas del proyecto</p><ul class="sheet__list">' + piezas + "</ul>" +
        '<div class="sheet__foot">' +
          '<a class="btn btn--primary" href="#contacto" data-sheet-cta>Quiero algo así para mi negocio</a>' +
          '<p class="sheet__note">Concepto de diseño propio. No representa a ningún cliente real.</p>' +
        "</div>";

      opener = card;
      sheet.showModal();
    }

    $$(".proj").forEach(function (card) {
      card.addEventListener("click", function () { open(card); });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(card); }
      });
    });

    $("[data-sheet-close]").addEventListener("click", function () { sheet.close(); });

    // Clic fuera del panel: el backdrop es el propio <dialog>.
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet) sheet.close();
    });
    sheet.addEventListener("click", function (e) {
      if (e.target.closest("[data-sheet-cta]")) sheet.close();
    });
    sheet.addEventListener("close", function () {
      body.innerHTML = "";
      if (opener) { opener.focus(); opener = null; }
    });
  }

  /* =========================================================================
     Formulario
     -------------------------------------------------------------------------
     Envía de verdad, a `contacto.php`. Si el servidor no responde (por ejemplo
     al abrir la web desde el disco), no se finge un envío correcto: se avisa y
     se ofrece el correo con el mensaje ya escrito.
     ====================================================================== */
  function initForm() {
    var form = $("[data-form]");
    if (!form) return;
    var ok = $("[data-form-ok]");
    var status = $("[data-form-status]");
    var okTitle = $("[data-form-ok-title]");
    var okText = $("[data-form-ok-text]");
    var contacto = data.contacto || {};

    var REGLAS = {
      nombre: { req: true, min: 2, msg: "Escribe tu nombre." },
      email: { req: true, re: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, msg: "Revisa el correo: falta algo." },
      sector: { req: true, msg: "Elige el tipo de negocio." },
      mensaje: { req: true, min: 12, msg: "Cuéntanos un poco más, con una frase basta." }
    };

    function fieldOf(name) {
      var el = form.elements[name];
      return el ? el.closest(".field") : null;
    }

    function validate(name) {
      var rule = REGLAS[name];
      var el = form.elements[name];
      if (!rule || !el) return true;
      var v = (el.value || "").trim();
      var bad = (rule.req && !v) || (rule.min && v.length < rule.min) || (rule.re && !rule.re.test(v));
      var wrap = fieldOf(name);
      if (wrap) {
        wrap.classList.toggle("is-bad", !!bad);
        var err = wrap.querySelector("[data-err-for]");
        if (err) err.textContent = bad ? rule.msg : "";
      }
      return !bad;
    }

    Object.keys(REGLAS).forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      el.addEventListener("blur", function () { if (el.value.trim()) validate(name); });
      el.addEventListener("input", function () {
        var wrap = fieldOf(name);
        if (wrap && wrap.classList.contains("is-bad")) validate(name);
      });
      el.addEventListener("change", function () { validate(name); });
    });

    function mailtoFallback(fd) {
      var cuerpo = [
        "Nombre: " + (fd.get("nombre") || ""),
        "Empresa: " + (fd.get("empresa") || ""),
        "Email: " + (fd.get("email") || ""),
        "Tipo de negocio: " + (fd.get("sector") || ""),
        "Objetivo: " + (fd.get("objetivo") || ""),
        "Funcionalidades: " + fd.getAll("funcionalidades[]").join(", "),
        "Presupuesto: " + (fd.get("presupuesto") || "—"),
        "",
        fd.get("mensaje") || ""
      ].join("\n");
      return "mailto:" + (contacto.email || "") +
        "?subject=" + encodeURIComponent("Quiero crear mi app") +
        "&body=" + encodeURIComponent(cuerpo);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.classList.contains("is-sending")) return;
      if (status) status.innerHTML = "";

      var valido = true, primero = null;
      Object.keys(REGLAS).forEach(function (name) {
        var okField = validate(name);
        if (!okField && !primero) primero = form.elements[name];
        valido = valido && okField;
      });
      if (!valido) {
        if (primero) primero.focus();
        return;
      }

      var fd = new FormData(form);

      // Trampa de robots: silencio y a otra cosa.
      if ((fd.get("web") || "").trim()) { form.reset(); return; }

      form.classList.add("is-sending");

      fetch(contacto.endpoint || "contacto.php", {
        method: "POST",
        body: fd,
        headers: { "X-Requested-With": "fetch" }
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json().catch(function () { return { ok: true }; });
        })
        .then(function (json) {
          if (json && json.ok === false) throw new Error(json.error || "rechazado");
          var nombre = String(fd.get("nombre") || "").trim().split(/\s+/)[0];
          if (okTitle) okTitle.textContent = nombre ? "Gracias, " + nombre + "." : "Recibido.";
          if (okText) {
            okText.textContent =
              "Hemos recibido tu mensaje. Lo leemos entero y te respondemos con una primera valoración de lo que nos cuentas.";
          }
          form.hidden = true;
          if (ok) { ok.hidden = false; ok.querySelector("h3").focus && ok.querySelector("h3").focus(); }
        })
        .catch(function (err) {
          console.warn("[form]", err);
          if (status) {
            status.innerHTML =
              "No hemos podido enviar el formulario desde aquí. " +
              'Escríbenos a <a href="' + escHTML(mailtoFallback(fd)) + '">' + escHTML(contacto.email || "") +
              "</a> y te contestamos igual.";
          }
        })
        .then(function () { form.classList.remove("is-sending"); });
    });

    var reset = $("[data-form-reset]");
    if (reset) {
      reset.addEventListener("click", function () {
        form.reset();
        $$(".field.is-bad", form).forEach(function (f) { f.classList.remove("is-bad"); });
        form.hidden = false;
        if (ok) ok.hidden = true;
        var first = form.elements.nombre;
        if (first) first.focus();
      });
    }
  }

  /* =========================================================================
     Arranque
     ====================================================================== */
  function boot() {
    if (hasGSAP) {
      try { gsap.registerPlugin(ScrollTrigger); } catch (e) {}
    }

    safe(initYear, "initYear");
    safe(initNav, "initNav");
    safe(initAnchors, "initAnchors");
    safe(initCursor, "initCursor");
    safe(initReveals, "initReveals");
    safe(initCinema, "initCinema");
    safe(initSheet, "initSheet");
    safe(initForm, "initForm");

    if (hasGSAP) {
      safe(initScrollSpy, "initScrollSpy");
      safe(initDevices, "initDevices");
      safe(initPieces, "initPieces");
      safe(initProcess, "initProcess");
      // Las fuentes cambian alturas al cargar: hay que recalcular los anclajes.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      }
      window.addEventListener("load", function () { ScrollTrigger.refresh(); });
    }

    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
