import { SINO as S, SINO_ART as ART, TUNING } from '../tuning.js'
import { circleHit, halfDiscHit, rectHit } from '../collision.js'
import Coro from './coro.js'

/**
 * O Sino. Um pêndulo de bronze pendurado no centro da câmara, **orbitando** o
 * chão em elipses que vão girando. Encostar mata.
 *
 * A luta inteira sai de uma regra: **o Vínculo move o corpo mais leve dos dois.**
 * No meio do arco o sino é uma tonelada em movimento e quem voa é o jogador —
 * direto contra o bronze. **Começando a descer** ele ainda não tem inércia, e é
 * aí que o puxão o arranca da corrente e o traz até você.
 *
 * Só dá para acertá-lo **no meio do arco**, onde ele está rente ao chão e mais
 * rápido. Nas pontas ele sobe: não encosta em ninguém e a flecha passa por
 * baixo — mas quem estiver na pegada dele leva um feixe da boca, e morre.
 *
 * Três puxões e o gancho arrebenta: ele tomba de lado, a boca vira para quem o
 * derrubou e o badalo — o núcleo — fica à mostra. Cada rodada ele volta
 * balançando mais rápido e parando menos tempo no alto.
 *
 * A órbita **precessa o tempo todo**, então ele não repete faixa: com uma linha
 * fixa dava para ficar parado fora dela a luta inteira. E ele não passa pelo
 * centro exato — passa ao lado, por um lado diferente a cada vinda, porque a
 * ida e a volta são os dois arcos de uma elipse e não a mesma reta duas vezes.
 */
export const SWING = 'swing' // na corrente, orbitando: leve só no início da queda
export const STRAIN = 'strain' // a corrente esticou e ele ainda resiste
export const YANK = 'yank' // arrancado, vindo até o jogador
export const DOWN = 'down' // caído no chão
export const RISE = 'rise' // voltando para o ponto de suspensão
export const TOPPLED = 'toppled' // deitado, badalo exposto
export const CORO = 'coro' // o badalo fugiu: quem luta agora é o coro

export default class Sino {
  constructor(room) {
    this.room = room
    this.reset()
  }

  reset() {
    this.pivot = { x: this.room.bossSpawn.x, y: this.room.bossSpawn.y }
    this.round = 0
    this.plane = 0 // ângulo da linha que ele varre; gira a cada travessia
    this.period = S.swingPeriod
    // Começa **no meio do arco**, como em `restartSwing`: pendurado na ponta ele
    // já estaria no começo da queda, e a luta abriria com a janela escancarada.
    this.swing = 0 // fase do pêndulo, de -PI/2 a +PI/2
    this.dir = 1
    this.state = SWING
    this.t = 0
    this.hits = 0
    this.dead = false
    // Para onde a boca aponta depois de tombar: a direção de quem o derrubou.
    this.mouth = { x: 0, y: 1 }
    this.arrowOff = null
    // O coro só existe depois que o badalo foge; até lá a luta é do sino grande.
    this.coro = null
    this.husk = null
    this.laser = null
    this.targetX = this.pivot.x
    this.targetY = this.pivot.y
    // Trajeto do puxão, em coordenadas polares em volta do pivô: ele vem **pelo
    // arco da corrente**, não em linha reta pelo chão.
    this.arc = null
    this.yankLift = 0
    this.bounce = 0
    this.lean = { x: 0, y: 0 }
    this.place()
  }

  /**
   * Até onde ele vai neste plano: raio de uma elipse encaixada na sala. Com
   * amplitude fixa, um plano quase vertical enfiava o sino na muralha.
   */
  get amp() {
    const ax = Math.cos(this.plane) / S.ampX
    const ay = Math.sin(this.plane) / S.ampY
    return 1 / Math.hypot(ax, ay)
  }

  /**
   * Posição a partir da fase.
   *
   * Ao longo do plano é o seno da fase: corre no meio do arco e afrouxa nas
   * pontas. **Atravessado a ele é a barriga da órbita**, e é ela que faz a
   * curva: máxima no meio da travessia, nula nas pontas, e trocando de lado
   * junto com `dir` — a ida por um lado, a volta pelo outro. As duas metades
   * fecham uma elipse em torno do pivô, que é o que um pêndulo de verdade faz
   * quando recebe qualquer empurrão de lado.
   */
  place() {
    const off = Math.sin(this.swing) * this.amp
    const lado = Math.cos(this.swing) * this.amp * S.orbitB * this.dir
    this.x = this.pivot.x + Math.cos(this.plane) * off - Math.sin(this.plane) * lado
    this.y = this.pivot.y + Math.sin(this.plane) * off + Math.cos(this.plane) * lado
  }

  /**
   * Altura acima do chão. Só leitura: a colisão continua no ponto do chão.
   *
   * No arco ela sai da própria fase do pêndulo — altura proporcional ao
   * quadrado do afastamento, que é como um pêndulo sobe. Puxado, ele **cai**:
   * a altura desce pela mesma curva acelerada do trajeto. E caído ele ainda
   * quica antes de assentar.
   */
  get lift() {
    if (this.state === SWING) {
      const s = Math.sin(this.swing)
      return S.liftMax * s * s
    }
    if (this.state === STRAIN || this.state === YANK) return this.yankLift
    if (this.state === DOWN) return this.bounce
    return 0
  }

  /**
   * Leve **no começo da queda**. É a regra que a luta inteira ensina.
   *
   * Ele não para no alto: o que abre a janela é ter virado e ainda estar lento,
   * que é a mesma coisa que um pêndulo de verdade faz. `swing * dir < 0` é
   * "voltando para o meio" — descendo.
   */
  get light() {
    return this.state === SWING && Math.abs(Math.sin(this.swing)) >= S.lightFrom && this.swing * this.dir < 0
  }

  /**
   * Rente ao chão, no meio do arco. É a única janela em que ele encosta em quem
   * está na pegada e em que a flecha o encontra — e é também onde ele corre
   * mais. Levantado, o feixe é que resolve quem estiver embaixo.
   */
  get grounded() {
    return this.lift <= S.liftMax * S.downLift
  }

  /** Deitado ele é inofensivo: é a janela para chegar perto e atirar. */
  get lethal() {
    return !this.dead && !this.coro && this.state !== TOPPLED && this.grounded
  }

  get radius() {
    return S.bellRadius
  }

  /** Setor de 45° para onde a boca aponta: 0 no leste, girando pela tela. */
  get mouthSector() {
    const i = Math.round((Math.atan2(this.mouth.y, this.mouth.x) * 4) / Math.PI)
    return ((i % 8) + 8) % 8
  }

  /**
   * O badalo. A posição vem de uma tabela por setor, não de um deslocamento
   * radial: a arte tem perspectiva e o badalo aparece num lugar diferente em
   * cada guinada.
   */
  corePos() {
    const o = ART.fallenCore[this.mouthSector]
    return { x: this.x + o[0], y: this.y + o[1] }
  }

  /** Centro da pegada. Sobe em relação ao ponto do chão: ver `footRise`. */
  get footY() {
    return this.y - S.footRise
  }

  /**
   * Pegada no chão. Meio-disco com a barriga para baixo: ele pende, e o chão que
   * ocupa fica à frente da boca, na direção da câmera — não no ar acima dela.
   */
  touches(x, y, r) {
    if (halfDiscHit(x, y, r, this.x, this.footY, S.bellRadius, true)) return true
    // Caixa por cima da aresta reta: pega o corpo, que o meio-disco deixava de fora.
    return rectHit(x, y, r, this.x, this.footY - S.bodyBoxH / 2, S.bodyBoxW / 2, S.bodyBoxH / 2)
  }

  /**
   * Deitado ele vira cenário baixo: **a flecha passa por cima do bronze** e só o
   * badalo a para. Sem isso o núcleo era inalcançável — ele fica dentro da boca,
   * atrás da borda, e todo tiro cravava no corpo antes de chegar lá.
   */
  hitTest(x, y) {
    if (this.dead) return null
    if (this.coro) return this.coro.hitTest(x, y)
    if (this.state === TOPPLED) {
      const c = this.corePos()
      return circleHit(x, y, TUNING.arrowRadius, c.x, c.y, S.coreRadius) ? 'core' : null
    }
    // No alto ele está fora do alcance da flecha: ela passa por baixo.
    if (!this.grounded) return null
    return this.touches(x, y, TUNING.arrowRadius) ? 'body' : null
  }

  onArrowHit(kind, arrow) {
    if (this.dead) return
    if (this.coro) {
      this.coro.onArrowHit(kind)
      this.dead = this.coro.dead
      return
    }
    if (kind === 'core') {
      // **O badalo não morre: ele desvia.** Foge para um dos sinos apagados da
      // câmara, e eles acordam. O corpo fica onde caiu, agora oco.
      this.husk = { x: this.x, y: this.y, sector: this.mouthSector }
      this.coro = new Coro(this.room, this.corePos())
      this.state = CORO
      return
    }
    // No bronze a flecha não fere: vira âncora. Guarda onde ela cravou para
    // acompanhar o balanço — é dela que a corda vai puxar.
    // Relativo à posição **desenhada**, com a altura descontada: guardando contra
    // o ponto do chão, a flecha escorregava sozinha toda vez que ele subia.
    this.arrowOff = { dx: arrow.x - this.x, dy: arrow.y - (this.y - this.lift) }
  }

  /**
   * Flecha cravada no bronze vai junto no balanço, altura inclusive. Sem isso a
   * corda ligaria a um ponto que o sino já deixou para trás, e a flecha parecia
   * deslizar no corpo dele a cada subida.
   */
  carryArrow(arrow) {
    if (!this.arrowOff || this.coro) return
    arrow.x = this.x + this.arrowOff.dx
    arrow.y = this.y - this.lift + this.arrowOff.dy
  }

  /**
   * O outro lado do Vínculo. Devolve `'yield'` quando é ele quem vem, e
   * `'slam'` quando é o jogador — e aí sem parar antes, porque um corpo pesado
   * não devolve nada da força: você chega nele, não perto dele.
   */
  tetherPull(player) {
    if (this.dead || this.coro) return null
    if (!this.light) return 'slam'

    const dx = player.x - this.x
    const dy = player.y - this.y
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d
    const uy = dy / d
    this.mouth = { x: ux, y: uy }
    // A reação: arrancar uma tonelada arrasta o jogador para a frente junto.
    const trancao = (S.shoveSpeed * S.shoveTime) / 1000
    player.shove(-ux, -uy, S.shoveSpeed, S.shoveTime)
    // Alvo travado agora, não perseguido: perseguir seria morte garantida. E o
    // avanço do trancão entra no cálculo, senão o sino pousaria em cima dele.
    this.targetX = player.x - ux * (S.yankGap + trancao)
    this.targetY = player.y - uy * (S.yankGap + trancao)
    this.lean = { x: ux, y: uy }
    this.arcTo(this.targetX, this.targetY, S.yankSpeed, 0)
    // Resiste antes de ceder: é o único jeito de uma tonelada parecer uma
    // tonelada quando ela sai do lugar.
    this.state = STRAIN
    this.t = 0
    return 'yield'
  }

  /** ctx: { player, grid, kill, shake } */
  update(dt, ctx) {
    if (this.dead) return
    // O badalo escapou: o corpo virou cenário e quem luta é o coro. A cena não
    // sabe da troca — ela continua falando com um chefe só.
    if (this.coro) {
      this.coro.update(dt, ctx)
      // O chefe passa a **ser** o sino do coração: é de lá que a alma sai e é
      // ele que a cena segue. O corpo velho fica guardado em `husk`.
      this.x = this.coro.x
      this.y = this.coro.y
      this.dead = this.coro.dead
      return
    }
    const ms = dt * 1000
    this.t += ms

    if (this.state === SWING) {
      // Meia volta (ponta a ponta) leva metade do período. O fator `swoop`
      // acelera o meio e afrouxa as pontas; a divisão devolve o período médio.
      const swoop = (1 + S.swoop * Math.cos(this.swing) ** 2) / (1 + S.swoop / 2)
      this.swing += this.dir * Math.PI * (ms / (this.period / 2)) * swoop
      // A elipse **precessa**, e devagar o tempo todo. Antes o plano saltava no
      // cruzamento do centro, e o desenho disso é um asterisco: retas pelo
      // mesmo ponto, com virada seca no meio de cada uma.
      this.plane += S.planeSpin * dt
      // Chegou na ponta: vira e volta na mesma hora. Sem pausa — o peso dele
      // inverte sozinho, e a lentidão daqui já é a janela.
      if (Math.abs(this.swing) >= Math.PI / 2) {
        this.swing = (Math.PI / 2) * Math.sign(this.swing)
        this.dir = -this.dir
        // No alto do arco a corrente segura o peso todo: é ali que ela range.
        ctx.som?.('balanco')
      }
      this.place()
    } else if (this.state === STRAIN) {
      // Uma tonelada não sai do lugar na hora: a corrente estica primeiro.
      if (this.t >= S.strainTime) {
        this.state = YANK
        this.t = 0
      }
    } else if (this.state === YANK) {
      if (this.stepArc(this.t, true)) this.land(ctx)
    } else if (this.state === DOWN) {
      // Quique amortecido: ele bate, pula uma vez e assenta.
      const q = Math.min(1, this.t / S.yankBounceTime)
      this.bounce = S.yankBounce * (1 - q) * Math.abs(Math.sin(q * Math.PI * 2))
      if (this.t >= S.downTime) {
        this.state = RISE
        this.t = 0
        this.bounce = 0
        this.arcTo(this.pivot.x, this.pivot.y, S.riseSpeed, 0)
      }
    } else if (this.state === TOPPLED) {
      if (this.t >= S.toppleWindow) {
        this.state = RISE
        this.t = 0
        // Sem trajeto montado aqui ele voltava **teleportado** para o pivô: o
        // arco antigo já tinha acabado e o passo dava por encerrado no primeiro
        // quadro.
        this.arcTo(this.pivot.x, this.pivot.y, S.riseSpeed, 0)
        // Continua frágil: perder a janela não obriga a refazer os três puxões.
        this.hits = S.toppleHits - 1
      }
    } else if (this.state === RISE) {
      // A corrente o traz de volta pelo mesmo arco, sem tranco nas pontas.
      if (this.stepArc(this.t, false)) this.restartSwing()
    }

    this.stepContact(ms, ctx)
  }

  /**
   * Embaixo, o bronze mata por contato. No alto ele passa por cima de todo mundo
   * — mas entrar na pegada **arma** o feixe, que leva `laserCharge` se formando
   * antes de causar dano. Essa meia-volta de segundo é a chance de sair de
   * baixo; sem ela a morte vinha sem nada na tela para explicá-la.
   *
   * O feixe continua registrado alguns quadros depois de disparar, porque a
   * simulação congela no hitstop e o desenho continua — é como a morte se lê.
   */
  stepContact(ms, ctx) {
    if (this.dead || this.state === TOPPLED) {
      this.laser = null
      return
    }
    // O feixe é do sino **na corrente**: arrastado ou caído ele não arma nada,
    // e quem resolve ali é o contato.
    if (this.state !== SWING) {
      this.laser = null
      if (this.grounded && this.touches(ctx.player.x, ctx.player.y, TUNING.playerRadius)) ctx.kill()
      return
    }
    const p = ctx.player
    const dentro = this.touches(p.x, p.y, TUNING.playerRadius)

    // Rente ao chão o bronze resolve por contato, e o feixe não tem o que fazer.
    if (this.grounded) {
      this.laser = null
      if (dentro) ctx.kill()
      return
    }

    // O feixe é do sino: cai reto debaixo da boca e acompanha o corpo. Uma vez
    // armado ele sai de qualquer jeito — quem escapa é quem sai de baixo.
    if (!this.laser && dentro) this.laser = { t: 0, fired: false }
    if (!this.laser) return
    this.laser.t += ms
    if (!this.laser.fired && this.laser.t >= S.laserCharge) {
      this.laser.fired = true
      if (circleHit(p.x, p.y, TUNING.playerRadius, this.x, this.footY, S.laserHit)) ctx.kill()
    }
    if (this.laser.fired && this.laser.t >= S.laserCharge + S.laserShow) this.laser = null
  }

  /**
   * De volta à corrente e mais rápido — e a janela encurta junto, de graça: ela
   * é uma fatia da fase, e a fase inteira passa a correr mais.
   */
  restartSwing() {
    this.round++
    this.period = Math.max(S.periodMin, this.period * S.periodSpeedUp)
    // Volta pendurado no centro, que é a fase 0, e recomeça a ganhar embalo.
    this.swing = 0
    this.dir = 1
    this.state = SWING
    this.t = 0
    this.place()
  }

  /** Move em linha reta até o alvo; devolve true ao chegar. */
  /**
   * Prepara o trajeto polar em volta do pivô: ângulo e raio interpolados, então
   * ele **varre o arco da corrente** em vez de cortar caminho pelo chão.
   *
   * `pico` é a velocidade de chegada. Com aceleração constante a média é metade
   * dela, e é daí que sai a duração.
   */
  arcTo(tx, ty, pico, liftFinal = 0) {
    const ang0 = Math.atan2(this.y - this.pivot.y, this.x - this.pivot.x)
    const ang1 = Math.atan2(ty - this.pivot.y, tx - this.pivot.x)
    let volta = (ang1 - ang0) % (Math.PI * 2)
    if (volta > Math.PI) volta -= Math.PI * 2
    if (volta < -Math.PI) volta += Math.PI * 2
    const r0 = Math.hypot(this.x - this.pivot.x, this.y - this.pivot.y)
    const r1 = Math.hypot(tx - this.pivot.x, ty - this.pivot.y)
    const dist = Math.max(1, Math.hypot(tx - this.x, ty - this.y))
    this.arc = {
      ang0,
      volta,
      r0,
      r1,
      lift0: this.lift,
      lift1: liftFinal,
      tempo: Math.max(S.yankTimeMin, (2 * dist * 1000) / pico),
    }
    this.yankLift = this.lift
  }

  /**
   * Um passo do trajeto polar. `acelerando` usa aceleração constante — começa
   * parado e chega na velocidade cheia, que é como peso puxado se move; a volta
   * usa suavização nas duas pontas, porque aí quem manda é a corrente.
   */
  stepArc(t, acelerando) {
    const a = this.arc
    if (!a) return true
    const p = Math.min(1, t / a.tempo)
    const e = acelerando ? p * p : p * p * (3 - 2 * p)
    const ang = a.ang0 + a.volta * e
    const r = a.r0 + (a.r1 - a.r0) * e
    this.x = this.pivot.x + Math.cos(ang) * r
    this.y = this.pivot.y + Math.sin(ang) * r
    this.yankLift = a.lift0 + (a.lift1 - a.lift0) * e
    return p >= 1
  }

  /** A batida: tranco na tela, poeira do tamanho do que caiu, e o quique. */
  land(ctx) {
    this.hits++
    this.t = 0
    this.arc = null
    this.yankLift = 0
    this.bounce = S.yankBounce
    // Sai **da saia para fora**, em três pontos da borda: no meio do corpo ela
    // nasceria escondida atrás do próprio bronze, que é desenhado por cima.
    if (ctx.dust) {
      const r = S.bellRadius * 0.85
      for (const [dx, dy] of [
        [-1, 0.2],
        [1, 0.2],
        [0, 0.7],
      ]) {
        ctx.dust(this.x + dx * r, this.y + dy * r, Math.ceil(S.yankDust / 3), {
          dirX: dx,
          dirY: dy,
          spread: 1.7,
          speed: S.yankDustSpeed,
          size: 4,
        })
      }
    }
    if (this.hits >= S.toppleHits) {
      this.state = TOPPLED
      if (ctx.shake) ctx.shake(S.toppleShakeMs, S.toppleShakeAmp)
      ctx.som?.('tomba')
    } else {
      this.state = DOWN
      if (ctx.shake) ctx.shake(S.yankShakeMs, S.yankShakeAmp)
      // Uma tonelada de bronze no chão de pedra, e o próprio sino ressoando.
      ctx.som?.('baque')
      ctx.som?.('sinoBadala', 0.7)
    }
  }

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
