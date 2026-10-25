// The page as a woven view: three sessions — main, fix and docs, each in its colour — write it at once, each a
// caret of its own; where two write the same point the woven view shows both sides; docs asks before its check
// reaches the network; once all are done they're brought in and the page is plain text. The text is in the HTML
// as written (no JS, reduced motion: it simply stands); this only takes it away and gives it back.
(() => {
  // The install line's copy works however the page came (written, or standing as it is).
  document.addEventListener("click", async (e) => {
    const copy = e.target.closest(".b-copy");
    if (!copy) return;
    try {
      await navigator.clipboard.writeText(copy.dataset.copy || "");
      copy.textContent = "copied";
      setTimeout(() => (copy.textContent = "copy"), 1400);
    } catch (_) {
      // (the line is there to select by hand)
    }
  });

  const root = document.documentElement;

  // ── The top line ────────────────────────────────────────────────────────────
  // It stays at the top (CSS); stuck there it takes the rule under it, and once the big title is out of sight
  // its small name comes in at the line's start — written or standing, motion or none.
  const topline = document.getElementById("topline");
  const tlName = document.getElementById("tl-name");
  const titleGone = () => {
    const bar = topline.getBoundingClientRect();
    const title = document.querySelector(".b-brand");
    const t = title.getBoundingClientRect();
    // (while it's still to be written it takes no room: the header's place stands for it)
    return t.height ? t.bottom <= bar.bottom : title.parentElement.getBoundingClientRect().top < bar.bottom;
  };
  // (a browser sends scroll at most once a frame already)
  const updateTop = () => {
    topline.classList.toggle("stuck", topline.getBoundingClientRect().top <= 0.5 && window.scrollY > 0);
    tlName.classList.toggle("on", titleGone());
  };
  window.addEventListener("scroll", updateTop, { passive: true });
  window.addEventListener("resize", updateTop);
  updateTop();

  if (!root.classList.contains("anim")) return;

  const buf = document.getElementById("buf");
  const ink = document.getElementById("ink");
  const toast = document.getElementById("toast");
  const toastBody = document.getElementById("toast-body");
  const card = document.getElementById("card");
  const cardKeys = document.getElementById("card-keys");
  const strip = document.getElementById("strip");
  const path = document.getElementById("tl-path");
  const hint = document.getElementById("tl-hint");
  const pristine = buf.innerHTML;
  const pathPristine = path.innerHTML;

  const NAMES = ["main", "fix", "docs"];
  const COLOUR = { main: 1, fix: 2, docs: 3 };
  const SEED = { main: 11, fix: 23, docs: 37 };
  // (tarae's presence: a tag stays this long after its session last wrote there, then fades)
  const TAG_STAY = 3000;

  class Stale extends Error {}

  let gen = 0;
  let cleanups = [];

  // A seeded generator: every visit streams the same way.
  function rng(seed) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function flash(e) {
    e.classList.remove("flash");
    void e.offsetWidth;
    e.classList.add("flash");
  }

  // Should anything go wrong once the text is taken (a replay's Stale aside), the page is given back as written:
  // the hero as it was and `.anim` off, so it stands as it does without motion.
  function fail(e) {
    if (!root.classList.contains("anim")) return;
    gen++;
    for (const c of cleanups) c();
    cleanups = [];
    buf.innerHTML = pristine;
    buf.removeAttribute("aria-busy");
    path.innerHTML = pathPristine;
    strip.replaceChildren();
    hint.hidden = true;
    ink.replaceChildren();
    toast.hidden = true;
    card.hidden = true;
    card.className = "card";
    root.classList.remove("anim", "woven");
    console.error(e);
  }

  function play() {
    try {
      weave();
    } catch (e) {
      if (!(e instanceof Stale)) fail(e);
    }
  }

  function weave() {
    // (too late: motion.js's failsafe gave the page back as written)
    if (!root.classList.contains("anim")) return;
    const g = ++gen;
    for (const c of cleanups) c();
    cleanups = [];
    const sl = (ms) =>
      new Promise((res, rej) => setTimeout(() => (g === gen ? res() : rej(new Stale())), ms));
    const until = async (cond) => {
      while (!cond()) await sl(90);
    };

    // ── The page taken back to its blanks ──────────────────────────────────
    buf.setAttribute("aria-busy", "true");
    buf.innerHTML = pristine;
    hint.hidden = true;
    ink.replaceChildren();
    toast.hidden = true;
    card.hidden = true;
    card.className = "card";
    updateTop();
    const $ = (id) => document.getElementById(id);
    const run = $("run");
    const runok = $("runok");
    const seal = $("seal");
    const chead = $("chead");
    const wrap = $("p4wrap");

    // A screen reader doesn't wait ~20 s for the page to be written: while it is, the written-out part is hidden
    // from it and a visually hidden copy of the whole text stands beside it (outside the busy hero, so it's read).
    // Brought in, the copy goes and the hero is read as it is. Meanwhile Tab reaches the copy's links, not the
    // hidden part's links and copy button (a control that says nothing) — those stay for a mouse or a finger.
    const written = [".b-hero", ".b-points", ".b-installwrap"].map((sel) => buf.querySelector(sel));
    const copy = el("div", "sr-only");
    for (const p of written) {
      const c = p.cloneNode(true);
      for (const e of c.querySelectorAll('[hidden], [aria-hidden="true"], button')) e.remove();
      for (const e of [c, ...c.querySelectorAll("*")]) {
        for (const a of ["id", "class", "data-w", "data-skip"]) e.removeAttribute(a);
      }
      copy.append(c);
    }
    buf.before(copy);
    const controls = written.flatMap((p) => [...p.querySelectorAll("a, button")]);
    for (const p of written) p.setAttribute("aria-hidden", "true");
    for (const c of controls) c.tabIndex = -1;
    const unhide = () => {
      copy.remove();
      for (const p of written) p.removeAttribute("aria-hidden");
      for (const c of controls) c.removeAttribute("tabindex");
    };
    cleanups.push(() => copy.remove());

    // Nothing written moves, and no empty page stands while it's written. The points as a whole are held at their
    // final height (the conflict's included), so the install line under them never moves, and the install line
    // holds its own; every other block takes no room until a session enters it (or one after it in reading order),
    // then its final height at once. The header is all in before anything under it is entered. What's in is always
    // the points' first ones in reading order, so each lands in its final cell (by rows: main's left, fix's
    // right), and a row that grows has nothing in under it yet. Measured here in one go with the text still in,
    // before the first frame shows any of it (the head's CSS lays it out the same).
    root.classList.add("woven");
    const p4f = buf.querySelector('[data-w="p4f"]');
    p4f.hidden = false;
    chead.hidden = false;
    chead.classList.add("mute");
    wrap.classList.add("on");
    const held = [];
    let holding = true;
    const hold = (e, h) => {
      e.style.minHeight = `${h}px`;
      held.push(e);
    };
    const points = buf.querySelector(".b-points");
    hold(points, points.offsetHeight);
    const heights = new Map();
    for (const b of buf.querySelectorAll("[data-w]")) heights.set(b, b.offsetHeight);
    p4f.hidden = true;
    wrap.classList.add("w-wait");

    const header = [...buf.querySelectorAll(".b-hero [data-w]")];
    const groups = new Map();
    for (const g of [header, [...points.querySelectorAll("[data-w]")]]) {
      for (const b of g) groups.set(b, g);
    }
    const takeOne = (b) => {
      if (!b.classList.contains("w-wait")) return;
      b.classList.remove("w-wait");
      if (b.parentElement === wrap) wrap.classList.remove("w-wait");
      if (holding) hold(b, heights.get(b));
    };
    const take = (b) => {
      const g = groups.get(b) || [];
      if (g !== header) header.forEach(takeOne);
      for (const e of g) {
        takeOne(e);
        if (e === b) break;
      }
    };

    const blocks = new Map();
    for (const b of buf.querySelectorAll("[data-w]")) {
      if (groups.has(b)) b.classList.add("w-wait");
      else hold(b, heights.get(b));
      const parts = [];
      const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          n.parentElement.closest("[data-skip]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        if (/^\s*$/.test(n.data) && n.data.includes("\n")) continue;
        const box = el("span", "t");
        n.replaceWith(box);
        parts.push({ box, chars: Array.from(n.data) });
      }
      for (const e of b.querySelectorAll("code, a, .mark")) e.classList.add("pending");
      if (b.classList.contains("b-install")) b.classList.add("blank");
      b.classList.add("ready");
      blocks.set(b.dataset.w, { el: b, parts, done: 0 });
    }
    const release = () => {
      holding = false;
      for (const e of held) e.style.minHeight = "";
      held.length = 0;
    };
    // Another width lays the text out anew: what's held no longer fits it, so it's let go (blocks entered after
    // that grow as they're written). A phone's bars coming and going change only the height.
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      release();
      fitStrip();
    };
    window.addEventListener("resize", onResize);
    cleanups.push(() => window.removeEventListener("resize", onResize));

    path.replaceChildren(el("span", "tl-woven", "woven"), " · ", el("b", "", "index.md"));

    // ── The sessions ───────────────────────────────────────────────────────
    strip.replaceChildren();
    const sess = {};
    NAMES.forEach((name) => {
      const caret = el("div", `caret own${COLOUR[name]}`);
      const tag = el("div", `tag own${COLOUR[name]}`);
      caret.hidden = true;
      tag.hidden = true;
      ink.append(caret, tag);
      const marker = el("span", "at", "​");
      sess[name] = { name, caret, tag, marker, rnd: rng(SEED[name]), block: null, skips: [], fade: 0 };
    });
    // The strip says each session's state as tarae's does (`working`, `▲ waits`, `done`); what it does where —
    // `reading`, `writing` — is its tag's. It's drawn from this, the sessions still named, in their order.
    const line = NAMES.map((name) => ({ name, word: "working", kind: "", ov: "" }));
    fitStrip();
    function state(name, word, kind) {
      const s = line.find((x) => x.name === name);
      s.word = word;
      s.kind = kind || "";
      fitStrip();
    }
    const overlap = (name, with_) => {
      line.find((x) => x.name === name).ov = with_;
      fitStrip();
    };
    // The strip stays one row, as tarae's chat line does: names stay whole; the states fold to their glyph first
    // (`▲` waits, `◦` the rest), then the sessions go into `+N` from the back — all but the front one and those
    // waiting on you, which stay named whatever the room. A folded one's `·` goes with it. The path gives way
    // only after (CSS), and never to nothing.
    function fitStrip() {
      const over = () => topline.scrollWidth > topline.clientWidth + 1 || path.scrollWidth > path.clientWidth + 1;
      const draw = (glyphs, shown) => {
        strip.replaceChildren();
        for (const s of shown) {
          if (strip.firstChild) strip.append(el("span", "dot", "·"));
          const entry = el("span", `s ${s.kind}`);
          entry.dataset.s = s.name;
          const word = glyphs ? (s.kind === "waits" ? "▲" : "◦") : s.word;
          const ov = s.ov ? (glyphs ? " ≈" : ` ≈ ${s.ov}`) : "";
          entry.append(el("b", `c${COLOUR[s.name]}`, s.name), " ", el("i", "", word), el("span", "ov warn", ov));
          strip.append(entry);
        }
        if (shown.length < line.length) {
          strip.append(el("span", "dot", "·"), el("span", "more", `+${line.length - shown.length}`));
        }
      };
      draw(false, line);
      if (!line.length || !over()) return;
      const shown = [...line];
      draw(true, shown);
      for (let i = shown.length - 1; i > 0 && over(); i--) {
        if (shown[i].kind === "waits") continue;
        shown.splice(i, 1);
        draw(true, shown);
      }
    }

    // Carets and tags sit in an overlay over the text, placed from each session's marker every frame. A tag never
    // lies over text: after the caret when the rest of its line has room (up to the block's edge, or a button in
    // it); else under the caret's line while that's free (a held block's lines not yet written); else there all
    // the same, on the page's own ground, so the text under it doesn't mix with it.
    const place = (s) => {
      if (!s.marker.isConnected) {
        s.caret.hidden = true;
        return;
      }
      const r = s.marker.getBoundingClientRect();
      const sx = window.scrollX;
      const sy = window.scrollY;
      const h = r.height || 18;
      s.caret.style.left = `${r.left + sx}px`;
      s.caret.style.top = `${r.top + sy}px`;
      s.caret.style.height = `${h}px`;
      if (s.tag.hidden) return;
      const tw = s.tag.offsetWidth;
      const th = s.tag.offsetHeight;
      const blk = s.block.getBoundingClientRect();
      let right = blk.right;
      for (const k of s.skips) {
        const kr = k.getBoundingClientRect();
        if (kr.left > r.left && kr.top < r.bottom && kr.bottom > r.top) right = Math.min(right, kr.left - 4);
      }
      let tx = r.left + 8;
      let ty = r.top + (h - th) / 2;
      let ground = false;
      if (tx + tw > right) {
        tx = Math.max(blk.left, Math.min(r.left, blk.right - tw));
        ty = r.bottom + 1;
        ground = ty + th > blk.bottom;
      }
      s.tag.classList.toggle("ground", ground);
      s.tag.style.left = `${tx + sx}px`;
      s.tag.style.top = `${ty + sy}px`;
    };
    // A toast says what changed among the sessions the strip names, so it never covers the strip: its frame's top
    // goes under the top line, however many rows that takes now (its name sits on the frame's edge, above it).
    const toastName = toast.querySelector(".fr-name");
    const placeToast = () => {
      const below = Math.max(16, topline.getBoundingClientRect().bottom);
      toast.style.top = `${below - toastName.offsetTop + 6}px`;
    };
    // Placed every frame, but only while there's something to place — a caret, a tag or the toast showing; once
    // none is (brought in, or the card waiting) the loop stops, and the next caret or toast wakes it.
    let looping = false;
    const showing = () =>
      !toast.hidden || Object.values(sess).some((s) => !s.caret.hidden || !s.tag.hidden);
    const tick = () => {
      if (g !== gen) return;
      for (const s of Object.values(sess)) place(s);
      if (!toast.hidden) placeToast();
      if (showing()) requestAnimationFrame(tick);
      else looping = false;
    };
    const wake = () => {
      if (looping) return;
      looping = true;
      requestAnimationFrame(tick);
    };

    const enter = (s, id, act) => {
      const b = blocks.get(id);
      s.block = b.el;
      take(b.el);
      b.el.classList.remove("blank");
      b.el.classList.add("own", `own${COLOUR[s.name]}`);
      s.skips = [...b.el.querySelectorAll("[data-skip]")];
      b.parts[0].box.append(s.marker);
      clearTimeout(s.fade);
      s.caret.hidden = false;
      s.tag.hidden = false;
      s.tag.classList.remove("gone");
      s.tag.textContent = `‹${s.name} ${act}›`;
      place(s);
      wake();
      return b;
    };
    const read = async (s, id, ms) => {
      enter(s, id, "reading");
      await sl(ms);
    };
    // Written as a stream arrives: a few characters at a time, now and then a longer wait for the next batch.
    const write = async (s, id, at) => {
      const b = enter(s, id, "writing");
      const total = b.parts.reduce((n, p) => n + p.chars.length, 0);
      for (const p of b.parts) {
        for (let a = p.box.parentElement; a && a !== b.el; a = a.parentElement) a.classList.remove("pending");
        p.box.append(s.marker);
        let i = 0;
        while (i < p.chars.length) {
          const n = 1 + Math.floor(s.rnd() * 4);
          s.marker.before(el("span", "wet", p.chars.slice(i, i + n).join("")));
          place(s);
          i += n;
          b.done += n;
          if (at && !at.fired && b.done >= total * at.share) {
            at.fired = true;
            at.then();
          }
          await sl(22 + s.rnd() * 46 + (s.rnd() < 0.05 ? 220 : 0));
        }
      }
    };
    // A tag stays only while it says something new: once its session stops writing — waiting on its card, or
    // done — the caret goes at once and the tag a while after.
    const rest = (s) => {
      s.marker.remove();
      s.caret.hidden = true;
      clearTimeout(s.fade);
      s.fade = setTimeout(() => {
        s.tag.classList.add("gone");
        s.fade = setTimeout(() => (s.tag.hidden = true), 120);
      }, TAG_STAY);
    };
    const finish = (s) => {
      rest(s);
      state(s.name, "done", "done");
    };

    // ── Toast and ask ──────────────────────────────────────────────────────
    // A message takes the toast's place: the newer news replaces what's there, and it starts its own time.
    let t1 = 0;
    let t2 = 0;
    const say = (...body) => {
      clearTimeout(t1);
      clearTimeout(t2);
      toastBody.replaceChildren(...body);
      toast.hidden = false;
      placeToast();
      wake();
      toast.classList.remove("gone");
      t1 = setTimeout(() => toast.classList.add("gone"), 3600);
      t2 = setTimeout(() => (toast.hidden = true), 3950);
    };
    cleanups.push(() => (clearTimeout(t1), clearTimeout(t2)));

    // An ask that came on its own waits in its faint frame, and never answers itself (tarae's cards don't).
    // Untouched for a while it folds to its one-row peek; a click or a tap opens it again, focused — a click never
    // answers it — as Tab does; then `y` and `n` answer and `esc` gives it back. Focused and then left alone, it
    // folds back to the peek. (No `C-q` on the web: it quits some browsers.)
    const UNTOUCHED = 5000;
    const LEFT_ALONE = 10000;
    const ask = () =>
      new Promise((resolve) => {
        const keys = (mode, k) => {
          cardKeys.replaceChildren();
          if (mode === "waiting") {
            cardKeys.append(el("span", "", "click to answer it"));
          } else if (mode === "focused") {
            for (const [key, word] of [
              ["y", "Once"],
              ["n", "No"],
              ["esc", "back"],
            ]) {
              const e = el("span", "k");
              e.dataset.k = key;
              e.append(el("b", "", key), ` ${word}`);
              cardKeys.append(e);
            }
          } else {
            const stamp = el("span", "stamp");
            stamp.append(el("span", "st-edge", "▐"), el("span", "st-key", k), el("span", "st-edge", "▌"));
            cardKeys.append(stamp, el("span", "", k === "y" ? "Once" : "No"));
          }
        };
        card.hidden = false;
        card.className = "card";
        keys("waiting");
        state("docs", "▲ waits", "waits");
        let fold = 0;
        let answered = false;
        const foldIn = (ms) => {
          clearTimeout(fold);
          fold = setTimeout(peek, ms);
        };
        const peek = () => {
          if (g !== gen || answered) return;
          card.classList.remove("focused");
          card.classList.add("peek");
          keys("waiting");
          if (document.activeElement === card) card.blur();
        };
        const focus = () => {
          if (g !== gen || answered) return;
          card.classList.remove("peek");
          card.classList.add("focused");
          keys("focused");
          foldIn(LEFT_ALONE);
        };
        const unfocus = () => {
          if (answered || !card.classList.contains("focused")) return;
          card.classList.remove("focused");
          keys("waiting");
          foldIn(UNTOUCHED);
        };
        const answer = (k) => {
          if (g !== gen || answered) return;
          answered = true;
          clearTimeout(fold);
          detach();
          keys("answered", k);
          setTimeout(() => g === gen && card.classList.add("gone"), 1300);
          setTimeout(() => {
            if (g !== gen) return;
            card.hidden = true;
            card.className = "card";
            resolve(k);
          }, 1650);
        };
        const onKey = (e) => {
          if (!card.classList.contains("focused") || e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key === "y" || e.key === "n") {
            e.preventDefault();
            answer(e.key);
          } else if (e.key === "Escape") {
            e.preventDefault();
            unfocus();
            if (document.activeElement === card) card.blur();
          } else {
            foldIn(LEFT_ALONE);
          }
        };
        // The card takes the keyboard's focus too (Tab, or the press itself); leaving it gives it back. Its keys
        // are pressable, as tarae's are (a phone's way in, and a mouse's): a press on a waiting card — the peek, or
        // anywhere on it — only focuses it; on a focused card's `y`/`n` it answers, on `esc` it gives it back. Whether
        // it was focused is taken as the press begins: the focus the press itself gives (keys drawn under the
        // finger) never makes it an answer.
        const onFocus = () => focus();
        const onBlur = () => unfocus();
        let wasFocused = false;
        const onDown = () => (wasFocused = card.classList.contains("focused"));
        const onClick = (e) => {
          const k = e.target.closest("[data-k]");
          if (!wasFocused || !k) {
            if (document.activeElement !== card) card.focus();
            focus();
          } else if (k.dataset.k === "esc") {
            unfocus();
            card.blur();
          } else {
            answer(k.dataset.k);
          }
        };
        const detach = () => {
          document.removeEventListener("keydown", onKey);
          card.removeEventListener("focus", onFocus);
          card.removeEventListener("blur", onBlur);
          card.removeEventListener("pointerdown", onDown);
          card.removeEventListener("click", onClick);
        };
        document.addEventListener("keydown", onKey);
        card.addEventListener("focus", onFocus);
        card.addEventListener("blur", onBlur);
        card.addEventListener("pointerdown", onDown);
        card.addEventListener("click", onClick);
        foldIn(UNTOUCHED);
        cleanups.push(() => {
          clearTimeout(fold);
          detach();
        });
      });

    // ── Who writes what ────────────────────────────────────────────────────
    const conflictOn = () => {
      const m = blocks.get("p4m").el;
      const f = blocks.get("p4f").el;
      f.hidden = false;
      chead.classList.remove("mute");
      m.classList.add("part");
      m.dataset.letter = "m";
      f.classList.add("part");
      f.dataset.letter = "f";
    };
    // The conflict's end says why: fix took main's line under its own, so its part folds and the overlap goes.
    const conflictOff = async () => {
      const m = blocks.get("p4m").el;
      const f = blocks.get("p4f").el;
      say(el("b", "c2", "fix"), " · rebased onto ", el("b", "c1", "main"), " — its line folds");
      overlap("main", "");
      overlap("fix", "");
      f.classList.add("folding");
      await sl(500);
      // (the head's line stays, empty, till all is brought in: main's part under it doesn't move)
      f.hidden = true;
      chead.classList.add("mute");
      m.classList.remove("part");
      flash(m);
    };

    const main = async () => {
      const s = sess.main;
      await read(s, "title", 450);
      await write(s, "title");
      await read(s, "tagline", 260);
      await write(s, "tagline");
      for (const id of ["p1", "p2", "p3"]) {
        await read(s, id, 380);
        await write(s, id);
      }
      await read(s, "p4m", 320);
      await write(s, "p4m");
      finish(s);
    };

    const fix = async () => {
      const s = sess.fix;
      await sl(900);
      await read(s, "sub", 420);
      await write(s, "sub");
      for (const id of ["p5", "p6"]) {
        await read(s, id, 380);
        await write(s, id);
      }
      await until(() => blocks.get("p4m").done > 40);
      conflictOn();
      await read(s, "p4f", 300);
      await write(s, "p4f", {
        share: 0.45,
        then: () => {
          say(el("b", "c1", "main"), " ", el("span", "warn", "≈"), " ", el("b", "c2", "fix"), " · index.md — would conflict");
          overlap("main", "fix");
          overlap("fix", "main");
        },
      });
      await sl(2600);
      await conflictOff();
      for (const id of ["p7", "p8"]) {
        await read(s, id, 380);
        await write(s, id);
      }
      finish(s);
    };

    const docs = async () => {
      const s = sess.docs;
      await sl(1600);
      await read(s, "install", 600);
      await write(s, "install");
      // Its turn goes on (still `working`) while the check runs; the run line says what it runs.
      rest(s);
      run.classList.add("on");
      runok.textContent = "▲ waits for you";
      runok.className = "b-runok warn";
      const k = await ask();
      state("docs", "working");
      if (k === "y") {
        runok.textContent = "…";
        runok.className = "b-runok";
        await sl(1500);
        runok.textContent = "ok";
        runok.className = "b-runok ok";
      } else {
        runok.textContent = "not run — the network stays closed";
        runok.className = "b-runok";
      }
      finish(s);
    };

    const unmark = (name, flashed) => {
      for (const b of blocks.values()) {
        if (b.el.classList.contains(`own${COLOUR[name]}`) && b.el.classList.contains("own")) {
          b.el.classList.remove("own");
          if (flashed) flash(b.el);
        }
      }
    };
    // Each session, once done, is brought into main and leaves the strip — fix without waiting for docs, which
    // waits on its card as long as nobody answers. With main alone there are no sessions to name (tarae names them
    // only when there are two or more), so the strip goes and the path is the plain file's again.
    const bringIn = async (name) => {
      await sl(900);
      const entry = strip.querySelector(`[data-s="${name}"]`);
      unmark(name, true);
      if (entry) flash(entry);
      await sl(380);
      line.splice(
        line.findIndex((x) => x.name === name),
        1
      );
      fitStrip();
    };
    const plain = async () => {
      await sl(200);
      line.length = 0;
      strip.replaceChildren();
      unmark("main", false);
      path.replaceChildren("tarae.sh ", el("span", "tl-sep", "›"), " ", el("b", "", "index.md"));
      const mark = buf.querySelector(".b-title .mark");
      mark.classList.remove("pending");
      flash(mark);
      await sl(300);
      seal.classList.add("on");
      hint.hidden = false;
      release();
      chead.hidden = true;
      chead.classList.remove("mute");
      wrap.classList.remove("on");
      for (const s of Object.values(sess)) s.marker.remove();
      for (const t of buf.querySelectorAll("span.t")) t.replaceWith(document.createTextNode(t.textContent));
      buf.normalize();
      unhide();
      buf.setAttribute("aria-busy", "false");
      updateTop();
    };

    (async () => {
      try {
        await sl(500);
        const docsDone = docs();
        // (docs may go wrong while the others still write: the page is given back then, not when it's awaited)
        docsDone.catch((e) => e instanceof Stale || fail(e));
        await Promise.all([main(), fix()]);
        await bringIn("fix");
        await docsDone;
        await bringIn("docs");
        await plain();
      } catch (e) {
        if (!(e instanceof Stale)) fail(e);
      }
    })();
  }

  // `r` replays only what's done (`r replay` shown), and only while the big title is in sight — never under a
  // visitor reading further down (the top line itself is always in sight now). `r replay` pressed from down there
  // takes the page back up to it first.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "r" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (hint.hidden) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (titleGone()) return;
    play();
  });
  hint.addEventListener("click", () => {
    if (titleGone()) window.scrollTo({ top: 0, behavior: "smooth" });
    play();
  });

  // Measured once the fonts are in, so what's held is the height the text takes in them — waiting a second at
  // most, well inside motion.js's failsafe.
  const fontsIn = document.fonts
    ? Promise.race([document.fonts.ready, new Promise((res) => setTimeout(res, 1000))])
    : Promise.resolve();
  const start = () => fontsIn.then(() => play(), () => play());
  if (document.hidden) {
    document.addEventListener("visibilitychange", start, { once: true });
  } else {
    start();
  }
})();
