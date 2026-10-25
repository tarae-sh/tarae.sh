# tarae.sh

Static homepage for [tarae](https://github.com/tarae-sh/tarae) — a terminal editor with Claude inside.

## Structure

- `cloudflare.config.ts` — Cloudflare Workers static asset configuration (`cf` CLI).
- `public/index.html`, `public/style.css`, `public/player.js`, `public/_headers` — one page, zero dependencies, strict `default-src 'self'` CSP, no trackers or third-party requests.
- `public/motion.js`, `public/weave.js`, `public/weave.css` — the hero as tarae's woven view: three sessions (main, fix, docs) write the page's own text at once, a conflict shown and folded, docs asking on a card before its check reaches the network, then all brought in. `motion.js` (sync, in the head) turns it on only without `prefers-reduced-motion`; without it or without JS the page simply stands as written.
- `public/rec/hero-meok.json`, `public/rec/hero-hanji.json` — keyframed cell-run recordings of the six-beat hero scene (*Three Claudes, one repository*), produced by `cargo xtask homepage` in the `tarae` repository.
- `public/hero-meok.png`, `public/hero-hanji.png` — first-frame still PNGs for first paint, fallback, and Open Graph preview.
- `public/fonts/` — subset `JetBrains Mono` (`Regular`, `Bold`, `Italic`, WOFF2) covering ASCII, Latin-1, box drawing, block elements, and tarae's glyphs; under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`).

## Regenerating the recording

From the `tarae` repository:

```sh
cargo xtask homepage target/homepage
cp target/homepage/hero-meok.json target/homepage/hero-hanji.json ../tarae.sh/public/rec/
cp target/homepage/hero-meok.png target/homepage/hero-hanji.png ../tarae.sh/public/
```

## Deploying

`cf deploy --prebuilt` uploads `.cloudflare/output/v0/workers/default/assets` without running a build step, so always sync `public/` into `.cloudflare/output/v0/workers/default/assets` first. The prebuilt output is git-ignored and kept by hand: `.cloudflare/output/v0/workers/default/worker.config.json` mirrors `cloudflare.config.ts` (its `domains` too), and `.cloudflare/output/v0/config.json`'s `buildContext.isPreview` is `true` for a preview deploy (`cf previews deploy` refuses otherwise) and `false` for production:

Dry run:

```sh
rm -rf .cloudflare/output/v0/workers/default/assets && cp -R public .cloudflare/output/v0/workers/default/assets && cf deploy --prebuilt --dry-run
```

Preview deploy:

```sh
rm -rf .cloudflare/output/v0/workers/default/assets && cp -R public .cloudflare/output/v0/workers/default/assets && cf previews deploy --prebuilt
```

Production deploy (`tarae.sh`):

```sh
rm -rf .cloudflare/output/v0/workers/default/assets && cp -R public .cloudflare/output/v0/workers/default/assets && cf deploy --prebuilt
```
