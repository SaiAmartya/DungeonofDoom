// Shared simulation code — used by the server (authoritative) and the
// client (prediction). Must stay dependency-free and deterministic.

export const TICK_RATE = 30

// All distances are in tile units (1 tile = 1 world unit = 1 meter in 3D).
export const PLAYER = {
  RADIUS: 0.32,
  SPEED: 5.2,
  MAX_HP: 100,
  ATTACK_DAMAGE: 26,
  ATTACK_RANGE: 2.0,
  ATTACK_ARC: 1.15, // radians off facing, each side
  ATTACK_COOLDOWN: 0.45,
  DASH_SPEED_MULT: 2.8,
  DASH_DURATION: 0.18,
  DASH_COOLDOWN: 1.6,
  RESPAWN_TIME: 6,
  RESPAWN_HP: 60
}

export const ENEMY_TYPES = {
  grunt: { radius: 0.38, speed: 2.9, hp: 52, damage: 8, attackRate: 1.15, aggro: 7.5 },
  brute: { radius: 0.55, speed: 2.2, hp: 120, damage: 15, attackRate: 1.5, aggro: 7.5 },
  boss:  { radius: 0.95, speed: 2.5, hp: 380, damage: 22, attackRate: 1.2, aggro: 10,
           dashSpeed: 9.5, dashDuration: 0.55, dashInterval: 6 }
}

export const PICKUPS = {
  heart: { radius: 0.45, heal: 35 },
  coin:  { radius: 0.45 }
}

// grid: array of strings, '#' = solid, anything else = floor
export function isSolid (grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true
  return grid[ty][tx] === '#'
}

// Circle-vs-tilemap overlap test
export function circleHitsWall (grid, x, y, r) {
  const minTx = Math.floor(x - r)
  const maxTx = Math.floor(x + r)
  const minTy = Math.floor(y - r)
  const maxTy = Math.floor(y + r)
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolid(grid, tx, ty)) continue
      // closest point on tile AABB to circle centre
      const cx = Math.max(tx, Math.min(x, tx + 1))
      const cy = Math.max(ty, Math.min(y, ty + 1))
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy < r * r) return true
    }
  }
  return false
}

// Move a circle through the tilemap, resolving each axis independently so
// the mover slides along walls instead of sticking to them.
export function moveCircle (grid, x, y, r, dx, dy) {
  if (dx !== 0) {
    let nx = x + dx
    if (circleHitsWall(grid, nx, y, r)) {
      // step in smaller increments so high speeds (dashes) cannot tunnel
      const step = Math.sign(dx) * 0.05
      nx = x
      while (Math.abs(nx + step - x) <= Math.abs(dx) && !circleHitsWall(grid, nx + step, y, r)) {
        nx += step
      }
    }
    x = nx
  }
  if (dy !== 0) {
    let ny = y + dy
    if (circleHitsWall(grid, x, ny, r)) {
      const step = Math.sign(dy) * 0.05
      ny = y
      while (Math.abs(ny + step - y) <= Math.abs(dy) && !circleHitsWall(grid, x, ny + step, r)) {
        ny += step
      }
    }
    y = ny
  }
  return { x, y }
}

export function dist (ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  return Math.sqrt(dx * dx + dy * dy)
}

// Smallest absolute difference between two angles
export function angleDiff (a, b) {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}
