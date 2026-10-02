// Poeira e rastro da flecha.
//
// Cosmético: anda no **delta real** do monitor, nunca no passo fixo — nada aqui
// muda o resultado de uma luta, e prender partícula ao passo fixo só faria o
// jogo parecer travado durante o hitstop, que é justamente quando o suco tem que
// continuar se mexendo.
//
// Sem Phaser neste arquivo: quem desenha é a cena, que é dona das camadas.

import { JUICE } from './tuning.js'

/** Nuvem de partículas: sopra, desacelera, encolhe e some. */
export class Dust {
  constructor() {
    this.parts = []
  }

  /**
   * `dirX/dirY` é para onde a nuvem sopra; `spread` é o quanto ela se abre em
   * radianos. Sem direção ela sai para todo lado.
   */
  spawn(x, y, n, opts = {}) {
    const {
      dirX = 0,
      dirY = 0,
      spread = Math.PI * 2,
      speed = JUICE.dustSpeed,
      life = JUICE.dustLife,
      size = JUICE.dustSize,
      color = 0x808080,
    } = opts
    const base = dirX || dirY ? Math.atan2(dirY, dirX) : 0
    for (let i = 0; i < n; i++) {
      const ang = base + (Math.random() - 0.5) * spread
      const v = speed * (0.45 + Math.random() * 0.75)
      const t = life * (0.6 + Math.random() * 0.7)
      this.parts.push({
        x,
        y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v * 0.6, // achatado: a poeira corre no chão, não sobe
        t,
        max: t,
        size: size * (0.7 + Math.random() * 0.8),
        color,
      })
      if (this.parts.length > JUICE.dustMax) this.parts.shift()
    }
  }

  step(dt) {
    const k = Math.max(0, 1 - JUICE.dustDrag * dt)
    for (const p of this.parts) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= k
      p.vy *= k
      p.t -= dt * 1000
    }
    // Filtrar só quando alguma morreu: a lista é curta, mas isto roda todo quadro.
    if (this.parts.some((p) => p.t <= 0)) this.parts = this.parts.filter((p) => p.t > 0)
  }

  clear() {
    this.parts.length = 0
  }
}

/**
 * Rastro da flecha: as últimas posições dela, envelhecendo. É o que dá leitura
 * de velocidade — a flecha carregada anda 42 px por quadro, e sem rastro ela
 * some de um lado e aparece do outro.
 */
export class Trail {
  constructor() {
    this.points = []
  }

  push(x, y) {
    const ultimo = this.points[this.points.length - 1]
    // Parada, ela não acumula ponto em cima de ponto.
    if (ultimo && Math.abs(ultimo.x - x) < 1 && Math.abs(ultimo.y - y) < 1) return
    this.points.push({ x, y, t: JUICE.trailLife })
    if (this.points.length > JUICE.trailPoints) this.points.shift()
  }

  step(dt) {
    for (const p of this.points) p.t -= dt * 1000
    while (this.points.length && this.points[0].t <= 0) this.points.shift()
  }

  clear() {
    this.points.length = 0
  }
}
