import { MONOLITO as M, TUNING } from '../tuning.js'
import { circleHit, halfDiscHit, solidPoint } from '../collision.js'

// Duas fases. A pirâmide bate no chão e vai rachando; na quarta queda fica
// frágil. Aí é preciso esquentá-la — flecha em brasa ou lava por baixo — e a
// carapaça cede, expondo o núcleo enquanto a sala vira uma grelha de jatos.
export const PHASE = { ARMOR: 1, CORE: 2 }

const HOVER = 'hover'
const TELEGRAPH = 'telegraph'
const FALLING = 'falling'
const RECOVER = 'recover'
const EXPOSED = 'exposed'
const REARM = 'rearm'

const DORMANT = 'dormant'
const WARN = 'warn'
const ERUPT = 'erupt'

export default class Monolito {
  constructor(room) {
    this.room = room
    this.reset()
  }

  reset() {
    this.x = this.room.bossSpawn.x
    this.y = this.room.bossSpawn.y
    this.phase = PHASE.ARMOR
    this.state = HOVER
    this.t = 0
    this.dead = false
    this.cracks = 0 // quedas acumuladas; em crackSlams ela fica frágil
    this.heat = 0 // 0 a 1; em 1 a carapaça cede
    this.heatHold = 0 // ms restantes segurando o calor antes de esfriar
    this.debris = []
    this.jets = []
    this.jetTimer = 0
    this.grabTimer = 0
    this.lockX = this.x
    this.lockY = this.y
    // Cada gêiser tem relógio próprio e espera aleatória: só alguns esquentam por
    // vez. Com período fixo compartilhado a arena inteira pulsava junto.
    this.geysers = this.room.geysers.map((g) => ({
      x: g.x,
      y: g.y,
      state: DORMANT,
      t: Math.random() * M.geyserRestMax,
    }))
  }

  get fragile() {
    return this.cracks >= M.crackSlams
  }

  /** Quanto mais rachada, mais rápido ela se levanta depois da queda. */
  get recoverTime() {
    const f = this.cracks / M.crackSlams
    return M.slamRecoverMax + (M.slamRecoverMin - M.slamRecoverMax) * f
  }

  /** Uma rachadura a mais; devolve true se essa foi a que a deixou frágil. */
  crack() {
    this.cracks = Math.min(M.crackSlams, this.cracks + 1)
    return this.fragile
  }

  /** No ar ele não encosta em ninguém; no chão, o contato mata. */
  get grounded() {
    return this.state !== HOVER && this.state !== TELEGRAPH
  }

  geyserState(g) {
    return g.state
  }

  /** Faixa coberta por um jato ativo. Vertical vem de cima; horizontal, das laterais. */
  jetHits(j, x, y, r) {
    if (j.t < M.jetWarn || j.t > M.jetWarn + M.jetActive) return false
    const half = M.jetWidth / 2 + r
    return j.side === 'top' ? Math.abs(x - j.pos) <= half : Math.abs(y - j.pos) <= half
  }

  /** Ponto dentro de lava ativa? Serve para acender a flecha e para matar. */
  igniteAt(x, y) {
    if (this.geysers.some((g) => this.geyserState(g) === ERUPT && circleHit(x, y, 0, g.x, g.y, M.geyserRadius))) {
      return true
    }
    return this.jets.some((j) => this.jetHits(j, x, y, 0))
  }

  /**
   * Encosta em algo neste ponto? A carapaça é um meio-disco — ela ocupa o espaço
   * acima da própria base. O núcleo é uma esfera solta, então continua círculo.
   */
  touches(x, y, r) {
    if (this.phase === PHASE.CORE) return circleHit(x, y, r, this.x, this.y, M.coreRadius)
    return halfDiscHit(x, y, r, this.x, this.y, M.bodyRadius)
  }

  /** O que a flecha encontra neste ponto. Voando, ele não tem corpo alcançável. */
  hitTest(x, y) {
    if (this.dead || !this.grounded) return null
    if (!this.touches(x, y, TUNING.arrowRadius)) return null
    return this.phase === PHASE.CORE ? 'core' : 'body'
  }

  /**
   * Núcleo morre em um acerto. No corpo, a flecha só importa se estiver em brasa
   * e a pirâmide já estiver rachada: aí o calor entra de uma vez.
   */
  onArrowHit(kind, arrow) {
    if (this.dead) return
    if (kind === 'core') {
      this.dead = true
      this.silence()
      return
    }
    // A flecha racha por si só. Se a rachadura que ela abriu for a última e a
    // flecha estiver em brasa, a carapaça cede no mesmo acerto.
    const agoraFragil = this.crack()
    if (agoraFragil && arrow.burning) this.shatter()
  }

  /** Morto, a arena cala: nada de jato, entulho voando ou gêiser aberto. */
  silence() {
    this.jets = []
    this.debris = []
    for (const g of this.geysers) {
      g.state = DORMANT
      g.t = M.geyserRestMax
    }
  }

  shatter() {
    this.phase = PHASE.CORE
    this.state = EXPOSED
    this.t = 0
    this.jetTimer = 0
    this.grabTimer = M.debrisSettle
    this.throwDebris(M.shatterDebris, M.shatterDebrisSize)
    // A carapaça cede por dois caminhos — o calor, que tem `ctx`, e o acerto em
    // brasa, que não tem. Marcar aqui e tocar no quadro seguinte cobre os dois
    // sem mudar o contrato de `onArrowHit`.
    this.somEstilhaco = true
  }

  /** Arremessa `n` pedaços de lado `size` em leque a partir do corpo. */
  throwDebris(n, size) {
    const off = Math.random() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const v = M.debrisSpeed * (0.6 + Math.random() * 0.7)
      this.debris.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        size,
        age: 0,
        landed: false,
        pulled: false,
        // Arte sorteada e giro próprio: sem isso oito cacos iguais saem em leque
        // e leem como padrão, não como estilhaço.
        art: Math.floor(Math.random() * M.debrisArtCount),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 2 * M.debrisSpin,
      })
    }
    // Ele bate indefinidamente enquanto você não o esquenta, então o entulho
    // cresceria sem fim. Os mais antigos somem primeiro.
    if (this.debris.length > M.debrisMax) this.debris.splice(0, this.debris.length - M.debrisMax)
  }

  /** Refaz a carapaça inteira: as rachaduras somem e a luta volta à fase 1. */
  rearm() {
    this.phase = PHASE.ARMOR
    this.state = HOVER
    this.t = 0
    this.cracks = 0
    this.heat = 0
    this.heatHold = 0
    this.jets = []
    this.debris = []
  }

  /** ctx: { player, grid, kill, shake } */
  update(dt, ctx) {
    if (this.somEstilhaco) {
      this.somEstilhaco = false
      ctx.som?.('estilhaca')
    }
    if (this.dead) return
    this.t += dt * 1000
    this.stepGeysers(dt, ctx)
    this.stepDebris(dt, ctx)

    if (this.phase === PHASE.ARMOR) this.stepArmorPhase(dt, ctx)
    else this.stepCorePhase(dt, ctx)

    if (this.grounded && this.touches(ctx.player.x, ctx.player.y, TUNING.playerRadius)) ctx.kill()
  }

  get radius() {
    return this.phase === PHASE.CORE ? M.coreRadius : M.bodyRadius
  }

  stepGeysers(dt, ctx) {
    for (const g of this.geysers) {
      g.t -= dt * 1000
      if (g.t <= 0) {
        if (g.state === DORMANT) {
          g.state = WARN
          g.t = M.geyserWarn
        } else if (g.state === WARN) {
          g.state = ERUPT
          ctx.som?.('geiser')
          g.t = M.geyserErupt
        } else {
          g.state = DORMANT
          g.t = M.geyserRestMin + Math.random() * (M.geyserRestMax - M.geyserRestMin)
        }
      }
      if (g.state !== ERUPT) continue
      if (circleHit(ctx.player.x, ctx.player.y, TUNING.playerRadius, g.x, g.y, M.geyserRadius)) ctx.kill()
    }
  }

  /**
   * Um único sistema para os destroços da batida e os do estilhaçamento: é a
   * mesma obsidiana. Voando eles cortam; parados viram entulho de cenário; e na
   * fase do núcleo ele recolhe qualquer um que esteja no chão.
   */
  stepDebris(dt, ctx) {
    for (const d of this.debris) {
      d.age += dt * 1000
      if (d.pulled) {
        const dx = this.x - d.x
        const dy = this.y - d.y
        const dist = Math.hypot(dx, dy) || 1
        const step = M.debrisPull * dt
        if (dist <= step) {
          d.done = true // absorvido
          continue
        }
        d.x += (dx / dist) * step
        d.y += (dy / dist) * step
      } else if (!d.landed) {
        d.rot += d.spin * dt // para de girar ao assentar
        const nx = d.x + d.vx * dt
        const ny = d.y + d.vy * dt
        // Bateu na parede: assenta ali mesmo, senão enterrava dentro da pedra.
        if (solidPoint(ctx.grid, nx, ny)) {
          d.landed = true
          continue
        }
        d.x = nx
        d.y = ny
        const k = 1 - M.debrisDrag * dt
        d.vx *= k
        d.vy *= k
        if (Math.hypot(d.vx, d.vy) <= M.debrisRest) d.landed = true
        // Corta só em movimento e depois de armar. Antes disso ele sai com a cor
        // de repouso, dando tempo de reagir a uma batida ao seu lado.
        if (d.age >= M.debrisArmTime && circleHit(ctx.player.x, ctx.player.y, TUNING.playerRadius, d.x, d.y, M.debrisRadius)) {
          ctx.kill()
        }
      }
    }
    this.debris = this.debris.filter((d) => !d.done)
  }

  /** Chama um caco por vez, sorteado entre os que já assentaram. */
  grabDebris(dt) {
    this.grabTimer -= dt * 1000
    if (this.grabTimer > 0) return
    this.grabTimer = M.debrisGrabEvery
    const parados = this.debris.filter((d) => d.landed && !d.pulled)
    if (parados.length) parados[Math.floor(Math.random() * parados.length)].pulled = true
  }

  stepArmorPhase(dt, ctx) {
    const p = ctx.player

    // Calor só serve depois de rachada; sem isso a carapaça inteira absorve tudo.
    const onLava = this.grounded && this.geysers.some(
      (g) => this.geyserState(g) === ERUPT && circleHit(this.x, this.y, M.bodyRadius * 0.6, g.x, g.y, M.geyserRadius),
    )
    // O calor não escorre logo que ela sai da lava: fica retido por um tempo, o
    // que deixa aquecimentos parciais se somarem entre um gêiser e outro.
    if (onLava) {
      this.heat = Math.min(M.heatShatter, this.heat + M.heatFromLava * dt)
      this.heatHold = M.heatHold
    } else if (this.heatHold > 0) {
      this.heatHold -= dt * 1000
    } else {
      this.heat = Math.max(0, this.heat - M.heatDecay * dt)
    }
    if (this.fragile && this.heat >= M.heatShatter) {
      this.shatter()
      return
    }

    if (this.state === HOVER) {
      this.moveToward(p.x, p.y, M.hoverSpeed * dt)
      if (this.t >= M.aimTime) {
        this.state = TELEGRAPH
        this.t = 0
        this.lockX = p.x
        this.lockY = p.y
      }
    } else if (this.state === TELEGRAPH) {
      // Mira travada: a posição não acompanha mais o jogador, é o que dá a esquiva.
      if (this.t >= M.aimTime * 0.5) {
        this.state = FALLING
        this.t = 0
      }
    } else if (this.state === FALLING) {
      if (this.moveToward(this.lockX, this.lockY, M.slamSpeed * dt)) {
        this.state = RECOVER
        this.t = 0
        this.crack()
        this.throwDebris(M.slamDebris, M.slamDebrisSize)
        if (ctx.shake) ctx.shake(M.slamShakeMs, M.slamShakeAmp)
        ctx.som?.('pousa')
        ctx.som?.('racha', 0.7)
      }
    } else if (this.state === RECOVER && this.t >= this.recoverTime) {
      this.state = HOVER
      this.t = 0
    }
  }

  stepCorePhase(dt, ctx) {
    if (this.state === REARM) {
      if (this.t >= M.rearmTime) this.rearm()
      return
    }

    this.moveToward(ctx.player.x, ctx.player.y, M.exposedSpeed * dt)
    this.grabDebris(dt)
    if (this.t >= M.coreWindow) {
      this.state = REARM
      this.t = 0
    }

    this.jetTimer -= dt * 1000
    if (this.jetTimer <= 0) {
      this.jetTimer = M.jetEvery
      this.spawnJet()
    }
    for (const j of this.jets) {
      const antes = j.t
      j.t += dt * 1000
      // O aviso acaba e o jato abre: é esse o instante que faz barulho, não o
      // quadro em que ele nasceu — aviso é luz, jato é pressão.
      if (antes < M.jetWarn && j.t >= M.jetWarn) ctx.som?.('jato')
      if (j.t > M.jetWarn + M.jetActive) j.done = true
      else if (this.jetHits(j, ctx.player.x, ctx.player.y, TUNING.playerRadius)) ctx.kill()
    }
    this.jets = this.jets.filter((j) => !j.done)
  }

  /** Jato de uma das três paredes: de cima desce, das laterais atravessa. */
  spawnJet() {
    const side = ['top', 'left', 'right'][Math.floor(Math.random() * 3)]
    const span = side === 'top' ? this.room.width : this.room.height
    const pos = TUNING.tileSize * 1.5 + Math.random() * (span - TUNING.tileSize * 3)
    this.jets.push({ side, pos, t: 0 })
  }

  /** Move em linha reta até o alvo; devolve true ao chegar. */
  moveToward(tx, ty, step) {
    const dx = tx - this.x
    const dy = ty - this.y
    const d = Math.hypot(dx, dy)
    if (d <= step) {
      this.x = tx
      this.y = ty
      return true
    }
    this.x += (dx / d) * step
    this.y += (dy / d) * step
    return false
  }
}
