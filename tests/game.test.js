// Smoke tests for the server simulation. Run with: npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generateDungeon } from '../server/dungeon.js'
import { Game } from '../server/game.js'
import { circleHitsWall, moveCircle, PLAYER } from '../shared/sim.js'

test('dungeon is fully connected and has exactly one boss + one spawn room', () => {
  for (let run = 0; run < 20; run++) {
    const d = generateDungeon()
    assert.equal(d.rooms.filter(r => r.boss).length, 1)
    assert.equal(d.rooms.filter(r => r.spawn).length, 1)
    assert.ok(d.rooms.length >= 4, 'enough rooms generated')

    // flood fill from spawn must reach every room centre
    const size = d.size
    const seen = new Set()
    const queue = [[Math.floor(d.spawnX), Math.floor(d.spawnY)]]
    while (queue.length) {
      const [x, y] = queue.pop()
      const k = x + ',' + y
      if (seen.has(k)) continue
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      if (d.grid[y][x] === '#') continue
      seen.add(k)
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
    for (const r of d.rooms) {
      const cx = Math.floor(r.x + r.w / 2)
      const cy = Math.floor(r.y + r.h / 2)
      assert.ok(seen.has(cx + ',' + cy), `room ${r.i} reachable from spawn`)
    }
  }
})

test('movement collides with walls and never tunnels through them', () => {
  const grid = ['#####', '#...#', '#...#', '#...#', '#####']
  // starting in the open, slam into the right wall at high speed
  const res = moveCircle(grid, 2.5, 2.5, 0.32, 50, 0)
  assert.ok(res.x < 4 - 0.32 + 0.01, 'stopped at the wall')
  assert.ok(!circleHitsWall(grid, res.x, res.y, 0.32), 'resting position is valid')
})

test('player attack damages and kills enemies, boss kill triggers victory', () => {
  const game = new Game('TEST', { solo: true })
  const p = game.addPlayer('p1')

  const enemy = game.enemies.find(e => e.type !== 'boss')
  p.x = enemy.x - 1
  p.y = enemy.y
  p.facing = 0 // facing +x, toward the enemy

  while (!enemy.dead) {
    p.attackCd = 0
    game.handleAttack('p1')
  }
  assert.ok(enemy.dead)
  assert.ok(game.pickups.some(k => k.type === 'coin'), 'enemy dropped a coin')
  assert.ok(game.events.some(e => e.k === 'edeath'))

  const boss = game.enemies.find(e => e.type === 'boss')
  p.x = boss.x - 1
  p.y = boss.y
  while (!boss.dead) {
    p.attackCd = 0
    game.handleAttack('p1')
  }
  assert.ok(game.victory, 'killing the boss wins the run')
  assert.ok(game.events.some(e => e.k === 'victory'))
})

test('enemies chase and damage players; player death ends a solo run', () => {
  const game = new Game('TEST', { solo: true })
  const p = game.addPlayer('p1')
  const enemy = game.enemies.find(e => e.type === 'grunt')

  // drop the player on top of the enemy and let the sim run
  p.x = enemy.x + 0.5
  p.y = enemy.y
  for (let i = 0; i < 30 * 60 && !p.dead; i++) {
    p.x = enemy.x + 0.5 // pin the player in contact
    p.y = enemy.y
    game.tick(1 / 30)
  }
  assert.ok(p.dead, 'player eventually dies in contact with an enemy')
  assert.ok(game.over, 'solo run is over when the only player dies')
})

test('enemy attacks are telegraphed and cannot be paused by attack-spam', () => {
  const game = new Game('TEST', { solo: true })
  const p = game.addPlayer('p1')
  const enemy = game.enemies.find(e => e.type === 'grunt')
  enemy.aggro = true
  p.x = enemy.x + 0.5
  p.y = enemy.y

  // first tick starts a windup, not instant damage
  game.tick(1 / 30)
  assert.equal(p.hp, p.maxHp, 'no instant damage — attack telegraphed')
  assert.ok(enemy.windup > 0, 'enemy is winding up')

  // a player hit no longer interrupts the windup — no hit-stun pause
  p.facing = Math.atan2(enemy.y - p.y, enemy.x - p.x)
  game.handleAttack('p1')
  assert.ok(enemy.windup > 0, 'windup survives being hit')

  // face-tanking while spamming attacks is a trade: the strike still lands
  for (let i = 0; i < 60 && p.hp === p.maxHp; i++) {
    game.handleAttack('p1') // no-ops while on cooldown
    p.x = enemy.x + 0.5     // stay pinned in contact despite knockback
    p.y = enemy.y
    game.tick(1 / 30)
  }
  assert.ok(p.hp < p.maxHp, 'spamming attacks does not prevent the enemy striking')
})

test('incoming attacks on one player are rate-limited, even when swarmed', () => {
  const game = new Game('TEST', { solo: true })
  const p = game.addPlayer('p1')
  // surround the player with four aggroed grunts in contact
  const grunts = game.enemies.filter(e => e.type === 'grunt').slice(0, 4)
  grunts.forEach((e, i) => {
    e.aggro = true
    const ang = (i / 4) * Math.PI * 2
    e.x = p.x + Math.cos(ang) * 0.8
    e.y = p.y + Math.sin(ang) * 0.8
  })
  game.tick(1 / 30)
  const windingUp = game.enemies.filter(e => e.windup > 0).length
  assert.equal(windingUp, 1, 'only one enemy may wind up while the lock is active')
  assert.ok(p.windupLockT > 0, 'player attack-pacing lock engaged')

  // over a full second of being surrounded, damage stays within the pacing
  // budget (~1 strike per 0.8s) instead of all four striking at once
  for (let i = 0; i < 30; i++) game.tick(1 / 30)
  assert.ok(p.maxHp - p.hp <= 16, `took ${p.maxHp - p.hp} dmg in 1s — should be paced`)
})

test('dash grants i-frames', () => {
  const game = new Game('TEST', { solo: true })
  const p = game.addPlayer('p1')
  p.dashLeft = PLAYER.DASH_DURATION
  game.damagePlayer(p, 50)
  assert.equal(p.hp, p.maxHp, 'no damage taken while dashing')
})

test('snapshot serializes and events drain', () => {
  const game = new Game('TEST', {})
  game.addPlayer('p1')
  game.tick(1 / 30)
  const snap = game.snapshot()
  assert.equal(snap.p.length, 1)
  assert.ok(Array.isArray(snap.e))
  assert.ok(snap.e.length > 0)
  assert.ok(JSON.stringify(snap).length < 20000, 'snapshot stays reasonably small')
  const snap2 = game.snapshot()
  assert.equal(snap2.ev.length, 0, 'events drained after snapshot')
})
