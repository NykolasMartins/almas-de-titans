import { CORO as C, SINO_ART as ART, TUNING } from '../tuning.js'
import { circleHit, segmentHit, bounceRay } from '../collision.js'

/**
 * O Coro.
 *
 * O badalo do sino grande não morre quando você acerta: **ele desvia** e foge
 * para um dos sete sinos apagados que estão pendurados na câmara desde o começo
 * da luta. Eles acordam, e a partir daí a luta é outra.
 *
 * Uma fase só, em ciclo:
 *
 * 1. **Embaralho** — todos trocam de lugar no céu, em arcos que se cruzam. Sete
 *    corpos iguais, e você perde de vista qual carrega o coração.
 * 2. **Badaladas** — de volta aos ganchos, eles tocam em ordem sorteada. Cada
 *    badalada chacoalha o sino e solta uma **onda de som** que cobre um pouco
 *    mais que meia sala: a frente mata, e quem se salva é quem está do outro
 *    lado.
 * 3. **A mira** — passada a rodada de badaladas, **o sino do coração se
 *    entrega**: ele se inclina na sua direção e leva 2 s assim. O feixe sai na
 *    direção **antiga**, então sair de cima da linha é o que salva.
 * 4. **A volta** — ele demora para se endireitar, e o coração continua exposto.
 *
 * Inclinado, a boca vira para fora e **o badalo aparece**: o feixe sai do
 * próprio coração, e é essa a janela para acertá-lo. De pé ele está dentro da
 * boca, inalcançável — a flecha passa por baixo de todos eles, que estão no ar.
 */
export const ESCAPE = 'escape'
export const SCRAMBLE = 'scramble'
export const RING = 'ring'
export const AIM = 'aim'
export const BEAM = 'beam'
export const HOLD = 'hold' // parado, deitado e com o badalo à mostra
export const RECOVER = 'recover'

/** Suavização nas duas pontas: eles saem e chegam sem tranco. */
const suave = (p) => p * p * (3 - 2 * p)

export default class Coro {
  constructor(room, origem) {
    this.room = room
    this.homes = (room.hangingBells ?? []).map(([x, y]) => ({ x, y }))
    this.bells = this.homes.map((h) => ({
      x: h.x,
      y: h.y,
      ax: h.x,
      ay: h.y,
      bx: h.x,
      by: h.y,
      arc: 0,
      ring: 0,
      shake: 0,
    }))
    // Quem ficou com o coração é sorteado: a luta não pode ter resposta decorada.
    this.heart = Math.floor(Math.random() * this.bells.length)
    this.from = { x: origem.x, y: origem.y }

    this.state = ESCAPE
    this.t = 0
    this.dead = false
    this.round = 0
    this.awake = 0 // 0 a 1: o quanto o coro já acordou, para a cor voltar

    this.waves = []
    this.beam = null
    this.aimX = 0
    this.aimY = 1
    this.aimLocked = false
    this.tilt = 0 // 0 de pé, 1 inclinado com a boca para fora

    this.ringEvery = C.ringEvery
    this.aimTime = C.aimTime
    this.recoverTime = C.recoverTime
    this.ringsLeft = C.rings
    this.ringTimer = 0
    this.swapsLeft = 0
    this.swapT = 0
  }

  /** O chefe **é** o sino do coração: é ele que a cena segue e mata. */
  get x() {
    return this.bells[this.heart]?.x ?? 0
  }

  get y() {
    return this.bells[this.heart]?.y ?? 0
  }

  get radius() {
    return ART.cell * C.scale * 0.25
  }

  /** Exposto do momento em que se inclina até acabar de se endireitar. */
  get exposed() {
    return this.state === AIM || this.state === BEAM || this.state === HOLD || this.state === RECOVER
  }

  /** Setor de 45° da mira, na mesma convenção do sino caído. */
  get sector() {
    const i = Math.round((Math.atan2(this.aimY, this.aimX) * 4) / Math.PI)
    return ((i % 8) + 8) % 8
  }

  /**
   * O badalo. De pé ele está dentro da boca; inclinado, sai para onde a arte do
   * sino caído o coloca naquele setor — a mesma tabela do chefe grande, na
   * escala menor destes.
   */
  corePos() {
    const b = this.bells[this.heart]
    if (!b) return { x: 0, y: 0 }
    const k = C.scale / ART.fallenScale
    const o = ART.fallenCore[this.sector]
    const px = o[0] * k
    const py = o[1] * k
    return {
      x: b.x + px * this.tilt,
      y: b.y - C.coreRise + (py + C.coreRise) * this.tilt,
    }
  }

  /** Onde o coração está enquanto foge, antes de entrar no corpo novo. */
  escapePos() {
    const p = Math.min(1, this.t / C.escapeTime)
    const alvo = this.corePos()
    // Sobe no meio do caminho: ele pula de um corpo para o outro.
    return {
      x: this.from.x + (alvo.x - this.from.x) * p,
      y: this.from.y + (alvo.y - this.from.y) * p - Math.sin(p * Math.PI) * 40,
    }
  }

  update(dt, ctx) {
    if (this.dead) return
    this.t += dt * 1000
    this.stepWaves(dt, ctx)

    if (this.state === ESCAPE) {
      this.awake = Math.min(1, this.t / C.escapeTime)
      if (this.t >= C.escapeTime) this.startScramble()
      return
    }

    if (this.state === SCRAMBLE) this.stepScramble(dt)
    else if (this.state === RING) this.stepRing(dt, ctx)
    else if (this.state === AIM) this.stepAim(dt, ctx)
    else if (this.state === BEAM) this.stepBeam(dt, ctx)
    else if (this.state === HOLD) this.stepHold()
    else if (this.state === RECOVER) this.stepRecover(dt)

    for (const b of this.bells) {
      if (b.shake > 0) b.shake -= dt * 1000
    }
  }

  startScramble() {
    this.state = SCRAMBLE
    this.t = 0
    this.swapsLeft = C.swaps
    this.swapT = 0
  }

  /** Uma rodada nova de troca de lugares, em arcos que se cruzam. */
  embaralha() {
    const ordem = this.homes.map((_, i) => i)
    for (let i = ordem.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const troca = ordem[i]
      ordem[i] = ordem[j]
      ordem[j] = troca
    }
    this.bells.forEach((b, i) => {
      b.ax = b.x
      b.ay = b.y
      b.bx = this.homes[ordem[i]].x
      b.by = this.homes[ordem[i]].y
      // Arco alternado: dois sinos que trocam não passam um dentro do outro.
      b.arc = (i % 2 === 0 ? 1 : -1) * C.swapArc
    })
    this.swapT = C.swapTime
  }

  stepScramble(dt) {
    if (this.swapT <= 0) {
      if (this.swapsLeft <= 0) {
        this.state = RING
        this.t = 0
        this.ringsLeft = C.rings
        this.ringTimer = C.ringWarn
        return
      }
      this.swapsLeft--
      this.embaralha()
    }
    this.swapT -= dt * 1000
    const p = suave(Math.min(1, 1 - this.swapT / C.swapTime))
    for (const b of this.bells) {
      const dx = b.bx - b.ax
      const dy = b.by - b.ay
      const d = Math.hypot(dx, dy) || 1
      const desvio = Math.sin(p * Math.PI) * b.arc
      b.x = b.ax + dx * p - (dy / d) * desvio
      b.y = b.ay + dy * p + (dx / d) * desvio
    }
  }

  stepRing(dt, ctx) {
    this.ringTimer -= dt * 1000
    if (this.ringTimer <= 0 && this.ringsLeft > 0) {
      this.ringsLeft--
      this.ringTimer = this.ringEvery
      const b = this.bells[Math.floor(Math.random() * this.bells.length)]
      b.ring = C.ringWarn
      b.shake = C.ringWarn
    }
    for (const b of this.bells) {
      if (b.ring <= 0) continue
      b.ring -= dt * 1000
      if (b.ring <= 0) {
        this.waves.push({ x: b.x, y: b.y, r: 0 })
        b.shake = C.ringWarn * 0.4
        // A badalada. Era a falta mais gritante do jogo: sete sinos tocando em
        // silêncio, e a onda que mata saindo de lugar nenhum.
        ctx.som?.('sinoBadala')
      }
    }
    // Acabaram as badaladas **e a última onda já se apagou**: aí o coração se
    // entrega. Onda aberta e feixe carregando ao mesmo tempo eram duas leituras
    // disputando a mesma atenção.
    if (this.ringsLeft <= 0 && this.waves.length === 0 && this.bells.every((b) => b.ring <= 0)) {
      this.state = AIM
      this.t = 0
      this.tilt = 0
      this.aimLocked = false
    }
  }

  stepAim(dt, ctx) {
    if (!this.aimLocked) {
      // A direção trava agora: o feixe sai onde você **estava**.
      const b = this.bells[this.heart]
      const dx = ctx.player.x - b.x
      const dy = ctx.player.y - b.y
      const d = Math.hypot(dx, dy) || 1
      this.aimX = dx / d
      this.aimY = dy / d
      this.aimLocked = true
    }
    this.tilt = suave(Math.min(1, this.t / this.aimTime))
    if (this.t >= this.aimTime) {
      this.state = BEAM
      this.t = 0
      this.beam = this.traceBeam(ctx.grid)
      if (ctx.shake) ctx.shake(C.beamShakeMs, C.beamShakeAmp)
      ctx.som?.('feixe')
    }
  }

  /** O feixe sai do coração e para na muralha. Sem quique: ele é bruto. */
  traceBeam(grid) {
    const c = this.corePos()
    return bounceRay(grid, c.x, c.y, this.aimX, this.aimY, C.beamRange, 0).points
  }

  stepBeam(dt, ctx) {
    if (this.beam) {
      for (let i = 1; i < this.beam.length; i++) {
        const a = this.beam[i - 1]
        const b = this.beam[i]
        if (segmentHit(ctx.player.x, ctx.player.y, TUNING.playerRadius + C.beamWidth / 2, a.x, a.y, b.x, b.y)) {
          ctx.kill()
          break
        }
      }
    }
    if (this.t >= C.beamTime) {
      this.state = HOLD
      this.t = 0
      this.beam = null
    }
  }

  /** Depois do tiro ele fica onde está, deitado e aberto: é a janela de acerto. */
  stepHold() {
    if (this.t >= C.holdTime) {
      this.state = RECOVER
      this.t = 0
    }
  }

  stepRecover() {
    this.tilt = 1 - suave(Math.min(1, this.t / this.recoverTime))
    if (this.t < this.recoverTime) return
    // Fecha a boca e some de novo no meio dos outros, e a cada rodada aperta.
    this.round++
    this.ringEvery = Math.max(C.ringEveryMin, this.ringEvery * C.ringSpeedUp)
    this.aimTime = Math.max(C.aimTimeMin, this.aimTime * C.aimSpeedUp)
    this.recoverTime = Math.max(C.recoverMin, this.recoverTime * C.recoverShrink)
    this.tilt = 0
    this.startScramble()
  }

  /**
   * Ondas de som. Duas regras: **só a frente mata**, então dá para ficar dentro
   * do que já passou; e ela **se dissipa depois do meio da sala**, então existe
   * sempre uma faixa de fora onde o som chega fraco demais para machucar.
   */
  stepWaves(dt, ctx) {
    for (const w of this.waves) {
      w.r += C.waveSpeed * dt
      if (w.r > C.waveFade) continue // dissipando: daqui em diante é só luz
      const d = Math.hypot(ctx.player.x - w.x, ctx.player.y - w.y)
      if (Math.abs(d - w.r) <= C.waveThick / 2 + TUNING.playerRadius) ctx.kill()
    }
    if (this.waves.some((w) => w.r >= C.waveRange)) this.waves = this.waves.filter((w) => w.r < C.waveRange)
  }

  /**
   * Só o badalo exposto para a flecha. Os corpos estão no ar, como sempre
   * estiveram nesta câmara: a flecha passa por baixo deles.
   */
  hitTest(x, y) {
    if (this.dead || !this.exposed) return null
    const c = this.corePos()
    return circleHit(x, y, TUNING.arrowRadius, c.x, c.y, C.coreRadius) ? 'core' : null
  }

  onArrowHit(kind) {
    if (kind === 'core') this.dead = true
  }
}
