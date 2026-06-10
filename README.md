# ⚔️ Dungeon of Doom

A 3D co-op roguelite dungeon crawler that runs entirely in the browser.
Descend into a procedurally generated dungeon, carve through monsters with
telegraphed melee combat, and slay the **Dungeon Overlord** — solo or with
a friend over the internet.

**Play it live:** https://dungeonofdoom.onrender.com
*(free hosting — the first load may take ~50s if the server was asleep)*

## Features

- **Full 3D** — Three.js renderer with a third-person follow camera,
  low-poly procedural art (zero asset files), pooled torch lighting,
  fog, drifting dust, damage numbers, and screen shake
- **Procedural dungeons** — random-walk room placement joined by corridors;
  the boss room is always the farthest room from spawn
- **Skill-based combat** — enemy attacks are telegraphed (they glow before
  striking), your hits stagger and knock back enemies, and dashing grants
  invincibility frames. Incoming attacks are paced so packs circle for
  openings instead of bursting you down
- **Online co-op** — host a game, share the 4-letter room code, and a friend
  joins from any browser. Allies respawn after a few seconds while you
  keep the run alive
- **Roguelite loop** — coins, heart pickups, a boss fight, death and
  victory screens, and instant "Run It Back" regeneration
- **Plays anywhere** — true fullscreen at any aspect ratio, plus a touch
  joystick and buttons on mobile devices
- **Fair networking** — server-authoritative simulation at 30 Hz with
  client-side prediction and snapshot interpolation

## Controls

| Action | Keys |
|--------|------|
| Move   | WASD / arrow keys (or touch joystick) |
| Attack | Space, J, or click |
| Dash (i-frames) | Shift or K |
| Mute   | M |

## Running locally

```bash
npm install
npm start          # serves the game at http://localhost:8080
```

Open two browser windows to test co-op locally (Host Co-op → Join with
the room code).

```bash
npm test           # server simulation test suite (node:test)
```

## Architecture

```
client/            Three.js client (ES modules, no build step)
  game3d/          scene, entities, effects
  main.js          menus, networking, prediction, render loop
server/            authoritative game server (Express + Socket.IO)
  dungeon.js       procedural generation
  game.js          simulation: combat, AI, pickups, win/lose
shared/sim.js      movement & collision shared by server and client
tests/             simulation tests
```

The server simulates every game at 30 Hz and broadcasts compact snapshots;
clients predict their own movement against the same shared collision code
and softly reconcile, while other entities are interpolated ~110 ms behind.

## Deployment

Deployed on [Render](https://render.com) (free tier) as a plain Node web
service — `npm install` / `node server/server.js`, health check at
`/healthz`. A GitHub Actions workflow (plus a cron-job.org job as backup)
pings `/healthz` every 10 minutes to keep the free instance awake.
