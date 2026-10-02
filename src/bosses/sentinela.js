import { SENTINELA as S, TUNING } from '../tuning.js'
import { circleHit, segmentHit, bounceRay, moveBox } from '../collision.js'

/**
 * A Sentinela Espelhada. Não anda atrás de você: **desliza mantendo distância** e
 * encara você o tempo todo.
 *
 * A frente é espelho e **devolve a flecha contra quem atirou** — o tiro direto,
 * que é o reflexo natural, é o erro.
 *
 * **Fase 1: a carapaça.** As costas dela são blindadas, e a flecha não faz nada
 * ali. Só o **próprio feixe dela** quebra a carapaça — e o feixe reflete tanto na
 * muralha quanto na face espelhada dela. Quem mira esse raio é o jogador, sem
 * tocar nele: a direção dela sai de onde você está, e a posição dela sai de quão
 * longe você está. A prévia durante a carga deixa de ser aviso e vira mira.
 *
 * **Fase 2: o núcleo.** Sem carapaça ela abre o jogo — alcance maior, tiro mais
 * frequente, gira mais rápido. Aí o núcleo das costas é alcançável, e o jeito de
 * matar é plantar a flecha atrás dela e **chamá-la de volta atravessando o
 * corpo**: a mecânica que a seção 3.3 do DESIGN chama de central e que nenhum
 * chefe cobrava.
 *
 * O aperto vem de quem controla a posição dela ser **você**. Ela quer ficar a
 * `keepDist`: chegar perto a empurra para a muralha, afastar-se a traz para o
 * meio da sala — que é onde dá para contorná-la. Só que ficar longe é dar tempo
 * ao feixe, que ricocheteia nas paredes e transforma o salão inteiro no perigo.
 *
 * E disparar a **cega**: o espelho embaça com o calor do próprio feixe e ela para
 * de seguir você. É a única janela para se pôr atrás dela sem que ela vire junto.
 */
export const TRACK = 'track' // deslizando e encarando
export const CHARGE = 'charge' // mira travada, o caminho do feixe já aparece
export const FIRE = 'fire' // feixe ativo
export const BLIND = 'blind' // espelho embaçado: não vira, não atira

export default class Sentinela {
  constructor(room) {
    this.room = room
    this.reset()
  }

  reset() {
    this.x = this.room.bossSpawn.x
    this.y = this.room.bossSpawn.y
    this.face = Math.PI / 2 // encarando a câmera
    this.state = TRACK
    this.t = 0
    this.dead = false
    this.rounds = 0
    this.shell = true // carapaça nas costas; só o feixe dela quebra
    this.fireEvery = S.fireEvery
    this.blindTime = S.blindTime
    this.beam = null // polilinha do feixe, travada no disparo
    this.arrowOff = null
    this.vx = 0 // velocidade suavizada: é o que dá o deslize
    this.vy = 0
    this.driftT = 0
  }

  get nx() {
    return Math.cos(this.face)
  }

  get ny() {
    return Math.sin(this.face)
  }

  get radius() {
    return S.bodyRadius
  }

  /** Cega ela não vira nem atira: é a janela para chegar às costas. */
  get blind() {
    return this.state === BLIND
  }

  /** Quanto ela gira, quanto tempo carrega, até onde o feixe vai: muda na fase 2. */
  get turnSpeed() {
    return this.shell ? S.turnSpeed : S.exposedTurn
  }

  get chargeTime() {
    return this.shell ? S.chargeTime : S.exposedCharge
  }

  get beamTime() {
    return this.shell ? S.beamTime : S.exposedBeamTime
  }

  /**
   * O núcleo fica atrás, e um pouco além da borda do corpo. De trás a flecha o
   * encontra antes da pedra; de frente o espelho a devolve muito antes.
   *
   * ponytail: contínuo enquanto o chefe é desenhado por `Graphics`. Quando a
   * folha de 8 guinadas existir, isto vira tabela por setor como o badalo do
   * Sino — senão o brilho descola do desenho nos ângulos intermediários.
   */
  corePos() {
    return { x: this.x - this.nx * S.coreOffset, y: this.y - this.ny * S.coreOffset }
  }

  /** Frente é o hemisfério para onde ela encara. */
  isFront(x, y) {
    return (x - this.x) * this.nx + (y - this.y) * this.ny > 0
  }

  touches(x, y, r) {
    return circleHit(x, y, r, this.x, this.y, S.bodyRadius)
  }

  /**
   * Núcleo antes do corpo, e o corpo só é espelho pela frente. De costas a
   * flecha crava; de frente ela volta.
   */
  hitTest(x, y) {
    if (this.dead) return null
    // Com a carapaça, as costas são só pedra: a flecha crava e não resolve nada.
    if (!this.shell) {
      const c = this.corePos()
      if (circleHit(x, y, TUNING.arrowRadius, c.x, c.y, S.coreRadius)) return 'core'
    }
    if (!this.touches(x, y, TUNING.arrowRadius)) return null
    return this.isFront(x, y) ? 'reflect' : 'body'
  }

  onArrowHit(kind, arrow) {
    if (this.dead) return
    if (kind === 'core') {
      this.dead = true
      this.beam = null
      return
    }
    if (kind === 'reflect') {
      // Espelho plano de normal `n`: d' = d - 2(d·n)n. A flecha guarda parte da
      // velocidade e sai andando de novo — não é tiro perdido, é tiro devolvido.
      const dot = arrow.dirX * this.nx + arrow.dirY * this.ny
      arrow.dirX -= 2 * dot * this.nx
      arrow.dirY -= 2 * dot * this.ny
      arrow.speed *= S.reflectKeep
      // Um empurrãozinho para fora do espelho: sem isso um acerto muito raso
      // pode reentrar no mesmo passo e queimar os quiques à toa.
      arrow.x += arrow.dirX * 2
      arrow.y += arrow.dirY * 2
      return
    }
    // Cravou nas costas: vira âncora, e acompanha ela enquanto desliza.
    this.arrowOff = { dx: arrow.x - this.x, dy: arrow.y - this.y }
  }

  /** Flecha cravada nela vai junto: ela desliza o tempo todo. */
  carryArrow(arrow) {
    if (!this.arrowOff) return
    arrow.x = this.x + this.arrowOff.dx
    arrow.y = this.y + this.arrowOff.dy
  }

  /** ctx: { player, grid, kill, shake } */
  update(dt, ctx) {
    if (this.dead) return
    const ms = dt * 1000
    this.t += ms
    const p = ctx.player

    if (this.state === TRACK) {
      this.turnTo(p, dt)
      this.drift(p, dt, ctx.grid)
      if (this.t >= this.fireEvery) {
        this.state = CHARGE
        // O único som que sobe e fica: é ameaça crescendo, e manda procurar a
        // linha na tela antes de ela existir.
        ctx.som?.('carrega')
        this.t = 0
        // Planta os pés na hora. A parada seca é o aviso de que o tiro começou —
        // vale mais que qualquer efeito, porque ela se mexe o tempo todo.
        this.vx = 0
        this.vy = 0
      }
    } else if (this.state === CHARGE) {
      // Mira travada e ela planta os pés: é o telegrafo, e o caminho inteiro do
      // feixe já aparece na tela durante ele.
      if (this.t >= this.chargeTime) {
        this.state = FIRE
        this.t = 0
        const tiro = this.traceBeam(ctx.grid)
        this.beam = tiro.points
        // O feixe voltou nas próprias costas: é a única coisa que abre a carapaça.
        if (tiro.absorbed && this.shell) this.breakShell(ctx)
        else if (ctx.shake) ctx.shake(S.fireShakeMs, S.fireShakeAmp)
        ctx.som?.('feixe')
      }
    } else if (this.state === FIRE) {
      if (this.beam && this.beamHits(p.x, p.y, TUNING.playerRadius)) ctx.kill()
      if (this.t >= this.beamTime) {
        this.state = BLIND
        this.t = 0
        this.beam = null
        this.escalate()
      }
    } else if (this.state === BLIND) {
      if (this.t >= this.blindTime) {
        this.state = TRACK
        this.t = 0
      }
    }

    if (this.touches(p.x, p.y, TUNING.playerRadius)) ctx.kill()
  }

  /** A cada ciclo ela atira mais cedo e enxerga de volta mais rápido. */
  escalate() {
    this.rounds++
    this.fireEvery = Math.max(S.fireEveryMin, this.fireEvery * S.fireSpeedUp)
    this.blindTime = Math.max(S.blindTimeMin, this.blindTime * S.blindShrink)
  }

  /** Carapaça aberta pelo próprio raio: daqui em diante ela não se contém mais. */
  breakShell(ctx) {
    this.shell = false
    this.fireEvery = S.exposedFireEvery
    this.blindTime = S.exposedBlind
    if (ctx.shake) ctx.shake(S.shellBreakShakeMs, S.shellBreakShakeAmp)
  }

  /** Gira devagar para encarar. A folga é o que permite contorná-la a pé. */
  turnTo(p, dt) {
    const alvo = Math.atan2(p.y - this.y, p.x - this.x)
    let d = alvo - this.face
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    const passo = this.turnSpeed * dt
    this.face += Math.abs(d) <= passo ? d : Math.sign(d) * passo
  }

  /**
   * Deslize. Duas componentes: **radial**, que segura `keepDist` e afrouxa perto
   * do anel ideal — então **quem move ela é o jogador**, afastar-se a traz para o
   * meio da sala e chegar perto a empurra para a muralha — e **lateral**, um
   * vaivém que a mantém em movimento o tempo todo.
   *
   * A velocidade é suavizada em vez de aplicada direto: é isso que dá o deslize
   * em vez do liga-desliga. E ela para seco ao começar a carregar.
   */
  drift(p, dt, grid) {
    this.driftT += dt
    const dx = p.x - this.x
    const dy = p.y - this.y
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d
    const uy = dy / d

    const radial = Math.max(-S.driftSpeed, Math.min(S.driftSpeed, (d - S.keepDist) * S.radialGain))
    const lado = Math.sin((this.driftT * 2000 * Math.PI) / S.strafePeriod) * S.strafeSpeed
    const alvoX = ux * radial - uy * lado
    const alvoY = uy * radial + ux * lado

    const k = Math.min(1, S.driftAccel * dt)
    this.vx += (alvoX - this.vx) * k
    this.vy += (alvoY - this.vy) * k

    const m = moveBox(grid, this.x, this.y, this.vx * dt, this.vy * dt, S.bodyRadius, S.bodyRadius)
    // Bateu na muralha: mata a inércia naquele eixo, senão ela fica raspando.
    if (m.hitX) this.vx = 0
    if (m.hitY) this.vy = 0
    this.x = m.x
    this.y = m.y
  }

  /**
   * O caminho do feixe. Sai da face espelhada — do centro dela mataria quem
   * estivesse atrás — e ricocheteia na muralha **e no próprio espelho dela**. Se
   * voltar pelas costas, para ali: é a carapaça engolindo o tiro.
   *
   * Devolve `{ points, absorbed }`; `absorbed` é o que abre a fase 2.
   */
  traceBeam(grid) {
    const alcance = this.shell ? S.beamRange : S.exposedRange
    const quiques = this.shell ? S.beamBounces : S.exposedBounces
    const x = this.x + this.nx * (S.bodyRadius + S.beamStartGap)
    const y = this.y + this.ny * (S.bodyRadius + S.beamStartGap)
    return bounceRay(grid, x, y, this.nx, this.ny, alcance, quiques, 4, (px, py) => {
      const dx = px - this.x
      const dy = py - this.y
      if (dx * dx + dy * dy > S.bodyRadius * S.bodyRadius) return null
      // Pela frente ela reflete; pelas costas engole.
      if (dx * this.nx + dy * this.ny > 0) return { nx: this.nx, ny: this.ny }
      return 'stop'
    })
  }

  beamHits(x, y, r) {
    const meia = S.beamWidth / 2 + r
    for (let i = 1; i < this.beam.length; i++) {
      const a = this.beam[i - 1]
      const b = this.beam[i]
      if (segmentHit(x, y, meia, a.x, a.y, b.x, b.y)) return true
    }
    return false
  }
}
