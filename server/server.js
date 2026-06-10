// Dungeon of Doom — server entry point.
// Express serves the static client; Socket.IO carries game traffic.

import express from 'express'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { Server } from 'socket.io'

import { Game } from './game.js'
import { TICK_RATE } from '../shared/sim.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8080

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static(path.join(__dirname, '..', 'client')))
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')))

// lightweight health check — used by uptime monitors / keep-alive pings
app.get('/healthz', (req, res) => {
  res.json({ ok: true, games: games.size, uptime: Math.round(process.uptime()) })
})

// ---- lobby management ----

const games = new Map() // code -> Game
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeCode () {
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
  } while (games.has(code))
  return code
}

function leaveCurrentGame (socket) {
  const code = socket.data.gameCode
  if (!code) return
  const game = games.get(code)
  socket.leave(code)
  socket.data.gameCode = null
  if (!game) return
  game.removePlayer(socket.id)
  if (game.players.size === 0) games.delete(code)
}

io.on('connection', (socket) => {
  socket.data.gameCode = null

  const currentGame = () => games.get(socket.data.gameCode)

  socket.on('createGame', (opts, ack) => {
    if (typeof ack !== 'function') return
    leaveCurrentGame(socket)
    const code = makeCode()
    const game = new Game(code, { solo: !!opts?.solo })
    games.set(code, game)
    socket.join(code)
    socket.data.gameCode = code
    game.addPlayer(socket.id)
    ack({ ok: true, selfId: socket.id, init: game.initPayload() })
  })

  socket.on('joinGame', (opts, ack) => {
    if (typeof ack !== 'function') return
    const code = String(opts?.code || '').trim().toUpperCase()
    const game = games.get(code)
    if (!game) return ack({ ok: false, error: 'No game found with that code.' })
    if (game.solo) return ack({ ok: false, error: 'That game is single-player.' })
    if (game.players.size >= game.maxPlayers) return ack({ ok: false, error: 'That game is full.' })
    leaveCurrentGame(socket)
    socket.join(code)
    socket.data.gameCode = code
    game.addPlayer(socket.id)
    ack({ ok: true, selfId: socket.id, init: game.initPayload() })
    socket.to(code).emit('rosterUpdate', game.roster())
  })

  socket.on('input', (data) => currentGame()?.handleInput(socket.id, data || {}))
  socket.on('attack', () => currentGame()?.handleAttack(socket.id))
  socket.on('dash', () => currentGame()?.handleDash(socket.id))

  socket.on('restart', () => {
    const game = currentGame()
    if (!game) return
    game.reset()
    io.to(game.code).emit('worldReset', game.initPayload())
  })

  socket.on('leaveGame', () => leaveCurrentGame(socket))
  socket.on('disconnect', () => leaveCurrentGame(socket))
})

// ---- main loop ----

const dt = 1 / TICK_RATE
setInterval(() => {
  for (const game of games.values()) {
    if (game.players.size === 0) continue
    game.tick(dt)
    io.to(game.code).emit('snap', game.snapshot())
  }
}, 1000 / TICK_RATE)

server.listen(PORT, () => {
  console.log(`Dungeon of Doom running at http://localhost:${PORT}`)
})
