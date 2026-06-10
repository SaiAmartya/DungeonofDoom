// Visual juice: damage numbers, swing arcs, hit rings.

import * as THREE from 'three'

const ARC = 1.15 // matches PLAYER.ATTACK_ARC

function makeNumberSprite () {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.25, 0.62, 1)
  sprite.visible = false
  sprite.userData = { canvas, texture, life: 0 }
  return sprite
}

export class Effects {
  constructor (scene) {
    this.scene = scene
    this.numbers = []
    for (let i = 0; i < 14; i++) {
      const s = makeNumberSprite()
      scene.add(s)
      this.numbers.push(s)
    }
    this.transients = [] // { mesh, life, maxLife, grow }
  }

  damageNumber (x, z, amount, color = '#ffe9a8') {
    const sprite = this.numbers.find(s => !s.visible) || this.numbers[0]
    const { canvas, texture } = sprite.userData
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = '700 42px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 7
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.strokeText(String(amount), 64, 32)
    ctx.fillStyle = color
    ctx.fillText(String(amount), 64, 32)
    texture.needsUpdate = true
    sprite.position.set(x + (Math.random() - 0.5) * 0.3, 1.6, z)
    sprite.material.opacity = 1
    sprite.visible = true
    sprite.userData.life = 0.75
  }

  swingArc (x, z, facing, color = 0xffd9a0) {
    const geo = new THREE.RingGeometry(0.55, 1.95, 22, 1, -facing - ARC, ARC * 2)
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, 0.85, z)
    this.scene.add(mesh)
    this.transients.push({ mesh, life: 0.18, maxLife: 0.18, grow: 0 })
  }

  ring (x, z, color = 0xffffff, size = 1) {
    const geo = new THREE.RingGeometry(0.25, 0.4, 20)
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, 0.12, z)
    mesh.userData.targetScale = 2.6 * size
    this.scene.add(mesh)
    this.transients.push({ mesh, life: 0.35, maxLife: 0.35, grow: 1 })
  }

  update (dt) {
    for (const sprite of this.numbers) {
      if (!sprite.visible) continue
      sprite.userData.life -= dt
      sprite.position.y += dt * 1.1
      sprite.material.opacity = Math.min(1, sprite.userData.life / 0.3)
      if (sprite.userData.life <= 0) sprite.visible = false
    }

    for (let i = this.transients.length - 1; i >= 0; i--) {
      const t = this.transients[i]
      t.life -= dt
      const f = Math.max(0, t.life / t.maxLife)
      t.mesh.material.opacity = f * 0.8
      if (t.grow) {
        const s = 1 + (1 - f) * t.mesh.userData.targetScale
        t.mesh.scale.set(s, s, 1)
      }
      if (t.life <= 0) {
        this.scene.remove(t.mesh)
        t.mesh.geometry.dispose()
        t.mesh.material.dispose()
        this.transients.splice(i, 1)
      }
    }
  }
}
