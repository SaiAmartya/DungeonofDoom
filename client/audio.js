// Tiny WebAudio synthesizer — all SFX generated procedurally, no assets.

class AudioFx {
  constructor () {
    this.ctx = null
    this.muted = false
  }

  ensure () {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return null
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.35
      this.master.connect(this.ctx.destination)
      // shared noise buffer
      const len = this.ctx.sampleRate
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  toggleMute () {
    this.muted = !this.muted
    return this.muted
  }

  tone ({ from, to, dur, type = 'sine', vol = 0.5, delay = 0 }) {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur)
    gain.gain.setValueAtTime(vol, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    osc.connect(gain).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  whoosh ({ from = 3000, to = 600, dur = 0.16, vol = 0.4 }) {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    const t0 = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 1.2
    filter.frequency.setValueAtTime(from, t0)
    filter.frequency.exponentialRampToValueAtTime(to, t0 + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    src.connect(filter).connect(gain).connect(this.master)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  swing () { this.whoosh({ from: 2600, to: 500, dur: 0.15, vol: 0.35 }) }
  dash () { this.whoosh({ from: 900, to: 2800, dur: 0.22, vol: 0.35 }) }
  hit () {
    this.tone({ from: 200, to: 70, dur: 0.12, type: 'square', vol: 0.3 })
    this.whoosh({ from: 4000, to: 1500, dur: 0.06, vol: 0.25 })
  }
  hurt () { this.tone({ from: 320, to: 90, dur: 0.22, type: 'sawtooth', vol: 0.4 }) }
  coin () {
    this.tone({ from: 980, to: 980, dur: 0.07, type: 'triangle', vol: 0.3 })
    this.tone({ from: 1320, to: 1320, dur: 0.18, type: 'triangle', vol: 0.3, delay: 0.07 })
  }
  heal () {
    this.tone({ from: 520, to: 520, dur: 0.1, type: 'sine', vol: 0.3 })
    this.tone({ from: 660, to: 660, dur: 0.1, type: 'sine', vol: 0.3, delay: 0.09 })
    this.tone({ from: 780, to: 780, dur: 0.2, type: 'sine', vol: 0.3, delay: 0.18 })
  }
  enemyDeath () { this.tone({ from: 260, to: 40, dur: 0.3, type: 'sawtooth', vol: 0.3 }) }
  playerDeath () { this.tone({ from: 240, to: 30, dur: 0.9, type: 'sawtooth', vol: 0.5 }) }
  bossRoar () {
    this.tone({ from: 70, to: 45, dur: 0.6, type: 'sawtooth', vol: 0.55 })
    this.tone({ from: 110, to: 60, dur: 0.6, type: 'square', vol: 0.3 })
  }
  victory () {
    const notes = [523, 659, 784, 1046]
    notes.forEach((n, i) => this.tone({ from: n, to: n, dur: 0.3, type: 'triangle', vol: 0.35, delay: i * 0.14 }))
  }
  gameover () {
    const notes = [392, 330, 262, 196]
    notes.forEach((n, i) => this.tone({ from: n, to: n * 0.97, dur: 0.4, type: 'sawtooth', vol: 0.3, delay: i * 0.22 }))
  }
  join () { this.tone({ from: 660, to: 880, dur: 0.18, type: 'triangle', vol: 0.3 }) }
}

export const audio = new AudioFx()
