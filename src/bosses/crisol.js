import { CRISOL as C, TUNING } from '../tuning.js'
import { circleHit } from '../collision.js'

/**
 * O Crisol.
 *
 * O caldeirão que fez os gêiseres, e o irmão do Monólito: mesma câmara, mesma
 * brasa. **Ele derrama o chão em cima de você**, e é esse mesmo fogo que arma a
 * sua flecha.
 *
 * O ciclo, em quatro tempos:
 *
 * 1. **Cheio** — a lava dentro dele sela a boca, e a flecha ricocheteia. A sala
 *    está seca.
 * 2. **Inclina e verte** — ele tomba numa direção e **cospe lava**. A lava
 *    despreende do lábio em gotas, cada uma voa em arco e explode no chão. A
 *    inclinação é o primeiro aviso; a **sombra** de cada gota é o segundo, e
 *    chega meio segundo antes do respingo.
 * 3. **Vazio** — o interior fica à mostra, e o núcleo está no fundo da tigela.
 *    É a janela.
 * 4. **Bebe** — **puxa a lava por baixo**: ela volta escorrendo pelo chão, e
 *    continua matando no caminho.
 *
 * A cada rodada ele **derrama mais e bebe menos**: a sala encolhe, e é esse o
 * relógio da luta.
 *
 * **Só flecha em brasa mata.** O único fogo da sala é o que ele acabou de
 * derramar, então o tiro certo é aquele cuja linha atravessa uma poça — o
 * Monólito ensinou que flecha cruzando fogo acende, e o irmão cobra.
 *
 * E a regra do Sino volta pelo outro lado: **o Vínculo move o corpo mais leve.**
 * Cheio, ele é uma tonelada e quem viaja é você. Vazio, ele é casca — e aí o
 * puxão o **tomba**, derrama o resto aos seus pés e deixa o núcleo aberto o
 * dobro do tempo.
 *
 * Encostar nele não machuca: é pedra. O que mata é o chão.
 */
export const CHEIO = 'cheio'
export const MIRA = 'mira'
export const VERTE = 'verte'
export const VAZIO = 'vazio'
export const TOMBADO = 'tombado'
export const BEBE = 'bebe'

const T = TUNING.tileSize
const VIZINHOS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * O fluido corre numa **sub-grade** mais fina que o terreno: célula de 12 px
 * contra tile de 24. Quatro vezes mais células pelo mesmo dinheiro, e é o que
 * dá contorno em vez de quadriculado.
 *
 * `vol` é **profundidade**, não volume: célula menor com a mesma profundidade
 * guarda menos lava, então tudo que entra ou sai do campo passa por `AREA`. É
 * isso que faz `cell: 24` devolver exatamente o comportamento antigo.
 */
const CELL = C.cell
const SUB = Math.round(T / CELL)
const AREA = SUB * SUB
/** Raio do respingo, em px — fixo, para não depender do tamanho da célula. */
const SPLASH = C.splashRadius + T * 0.5

export default class Crisol {
  constructor(room) {
    this.room = room
    this.reset()
  }

  reset() {
    this.x = this.room.bossSpawn.x
    this.y = this.room.bossSpawn.y
    this.state = CHEIO
    this.t = 0
    this.dead = false
    this.round = 0
    this.fill = 1 // 0 a 1: quanto de lava ainda tem dentro
    this.tilt = 0 // 0 de pé, 1 tombado derramando
    this.aim = Math.PI / 2 // direção do jorro
    this.doused = 0 // ms de chiado, quando a flecha fria acerta o núcleo

    // A lava no chão, por tile: cada uma guarda **volume**, não um estado. É
    // esse número que escorre para o vizinho mais baixo, esfria pelas bordas e
    // é sugado de volta. Chave "c,r" para o teste de quem está em cima sair numa
    // conta só — o mesmo truque da grade do terreno.
    this.pools = new Map()

    // A lava no ar. Cada gota é um arco balístico de verdade: `z` é altura de
    // tela, e ela **passa por cima** de quem está embaixo até descer. Quem mata
    // é a queda, não a passagem — é isso que torna a sombra uma promessa.
    this.gouts = []
    this.splashes = []
    this.goutT = 0

    this.fillTime = C.fillTime
    this.openTime = C.openTime
    this.sweep = C.pourSweep
    this.drinkRate = C.drinkRate
  }

  /** O tile é chão de verdade? Lava não escorre para dentro de muralha. */
  chao(c, r) {
    return this.room.grid[Math.floor(r / SUB)]?.[Math.floor(c / SUB)] === 0
  }

  /** Volume no tile, 0 se não houver nada. */
  volAt(c, r) {
    return this.pools.get(c + ',' + r)?.vol ?? 0
  }

  /** Lava viva: funda o bastante para matar e para acender a flecha. */
  viva(c, r) {
    return this.volAt(c, r) >= C.lethalVol
  }

  get radius() {
    return C.bodyRadius
  }

  /** Aberto: o interior à mostra, e o núcleo alcançável. */
  get open() {
    return this.state === VAZIO || this.state === TOMBADO
  }

  /** Vazio ele é casca, e a corda tomba ele. Cheio, é uma tonelada. */
  get light() {
    return this.state === VAZIO
  }

  /**
   * O núcleo, no fundo da tigela — e a tigela é alta. O alvo mora onde o brilho
   * é desenhado, que é dentro da boca, e não no chão sob o caldeirão: quem mira
   * no que vê tem que acertar.
   */
  corePos() {
    const t = this.tilt
    const d = C.bodyRadius * C.tiltShift * t
    const g = this.giro
    return {
      x: this.x + Math.cos(this.aim) * d + Math.sin(g) * C.coreLift,
      y: this.y + Math.sin(this.aim) * d * 0.6 - Math.cos(g) * C.coreLift,
    }
  }

  /**
   * O giro do corpo ao tombar, em torno do pé. Ele **move a boca**, então mora
   * aqui e não na view: mira e desenho leem o mesmo número.
   */
  get giro() {
    return this.tilt * C.tiltRot * Math.cos(this.aim)
  }

  /**
   * A boca, no chão: é de onde o jorro sai e onde o núcleo mora, 55 px acima.
   * Ela escorrega na direção do jorro e **balança com o giro** — o caldeirão é
   * rígido, e a boca de um corpo rígido que tomba descreve um arco.
   */
  mouth() {
    const t = this.tilt
    const d = C.bodyRadius * C.tiltShift * t
    const g = this.giro
    return {
      x: this.x + Math.cos(this.aim) * (d + C.bodyRadius * 0.4 * t) + Math.sin(g) * C.coreLift,
      y: this.y + Math.sin(this.aim) * d * 0.6 + C.coreLift * (1 - Math.cos(g)),
    }
  }

  /** Para onde o lábio aponta agora: ele **gira** enquanto verte. */
  pourAngle() {
    const p = Math.min(1, this.t / C.pourTime)
    return this.aim - this.sweep / 2 + this.sweep * p
  }

  /** Está vertendo agora? É o que diz se há lava desprendendo do lábio. */
  get vertendo() {
    return this.state === VERTE && this.fill > 0
  }

  /**
   * **Torricelli.** A velocidade no lábio cai com a coluna de lava que sobrou
   * dentro dele, então o alcance cai junto: ele começa jogando longe e termina
   * escorrendo pela própria borda. É essa curva que faz o jorro varrer uma
   * faixa do chão em vez de pintar um arco de raio fixo — e ela sai de graça,
   * porque `fill` já era o nível de dentro.
   */
  alcance() {
    return C.pourNear + (C.pourFar - C.pourNear) * Math.sqrt(Math.max(0, this.fill))
  }

  update(dt, ctx) {
    if (this.dead) return
    const ms = dt * 1000
    this.t += ms
    if (this.doused > 0) this.doused -= ms

    this.stepFluid(dt, ctx)
    // As gotas voam em todo estado: a última cuspida cai depois de a boca já
    // ter fechado, que é como lava jogada se comporta.
    this.stepGouts(dt, ctx)

    if (this.state === CHEIO) {
      if (this.t >= this.fillTime) {
        // Mira travada agora: o jorro vai para onde você **estava**.
        const dx = ctx.player.x - this.x
        const dy = ctx.player.y - this.y
        this.aim = Math.atan2(dy, dx) || 0
        this.state = MIRA
        this.t = 0
      }
    } else if (this.state === MIRA) {
      this.tilt = Math.min(1, this.t / C.aimTime)
      // Inclinado o bastante, a lava alcança o lábio e **pinga** antes de
      // jorrar. O pingo sai da borda em que o jorro vai começar, então ele
      // avisa duas coisas de uma vez: que vem lava, e de onde.
      if (this.tilt > C.dribbleAt) {
        this.goutT -= ms
        while (this.goutT <= 0) {
          this.goutT += C.dribbleEvery
          const boca = this.mouth()
          const ang = this.aim - this.sweep / 2 + (Math.random() - 0.5) * 0.4
          const d = C.dribbleDist * (0.6 + Math.random() * 0.8)
          // Empuxo quase nulo: o pingo **escorre** pela borda, não é arremessado.
          this.lanca(boca.x, boca.y, ang, d, C.dribbleVol, C.mouthZ, C.goutLift * 0.15)
        }
      }
      if (this.t >= C.aimTime) {
        this.state = VERTE
        this.t = 0
        if (ctx.shake) ctx.shake(C.pourShakeMs, C.pourShakeAmp)
        ctx.som?.('jorro')
      }
    } else if (this.state === VERTE) {
      this.stepPour(dt, ctx)
      // O que sai da boca sai de dentro dele: o nível cai enquanto derrama.
      this.fill = Math.max(0, 1 - this.t / C.pourTime)
      if (this.t >= C.pourTime) {
        this.state = VAZIO
        this.t = 0
        this.fill = 0
      }
    } else if (this.state === VAZIO) {
      this.tilt = Math.max(0, 1 - this.t / (C.openTime * 0.4))
      if (this.t >= this.openTime) this.startDrink(ctx)
    } else if (this.state === TOMBADO) {
      if (this.t >= C.toppleWindow) this.startDrink(ctx)
    } else if (this.state === BEBE) {
      this.stepDrink(dt)
      this.fill = Math.min(1, this.t / C.drinkTime)
      this.tilt = 0
      if (this.t >= C.drinkTime) {
        this.round++
        this.fillTime = Math.max(C.fillMin, this.fillTime * C.speedUp)
        this.openTime = Math.max(1600, this.openTime * C.speedUp)
        this.sweep = Math.min(C.sweepMax, this.sweep + C.sweepGrow)
        // A cada rodada ele recupera menos do que derramou.
        this.drinkRate = Math.max(C.drinkMin, this.drinkRate * (1 - C.drinkFall))
        this.state = CHEIO
        this.t = 0
      }
    }
  }

  /**
   * O jorro. Nada é pintado no chão daqui: ele só **cospe**, e é a gota que
   * molha onde cai. O volume que sai por segundo continua sendo `pourRate` — ele
   * só passou a sair em pedaços.
   */
  stepPour(dt, ctx) {
    if (!this.vertendo) return
    this.goutT -= dt * 1000
    while (this.goutT <= 0) {
      this.goutT += C.goutEvery
      this.cospe()
    }
  }

  /** Uma cuspida: duas gotas, abertas em leque e com alcance sorteado. */
  cospe() {
    const vol = (C.pourRate * C.goutEvery) / 1000 / C.goutPer
    const alvo = this.alcance()
    const boca = this.mouth()
    const base = this.pourAngle()
    for (let i = 0; i < C.goutPer; i++) {
      const ang = base + (Math.random() - 0.5) * C.goutSpread
      const d = Math.max(14, alvo * (1 + (Math.random() - 0.5) * C.goutJitter))
      // Empuxo sorteado: arcos de alturas diferentes se cruzam, e é o que
      // impede a chuva de virar uma fila.
      const lift = C.goutLift * (1 + (Math.random() - 0.5) * C.goutLiftJitter)
      this.lanca(boca.x, boca.y, ang, d, vol, C.mouthZ, lift)
    }
  }

  /**
   * Põe uma gota no ar mirando **onde ela vai cair**: o tempo de voo sai da
   * altura e do empuxo, e a velocidade horizontal é a distância dividida por
   * ele. Assim o alcance é um número de design em pixels, e a física continua
   * sendo um arco de verdade.
   */
  lanca(x, y, ang, dist, vol, z, lift = C.goutLift) {
    const tempo = (lift + Math.sqrt(lift * lift + 2 * C.gravity * z)) / C.gravity
    const v = dist / tempo
    this.gouts.push({
      x,
      y,
      z,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      vz: lift,
      dx: Math.cos(ang),
      dy: Math.sin(ang),
      vol,
      t: 0,
    })
  }

  /**
   * O voo. No ar a gota **passa por cima** de você; rasante, ela queima; e ao
   * bater ela vira volume no chão, com o momento do próprio voo — é por isso
   * que a poça avança na direção em que foi jogada em vez de crescer redonda.
   */
  stepGouts(dt, ctx) {
    if (this.gouts.length) {
      const vivas = []
      for (const g of this.gouts) {
        g.t += dt
        g.x += g.vx * dt
        g.y += g.vy * dt
        g.z += g.vz * dt
        g.vz -= C.gravity * dt
        if (g.z > 0) {
          if (
            g.z < C.goutLowZ &&
            circleHit(ctx.player.x, ctx.player.y, TUNING.playerRadius, g.x, g.y, C.goutRadius)
          ) {
            ctx.kill()
          }
          vivas.push(g)
          continue
        }
        this.derrama(g.x, g.y, g.vol, g.dx, g.dy)
        this.splashes.push({ x: g.x, y: g.y, t: 0 })
        // O chiado sai por pedido, como a poeira: o chefe não sabe o que é som.
        // Dez gotas por segundo caindo viram uma só — quem segura o intervalo é
        // o mixer, não este laço.
        if (ctx.som) ctx.som('respingo', Math.min(1, 0.5 + g.vol))
        if (circleHit(ctx.player.x, ctx.player.y, TUNING.playerRadius, g.x, g.y, C.splashKill)) ctx.kill()
        if (ctx.dust) ctx.dust(g.x, g.y, 2, { speed: 40 })
      }
      this.gouts = vivas
    }
    if (!this.splashes.length) return
    const ms = dt * 1000
    for (const sp of this.splashes) sp.t += ms
    this.splashes = this.splashes.filter((sp) => sp.t < C.splashShow)
  }

  /**
   * Despeja num ponto, espalhado pelo respingo. `volume` é volume de verdade, e
   * `AREA` o converte para a profundidade que cada célula recebe — o jorro
   * molha o mesmo tanto em qualquer sub-grade. `vx`/`vy` é a direção em que a
   * lava vinha: ela **continua nessa direção** depois de bater no chão.
   */
  derrama(x, y, volume, vx = 0, vy = 0) {
    const alvos = []
    const c0 = Math.floor((x - SPLASH) / CELL)
    const c1 = Math.floor((x + SPLASH) / CELL)
    const r0 = Math.floor((y - SPLASH) / CELL)
    const r1 = Math.floor((y + SPLASH) / CELL)
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        if (!this.chao(c, r)) continue
        const d = Math.hypot((c + 0.5) * CELL - x, (r + 0.5) * CELL - y)
        if (d <= SPLASH) alvos.push([c, r, 1 - d / (SPLASH + T * 0.5)])
      }
    }
    const soma = alvos.reduce((a, t) => a + t[2], 0) || 1
    for (const [c, r, peso] of alvos) this.poe(c, r, (volume * AREA * peso) / soma, vx, vy)
  }

  /**
   * Soma profundidade numa célula, criando a poça se ela não existir, e mistura
   * o momento de quem chegou com o de quem já estava, pesado pelo volume — que
   * é como líquido junta impulso.
   */
  poe(c, r, volume, vx = 0, vy = 0) {
    if (!this.chao(c, r) || volume <= 0) return
    const chave = c + ',' + r
    let p = this.pools.get(chave)
    if (!p) {
      p = { c, r, x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, vol: 0, vx: 0, vy: 0 }
      this.pools.set(chave, p)
    }
    const k = volume / (p.vol + volume)
    p.vx += (vx - p.vx) * k
    p.vy += (vy - p.vy) * k
    // Momento com teto: o viés de escoamento é multiplicativo, e sem teto um
    // acúmulo de impulsos viraria lava atirada em vez de lava escorrida.
    const m = Math.hypot(p.vx, p.vy)
    if (m > 1) {
      p.vx /= m
      p.vy /= m
    }
    p.vol = Math.min(C.volMax, p.vol + volume)
  }

  /**
   * O passo do líquido: **escorrer, seguir em frente, esfriar, matar**.
   *
   * Escorrer é procurar o nível — cada célula passa parte da diferença para a
   * vizinha mais baixa, e é só isso que faz a poça avançar, contornar e parar
   * sozinha. Mas nível sozinho espalha igual para todo lado, e aí a lava infla
   * em círculo em vez de escorrer: por isso cada célula também guarda
   * **momento**. O escoamento a favor do movimento ganha, o contra perde, e a
   * favor ela avança **mesmo em nível** — é essa parcela que faz a lava jogada
   * continuar para longe da boca antes de assentar.
   *
   * Esfriar tira profundidade de todo mundo por igual, então **a borda fina
   * seca primeiro** e a mancha encolhe de fora para dentro. O que ainda está
   * fundo mata; o filme que sobrou é crosta, escura e inofensiva.
   */
  stepFluid(dt, ctx) {
    const passa = new Map()
    const soma = (c, r, v, vx = 0, vy = 0) => {
      const chave = c + ',' + r
      const e = passa.get(chave)
      if (e) {
        e.v += v
        e.vx += vx * v
        e.vy += vy * v
      } else passa.set(chave, { c, r, v, vx: vx * v, vy: vy * v })
    }

    // A célula menor precisa de mais passos para cobrir a mesma distância, então
    // o nivelamento acompanha a sub-grade — senão a poça escorre em câmera lenta.
    // Bebendo, ele **para de procurar o nível**: nivelar espalharia a lava de
    // lado justamente enquanto ela corre, e ela chegava diluída em crosta em vez
    // de chegar como lava. Puxada, ela anda inteira — só o momento a move, e
    // multiplicado, senão voltaria a ~19 px/s e nada chegaria dentro do tempo.
    const bebendo = this.state === BEBE
    const nivela = bebendo ? 0 : Math.min(1, C.flowRate * SUB * dt)
    const puxa = bebendo ? C.drinkPull : 1
    for (const p of this.pools.values()) {
      for (const [dc, dr] of VIZINHOS) {
        const c = p.c + dc
        const r = p.r + dr
        if (!this.chao(c, r)) continue
        const desnivel = p.vol - this.volAt(c, r)
        const favor = p.vx * dc + p.vy * dr // -1 contra o movimento, +1 a favor
        let v = 0
        // Um quarto da diferença por vizinho é o que mantém o nivelamento
        // estável: acima disso ele oscila e a poça fica piscando.
        if (desnivel > C.flowMin) {
          v += Math.min(desnivel * 0.25, p.vol * 0.25) * nivela * (1 + C.flowPush * favor)
        }
        if (favor > 0) v += p.vol * C.momentumFlow * puxa * favor * dt
        if (v <= 0) continue
        v = Math.min(v, p.vol * 0.25)
        soma(p.c, p.r, -v)
        soma(c, r, v, p.vx, p.vy)
      }
    }
    for (const e of passa.values()) {
      if (e.v > 0) this.poe(e.c, e.r, e.v, e.vx / e.v, e.vy / e.v)
      else {
        const p = this.pools.get(e.c + ',' + e.r)
        if (p) p.vol = Math.max(0, p.vol + e.v)
      }
    }

    const esfria = C.coolRate * dt
    // O momento se apaga sozinho: é lava, não bala. Sem o atrito a poça nunca
    // assenta e continua deslizando depois de o jorro fechar.
    const atrito = Math.max(0, 1 - C.momentumDrag * dt)
    for (const [chave, p] of this.pools) {
      p.vol -= esfria
      p.vx *= atrito
      p.vy *= atrito
      if (p.vol <= 0) this.pools.delete(chave)
    }

    const embaixo = this.pools.get(Math.floor(ctx.player.x / CELL) + ',' + Math.floor(ctx.player.y / CELL))
    if (embaixo && embaixo.vol >= C.lethalVol) ctx.kill()
  }

  /**
   * Beber é **puxar por baixo**.
   *
   * Nada some de longe: ele aponta o momento de cada célula para si e a lava
   * **volta escorrendo pelo chão**, pelo mesmo passo de fluido que a espalhou.
   * Engolir mesmo só acontece de perto, dentro de `drinkRadius`.
   *
   * Duas consequências, e as duas são o ponto: a lava **continua matando
   * enquanto volta** — a janela do núcleo é justamente quando o chão inteiro
   * está andando na sua direção —, e o que não chega a tempo fica no chão. Ele
   * recupera o que conseguiu puxar, não o que quis.
   */
  stepDrink(dt) {
    let resta = this.drinkRate * AREA * dt
    for (const p of this.pools.values()) {
      const dx = this.x - p.x
      const dy = this.y - p.y
      const d = Math.hypot(dx, dy) || 1
      p.vx = dx / d
      p.vy = dy / d
      if (d > C.drinkRadius || resta <= 0) continue
      const tira = Math.min(p.vol, resta)
      p.vol -= tira
      resta -= tira
      if (p.vol <= 0) this.pools.delete(p.c + ',' + p.r)
    }
  }

  startDrink(ctx) {
    this.state = BEBE
    this.t = 0
    // O contrário do jorro, e soa como tal: o filtro fecha em vez de abrir.
    ctx?.som?.('sorve')
  }

  /**
   * Fogo no ponto? É o que acende a flecha — e é o que ele mesmo derramou.
   * Crosta não acende nada: lava fina já esfriou.
   */
  igniteAt(x, y) {
    if (this.viva(Math.floor(x / CELL), Math.floor(y / CELL))) return true
    // Atravessar a chuva acende: é lava caindo, e é o tiro que a luta pede
    // quando o chão ainda está seco.
    for (const g of this.gouts) {
      if (circleHit(x, y, TUNING.arrowRadius, g.x, g.y, C.goutRadius)) return true
    }
    return false
  }

  /**
   * **Aberto, a boca engole a flecha**: o corpo deixa de parar tiro e só o
   * núcleo, no fundo da tigela, a segura. É a mesma regra do Sino tombado — sem
   * ela o núcleo era inalcançável, porque a borda cravava todo tiro antes.
   *
   * Fechado, é pedra maciça: a flecha crava e serve de âncora, não de dano.
   */
  hitTest(x, y) {
    if (this.dead) return null
    const c = this.corePos()
    if (this.open) {
      return circleHit(x, y, TUNING.arrowRadius, c.x, c.y, C.coreRadius) ? 'core' : null
    }
    // Fechado ele é pedra maciça — e a boca selada também é. Sem o segundo
    // círculo a flecha mirada na boca passava por cima do corpo e seguia reto,
    // porque o corpo é um círculo no chão e a boca fica 55 px acima dele.
    if (circleHit(x, y, TUNING.arrowRadius, this.x, this.y - C.bodyLift, C.bodyRadius)) return 'body'
    return circleHit(x, y, TUNING.arrowRadius, c.x, c.y, C.coreRadius + 6) ? 'body' : null
  }

  /** **Só flecha em brasa mata.** Fria, ela chia e apaga contra a pedra. */
  onArrowHit(kind, arrow) {
    if (this.dead || kind !== 'core') return
    if (arrow && arrow.burning) this.dead = true
    else this.doused = C.dousedShow
  }

  /**
   * O outro lado do Vínculo. Cheio ele é uma tonelada e quem viaja é você;
   * vazio ele é casca, e o puxão o derruba — o resto da lava cai aos seus pés,
   * que é justamente o fogo que faltava para acender a flecha.
   */
  tetherPull(player) {
    if (this.dead) return null
    if (!this.light) return 'slam'

    const ang = Math.atan2(player.y - this.y, player.x - this.x)
    this.aim = ang
    this.tilt = 1
    this.state = TOMBADO
    this.t = 0
    // Entorna o que sobrou **aos próprios pés**: caldeirão deitado não
    // arremessa, ele vaza. O leque vira para o lado de quem puxou, e o anel de
    // fogo fica em volta dele — justamente por onde a flecha tem que passar
    // para chegar ao núcleo.
    const vol = (C.pourRate * 0.6) / C.toppleGouts
    for (let i = 0; i < C.toppleGouts; i++) {
      const a = ang + (i / (C.toppleGouts - 1) - 0.5) * C.toppleArc
      const d = C.toppleNear + Math.random() * (C.toppleFar - C.toppleNear)
      this.lanca(
        this.x + Math.cos(a) * C.bodyRadius * 0.7,
        this.y + Math.sin(a) * C.bodyRadius * 0.7,
        a,
        d,
        vol,
        C.mouthZ * 0.6,
        C.goutLift * 0.6,
      )
    }
    this.fill = 0
    return 'yield'
  }
}
