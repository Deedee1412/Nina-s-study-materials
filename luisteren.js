/* Audiospeler voor de onderwerppagina's.
   Zoekt op de pagina een <section class="listen"> met een lijst <ol class="tracks">
   waarin elke <li> een link naar een mp3 heeft. Van die lijst maakt dit script
   één speler. Zonder dit script werken de links gewoon als downloadlinks.

   Een blok toevoegen = één regel in de lijst:
   <li><a href="Blok%204.1%20Titel.mp3" data-dur="1:23">Titel</a></li>
*/
(function () {
  var section = document.querySelector(".listen");
  if (!section) return;

  var links = [].slice.call(section.querySelectorAll(".tracks a"));
  if (!links.length) return;

  var KEY_COUNT = "nina-luister-teller";
  var KEY_LAST = "nina-luister-laatst";
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
    if (!isFinite(s)) return "0:00";
    s = Math.floor(s);
    return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }
  function fileOf(a) { return decodeURIComponent(a.getAttribute("href")); }

  var counts = load(KEY_COUNT, {});
  var last = load(KEY_LAST, {});
  var page = location.pathname.split("/").pop() || "index";

  /* Lijst opmaken: nummer, titel, duur en 3 bolletjes */
  links.forEach(function (a, i) {
    var title = a.textContent.trim();
    var dur = a.getAttribute("data-dur") || "";
    a.setAttribute("data-title", title);
    a.innerHTML =
      '<span class="t-n"><span>' + (i + 1) + "</span></span>" +
      '<span class="t-title"></span>' +
      '<span class="t-meta"><span class="dots" aria-hidden="true"></span><span class="t-dur">' + dur + "</span></span>";
    a.querySelector(".t-title").textContent = title;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      select(i, true);
    });
  });

  /* Speler bouwen */
  var player = document.createElement("div");
  player.className = "player";
  player.innerHTML =
    '<div class="player-now">Nu: blok <span class="p-num">1</span> van ' + links.length + "</div>" +
    '<div class="player-title"></div>' +
    '<div class="player-row">' +
    '  <button type="button" class="p-play" aria-label="Afspelen"></button>' +
    '  <div class="p-bar">' +
    '    <input type="range" class="p-seek" min="0" max="100" step="1" value="0" aria-label="Positie in het blok">' +
    '    <div class="p-time"><span class="p-cur">0:00</span><span class="p-len">0:00</span></div>' +
    "  </div>" +
    "</div>" +
    '<div class="player-tools">' +
    '  <button type="button" class="p-back">&#8634; 10 sec terug</button>' +
    '  <button type="button" class="p-speed" aria-label="Snelheid">Snelheid 1x</button>' +
    '  <button type="button" class="p-prev">&larr; Vorig blok</button>' +
    '  <button type="button" class="p-next">Volgend blok &rarr;</button>' +
    "</div>" +
    '<p class="p-done"><b>Blok klaar.</b> Pauzeer even en zeg de kernwoorden hardop. Klaar? Tik op "Volgend blok".</p>';
  var list = section.querySelector(".tracks");
  list.before(player);

  /* Lijst inklappen zodat de pagina rustig blijft */
  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "tracks-toggle";
  toggle.setAttribute("aria-expanded", "false");
  list.hidden = true;
  function setToggle() {
    toggle.textContent = list.hidden ? "Toon alle " + links.length + " blokken ▾" : "Verberg de blokken ▴";
    toggle.setAttribute("aria-expanded", String(!list.hidden));
  }
  toggle.addEventListener("click", function () { list.hidden = !list.hidden; setToggle(); });
  setToggle();
  list.before(toggle);

  var audio = new Audio();
  audio.preload = "none";

  var el = function (c) { return player.querySelector(c); };
  var btnPlay = el(".p-play"), seek = el(".p-seek"), cur = el(".p-cur"), len = el(".p-len");
  var btnSpeed = el(".p-speed"), btnPrev = el(".p-prev"), btnNext = el(".p-next"), done = el(".p-done");

  var ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

  var index = 0, speedIdx = 0, counted = false, seeking = false;

  function renderDots() {
    links.forEach(function (a) {
      var n = counts[fileOf(a)] || 0;
      var html = "";
      for (var k = 0; k < TARGET; k++) html += '<span class="dot' + (k < n ? " on" : "") + '"></span>';
      a.querySelector(".dots").innerHTML = html;
      a.setAttribute("title", n + " van " + TARGET + " keer geluisterd");
    });
  }

  function setPlaying(on) {
    btnPlay.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
    btnPlay.setAttribute("aria-label", on ? "Pauzeren" : "Afspelen");
  }

  function select(i, autoplay) {
    index = i;
    counted = false;
    var a = links[i];
    audio.src = a.getAttribute("href");
    audio.playbackRate = SPEEDS[speedIdx];
    el(".p-num").textContent = i + 1;
    el(".player-title").textContent = a.getAttribute("data-title");
    len.textContent = a.getAttribute("data-dur") || "0:00";
    cur.textContent = "0:00";
    seek.value = 0;
    done.classList.remove("show");
    btnNext.classList.remove("ready");
    btnPrev.disabled = i === 0;
    btnNext.disabled = i === links.length - 1;
    links.forEach(function (x, k) { x.parentNode.classList.toggle("current", k === i); });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: a.getAttribute("data-title"),
        album: document.title
      });
    }
    if (autoplay) audio.play();
  }

  btnPlay.addEventListener("click", function () {
    if (audio.paused) audio.play(); else audio.pause();
  });
  el(".p-back").addEventListener("click", function () {
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  });
  btnSpeed.addEventListener("click", function () {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    audio.playbackRate = SPEEDS[speedIdx];
    btnSpeed.textContent = "Snelheid " + String(SPEEDS[speedIdx]).replace(".", ",") + "x";
  });
  btnPrev.addEventListener("click", function () { if (index > 0) select(index - 1, true); });
  btnNext.addEventListener("click", function () { if (index < links.length - 1) select(index + 1, true); });

  seek.addEventListener("input", function () {
    seeking = true;
    if (audio.duration) cur.textContent = fmt(seek.value / 100 * audio.duration);
  });
  seek.addEventListener("change", function () {
    if (audio.duration) audio.currentTime = seek.value / 100 * audio.duration;
    seeking = false;
  });

  audio.addEventListener("play", function () { setPlaying(true); done.classList.remove("show"); });
  audio.addEventListener("pause", function () { setPlaying(false); });
  audio.addEventListener("loadedmetadata", function () { len.textContent = fmt(audio.duration); });
  audio.addEventListener("timeupdate", function () {
    if (!audio.duration) return;
    if (!seeking) {
      seek.value = audio.currentTime / audio.duration * 100;
      cur.textContent = fmt(audio.currentTime);
    }
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
