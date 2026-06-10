// Procedural dungeon generation.
//
// The dungeon lives on a square tile grid. Rooms are placed on a coarse
// cell grid via a random walk (guaranteeing connectivity), then carved
// into the tile grid and joined with L-shaped corridors. The room with
// the greatest graph distance from spawn becomes the boss room.

const CELLS = 4        // coarse cell grid is CELLS x CELLS
const CELL_T = 16      // tiles per cell
const GRID = CELLS * CELL_T

const randInt = (n) => Math.floor(Math.random() * n)

export function generateDungeon (roomCount = 8) {
  // --- 1. place rooms on the cell grid with a random walk ---
  const placed = new Map() // "cx,cy" -> room index
  const rooms = []         // { cx, cy, x, y, w, h, d, boss, spawn }
  const edges = []         // pairs of room indices

  const key = (cx, cy) => cx + ',' + cy
  const addRoom = (cx, cy) => {
    placed.set(key(cx, cy), rooms.length)
    rooms.push({ cx, cy, x: 0, y: 0, w: 0, h: 0, d: 0, boss: false, spawn: false })
    return rooms.length - 1
  }

  addRoom(randInt(CELLS), CELLS - 1) // spawn on the bottom row
  let guard = 0
  while (rooms.length < roomCount && guard++ < 1000) {
    const from = rooms[randInt(rooms.length)]
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5)
    for (const [dx, dy] of dirs) {
      const cx = from.cx + dx
      const cy = from.cy + dy
      if (cx < 0 || cy < 0 || cx >= CELLS || cy >= CELLS) continue
      if (placed.has(key(cx, cy))) continue
      const idx = addRoom(cx, cy)
      edges.push([placed.get(key(from.cx, from.cy)), idx])
      break
    }
  }

  // --- 2. BFS graph distance from spawn; farthest room is the boss room ---
  const adj = rooms.map(() => [])
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a) }
  const distQ = [0]
  const seen = new Set([0])
  rooms[0].d = 0
  while (distQ.length) {
    const cur = distQ.shift()
    for (const nb of adj[cur]) {
      if (seen.has(nb)) continue
      seen.add(nb)
      rooms[nb].d = rooms[cur].d + 1
      distQ.push(nb)
    }
  }
  let bossIdx = 0
  for (let i = 1; i < rooms.length; i++) {
    if (rooms[i].d > rooms[bossIdx].d) bossIdx = i
  }
  rooms[0].spawn = true
  rooms[bossIdx].boss = true

  // --- 3. size each room and carve into the tile grid ---
  const grid = Array.from({ length: GRID }, () => new Array(GRID).fill('#'))

  for (const room of rooms) {
    const w = room.boss ? 13 : 9 + randInt(5)   // 9-13 tiles wide
    const h = room.boss ? 11 : 7 + randInt(4)   // 7-10 tiles tall
    room.w = w
    room.h = h
    room.x = room.cx * CELL_T + 1 + randInt(CELL_T - w - 2)
    room.y = room.cy * CELL_T + 1 + randInt(CELL_T - h - 2)
    for (let ty = room.y; ty < room.y + h; ty++) {
      for (let tx = room.x; tx < room.x + w; tx++) {
        grid[ty][tx] = '.'
      }
    }
  }

  const carve = (tx, ty) => {
    if (tx < 1 || ty < 1 || tx >= GRID - 1 || ty >= GRID - 1) return
    if (grid[ty][tx] === '#') grid[ty][tx] = ','
  }

  // --- 4. carve 2-wide L corridors between connected rooms ---
  for (const [a, b] of edges) {
    const ra = rooms[a]
    const rb = rooms[b]
    const ax = Math.floor(ra.x + ra.w / 2)
    const ay = Math.floor(ra.y + ra.h / 2)
    const bx = Math.floor(rb.x + rb.w / 2)
    const by = Math.floor(rb.y + rb.h / 2)
    for (let tx = Math.min(ax, bx); tx <= Math.max(ax, bx); tx++) {
      carve(tx, ay); carve(tx, ay + 1)
    }
    for (let ty = Math.min(ay, by); ty <= Math.max(ay, by); ty++) {
      carve(bx, ty); carve(bx + 1, ty)
    }
  }

  // --- 5. torches along room walls ---
  const torches = []
  for (const room of rooms) {
    const inset = [
      [room.x + 1, room.y + 1],
      [room.x + room.w - 2, room.y + 1],
      [room.x + 1, room.y + room.h - 2],
      [room.x + room.w - 2, room.y + room.h - 2]
    ]
    for (const [tx, ty] of inset) torches.push({ x: tx + 0.5, y: ty + 0.5 })
  }

  // --- 6. spawn points for enemies and pickups ---
  const enemySpawns = []
  const pickupSpawns = []
  const floorTileIn = (room) => ({
    x: room.x + 1 + randInt(room.w - 2) + 0.5,
    y: room.y + 1 + randInt(room.h - 2) + 0.5
  })

  for (const room of rooms) {
    if (room.spawn) continue
    if (room.boss) {
      enemySpawns.push({ type: 'boss', x: room.x + room.w / 2, y: room.y + room.h / 2, room })
      enemySpawns.push({ type: 'grunt', ...floorTileIn(room) })
      enemySpawns.push({ type: 'grunt', ...floorTileIn(room) })
      continue
    }
    const count = Math.min(2 + room.d, 4)
    for (let i = 0; i < count; i++) {
      const type = room.d >= 2 && Math.random() < 0.35 ? 'brute' : 'grunt'
      enemySpawns.push({ type, ...floorTileIn(room) })
    }
    if (Math.random() < 0.55) pickupSpawns.push({ type: 'heart', ...floorTileIn(room) })
    if (Math.random() < 0.6) pickupSpawns.push({ type: 'coin', ...floorTileIn(room) })
  }

  const spawnRoom = rooms[0]
  return {
    size: GRID,
    grid: grid.map(row => row.join('')),
    rooms: rooms.map((r, i) => ({
      i, x: r.x, y: r.y, w: r.w, h: r.h, d: r.d, boss: r.boss, spawn: r.spawn
    })),
    edges,
    torches,
    spawnX: spawnRoom.x + spawnRoom.w / 2,
    spawnY: spawnRoom.y + spawnRoom.h / 2,
    enemySpawns,
    pickupSpawns
  }
}

// Which room (index) contains this position, or -1
export function roomAt (rooms, x, y) {
  for (const r of rooms) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.i
  }
  return -1
}
