import { TUNING, PLAYER_BOX } from './tuning.js'
import { moveBox } from './collision.js'

export default class Player {
  constructor(x, y) {
    this.reset(x, y)
  }

  reset(x, y) {
    this.x = x
    this.y = y
    this.faceX = 1
    this.faceY = 0
    this.rollLeft = 0 // ms restantes do rolamento (ou do trancão)
    this.rollX = 0
    this.rollY = 0
    this.dashSpeed = TUNING.rollSpeed
    this.tethering = false
    this.tetherGap = TUNING.tetherStopGap
    this.moving = false // só para escolher entre animação parada e correndo
  }

  get rolling() {
    return this.rollLeft > 0
  }

  /** Altura do arco. A colisão do jogador é nos pés, mas a flecha sai da mão. */
  get handY() {
    return this.y - TUNING.bowHeight
  }

  /**
   * Vínculo: só com a flecha cravada, e não interrompe um rolamento em curso.
   * `gap` é onde o puxão para. O padrão para um pouco antes da flecha; 0 leva o
   * jogador até ela — é o que acontece quando a âncora é um corpo pesado demais
   * para ceder, e aterrissar em cima dele é o preço.
   */
  startTether(gap = TUNING.tetherStopGap) {
    if (this.rolling) return
    this.tethering = true
    this.tetherGap = gap
  }

  /**
   * Trancão: deslocamento sem controle, com a mesma máquina do rolamento mas com
   * velocidade e duração próprias. É a reação a puxar um corpo pesado — a corda
   * tem dois lados, e o que não cede leva você junto.
   */
  shove(dirX, dirY, speed, ms) {
    this.rollLeft = ms
    this.rollX = dirX
    this.rollY = dirY
    this.dashSpeed = speed
  }

  /**
   * O rolamento trava a direção no instante em que começa, não pode ser
   * interrompido e não dá invencibilidade. É deslocamento, não defesa.
   */
  step(dt, input, grid) {
    if (this.tethering) {
      this.stepTether(dt, input, grid)
      return
    }

    let vx = 0
    let vy = 0

    if (this.rolling) {
      this.rollLeft -= dt * 1000
      vx = this.rollX * this.dashSpeed
      vy = this.rollY * this.dashSpeed
    } else {
      if (input.dirX || input.dirY) {
        this.faceX = input.dirX
        this.faceY = input.dirY
      }
      if (input.rollPressed) {
        this.rollLeft = TUNING.rollDuration
        this.rollX = this.faceX
        this.rollY = this.faceY
        this.dashSpeed = TUNING.rollSpeed
        vx = this.rollX * TUNING.rollSpeed
        vy = this.rollY * TUNING.rollSpeed
      } else {
        const speed = input.aiming ? TUNING.aimSpeed : TUNING.walkSpeed
        vx = input.dirX * speed
        vy = input.dirY * speed
      }
    }

    this.moving = vx !== 0 || vy !== 0
    const m = moveBox(grid, this.x, this.y, vx * dt, vy * dt, PLAYER_BOX.hw, PLAYER_BOX.hh)
    this.x = m.x
    this.y = m.y
  }

  /**
   * Puxado em linha reta até a flecha: sem controle, sem invencibilidade, sem
   * atravessar parede. A âncora é lida a cada passo, então uma flecha cravada
   * num chefe que anda arrasta o jogador junto.
   */
  stepTether(dt, input, grid) {
    if (input.anchorX === null) {
      this.tethering = false
      return
    }

    const dx = input.anchorX - this.x
    const dy = input.anchorY - this.y
    const dist = Math.hypot(dx, dy)
    if (dist <= this.tetherGap) {
      this.tethering = false
      return
    }

    this.moving = true
    const move = Math.min(dist - this.tetherGap, TUNING.tetherSpeed * dt)
    const m = moveBox(grid, this.x, this.y, (dx / dist) * move, (dy / dist) * move, PLAYER_BOX.hw, PLAYER_BOX.hh)
    this.x = m.x
    this.y = m.y
    this.faceX = dx / dist
    this.faceY = dy / dist

    // Bateu em parede: o puxão é reto, não desliza. Acaba aqui.
    if (m.hitX || m.hitY) this.tethering = false
  }
}
