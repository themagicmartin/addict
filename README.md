# ONE MORE

A neon survivor-roguelite that runs in a single HTML file. No dependencies, no
assets, no build step required to play — open `dist/index.html` and it works,
offline, on desktop or phone.

Your weapons fire themselves. Your only job is to not get hit.

```
WASD / arrows      move
1 2 3              pick a level-up card
R / B              reroll / banish
Esc or P           pause
Space              one more run
```

On mobile, touch and drag anywhere to move.

## The loop

A run is 3–10 minutes. You die. You keep the souls. You spend them. You go again.

- **Kill things → XP gems → level up → draft 1 of 3 upgrades.** Levels come every
  few seconds early on, then slow down as the swarm speeds up.
- **Seven weapons, ten items.** Max a weapon *and* its paired item and the next
  card you see is a golden **evolution** — a strictly better weapon with a new
  identity. Chests pay out pending evolutions immediately, so the best moment in
  the game is never gated behind another level-up.
- **Elites drop chests**, which are slot machines: usually one upgrade,
  sometimes three, rarely five.
- **A Warden arrives every 3 minutes**, then every 3 after that, each one harder.
- **From 15:00, the hunt begins** — reapers that are faster than you are. Every
  run ends eventually.
- **Death pays out souls**, scaled by run time, kills, level and your best combo.
  Souls buy permanent upgrades that apply to every future run, so a bad run
  still moves you forward.

Unlocks (six extra survivors, sixteen trials) are drip-fed against milestones you
are always shown progress toward.

## Layout

```
index.html        shell + all styling; loads src/*.js in order for development
src/00-core.js    math, input, WebAudio synth (sfx + procedural soundtrack), save
src/10-content.js characters, weapons, evolutions, items, enemies, meta, trials
src/20-game.js    entities, combat, spatial grid, the spawn director, run lifecycle
src/30-render.js  canvas renderer (additive-glow vector art)
src/40-ui.js      menus, draft cards, chests, meta shop, codex, death screen
src/50-main.js    fixed-timestep loop, hotkeys, boot
src/60-about.js   Sonder demo overlay: "i" button + about panel (markup/CSS live in index.html)
build.js          concatenates src/*.js into a self-contained dist/index.html
```

Everything is drawn with canvas paths and every sound is synthesised at runtime,
so the whole game is one ~140 kB file with zero network requests.

## Working on it

```bash
node build.js                 # rebuild dist/index.html
node tools/balance.js 12      # sim all 7 characters for 12 min, print a balance table
node tools/playtest.js        # long headless run, reports any runtime errors
node tools/perf.js            # measure real frame times under load
```

`src/` is the source of truth — edit there, then rebuild. Opening the root
`index.html` directly also works and skips the build.

In the browser console, `OM` exposes the internals (`OM.G`, `OM.SV`,
`OM.grantSouls(5000)`, `OM.wipe()`).

## Tuning notes

The two levers that matter most, both in `src/20-game.js`:

- `difficulty()` — enemy HP/damage/speed against run time. The `late` term is a
  deliberate hard shoulder past 8 minutes; without it a fully-evolved build never
  loses ground.
- `updateDirector()` — spawn rate, swarm events, boss cadence, the reaper hunt.

Player move speed (`recalc`) is only modestly above early enemy speed on purpose.
When that gap is wide, kiting becomes free, contact weapons stop connecting, and
a good build never takes a scratch.

## Public demo (onemore.sondersoftware.com)

`index.html` carries a small "← Sonder Software" link and an "i" about panel; they are part of
the single-file build, hidden while a run is live and shown on menus, pause, level-up and death.

`Dockerfile` builds the game, then `tools/split-for-csp.js` splits the inline script/style into
`app.js`/`app.css` (docker image only; `dist/index.html` stays one file) so nginx can serve
`script-src 'self'` with no `unsafe-inline`. See `docker/nginx.conf` for the CSP and why.
CI: `.github/workflows/demo.yaml` on `demo-vX.Y.Z` tags.

```bash
node tools/headless-check.js  # no-browser smoke test: play, die, restart (needs node build.js first)
docker build -t onemore-demo . && docker run --rm -p 8080:8080 onemore-demo
```
