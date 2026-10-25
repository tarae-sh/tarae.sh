(() => {
  const grid = document.getElementById("player");
  if (!grid) return;

  const frameBox = document.getElementById("term-frame");
  const fallback = document.getElementById("player-fallback");
  const beatNum = document.getElementById("beat-num");
  const beatText = document.getElementById("beat-text");
  const beatAnnouncer = document.getElementById("beat-announcer");
  const beatDots = document.getElementById("beat-dots");
  const playBtn = document.getElementById("play-toggle");
  const copyBtn = document.querySelector(".copy-btn");

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = copyBtn.getAttribute("data-copy") || "";
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      try {
        await navigator.clipboard.writeText(text);
        const prev = copyBtn.textContent;
        copyBtn.textContent = "copied";
        setTimeout(() => {
          copyBtn.textContent = prev;
        }, 1400);
      } catch (_) {
        // Ignore clipboard permission errors silently
      }
    });
  }

  const lightQuery = window.matchMedia("(prefers-color-scheme: light)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const colsCount = Number(grid.dataset.cols) || 120;
  const rowsCount = Number(grid.dataset.rows) || 32;
  const rowEls = [];
  for (let r = 0; r < rowsCount; r++) {
    const div = document.createElement("div");
    div.className = "term-row";
    grid.appendChild(div);
    rowEls.push(div);
  }
  const cursorEl = document.createElement("div");
  cursorEl.className = "term-cursor";
  cursorEl.hidden = true;
  grid.appendChild(cursorEl);

  let rec = null;
  let styleCss = [];
  let beatBtns = [];
  let currentBeat = -1;
  let frameIndex = 0;
  let playing = !reducedMotion.matches;
  let inView = true;
  let timer = null;
  let cells = makeGrid();
  const cache = new Map();

  function fitGrid() {
    if (!frameBox) return;
    const innerW = Math.max(280, frameBox.clientWidth - 26);
    // On desktop (>= 680px), fit all 120 columns across the full frame width.
    // On phone (< 680px), keep cells readable (>= 7.2px) and pan to the active beat's focus.
    const fit = window.innerWidth < 680 ? Math.max(7.2, innerW / colsCount) : innerW / colsCount;
    // (on the layout's own 1/64 px, so a cell's box is exactly the cell and n of them exactly n cells)
    const cellW = Math.floor(fit * 64) / 64;
    grid.style.setProperty("--cell-w", `${cellW}px`);
    grid.style.setProperty("--cols", String(colsCount));
  }

  // Every glyph sits in a box of its own cell (two for a wide one), so the columns hold whatever face the page
  // gets — a browser that keeps JetBrains Mono out, and whose `monospace` isn't, included. The font is sized from
  // the face actually in use: the widest advance among the recording's glyphs (each weight and slant it uses,
  // a wide glyph's half) sets it, so no glyph is wider than its cell. JetBrains Mono's every advance is 0.6 em,
  // as the grid was sized before, and a face no wider keeps that size.
  const MONO_ADVANCE = 0.6001;
  let glyphs = null;
  let measureCtx = null;

  function recordingGlyphs(data) {
    const narrow = new Set();
    const wide = new Set();
    for (const f of data.frames || []) {
      for (const runs of Object.values(f.rows || {})) {
        for (const run of runs) {
          for (const ch of run[2]) {
            if (ch === " ") continue;
            (isWideChar(ch.codePointAt(0)) ? wide : narrow).add(ch);
          }
        }
      }
    }
    const fonts = new Set(["400"]);
    for (const [, , flags] of data.styles || []) {
      fonts.add(`${flags & 2 ? "italic " : ""}${flags & 1 ? "700" : "400"}`);
    }
    return { narrow: [...narrow], wide: [...wide], fonts: [...fonts] };
  }

  // Measured at once with what's loaded, then again once each weight and slant the recording uses is (a face not
  // loaded yet measures as the next one in the list).
  function fitFont() {
    measureFont();
    if (!glyphs || !document.fonts || !document.fonts.load) return;
    const family = getComputedStyle(grid).fontFamily;
    const sample = glyphs.narrow.join("");
    Promise.all(glyphs.fonts.map((font) => document.fonts.load(`${font} 16px ${family}`, sample))).then(
      measureFont,
      measureFont
    );
  }

  function measureFont() {
    let advance = MONO_ADVANCE;
    try {
      if (glyphs) {
        measureCtx = measureCtx || document.createElement("canvas").getContext("2d");
        const family = getComputedStyle(grid).fontFamily;
        let widest = 0;
        for (const font of glyphs.fonts) {
          measureCtx.font = `${font} 100px ${family}`;
          for (const ch of glyphs.narrow) widest = Math.max(widest, measureCtx.measureText(ch).width);
          for (const ch of glyphs.wide) widest = Math.max(widest, measureCtx.measureText(ch).width / 2);
        }
        // (a hair over is let be: JetBrains Mono's subset lacks a glyph or two (`›`), which the next face draws at
        // 0.602 em — a few hundredths of a pixel, and its box keeps the column all the same)
        if (widest / 100 > MONO_ADVANCE * 1.01) advance = widest / 100 + 0.0001;
      }
    } catch (_) {
      // (no canvas: JetBrains Mono's proportion, as before)
    }
    grid.style.setProperty("--advance", advance.toFixed(4));
  }

  // Beat focus column on narrow screens (< 680px):
  // Beats 1 (index 0: session list) and 4 (index 3: sandbox card) focus the right pane;
  // Beats 2, 3, 5, 6 focus the code/weave pane on the left.
  function panToBeat(bIdx) {
    if (!frameBox || window.innerWidth >= 680) return;
    const maxScroll = Math.max(0, frameBox.scrollWidth - frameBox.clientWidth);
    if (maxScroll <= 0) return;
    const rightFocus = bIdx === 0 || bIdx === 3;
    const left = rightFocus ? maxScroll : 0;
    if (typeof frameBox.scrollTo === "function") {
      frameBox.scrollTo({ left, behavior: "instant" });
    } else {
      frameBox.scrollLeft = left;
    }
  }

  window.addEventListener("resize", () => {
    fitGrid();
    if (currentBeat >= 0) panToBeat(currentBeat);
  });

  function makeGrid() {
    const g = [];
    for (let r = 0; r < rowsCount; r++) {
      const row = [];
      for (let c = 0; c < colsCount; c++) {
        row.push({ s: 0, ch: " ", w: 0 });
      }
      g.push(row);
    }
    return g;
  }

  function isWideChar(code) {
    return (
      code >= 0x1100 &&
      (code <= 0x115f ||
        code === 0x2329 ||
        code === 0x232a ||
        (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe10 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6))
    );
  }

  function buildStyles(data) {
    const pal = data.palette || [];
    const styles = data.styles || [];
    styleCss = styles.map(([fg, bg, flags]) => {
      let css = `color:${pal[fg] || "inherit"}`;
      if (bg !== 0 && pal[bg]) css += `;background-color:${pal[bg]}`;
      if (flags & 1) css += ";font-weight:700";
      if (flags & 2) css += ";font-style:italic";
      if (flags & 4) css += ";text-decoration:underline";
      return css;
    });
  }

  function buildBeatDots(beats) {
    if (!beatDots) return;
    beatDots.replaceChildren();
    beatBtns = [];
    (beats || []).forEach((beat, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "beat-btn" + (idx === 0 ? " is-active" : "");
      btn.dataset.beat = String(idx);
      btn.textContent = String(idx + 1);
      btn.title = beat.label;
      btn.setAttribute("aria-label", `Beat ${idx + 1}: ${beat.label}`);
      btn.addEventListener("click", () => {
        if (!rec || !rec.beats || !rec.beats[idx]) return;
        setPlaying(false);
        seekToTime(rec.beats[idx].at, idx, true);
      });
      beatDots.appendChild(btn);
      beatBtns.push(btn);
    });
  }

  function patchRow(r, runs) {
    const row = cells[r];
    if (!row) return;
    for (let i = 0; i < runs.length; i++) {
      const [startCol, styleIdx, text] = runs[i];
      let c = startCol;
      for (const ch of text) {
        if (c >= colsCount) break;
        if (row[c].w === 2 && c > 0) {
          row[c - 1] = { s: row[c - 1].s, ch: " ", w: 0 };
        }
        const wide = isWideChar(ch.codePointAt(0));
        if (wide) {
          if (row[c].w === 1 && c + 1 < colsCount) {
            row[c + 1] = { s: styleIdx, ch: "", w: 2 };
          }
          if (c + 1 < colsCount && row[c + 1].w === 1 && c + 2 < colsCount) {
            row[c + 2] = { s: row[c + 2].s, ch: " ", w: 0 };
          }
          row[c] = { s: styleIdx, ch, w: 1 };
          if (c + 1 < colsCount) {
            row[c + 1] = { s: styleIdx, ch: "", w: 2 };
          }
          c += 2;
        } else {
          if (row[c].w === 1 && c + 1 < colsCount) {
            row[c + 1] = { s: row[c + 1].s, ch: " ", w: 0 };
          }
          row[c] = { s: styleIdx, ch, w: 0 };
          c += 1;
        }
      }
    }
  }

  // A cell's box: one glyph centred in its cell (`w`: a wide one in two), or a run of blanks as one box of their
  // cells. A run of one style stays one span holding its boxes.
  function cellBox(cls, text, n) {
    const b = document.createElement("span");
    b.className = cls;
    b.textContent = text;
    if (n > 1) b.style.setProperty("--n", String(n));
    return b;
  }

  function renderRowFromGrid(r) {
    const rowEl = rowEls[r];
    const row = cells[r];
    if (!rowEl || !row) return;
    const frag = document.createDocumentFragment();
    let c = 0;
    while (c < colsCount) {
      if (row[c].w === 2) {
        c++;
        continue;
      }
      const s = row[c].s;
      const span = document.createElement("span");
      const css = styleCss[s];
      if (css) span.style.cssText = css;
      while (c < colsCount && row[c].s === s) {
        const cell = row[c];
        if (cell.w === 2) {
          c++;
        } else if (cell.w === 1) {
          span.appendChild(cellBox("c w", cell.ch, 1));
          c += 2;
        } else if (cell.ch === " ") {
          let n = 0;
          while (c < colsCount && row[c].s === s && row[c].w === 0 && row[c].ch === " ") {
            n++;
            c++;
          }
          span.appendChild(cellBox("c", " ".repeat(n), n));
        } else {
          span.appendChild(cellBox("c", cell.ch, 1));
          c++;
        }
      }
      frag.appendChild(span);
    }
    rowEl.replaceChildren(frag);
  }

  function placeCursor(cursor) {
    if (!cursor) {
      cursorEl.hidden = true;
      return;
    }
    const [cx, cy] = cursor;
    cursorEl.hidden = false;
    cursorEl.style.left = `calc(var(--cell-w) * ${cx})`;
    cursorEl.style.top = `${cy * 1.45}em`;
  }

  function applyFrame(f, renderNow) {
    if (f.key) {
      cells = makeGrid();
    }
    const rows = f.rows || {};
    const keys = Object.keys(rows);
    for (let i = 0; i < keys.length; i++) {
      const r = Number(keys[i]);
      patchRow(r, rows[keys[i]]);
      if (renderNow) renderRowFromGrid(r);
    }
    if (renderNow) {
      placeCursor(f.cursor);
      updateBeat(f.t);
    }
  }

  function updateBeat(t, forcedIdx, announce) {
    if (!rec || !rec.beats || !rec.beats.length) return;
    let bIdx = 0;
    if (typeof forcedIdx === "number" && forcedIdx >= 0 && forcedIdx < rec.beats.length) {
      bIdx = forcedIdx;
    } else {
      for (let i = 0; i < rec.beats.length; i++) {
        if (t >= rec.beats[i].at) bIdx = i;
      }
    }
    const changed = bIdx !== currentBeat;
    currentBeat = bIdx;
    const label = rec.beats[bIdx].label;
    if (beatNum) beatNum.textContent = `${bIdx + 1}/${rec.beats.length}`;
    if (beatText) beatText.textContent = label;
    if (announce && beatAnnouncer) {
      beatAnnouncer.textContent = `Beat ${bIdx + 1} of ${rec.beats.length}: ${label}`;
    }
    beatBtns.forEach((btn, idx) => {
      btn.classList.toggle("is-active", idx === bIdx);
    });
    if (changed || announce) {
      panToBeat(bIdx);
    }
  }

  function seekToFrame(targetIdx, forcedBeatIdx, announce) {
    if (!rec || !rec.frames || !rec.frames.length) return;
    const clamped = Math.max(0, Math.min(targetIdx, rec.frames.length - 1));
    let keyIdx = clamped;
    while (keyIdx > 0 && !rec.frames[keyIdx].key) {
      keyIdx--;
    }
    for (let i = keyIdx; i <= clamped; i++) {
      applyFrame(rec.frames[i], false);
    }
    for (let r = 0; r < rowsCount; r++) {
      renderRowFromGrid(r);
    }
    const f = rec.frames[clamped];
    placeCursor(f.cursor);
    updateBeat(f.t, forcedBeatIdx, announce);
    frameIndex = clamped;
  }

  function seekToTime(ms, forcedBeatIdx, announce) {
    if (!rec || !rec.frames || !rec.frames.length) return;
    let idx = 0;
    for (let i = 0; i < rec.frames.length; i++) {
      if (rec.frames[i].t <= ms) idx = i;
      else break;
    }
    seekToFrame(idx, forcedBeatIdx, announce);
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (!playing || !inView || document.hidden || !rec || !rec.frames || rec.frames.length < 2) return;
    const cur = rec.frames[frameIndex];
    const nextIdx = (frameIndex + 1) % rec.frames.length;
    const next = rec.frames[nextIdx];
    const delay = nextIdx === 0 ? 1800 : Math.max(16, Math.min(2500, next.t - cur.t));
    timer = setTimeout(() => {
      if (nextIdx === 0) {
        seekToFrame(0);
      } else {
        frameIndex = nextIdx;
        applyFrame(next, true);
      }
      scheduleNext();
    }, delay);
  }

  function setPlaying(nextState) {
    playing = nextState;
    if (playBtn) {
      playBtn.textContent = playing ? "pause" : "play";
      playBtn.setAttribute("aria-label", playing ? "Pause playback" : "Resume playback");
    }
    if (playing) scheduleNext();
    else clearTimeout(timer);
  }

  if (playBtn) {
    playBtn.textContent = playing ? "pause" : "play";
    playBtn.setAttribute("aria-label", playing ? "Pause playback" : "Resume playback");
    playBtn.addEventListener("click", () => {
      if (!playing && rec && rec.frames && frameIndex >= rec.frames.length - 1) {
        seekToFrame(0);
      }
      setPlaying(!playing);
    });
  }

  async function loadTheme() {
    const url = lightQuery.matches ? grid.dataset.hanji : grid.dataset.meok;
    if (!url) return;
    const hadRec = Boolean(rec);
    const currentT = rec && rec.frames && rec.frames[frameIndex] ? rec.frames[frameIndex].t : 0;
    try {
      if (!cache.has(url)) {
        const res = await fetch(url);
        if (!res.ok) return;
        cache.set(url, await res.json());
      }
      rec = cache.get(url);
      buildStyles(rec);
      buildBeatDots(rec.beats);
      glyphs = recordingGlyphs(rec);
      grid.hidden = false;
      if (fallback) fallback.hidden = true;
      fitGrid();
      fitFont();
      if (!hadRec && reducedMotion.matches && rec.frames && rec.frames.length) {
        seekToFrame(rec.frames.length - 1);
      } else {
        seekToTime(currentT);
      }
      requestAnimationFrame(() => {
        fitGrid();
        panToBeat(currentBeat);
      });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          fitGrid();
          fitFont();
          panToBeat(currentBeat);
        });
      }
      scheduleNext();
    } catch (_) {
      // Leave the static fallback picture visible if fetch fails
    }
  }

  lightQuery.addEventListener("change", () => {
    loadTheme();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer);
    else if (playing && inView) scheduleNext();
  });

  if ("IntersectionObserver" in window && frameBox) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          inView = entry.isIntersecting;
        }
        if (!inView) clearTimeout(timer);
        else if (playing && !document.hidden) scheduleNext();
      },
      { threshold: 0.1 }
    );
    io.observe(frameBox);
  }

  loadTheme();
})();
