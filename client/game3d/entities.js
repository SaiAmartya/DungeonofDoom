// Entity meshes & animation: heroes, monsters, the boss and pickups.
// Everything is built from primitives — no external assets.

import * as THREE from 'three'

const HERO_COLORS = [0x41b6ff, 0xff9d3e, 0x7dff8a, 0xff6bd5]
const CAMERA_PITCH = Math.atan2(7.6, 5.9) // must match scene camera offset

const yawFromFacing = (f) => Math.atan2(Math.cos(f), Math.sin(f))

function circleShadow (radius) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.02
  return mesh
}

function healthBar (width) {
  const group = new THREE.Group()
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85, depthWrite: false })
  )
  const fg = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xd8453f, transparent: true, depthWrite: false })
  )
  // both are transparent so they sort by renderOrder: fill always over back
  bg.renderOrder = 10
  fg.renderOrder = 11
  fg.position.z = 0.01
  group.add(bg, fg)
  group.rotation.x = -CAMERA_PITCH
  group.userData = { fg, width }
  group.visible = false
  return group
}

function setBarFraction (bar, frac) {
  const { fg, width } = bar.userData
  fg.scale.x = Math.max(0.001, frac)
  fg.position.x = -width * (1 - frac) / 2
  bar.visible = frac < 0.999
}

// ---- mesh factories ----

function makeHero (colorIdx, isSelf) {
  const color = HERO_COLORS[colorIdx % HERO_COLORS.length]
  const group = new THREE.Group()
  const rig = new THREE.Group()
  group.add(rig)

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.45, 4, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  )
  body.position.y = 0.62
  rig.add(body)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x99a2ad, roughness: 0.35, metalness: 0.55 })
  )
  head.position.y = 1.16
  rig.add(head)

  const plume = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.26, 6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
  )
  plume.position.y = 1.4
  rig.add(plume)

  // sword on a shoulder pivot, blade pointing forward (+z)
  const swordPivot = new THREE.Group()
  swordPivot.position.set(0.36, 0.82, 0.05)
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.78),
    new THREE.MeshStandardMaterial({ color: 0xcfd6e0, roughness: 0.25, metalness: 0.8, emissive: 0x222933 })
  )
  blade.position.z = 0.5
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.05, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x8a6a2e, roughness: 0.4, metalness: 0.6 })
  )
  guard.position.z = 0.12
  swordPivot.add(blade, guard)
  swordPivot.rotation.x = 0.55
  rig.add(swordPivot)

  group.add(circleShadow(0.4))
  if (isSelf) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8b54d, transparent: true, opacity: 0.55, depthWrite: false })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    group.add(ring)
  }
  const bar = healthBar(0.9)
  bar.position.y = 1.72
  group.add(bar)

  return { group, rig, parts: { swordPivot, body }, bar }
}

function makeGrunt () {
  const group = new THREE.Group()
  const rig = new THREE.Group()
  group.add(rig)

  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4, 0),
    new THREE.MeshStandardMaterial({ color: 0x7e1f1f, roughness: 0.8, flatShading: true })
  )
  body.position.y = 0.46
  rig.add(body)

  const hornMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.7 })
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.27, 6), hornMat)
    horn.position.set(side * 0.2, 0.85, 0)
    horn.rotation.z = -side * 0.5
    rig.add(horn)
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd23e })
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat)
    eye.position.set(side * 0.13, 0.56, 0.32)
    rig.add(eye)
  }

  group.add(circleShadow(0.42))
  const bar = healthBar(0.8)
  bar.position.y = 1.15
  group.add(bar)
  return { group, rig, parts: {}, bar }
}

function makeBrute () {
  const group = new THREE.Group()
  const rig = new THREE.Group()
  group.add(rig)

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.95, 0.65),
    new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.95, flatShading: true })
  )
  body.position.y = 0.55
  rig.add(body)

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.3, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x3a352c, roughness: 0.9 })
  )
  head.position.y = 1.18
  rig.add(head)

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xb76bff })
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat)
    eye.position.set(side * 0.09, 1.2, 0.17)
    rig.add(eye)
  }
  const fistMat = new THREE.MeshStandardMaterial({ color: 0x55503f, roughness: 0.9 })
  for (const side of [-1, 1]) {
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), fistMat)
    fist.position.set(side * 0.55, 0.42, 0.1)
    rig.add(fist)
  }

  group.add(circleShadow(0.58))
  const bar = healthBar(1.0)
  bar.position.y = 1.6
  group.add(bar)
  return { group, rig, parts: {}, bar }
}

function makeBoss () {
  const group = new THREE.Group()
  const rig = new THREE.Group()
  group.add(rig)

  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 1),
    new THREE.MeshStandardMaterial({ color: 0x6b1212, roughness: 0.6, flatShading: true, emissive: 0x1c0303 })
  )
  body.position.y = 1.05
  rig.add(body)

  const crownMat = new THREE.MeshStandardMaterial({ color: 0x1f1a16, roughness: 0.6 })
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 5), crownMat)
    spike.position.set(Math.cos(ang) * 0.55, 1.95, Math.sin(ang) * 0.55)
    spike.rotation.set(Math.sin(ang) * 0.5, 0, -Math.cos(ang) * 0.5)
    rig.add(spike)
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff7a20 })
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), eyeMat)
    eye.position.set(side * 0.3, 1.25, 0.78)
    rig.add(eye)
  }
  const glow = new THREE.PointLight(0xff3a20, 9, 7, 1.8)
  glow.position.y = 1.4
  group.add(glow)

  group.add(circleShadow(1.0))
  const bar = healthBar(1.8)
  bar.position.y = 2.6
  group.add(bar)
  return { group, rig, parts: { body }, bar }
}

function makePickup (type) {
  const group = new THREE.Group()
  let mesh
  if (type === 'heart') {
    mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0xe8332e, emissive: 0x701210, roughness: 0.3 })
    )
  } else {
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: 0xe8b54d, emissive: 0x6e4d12, metalness: 0.85, roughness: 0.25 })
    )
    mesh.rotation.z = Math.PI / 2
  }
  mesh.position.y = 0.45
  group.add(mesh)
  group.add(circleShadow(0.16))
  group.userData.spin = mesh
  return group
}

// ---- manager ----

export class Entities {
  constructor (scene) {
    this.scene = scene
    this.players = new Map() // id -> record
    this.enemies = new Map()
    this.pickups = new Map()
    this.dying = []          // death animations in flight
    this.enemyDefs = new Map()
    this.time = 0
  }

  reset (enemyDefs) {
    for (const rec of this.players.values()) this.scene.remove(rec.group)
    for (const rec of this.enemies.values()) this.scene.remove(rec.group)
    for (const g of this.pickups.values()) this.scene.remove(g)
    for (const d of this.dying) this.scene.remove(d.group)
    this.players.clear()
    this.enemies.clear()
    this.pickups.clear()
    this.dying = []
    this.enemyDefs = new Map(enemyDefs.map(d => [d.id, d]))
  }

  // states: [{id, c, x, y, f, hp, maxHp, d(ead), ds(ash), moving}]
  syncPlayers (states, selfId) {
    const present = new Set()
    for (const s of states) {
      present.add(s.id)
      let rec = this.players.get(s.id)
      if (!rec) {
        rec = makeHero(s.c, s.id === selfId)
        rec.flashT = 0
        rec.swingT = -1
        this.scene.add(rec.group)
        this.players.set(s.id, rec)
      }
      rec.group.position.set(s.x, 0, s.y)
      rec.rig.rotation.y = yawFromFacing(s.f)
      setBarFraction(rec.bar, Math.max(0, s.hp) / (s.maxHp || 100))

      // dead heroes fall over and fade
      const targetTilt = s.d ? Math.PI / 2 : 0
      rec.rig.rotation.x += (targetTilt - rec.rig.rotation.x) * 0.2
      rec.group.visible = true

      // walk bob & dash stretch
      const bob = s.moving && !s.d ? Math.sin(this.time * 11 + s.c * 2) * 0.05 : 0
      rec.rig.position.y = bob
      const stretch = s.ds ? 1.18 : 1
      rec.rig.scale.set(2 - stretch, 1, stretch)
    }
    for (const [id, rec] of this.players) {
      if (!present.has(id)) {
        this.scene.remove(rec.group)
        this.players.delete(id)
      }
    }
  }

  syncEnemies (states) {
    const present = new Set()
    for (const s of states) {
      present.add(s.id)
      let rec = this.enemies.get(s.id)
      if (!rec) {
        const def = this.enemyDefs.get(s.id) || { type: 'grunt', maxHp: 50 }
        rec = def.type === 'boss' ? makeBoss() : def.type === 'brute' ? makeBrute() : makeGrunt()
        rec.type = def.type
        rec.maxHp = def.maxHp
        rec.flashT = 0
        this.scene.add(rec.group)
        this.enemies.set(s.id, rec)
      }
      rec.group.position.set(s.x, 0, s.y)
      rec.rig.rotation.y = yawFromFacing(s.f)
      setBarFraction(rec.bar, Math.max(0, s.hp) / rec.maxHp)

      const idleBob = Math.sin(this.time * 6 + s.x * 3) * 0.04
      rec.rig.position.y = idleBob
      if (rec.type === 'boss') {
        const pulse = 1 + Math.sin(this.time * 3) * 0.04
        rec.rig.scale.setScalar(s.ds ? 1.12 : pulse)
      } else {
        rec.rig.scale.setScalar(1)
      }
    }
    for (const [id, rec] of this.enemies) {
      if (!present.has(id)) {
        // no death event handled it (e.g. world reset) — remove quietly
        this.scene.remove(rec.group)
        this.enemies.delete(id)
      }
    }
  }

  syncPickups (list) {
    const present = new Set()
    for (const k of list) {
      present.add(k.id)
      let g = this.pickups.get(k.id)
      if (!g) {
        g = makePickup(k.type)
        g.position.set(k.x, 0, k.y)
        this.scene.add(g)
        this.pickups.set(k.id, g)
      }
    }
    for (const [id, g] of this.pickups) {
      if (!present.has(id)) {
        this.scene.remove(g)
        this.pickups.delete(id)
      }
    }
  }

  playSwing (id) {
    const rec = this.players.get(id)
    if (rec) rec.swingT = 0
  }

  flash (id, color = 0xff2010, duration = 0.18) {
    const rec = this.players.get(id) || this.enemies.get(id)
    if (!rec) return
    rec.flashT = duration
    rec.rig.traverse(obj => {
      if (obj.material && obj.material.emissive && !obj.userData.origEmissive) {
        obj.userData.origEmissive = obj.material.emissive.clone()
      }
      if (obj.material && obj.material.emissive) obj.material.emissive.setHex(color)
    })
  }

  // play a sink-and-shrink death, then dispose
  killEnemy (id) {
    const rec = this.enemies.get(id)
    if (!rec) return
    this.enemies.delete(id)
    rec.deathT = 0.6
    rec.bar.visible = false
    this.dying.push(rec)
  }

  update (dt) {
    this.time += dt

    for (const rec of [...this.players.values(), ...this.enemies.values()]) {
      if (rec.flashT > 0) {
        rec.flashT -= dt
        if (rec.flashT <= 0) {
          rec.rig.traverse(obj => {
            if (obj.material && obj.material.emissive && obj.userData.origEmissive) {
              obj.material.emissive.copy(obj.userData.origEmissive)
            }
          })
        }
      }
    }

    // sword swings
    for (const rec of this.players.values()) {
      if (rec.swingT < 0) continue
      rec.swingT += dt
      const t = rec.swingT / 0.24
      if (t >= 1) {
        rec.swingT = -1
        rec.parts.swordPivot.rotation.set(0.55, 0, 0)
      } else {
        const ease = 1 - Math.pow(1 - t, 3)
        rec.parts.swordPivot.rotation.y = 1.4 - ease * 2.8
        rec.parts.swordPivot.rotation.x = 0.2 + Math.sin(t * Math.PI) * 0.4
      }
    }

    // pickups idle animation
    for (const g of this.pickups.values()) {
      const spin = g.userData.spin
      spin.rotation.y += dt * 2.4
      spin.position.y = 0.45 + Math.sin(this.time * 3 + g.position.x) * 0.08
    }

    // death animations
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const rec = this.dying[i]
      rec.deathT -= dt
      const t = Math.max(0, rec.deathT / 0.6)
      rec.rig.scale.set(1 + (1 - t) * 0.3, t * t, 1 + (1 - t) * 0.3)
      rec.rig.rotation.y += dt * 6
      if (rec.deathT <= 0) {
        this.scene.remove(rec.group)
        this.dying.splice(i, 1)
      }
    }
  }
}
