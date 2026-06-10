// Authoritative game simulation. One Game instance per lobby.

import { generateDungeon, roomAt } from './dungeon.js'
import {
  PLAYER, ENEMY_TYPES, PICKUPS,
  moveCircle, dist, angleDiff
} from '../shared/sim.js'

const MAX_PLAYERS = 2

export class Game {
  constructor (code, { solo = false } = {}) {
    this.code = code
    this.solo = solo
    this.maxPlayers = solo ? 1 : MAX_PLAYERS
    this.players = new Map() // socketId -> player state
    this.events = []         // drained into each snapshot
    this.nextEnemyId = 0
    this.nextPickupId = 0
    this.generateWorld()
  }

  generateWorld () {
    this.dungeon = generateDungeon()
    this.over = false
    this.victory = false
    this.startedAt = Date.now()

    this.enemies = this.dungeon.enemySpawns.map(spawn => {
      const def = ENEMY_TYPES[spawn.type]
      return {
        id: 'e' + (this.nextEnemyId++),
        type: spawn.type,
        x: spawn.x,
        y: spawn.y,
        facing: Math.PI / 2,
        r: def.radius,
        hp: def.hp,
        maxHp: def.hp,
        aggro: false,
        attackCd: 0,
        windup: 0,
        windupTarget: null,
        staggerT: 0,
        staggerImmuneT: 0,
        dashLeft: 0,
        dashTimer: def.dashInterval || 0,
        dead: false
      }
    })

    this.pickups = this.dungeon.pickupSpawns.map(spawn => ({
      id: 'k' + (this.nextPickupId++),
      type: spawn.type,
      x: spawn.x,
      y: spawn.y
    }))
  }

  // ---- lobby ----

  addPlayer (id) {
    const idx = this.players.size
    const player = {
      id,
      color: idx,
      x: this.dungeon.spawnX + (idx === 0 ? -0.6 : 0.6),
      y: this.dungeon.spawnY,
      facing: -Math.PI / 2,
      mx: 0,
      my: 0,
      hp: PLAYER.MAX_HP,
      maxHp: PLAYER.MAX_HP,
      coins: 0,
      kills: 0,
      attackCd: 0,
      dashCd: 0,
      dashLeft: 0,
      dead: false,
      respawnT: 0,
      windupLockT: 0 // global incoming-attack pacing (anti-swarm-melt)
    }
    this.players.set(id, player)
    this.events.push({ k: 'join', id })
    return player
  }

  removePlayer (id) {
    if (!this.players.delete(id)) return
    this.events.push({ k: 'leave', id })
    // if everyone left behind is dead, the run is over (prevents a dead
    // player waiting forever on a respawn that requires a living partner)
    const remaining = [...this.players.values()]
    if (remaining.length && !remaining.some(p => !p.dead) && !this.over) {
      this.over = true
      this.events.push({ k: 'gameover' })
    }
  }

  reset () {
    this.nextEnemyId = 0
    this.nextPickupId = 0
    this.events = []
    this.generateWorld()
    let idx = 0
    for (const p of this.players.values()) {
      p.x = this.dungeon.spawnX + (idx === 0 ? -0.6 : 0.6)
      p.y = this.dungeon.spawnY
      p.hp = PLAYER.MAX_HP
      p.coins = 0
      p.kills = 0
      p.dead = false
      p.respawnT = 0
      p.attackCd = 0
      p.dashCd = 0
      p.dashLeft = 0
      idx++
    }
  }

  // ---- input ----

  handleInput (id, { mx, my }) {
    const p = this.players.get(id)
    if (!p || p.dead) return
    mx = Number(mx) || 0
    my = Number(my) || 0
    const len = Math.hypot(mx, my)
    if (len > 1) { mx /= len; my /= len }
    p.mx = mx
    p.my = my
    if (len > 0.05) p.facing = Math.atan2(my, mx)
  }

  handleAttack (id) {
    const p = this.players.get(id)
    if (!p || p.dead || this.over) return
    if (p.attackCd > 0) return
    p.attackCd = PLAYER.ATTACK_COOLDOWN
    this.events.push({ k: 'swing', id, f: p.facing })

    for (const e of this.enemies) {
      if (e.dead) continue
      const d = dist(p.x, p.y, e.x, e.y) - e.r
      if (d > PLAYER.ATTACK_RANGE) continue
      const ang = Math.atan2(e.y - p.y, e.x - p.x)
      if (angleDiff(ang, p.facing) > PLAYER.ATTACK_ARC) continue
      this.damageEnemy(e, PLAYER.ATTACK_DAMAGE, p)
      // knockback (bosses stand their ground)
      if (e.type !== 'boss' && !e.dead) {
        const kb = 0.85
        const moved = moveCircle(this.dungeon.grid, e.x, e.y, e.r, Math.cos(ang) * kb, Math.sin(ang) * kb)
        e.x = moved.x
        e.y = moved.y
      }
    }
  }

  handleDash (id) {
    const p = this.players.get(id)
    if (!p || p.dead || this.over) return
    if (p.dashCd > 0) return
    p.dashCd = PLAYER.DASH_COOLDOWN
    p.dashLeft = PLAYER.DASH_DURATION
    this.events.push({ k: 'dash', id })
  }

  // ---- simulation ----

  damageEnemy (enemy, amount, source) {
    enemy.hp -= amount
    enemy.aggro = true
    // stagger: interrupt any windup and stop the enemy briefly — but with
    // an immunity window so attack-spam cannot stun-lock an enemy forever
    if (enemy.type !== 'boss' && enemy.staggerImmuneT <= 0) {
      enemy.windup = 0
      enemy.staggerT = 0.4
      enemy.staggerImmuneT = 1.3
    }
    this.events.push({ k: 'ehit', id: enemy.id, dmg: amount, x: enemy.x, y: enemy.y })
    if (enemy.hp > 0) return

    enemy.dead = true
    if (source) source.kills++
    this.events.push({ k: 'edeath', id: enemy.id, x: enemy.x, y: enemy.y, type: enemy.type })

    // loot
    const drops = enemy.type === 'boss' ? 5 : 1
    for (let i = 0; i < drops; i++) {
      this.pickups.push({
        id: 'k' + (this.nextPickupId++),
        type: 'coin',
        x: enemy.x + (Math.random() - 0.5) * 1.2,
        y: enemy.y + (Math.random() - 0.5) * 1.2
      })
    }
    if (enemy.type !== 'boss' && Math.random() < 0.3) {
      this.pickups.push({ id: 'k' + (this.nextPickupId++), type: 'heart', x: enemy.x, y: enemy.y })
    }

    if (enemy.type === 'boss' && !this.victory) {
      this.victory = true
      this.over = true
      this.events.push({ k: 'victory', time: Date.now() - this.startedAt })
    }
  }

  damagePlayer (p, amount) {
    if (p.dead || p.dashLeft > 0) return // dash grants i-frames
    p.hp = Math.max(0, p.hp - amount)
    this.events.push({ k: 'phit', id: p.id, dmg: amount })
    if (p.hp > 0) return

    p.dead = true
    p.mx = 0
    p.my = 0
    p.respawnT = PLAYER.RESPAWN_TIME
    this.events.push({ k: 'pdeath', id: p.id })

    const anyAlive = [...this.players.values()].some(pl => !pl.dead)
    if (!anyAlive && !this.over) {
      this.over = true
      this.events.push({ k: 'gameover' })
    }
  }

  tick (dt) {
    const grid = this.dungeon.grid
    const alivePlayers = [...this.players.values()].filter(p => !p.dead)

    // players
    for (const p of this.players.values()) {
      p.attackCd = Math.max(0, p.attackCd - dt)
      p.dashCd = Math.max(0, p.dashCd - dt)
      p.dashLeft = Math.max(0, p.dashLeft - dt)
      p.windupLockT = Math.max(0, p.windupLockT - dt)

      if (p.dead) {
        // respawn only while the run is still live (co-op carry)
        if (!this.over && this.players.size > 1) {
          p.respawnT -= dt
          if (p.respawnT <= 0) {
            p.dead = false
            p.hp = PLAYER.RESPAWN_HP
            p.x = this.dungeon.spawnX
            p.y = this.dungeon.spawnY
            this.events.push({ k: 'respawn', id: p.id })
          }
        }
        continue
      }

      const speed = PLAYER.SPEED * (p.dashLeft > 0 ? PLAYER.DASH_SPEED_MULT : 1)
      if (p.mx !== 0 || p.my !== 0) {
        const moved = moveCircle(grid, p.x, p.y, PLAYER.RADIUS, p.mx * speed * dt, p.my * speed * dt)
        p.x = moved.x
        p.y = moved.y
      }
    }

    // enemies
    for (const e of this.enemies) {
      if (e.dead || this.over) continue
      const def = ENEMY_TYPES[e.type]
      e.attackCd = Math.max(0, e.attackCd - dt)
      e.staggerImmuneT = Math.max(0, e.staggerImmuneT - dt)

      // find nearest living player
      let target = null
      let best = Infinity
      for (const p of alivePlayers) {
        const d = dist(e.x, e.y, p.x, p.y)
        if (d < best) { best = d; target = p }
      }
      if (!target) continue
      if (best < def.aggro) e.aggro = true
      if (!e.aggro) continue

      // staggered by a player hit: do nothing this frame
      if (e.staggerT > 0) {
        e.staggerT -= dt
        continue
      }

      // mid-windup: hold position, then strike if the player didn't escape
      if (e.windup > 0) {
        e.windup -= dt
        if (e.windup <= 0) {
          const victim = this.players.get(e.windupTarget)
          const reach = e.r + PLAYER.RADIUS + 0.45
          this.events.push({ k: 'eswing', id: e.id })
          if (victim && !victim.dead && dist(e.x, e.y, victim.x, victim.y) < reach) {
            this.damagePlayer(victim, def.damage)
          }
        }
        continue
      }

      // boss dash ability
      let speed = def.speed
      if (e.type === 'boss') {
        e.dashTimer -= dt
        if (e.dashLeft > 0) {
          e.dashLeft -= dt
          speed = def.dashSpeed
        } else if (e.dashTimer <= 0 && best > 2.5) {
          e.dashLeft = def.dashDuration
          e.dashTimer = def.dashInterval
          this.events.push({ k: 'bossdash', id: e.id })
        }
      }

      // chase
      const ang = Math.atan2(target.y - e.y, target.x - e.x)
      e.facing = ang
      const contact = e.r + PLAYER.RADIUS + 0.1
      if (best > contact) {
        const step = Math.min(speed * dt, best - contact)
        const moved = moveCircle(grid, e.x, e.y, e.r, Math.cos(ang) * step, Math.sin(ang) * step)
        e.x = moved.x
        e.y = moved.y
      }

      // separation from other enemies
      for (const other of this.enemies) {
        if (other === e || other.dead) continue
        const d = dist(e.x, e.y, other.x, other.y)
        const min = e.r + other.r
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5
          const px = (e.x - other.x) / d * push
          const py = (e.y - other.y) / d * push
          const moved = moveCircle(grid, e.x, e.y, e.r, px, py)
          e.x = moved.x
          e.y = moved.y
        }
      }

      // begin a telegraphed attack on contact. Incoming attacks on one
      // player are rate-limited (windupLockT), so a surrounding pack lands
      // a readable rhythm of strikes instead of bursting the player down.
      if (e.attackCd <= 0 && dist(e.x, e.y, target.x, target.y) < contact + 0.25) {
        if (target.windupLockT > 0) {
          e.attackCd = 0.3 // circle and wait for an opening
        } else {
          target.windupLockT = e.type === 'boss' ? 0.6 : 0.8
          e.attackCd = def.attackRate
          e.windup = e.type === 'boss' ? 0.45 : 0.35
          e.windupTarget = target.id
          this.events.push({ k: 'ewindup', id: e.id })
        }
      }
    }

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i]
      for (const p of alivePlayers) {
        if (dist(k.x, k.y, p.x, p.y) > PICKUPS[k.type].radius + PLAYER.RADIUS) continue
        if (k.type === 'heart') {
          if (p.hp >= p.maxHp) continue // leave it for later
          p.hp = Math.min(p.maxHp, p.hp + PICKUPS.heart.heal)
        } else if (k.type === 'coin') {
          p.coins++
        }
        this.events.push({ k: 'pickup', id: p.id, type: k.type, x: k.x, y: k.y })
        this.pickups.splice(i, 1)
        break
      }
    }
  }

  // ---- serialization ----

  initPayload () {
    return {
      code: this.code,
      solo: this.solo,
      maxPlayers: this.maxPlayers,
      dungeon: {
        size: this.dungeon.size,
        grid: this.dungeon.grid,
        rooms: this.dungeon.rooms,
        edges: this.dungeon.edges,
        torches: this.dungeon.torches,
        spawnX: this.dungeon.spawnX,
        spawnY: this.dungeon.spawnY
      },
      enemies: this.enemies.map(e => ({
        id: e.id, type: e.type, x: e.x, y: e.y, maxHp: e.maxHp
      })),
      players: this.roster()
    }
  }

  roster () {
    return [...this.players.values()].map(p => ({
      id: p.id, color: p.color, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp
    }))
  }

  snapshot () {
    const snap = {
      t: Date.now(),
      p: [...this.players.values()].map(p => ({
        id: p.id,
        c: p.color,
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
        f: Math.round(p.facing * 100) / 100,
        hp: p.hp,
        co: p.coins,
        ki: p.kills,
        d: p.dead ? 1 : 0,
        ds: p.dashLeft > 0 ? 1 : 0,
        rt: p.dead ? Math.ceil(p.respawnT) : 0
      })),
      e: this.enemies.filter(e => !e.dead).map(e => ({
        id: e.id,
        x: Math.round(e.x * 100) / 100,
        y: Math.round(e.y * 100) / 100,
        f: Math.round(e.facing * 100) / 100,
        hp: e.hp,
        ds: e.dashLeft > 0 ? 1 : 0
      })),
      k: this.pickups,
      ev: this.events
    }
    this.events = []
    return snap
  }
}

export { roomAt }
