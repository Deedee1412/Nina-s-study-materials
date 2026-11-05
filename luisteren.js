/* Audiospeler voor de onderwerppagina's.
   Zoekt op de pagina een <section class="listen"> met een lijst <ol class="tracks">
   waarin elke <li> een link naar een mp3 heeft. Van die lijst maakt dit script
   een speler, plus een mini-speler onderin zodat je kunt meelezen.
   Zonder dit script werken de links gewoon als downloadlinks.

   Een blok toevoegen = één regel in de lijst:
   <li><a href="Blok%204.1%20Titel.mp3" data-dur="1:23">Titel</a></li>
*/
(function () {
  var section = document.querySelector(".listen");
  if (!section) return;
  var list = section.querySelector(".tracks");
  var links = [].slice.call(section.querySelectorAll(".tracks a"));
  if (!links.length) return;

  var KEY_COUNT = "nina-luister-teller";
  var KEY_LAST = "nina-luister-laatst";
  var KEY_SPEED = "nina-luister-snelheid";
  var TARGET = 3; // de audiogids zegt: luister elk blok 3 keer
  var SPEEDS = [1, 1.25, 1.5, 0.75];

  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }
  function fileOf(a) { return decodeURIComponent(a.getAttribute("href")); }
  function svg(path) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>'; }

  var I = {
    play: svg("M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"),
    pause: svg("M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"),
    prev: svg("M6 5h2v14H6zM9.5 12 19 5.5v13z"),
    next: svg("M16 5h2v14h-2zM14.5 12 5 18.5v-13z"),
    back: svg("M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"),
    up: svg("M7 14l5-5 5 5z")
  };

  var counts = load(KEY_COUNT, {});
  var last = load(KEY_LAST, {});
  var speedIdx = Math.max(0, SPEEDS.indexOf(load(KEY_SPEED, 1)));
  var page = location.pathname.split("/").pop() || "index";

  /* ---------- Lijst opmaken ---------- */
  links.forEach(function (a, i) {
    var title = a.textContent.trim();
    a.setAttribute("data-title", title);
    a.innerHTML =
      '<span class="t-n"><span class="num">' + (i + 1) + '</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>' +
      '<span class="t-title"></span>' +
      '<span class="t-meta"><span class="dots" aria-hidden="true"></span><span>' + (a.getAttribute("data-dur") || "") + "</span></span>";
    a.querySelector(".t-title").textContent = title;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      select(i, true);
    });
  });

  /* ---------- Grote speler ---------- */
  var player = document.createElement("div");
  player.className = "player";
  player.innerHTML =
    '<div class="p-head"><span class="p-count"></span></div>' +
    '<div class="p-title" aria-live="polite"></div>' +
    '<input type="range" class="p-seek" min="0" max="1000" step="1" value="0" aria-label="Positie in het blok">' +
    '<div class="p-time"><span class="p-cur">0:00</span><span class="p-len">0:00</span></div>' +
    '<div class="p-controls">' +
    '  <button type="button" class="p-ctrl p-back" aria-label="10 seconden terug">' + I.back + "</button>" +
    '  <button type="button" class="p-ctrl p-prev" aria-label="Vorig blok">' + I.prev + "</button>" +
    '  <button type="button" class="p-play" aria-label="Afspelen">' + I.play + "</button>" +
    '  <button type="button" class="p-ctrl p-next" aria-label="Volgend blok">' + I.next + "</button>" +
    '  <button type="button" class="p-ctrl p-speed" aria-label="Afspeelsnelheid wijzigen"></button>' +
    "</div>" +
    '<div class="p-labels" aria-hidden="true"><span>10 sec</span><span>vorige</span><span class="mid"></span><span>volgende</span><span>snelheid</span></div>' +
    '<p class="p-done" role="status"><b>Blok klaar!</b> Pauzeer even en zeg de kernwoorden hardop. Daarna tik je op volgende.</p>';
  list.before(player);

  /* Inklapbare lijst */
  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "tracks-toggle";
  toggle.innerHTML = '<span class="lbl"></span><span class="prog"></span><span class="chev" aria-hidden="true">&#9662;</span>';
  list.hidden = true;
  function setToggle() {
    toggle.querySelector(".lbl").textContent = list.hidden ? "Alle " + links.length + " blokken" : "Verberg blokken";
    toggle.setAttribute("aria-expanded", String(!list.hidden));
  }
  toggle.addEventListener("click", function () { list.hidden = !list.hidden; setToggle(); });
  setToggle();
  list.before(toggle);

  /* ---------- Mini-speler onderin ---------- */
  var mini = document.createElement("div");
  mini.className = "mini";
  mini.setAttribute("aria-label", "Audiospeler");
  mini.innerHTML =
    '<div class="mini-bar"><i></i></div>' +
    '<div class="mini-row">' +
    '  <button type="button" class="mini-play" aria-label="Afspelen">' + I.play + "</button>" +
    '  <button type="button" class="mini-text" aria-label="Naar de speler"><small></small><b></b></button>' +
    '  <button type="button" class="mini-btn mini-next" aria-label="Volgend blok">' + I.next + "</button>" +
    '  <button type="button" class="mini-btn mini-up" aria-label="Naar de speler">' + I.up + "</button>" +
    "</div>";
  document.body.appendChild(mini);

  var audio = new Audio();
  audio.preload = "none";

  var q = function (root, c) { return root.querySelector(c); };
  var btnPlay = q(player, ".p-play"), seek = q(player, ".p-seek"), cur = q(player, ".p-cur"), len = q(player, ".p-len");
  var btnSpeed = q(player, ".p-speed"), btnPrev = q(player, ".p-prev"), btnNext = q(player, ".p-next"), done = q(player, ".p-done");
  var miniPlay = q(mini, ".mini-play"), miniNext = q(mini, ".mini-next"), miniBar = q(mini, ".mini-bar i");

  var index = 0, counted = false, seeking = false, started = false, playerVisible = true;

  function renderDots() {
    var full = 0;
    links.forEach(function (a) {
      var n = counts[fileOf(a)] || 0;
      var html = "";
      for (var k = 0; k < TARGET; k++) html += '<span class="dot' + (k < n ? " on" : "") + '"></span>';
      a.querySelector(".dots").innerHTML = html;
      a.setAttribute("title", n + " van " + TARGET + " keer geluisterd");
      a.parentNode.classList.toggle("full", n >= TARGET);
      if (n >= TARGET) full++;
    });
    toggle.querySelector(".prog").textContent = full + " van " + links.length + " af";
  }

  function setPlaying(on) {
    [btnPlay, miniPlay].forEach(function (b) {
      b.innerHTML = on ? I.pause : I.play;
      b.setAttribute("aria-label", on ? "Pauzeren" : "Afspelen");
    });
    links.forEach(function (x, k) { x.parentNode.classList.toggle("playing", on && k === index); });
  }

  function setProgress(t, d) {
    var pct = d ? Math.min(100, t / d * 100) : 0;
    seek.style.setProperty("--pct", pct + "%");
    miniBar.style.width = pct + "%";
    if (!seeking) seek.value = Math.round(pct * 10);
    cur.textContent = fmt(t);
  }

  function setSpeed() {
    audio.playbackRate = SPEEDS[speedIdx];
    btnSpeed.textContent = String(SPEEDS[speedIdx]).replace(".", ",") + "x";
  }

  function select(i, autoplay) {
    index = i;
    counted = false;
    var a = links[i];
    var title = a.getAttribute("data-title");
    audio.src = a.getAttribute("href");
    setSpeed();
    q(player, ".p-count").textContent = "Blok " + (i + 1) + " van " + links.length;
    q(player, ".p-title").textContent = title;
    q(mini, ".mini-text small").textContent = "Blok " + (i + 1) + " van " + links.length;
    q(mini, ".mini-text b").textContent = title;
    len.textContent = a.getAttribute("data-dur") || "0:00";
    setProgress(0, 0);
    done.classList.remove("show");
    btnNext.classList.remove("ready");
    btnPrev.disabled = i === 0;
    btnNext.disabled = miniNext.disabled = i === links.length - 1;
    links.forEach(function (x, k) { x.parentNode.classList.toggle("current", k === i); });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: title, album: document.title });
    }
    if (autoplay) play();
  }

  function play() { started = true; var p = audio.play(); if (p && p.catch) p.catch(function () {}); updateMini(); }
  function toggle_() { if (audio.paused) play(); else audio.pause(); }
  function nextBlok() { if (index < links.length - 1) select(index + 1, true); }

  /* Mini-speler tonen als de grote speler uit beeld is en er al geluisterd is */
  function updateMini() {
    var show = started && !playerVisible;
    mini.classList.toggle("show", show);
    document.body.classList.toggle("mini-on", show);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      playerVisible = entries[0].isIntersecting;
      updateMini();
    }).observe(player);
  }

  btnPlay.addEventListener("click", toggle_);
  miniPlay.addEventListener("click", toggle_);
  q(player, ".p-back").addEventListener("click", function () {
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  });
  btnSpeed.addEventListener("click", function () {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    save(KEY_SPEED, SPEEDS[speedIdx]);
    setSpeed();
  });
  btnPrev.addEventListener("click", function () { if (index > 0) select(index - 1, true); });
  btnNext.addEventListener("click", nextBlok);
  miniNext.addEventListener("click", nextBlok);
  function toPlayer() { player.scrollIntoView({ behavior: "smooth", block: "center" }); }
  q(mini, ".mini-text").addEventListener("click", toPlayer);
  q(mini, ".mini-up").addEventListener("click", toPlayer);

  seek.addEventListener("input", function () {
    seeking = true;
    var d = audio.duration;
    seek.style.setProperty("--pct", seek.value / 10 + "%");
    if (d) cur.textContent = fmt(seek.value / 1000 * d);
  });
  seek.addEventListener("change", function () {
    if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration;
    seeking = false;
  });

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", play);
      navigator.mediaSession.setActionHandler("pause", function () { audio.pause(); });
      navigator.mediaSession.setActionHandler("nexttrack", nextBlok);
      navigator.mediaSession.setActionHandler("previoustrack", function () { if (index > 0) select(index - 1, true); });
    } catch (e) {}
  }

  audio.addEventListener("play", function () { setPlaying(true); done.classList.remove("show"); btnNext.classList.remove("ready"); });
  audio.addEventListener("pause", function () { setPlaying(false); });
  audio.addEventListener("loadedmetadata", function () { len.textContent = fmt(audio.duration); });
  audio.addEventListener("timeupdate", function () {
    if (!audio.duration) return;
    setProgress(audio.currentTime, audio.duration);
    /* Telt als geluisterd bij 90% */
    if (!counted && audio.currentTime / audio.duration > 0.9) {
      counted = true;
      var f = fileOf(links[index]);
      counts[f] = Math.min(TARGET, (counts[f] || 0) + 1);
      save(KEY_COUNT, counts);
      renderDots();
    }
    last[page] = { i: index, t: Math.floor(audio.currentTime) };
    save(KEY_LAST, last);
  });
  /* Niet automatisch door: de gids vraagt om na elk blok even te pauzeren */
  audio.addEventListener("ended", function () {
    setPlaying(false);
    setProgress(audio.duration, audio.duration);
    done.classList.add("show");
    if (index < links.length - 1) btnNext.classList.add("ready");
    last[page] = { i: Math.min(index + 1, links.length - 1), t: 0 };
    save(KEY_LAST, last);
  });

  /* Verder waar je gebleven was */
  var start = last[page] && last[page].i < links.length ? last[page] : { i: 0, t: 0 };
  select(start.i, false);
  if (start.t > 0) {
    var resume = function () { audio.currentTime = start.t; audio.removeEventListener("loadedmetadata", resume); };
    audio.addEventListener("loadedmetadata", resume);
    cur.textContent = fmt(start.t);
  }
  setPlaying(false);
  renderDots();
})();
