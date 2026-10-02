import { TUNING } from './tuning.js'
import { circleHit, solidPoint, sweep } from './collision.js'

export const HELD = 'held'
export const FLYING = 'flying'
export const STUCK = 'stuck' // cravada em parede ou chefe: serve de âncora do Vínculo
export const GROUND = 'ground' // caída no chão: dá para chamar e pegar, mas não puxa
export const RETURNING = 'returning'

const MAX_STEP = 4 // px por subpasso do sweep
const MAX_REFLECT = 4 // quiques no espelho antes de a flecha simplesmente cravar

export default class Arrow {
  constructor() {
    this.reset()
  }

  reset() {
    this.state = HELD
    this.x = 0
    this.y = 0
    this.dirX = 1
    this.dirY = 0
    this.speed = 0
    this.stuckTo = null // 'wall' | 'target'
    // Um acerto de núcleo por tiro. Sem isso a flecha dispara o acerto em todo
    // quadro em que estiver sobreposta ao núcleo.
    // ponytail: se algum chefe precisar sobreviver e ser acertado de novo no
    // mesmo tiro, este vira contador por passagem.
    this.coreHit = false
    // A volta que crava numa parede exige soltar e puxar de novo, senão ela
    // ficaria presa num laço de cravar e repuxar no mesmo ponto.
    this.recallBlocked = false
    // Quantas vezes já foi rebatida neste tiro. Teto de segurança: um espelho
    // mal posicionado poderia devolver a flecha para dentro de si mesmo.
    this.bounces = 0
    // Acesa ao cruzar um jato de lava. Apaga só no próximo tiro.
    this.burning = false
  }

  get angle() {
    return Math.atan2(this.dirY, this.dirX)
  }

  /** `charge` de 0 a 1: quanto mais carregado, mais rápido sai e mais longe chega. */
  shoot(x, y, dirX, dirY, charge) {
    if (this.state !== HELD) return
    this.state = FLYING
    this.x = x
    this.y = y
    this.dirX = dirX
    this.dirY = dirY
    this.speed = TUNING.arrowSpeedMin + (TUNING.arrowSpeedMax - TUNING.arrowSpeedMin) * charge
    this.stuckTo = null
    this.coreHit = false
    this.recallBlocked = false
    this.bounces = 0
    this.burning = false
  }

  /** Vale em pleno voo, cravada ou caída: dá para cancelar um tiro errado. */
  recall() {
    if (this.state === HELD || this.state === RETURNING || this.recallBlocked) return
    this.state = RETURNING
    this.speed = TUNING.recallSpeedMin
    this.stuckTo = null
  }

  /**
   * ctx: { grid, player, recallHeld, hitTest, onHit, igniteAt }
   * `hitTest(x, y)` devolve 'core' | 'body' | null — a flecha não sabe o que é
   * chefe, só o que para ela e o que a mata. `igniteAt(x, y)` diz se aquele ponto
   * é fogo.
   */
  step(dt, ctx) {
    if (this.state === FLYING) this.stepFlying(dt, ctx)
    else if (this.state === RETURNING) this.stepReturning(dt, ctx)
    else if (this.state === STUCK || this.state === GROUND) this.tryPickup(ctx)
  }

  stepFlying(dt, ctx) {
    this.speed -= this.speed * (TUNING.arrowDrag + TUNING.arrowDragFast * this.speed) * dt

    const dx = this.dirX * this.speed * dt
    const dy = this.dirY * this.speed * dt
    const { grid, hitTest } = ctx

    const hit = sweep(this.x, this.y, dx, dy, MAX_STEP, (px, py) => {
      // Núcleo antes do corpo: ele fica na borda e vale mais que o corpo.
      const kind = hitTest ? hitTest(px, py) : null
      if (kind === 'core' && this.coreHit) return solidPoint(grid, px, py) ? 'wall' : null
      if (kind) return kind
      return solidPoint(grid, px, py) ? 'wall' : null
    })

    // Fogo só acende no trecho realmente percorrido: atrás de uma parede não pega.
    const movedX = hit ? hit.prevX - this.x : dx
    const movedY = hit ? hit.prevY - this.y : dy
    if (!this.burning && ctx.igniteAt) {
      const fire = sweep(this.x, this.y, movedX, movedY, MAX_STEP, (px, py) => (ctx.igniteAt(px, py) ? true : null))
      if (fire) this.burning = true
    }

    if (hit) {
      // Espelho: não crava, é devolvida. Quem decide para onde é o chefe — ele é
      // que tem a face —, então a flecha só recua para o último ponto livre e
      // entrega a si mesma no `onHit`.
      if (hit.value === 'reflect' && this.bounces < MAX_REFLECT) {
        this.bounces++
        this.x = hit.prevX
        this.y = hit.prevY
        if (ctx.onHit) ctx.onHit('reflect', this)
        return
      }

      // Crava no último ponto livre, não dentro do sólido.
      this.x = hit.prevX
      this.y = hit.prevY
      this.state = STUCK
      this.speed = 0
      this.stuckTo = hit.value === 'wall' ? 'wall' : 'boss'
      if (hit.value === 'core') this.coreHit = true
      // No teto de quiques ela para no espelho como se fosse corpo: avisar
      // 'reflect' de novo faria o chefe virar uma flecha que já está cravada.
      const tipo = hit.value === 'reflect' ? 'body' : hit.value
      if (tipo !== 'wall' && ctx.onHit) ctx.onHit(tipo, this)
      return
    }

    this.x += dx
    this.y += dy
    if (this.speed <= TUNING.arrowRestSpeed) {
      this.state = GROUND
      this.speed = 0
    }
  }

  /**
   * A volta atravessa o corpo do chefe mas para na parede. Continuar puxando
   * acelera: quanto mais tempo, mais rápido ela vem. Soltar não corta na hora —
   * ela desacelera pela mesma curva do voo e cai.
   */
  stepReturning(dt, ctx) {
    const { grid, player, hitTest } = ctx

    if (ctx.recallHeld) {
      this.speed = Math.min(TUNING.recallSpeedMax, this.speed + TUNING.recallAccel * dt)
    } else {
      // Soltar não corta na hora: a flecha vai perdendo força e cai.
      this.speed -= this.speed * TUNING.recallDrag * dt
      if (this.speed <= TUNING.arrowRestSpeed) {
        this.state = GROUND
        this.speed = 0
        return
      }
    }

    const toX = player.x - this.x
    const toY = player.handY - this.y
    const dist = Math.hypot(toX, toY) || 1
    const move = Math.min(dist, this.speed * dt)
    const dx = (toX / dist) * move
    const dy = (toY / dist) * move
    // Arrastada pela corda, ela volta de traseira: a ponta fica virada para o
    // lado oposto ao jogador. Aqui `dir` só alimenta o ângulo de desenho — o
    // movimento sai de `toX/toY`, então inverter não mexe na trajetória.
    this.dirX = -toX / dist
    this.dirY = -toY / dist

    // O núcleo não interrompe a volta — é a mecânica central: cravar atrás do
    // chefe e chamar a flecha pelo meio dele.
    if (hitTest && !this.coreHit) {
      const core = sweep(this.x, this.y, dx, dy, MAX_STEP, (px, py) => (hitTest(px, py) === 'core' ? 'core' : null))
      if (core) {
        this.coreHit = true
        if (ctx.onHit) ctx.onHit('core', this)
      }
    }

    const wall = sweep(this.x, this.y, dx, dy, MAX_STEP, (px, py) => (solidPoint(grid, px, py) ? 'wall' : null))
    if (wall) {
      this.x = wall.prevX
      this.y = wall.prevY
      this.state = STUCK
      this.stuckTo = 'wall'
      this.speed = 0
      this.recallBlocked = true
      return
    }

    this.x += dx
    this.y += dy
    if (dist <= move + 1) this.state = HELD
  }

  tryPickup(ctx) {
    const { player } = ctx
    if (circleHit(this.x, this.y, TUNING.arrowRadius, player.x, player.y, TUNING.playerRadius)) {
      this.state = HELD
      this.stuckTo = null
    }
  }
}
