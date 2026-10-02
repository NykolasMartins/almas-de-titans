import crisolUrl from '../../assets/crisol.png'
import { CRISOL as C, CRISOL_ART as ART, TUNING, FX, COLOR, OUTRO } from '../tuning.js'
import { mixColor, sleepColor, frameBoxes } from '../draw.js'
import { paintLavaSurface } from '../terrain.js'
import { CHEIO, MIRA, VERTE, VAZIO, TOMBADO, BEBE } from './crisol.js'

/**
 * Desenho do Crisol.
 *
 * O corpo é a folha `crisol.png`: 8 guinadas de 45° de um objeto rígido. Não há
 * pose tombada, e não precisa — tombar é **girar o sprite em torno do pé**, que
 * é o que um caldeirão rígido faz de verdade.
 *
 * O líquido dentro dele vem em **ciano** na arte, e é isso que torna o resto
 * possível: ciano não existe em nenhum outro lugar da paleta, então uma passada
 * no carregamento separa a folha em duas texturas — a pedra sem líquido e o
 * líquido sozinho, repintado na rampa quente da sala. A partir daí a lava dentro
 * dele **baixa de nível e esfria de cor** com o mesmo `fill` que a física já
 * usava, sem um quadro de arte a mais.
 *
 * Quatro coisas precisam se ler sem HUD: **quanto falta encher** (o nível de
 * lava na boca), **para onde ele vai verter** (a inclinação, antes do jorro),
 * **onde a lava vai cair** (a sombra de cada gota, que chega meio segundo antes
 * dela) e **quando o núcleo está aberto** (a boca escurece e o ponto vermelho
 * aparece no fundo).
 */
const T = TUNING.tileSize
const CELL = C.cell
const SUB = Math.round(T / CELL)

/** Os quatro cantos de uma célula, na ordem do passeio do marching squares. */
const CANTOS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]
/** Buffers reaproveitados: 60 quadros por segundo não é hora de alocar. */
const PTS = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }))
const V = [0, 0, 0, 0]
const CORTE = [0, 0, 0, 0]
const SEGS = []

export default {
  preload(scene) {
    scene.load.spritesheet('crisol', crisolUrl, { frameWidth: ART.cell, frameHeight: ART.cell })
  },

  create(scene) {
    // Caixa por quadro: sprite gerado por IA varia de um para o outro, e com uma
    // âncora só o caldeirão subiria e desceria enquanto gira.
    scene.crisolBoxes = frameBoxes(scene, 'crisol', ART.cell, ART.cols, ART.frames)
    scene.crisolMouth = separaLava(scene)
    scene.crisolSpr = scene.add.image(0, 0, 'crisolPedra', 0)
    scene.crisolMouthGfx = scene.add.graphics()
    scene.crisolLavaSpr = scene.add.image(0, 0, 'crisolLava', 0)
  },

  draw(scene, b, time) {
    drawPools(scene, b, time)
    drawStream(scene, b, time)
    drawBody(scene, b, time)
  },

  hitboxes(g, b) {
    if (b.dead) return
    // O corpo é dois círculos: barriga e boca. Juntos cobrem a silhueta, que é o
    // que a flecha vê — o caldeirão é alto e a âncora dele está no pé.
    g.lineStyle(1, 0xff4488, 0.9)
    g.strokeCircle(Math.round(b.x), Math.round(b.y - C.bodyLift), C.bodyRadius)
    if (!b.open) {
      const c = b.corePos()
      g.strokeCircle(Math.round(c.x), Math.round(c.y), C.coreRadius + 6)
    }
    if (b.open) {
      const c = b.corePos()
      g.lineStyle(1, 0xffcc00, 0.9)
      g.strokeCircle(Math.round(c.x), Math.round(c.y), C.coreRadius)
    }
    // Verde é gota alta, que passa por cima; vermelha é rasante, que queima. O
    // pontinho azul é onde ela está desenhada, acima da própria pegada.
    for (const d of b.gouts) {
      g.lineStyle(1, d.z < C.goutLowZ ? 0xff4488 : 0x88ff88, 0.8)
      g.strokeCircle(Math.round(d.x), Math.round(d.y), C.goutRadius)
      g.lineStyle(1, 0x8888ff, 0.5)
      g.strokeCircle(Math.round(d.x), Math.round(d.y - d.z), 2)
    }
    for (const sp of b.splashes) {
      g.lineStyle(1, 0xff4488, 0.5)
      g.strokeCircle(Math.round(sp.x), Math.round(sp.y), C.splashKill)
    }
    // Só o que está fundo o bastante mata: a crosta fina aparece em azul. A
    // seta é o momento da célula, que é o que decide para onde ela escorre.
    for (const p of b.pools.values()) {
      g.lineStyle(1, p.vol >= C.lethalVol ? 0xff8844 : 0x4488ff, 0.5)
      g.strokeRect(p.c * CELL + 1, p.r * CELL + 1, CELL - 2, CELL - 2)
      if (Math.hypot(p.vx, p.vy) > 0.05) {
        g.lineStyle(1, 0x88ff88, 0.7)
        g.lineBetween(p.x, p.y, p.x + p.vx * CELL, p.y + p.vy * CELL)
      }
    }
  },

  status(b) {
    let vivas = 0
    let volume = 0
    let momento = 0
    for (const p of b.pools.values()) {
      volume += p.vol
      if (p.vol >= C.lethalVol) vivas++
      momento = Math.max(momento, Math.hypot(p.vx, p.vy))
    }
    return `crisol:${b.state}  cheio:${Math.round(b.fill * 100)}%  gotas:${b.gouts.length}  lava:${vivas}/${b.pools.size}  vol:${volume.toFixed(1)}  mom:${momento.toFixed(2)}  rodada:${b.round}`
  },
}

/**
 * O campo nos **cantos** das células, que é o que o marching squares consome:
 * cada canto vale a média das células de chão em volta dele. É essa média que
 * transforma degrau de 12 px em rampa, e rampa em contorno liso.
 */
function campoDe(b) {
  const canto = new Map()
  let c0 = Infinity
  let r0 = Infinity
  let c1 = -Infinity
  let r1 = -Infinity
  for (const p of b.pools.values()) {
    for (const [di, dj] of CANTOS) {
      const k = p.c + di + ',' + (p.r + dj)
      canto.set(k, (canto.get(k) ?? 0) + p.vol)
    }
    if (p.c < c0) c0 = p.c
    if (p.c > c1) c1 = p.c
    if (p.r < r0) r0 = p.r
    if (p.r > r1) r1 = p.r
  }
  // A média conta só as células de **chão**: contra a muralha o canto continua
  // cheio, e a poça encosta nela em vez de se afastar meia célula.
  for (const [k, soma] of canto) {
    const v = k.split(',')
    const i = Number(v[0])
    const j = Number(v[1])
    let n = 0
    for (const [di, dj] of CANTOS) if (b.chao(i - di, j - dj)) n++
    canto.set(k, n ? soma / n : 0)
  }
  return { c0, r0, c1, r1, canto }
}

/**
 * Marching squares no campo de volume.
 *
 * Para cada célula: `cheia` quando os quatro cantos passam do limiar — aí é
 * retângulo, que é mais barato —, e `borda` quando a linha de nível atravessa,
 * com o polígono do lado molhado em `PTS` e o pedaço da linha em `CORTE`. É a
 * interpolação nas arestas que tira o serrilhado, e ela sai de graça: o mesmo
 * número que já decidia quem mata decide onde a borda passa.
 */
function nivel(campo, thr, cheia, borda) {
  const canto = campo.canto
  for (let r = campo.r0 - 1; r <= campo.r1 + 1; r++) {
    for (let c = campo.c0 - 1; c <= campo.c1 + 1; c++) {
      let dentro = 0
      let media = 0
      for (let i = 0; i < 4; i++) {
        const v = canto.get(c + CANTOS[i][0] + ',' + (r + CANTOS[i][1])) ?? 0
        V[i] = v
        media += v
        if (v >= thr) dentro++
      }
      if (!dentro) continue
      media /= 4
      if (dentro === 4) {
        cheia(c, r, media)
        continue
      }
      let n = 0
      let cortes = 0
      for (let i = 0; i < 4; i++) {
        const [di, dj] = CANTOS[i]
        const [ni, nj] = CANTOS[(i + 1) % 4]
        const a = V[i]
        const z = V[(i + 1) % 4]
        if (a >= thr) {
          PTS[n].x = (c + di) * CELL
          PTS[n].y = (r + dj) * CELL
          n++
        }
        if ((a >= thr) !== (z >= thr)) {
          const t = (thr - a) / (z - a)
          PTS[n].x = (c + di + (ni - di) * t) * CELL
          PTS[n].y = (r + dj + (nj - dj) * t) * CELL
          if (cortes < 2) {
            CORTE[cortes * 2] = PTS[n].x
            CORTE[cortes * 2 + 1] = PTS[n].y
          }
          cortes++
          n++
        }
      }
      borda(n, cortes === 2 ? CORTE : null, c, r, media)
    }
  }
}

/**
 * As poças.
 *
 * O que se desenha é **volume**, não estado: fundo é lava viva, pintada pelo
 * mesmo código do mar lá fora (`paintLavaSurface`) — a primeira versão tinha
 * desenho próprio e não parecia líquido. Raso é **crosta**: escura, apagada e
 * inofensiva, o que já esfriou. A fronteira entre as duas é a mesma linha que
 * separa o que mata do que não mata, então olhar já é entender.
 *
 * E o contorno sai do campo, não da grade: retângulo por célula lia como
 * tabuleiro, por mais bojo que se pusesse na borda. O marching squares passa
 * **abaixo** do limiar letal de propósito — desenho nunca mais estreito que a
 * hitbox (regra 12) —, e cada célula que mata ainda ganha o miolo pintado, para
 * que ninguém morra em cima do que parece crosta.
 */
function drawPools(scene, b, time) {
  if (b.pools.size === 0) return
  const g = scene.decalGfx
  const th = scene.theme
  const campo = campoDe(b)
  const vivo = C.lethalVol * C.lavaEdge

  // 1) Crosta. A cor sai da profundidade do próprio ponto, então a mancha
  // escurece de dentro para fora sem ninguém animar nada.
  const crosta = (m) => {
    const k = Math.min(1, m / C.lethalVol)
    // Teto na mistura: crosta perto do limiar ficava 90% na cor da lava viva e
    // lia como lava — e lava que não mata é a pior mentira que esta sala pode
    // contar. Ela chega a cinza-brasa e para aí.
    g.fillStyle(mixColor(th.floorCrack, th.lavaOuter, k * 0.55), 0.2 + 0.55 * k)
  }
  nivel(
    campo,
    C.crustEdge,
    (c, r, m) => {
      crosta(m)
      g.fillRect(c * CELL, r * CELL, CELL, CELL)
    },
    (n, corte, c, r, m) => {
      crosta(m)
      g.fillPoints(PTS, true, false, n)
    },
  )

  // 2) Brilho na pedra em volta: a linha de nível da lava viva, grossa e fraca.
  // Os cortes ficam guardados para a borda quente da etapa 4 — o marching
  // squares roda uma vez e serve duas.
  SEGS.length = 0
  nivel(
    campo,
    vivo,
    () => {},
    (n, corte) => {
      if (corte) SEGS.push(corte[0], corte[1], corte[2], corte[3])
    },
  )
  const pulso = FX.bloomLava + 0.06 * Math.sin(time * 2)
  for (const [larg, forca] of [
    [13, pulso * 0.4],
    [5, pulso],
  ]) {
    g.lineStyle(larg, th.lavaGlow, forca)
    for (let i = 0; i < SEGS.length; i += 4) g.lineBetween(SEGS[i], SEGS[i + 1], SEGS[i + 2], SEGS[i + 3])
  }

  // 3) A massa viva.
  g.fillStyle(th.lavaOuter, 1)
  nivel(
    campo,
    vivo,
    (c, r) => g.fillRect(c * CELL, r * CELL, CELL, CELL),
    (n) => g.fillPoints(PTS, true, false, n),
  )
  for (const p of b.pools.values()) {
    if (p.vol >= C.lethalVol) g.fillCircle(p.x, p.y, CELL * 0.55)
  }

  // 4) A borda quente: tensão de superfície, e é ela que separa o líquido da
  // crosta a olho nu.
  g.lineStyle(2, th.lavaOuterMid, 0.75)
  for (let i = 0; i < SEGS.length; i += 4) g.lineBetween(SEGS[i], SEGS[i + 1], SEGS[i + 2], SEGS[i + 3])

  // 5) Borbulha onde está fundo, fresta acesa onde já virou crosta quente, e a
  // superfície do mar lá fora **só no tile inteiramente molhado**: meio tile
  // decorado vazaria para o chão seco.
  const cheios = new Map()
  for (const p of b.pools.values()) {
    const f = time * 3.5 + p.c * 2.1 + p.r * 1.1
    if (p.vol < C.lethalVol) {
      const k = p.vol / C.lethalVol
      if (k <= 0.5) continue
      g.fillStyle(th.lavaOuterMid, (k - 0.5) * 1.2 * (0.4 + 0.4 * Math.sin(f)))
      g.fillRect(p.x - CELL * 0.3, p.y - 1 + Math.sin(f) * 1.5, CELL * 0.6, 2)
      continue
    }
    const k = Math.floor(p.c / SUB) + ',' + Math.floor(p.r / SUB)
    cheios.set(k, (cheios.get(k) ?? 0) + 1)
    // Uma borbulha a cada quatro células, sorteada pela posição: uma por célula
    // virava bolinha em tudo, e mancha de bolinhas não é lava, é tecido.
    // Medido pelo teto da célula, não pelo limiar letal: com o limiar baixo,
    // "1,8 vezes o letal" era quase toda célula e a poça virava bolha.
    if (p.vol > C.volMax * 0.45 && (p.c * 7 + p.r * 13) % 4 === 0) {
      g.fillStyle(th.lavaOuterHot, 0.3 + 0.3 * Math.sin(f))
      g.fillEllipse(p.x, p.y, CELL * 0.7, CELL * 0.55)
    }
  }
  for (const [k, n] of cheios) {
    if (n < SUB * SUB) continue
    const v = k.split(',')
    paintLavaSurface(g, th, Number(v[0]), Number(v[1]), time)
  }
}

/**
 * O jorro: **chuva, e nada de reto**.
 *
 * Cada gota tem duas partes no desenho: o corpo, no ar, e a **sombra no chão**.
 * A sombra é quem carrega a informação — ela chega meio segundo antes da lava e
 * fecha conforme a gota desce, então sair de baixo dela é a jogada.
 *
 * Nenhum traço reto sobreviveu aqui. A primeira versão desenhava um segmento
 * aceso do lábio até o ponto de queda: lia como laser. A segunda guardou um toco
 * desse segmento como corda no lábio, e o toco lia como laser cortado. O que o
 * lábio tem agora é um **bolo de lava** engrossando antes de a gota desprender —
 * uma massa, não uma linha.
 */
function drawStream(scene, b, time) {
  const ar = scene.airGfx
  const chao = scene.decalGfx
  const th = scene.theme

  // 1) Sombras, no chão e antes de tudo: é a pegada da gota, e ela tem que
  // cobrir o que o respingo mata (regra 12).
  for (const d of b.gouts) {
    const perto = Math.max(0, 1 - d.z / 70)
    chao.fillStyle(COLOR.shadow, 0.1 + 0.32 * perto)
    chao.fillEllipse(
      Math.round(d.x),
      Math.round(d.y),
      C.splashKill * (2.2 - 0.5 * perto),
      C.splashKill * (1.3 - 0.35 * perto),
    )
  }

  // 2) Respingo: clarão e anel abrindo de onde ela bateu.
  for (const sp of b.splashes) {
    const f = 1 - sp.t / C.splashShow
    const r = C.splashKill * (0.6 + 1.1 * (1 - f))
    chao.fillStyle(th.lavaOuterHot, 0.45 * f * f)
    chao.fillEllipse(Math.round(sp.x), Math.round(sp.y), C.splashKill * 1.8, C.splashKill * 1.05)
    chao.lineStyle(2, th.lavaOuterHot, 0.7 * f)
    chao.strokeEllipse(Math.round(sp.x), Math.round(sp.y), r * 2, r * 1.2)
  }

  // 3) O bolo no lábio: a lava engrossando ali antes de desprender. Massa, não
  // linha — é o que sobrou depois de duas versões que liam como laser.
  if (b.vertendo) {
    const boca = b.mouth()
    const ang = b.pourAngle()
    const pulsa = 0.85 + 0.15 * Math.sin(time * 14)
    const r = C.lipGlow * (0.55 + 0.45 * b.fill) * pulsa
    const bx = Math.round(boca.x + Math.cos(ang) * r * 0.5)
    const by = Math.round(boca.y + Math.sin(ang) * r * 0.5)
    ar.fillStyle(th.lavaGlow, FX.bloomPlume)
    ar.fillPoints(elipse(bx, by, r * 1.7, r * 1.2, ang, 12), true)
    ar.fillStyle(th.lavaOuter, 1)
    ar.fillPoints(elipse(bx, by, r, r * 0.7, ang, 12), true)
    ar.fillStyle(th.lavaOuterMid, 1)
    ar.fillPoints(elipse(bx, by, r * 0.6, r * 0.42, ang, 12), true)
    ar.fillStyle(th.lavaOuterHot, 0.8 * pulsa)
    ar.fillCircle(bx, by, Math.max(1, r * 0.25))
  }

  // 4) As gotas, esticadas na direção em que voam — a vertical entra na conta,
  // então elas se deitam ao subir e apontam para baixo ao cair. Gota redonda
  // parece bola; gota esticada parece lava.
  for (const d of b.gouts) {
    const x = Math.round(d.x)
    const y = Math.round(d.y - d.z)
    // A velocidade de tela inclui a vertical, então ela se deita ao subir e
    // aponta para baixo ao cair — o desenho segue o voo, não o chão.
    const vyTela = d.vy - d.vz
    const ang = Math.atan2(vyTela, d.vx)
    const r = C.goutRadius * Math.min(1.2, 0.7 + d.vol)
    // Risco de 30 ms atrás dela: a 400 px/s, gota sem rastro pisca de um lugar
    // para o outro. Sai da própria velocidade, sem guardar histórico nenhum.
    ar.lineStyle(Math.max(1, r * 0.9), th.lavaOuter, 0.35)
    ar.lineBetween(x - d.vx * 0.03, y - vyTela * 0.03, x, y)
    ar.fillStyle(th.lavaGlow, FX.bloomPlume)
    ar.fillPoints(elipse(x, y, r * 2.1, r * 1.4, ang, 10), true)
    ar.fillStyle(th.lavaOuter, 1)
    ar.fillPoints(elipse(x, y, r * 1.5, r * 0.85, ang, 10), true)
    // O quente puxa para a frente: a borda que corta o ar é a mais acesa, e a
    // que fica atrás esfria. Concêntrico ela virava anel, e anel parece olho.
    const ox = Math.cos(ang) * r * 0.35
    const oy = Math.sin(ang) * r * 0.35
    ar.fillStyle(th.lavaOuterMid, 1)
    ar.fillPoints(elipse(x + ox, y + oy, r * 0.9, r * 0.5, ang, 10), true)
    ar.fillStyle(th.lavaOuterHot, 0.85)
    ar.fillCircle(Math.round(x + ox * 1.6), Math.round(y + oy * 1.6), Math.max(1, r * 0.35))
  }
}

/** Elipse girada, em pontos: `fillEllipse` do Phaser não gira. */
function elipse(cx, cy, rx, ry, ang, n = 22) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const x = Math.cos(a) * rx
    const y = Math.sin(a) * ry
    pts.push({ x: cx + x * Math.cos(ang) - y * Math.sin(ang), y: cy + x * Math.sin(ang) + y * Math.cos(ang) })
  }
  return pts
}

/** Setor de 45° para o quadro da folha. */
function setor(ang) {
  const i = Math.round((ang * 4) / Math.PI)
  return ((i % ART.frames) + ART.frames) % ART.frames
}

/**
 * Separa a folha em **pedra** e **lava**, no carregamento.
 *
 * O líquido foi desenhado em ciano justamente para isto: nenhum outro pixel do
 * jogo é ciano, então o teste é uma conta por pixel. A pedra sai sem o líquido
 * (a boca fica um buraco, e é a view que pinta o fundo escuro dela), e o líquido
 * sai sozinho, **repintado pela luminância** na rampa quente do tema — o escuro
 * do ciano vira o escuro da lava, a crista clara vira o clarão. Repintar por
 * luminância, e não por tabela de cor, é o que faz os meios-tons do desenho
 * sobreviverem à troca.
 *
 * Devolve, por quadro, a caixa do líquido: é ela que diz onde fica a boca, e
 * dela saem a âncora do nível e o fundo escuro da tigela.
 */
function separaLava(scene) {
  const src = scene.textures.get('crisol').getSourceImage()
  const W = src.width
  const H = src.height
  const cv = (nome) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    return c
  }
  const cp = cv()
  const cl = cv()
  const ctx = cp.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(src, 0, 0)
  const imgP = ctx.getImageData(0, 0, W, H)
  const p = imgP.data
  const imgL = ctx.createImageData(W, H)
  const l = imgL.data

  const ciano = (r, g, b) => b > r + 40 && g > r + 20
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b

  let lumMax = 1
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 20 || !ciano(p[i], p[i + 1], p[i + 2])) continue
    const v = lum(p[i], p[i + 1], p[i + 2])
    if (v > lumMax) lumMax = v
  }

  const th = scene.theme
  const rampa = (t) =>
    t < 0.5 ? mixColor(th.lavaOuter, th.lavaOuterMid, t * 2) : mixColor(th.lavaOuterMid, th.lavaOuterHot, (t - 0.5) * 2)

  const cell = ART.cell
  const caixas = Array.from({ length: ART.frames }, () => ({ x0: 1e9, y0: 1e9, x1: -1, y1: -1 }))
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 20 || !ciano(p[i], p[i + 1], p[i + 2])) continue
    const cor = rampa(Math.min(1, lum(p[i], p[i + 1], p[i + 2]) / lumMax))
    l[i] = (cor >> 16) & 255
    l[i + 1] = (cor >> 8) & 255
    l[i + 2] = cor & 255
    l[i + 3] = p[i + 3]
    p[i + 3] = 0 // some da pedra: a boca vira buraco, e a view pinta o fundo

    const px = (i / 4) % W
    const py = (i / 4 / W) | 0
    const f = Math.floor(px / cell) + Math.floor(py / cell) * ART.cols
    if (f >= ART.frames) continue
    const b = caixas[f]
    const cx = px % cell
    const cy = py % cell
    if (cx < b.x0) b.x0 = cx
    if (cx > b.x1) b.x1 = cx
    if (cy < b.y0) b.y0 = cy
    if (cy > b.y1) b.y1 = cy
  }
  ctx.putImageData(imgP, 0, 0)
  cl.getContext('2d').putImageData(imgL, 0, 0)

  // `create` roda de novo num restart e `addCanvas` devolve null se a chave já
  // existe: remover antes deixa o recarregamento idempotente.
  for (const [chave, canvas] of [
    ['crisolPedra', cp],
    ['crisolLava', cl],
  ]) {
    if (scene.textures.exists(chave)) scene.textures.remove(chave)
    const tex = scene.textures.addCanvas(chave, canvas)
    for (let f = 0; f < ART.frames; f++) {
      tex.add(f, 0, (f % ART.cols) * cell, Math.floor(f / ART.cols) * cell, cell, cell)
    }
  }

  return caixas.map((b) => ({
    cx: (b.x0 + b.x1) / 2,
    cy: (b.y0 + b.y1) / 2,
    w: b.x1 - b.x0 + 1,
    h: b.y1 - b.y0 + 1,
  }))
}

/**
 * O caldeirão.
 *
 * O que está **dentro da boca** é a informação: lava até a borda quer dizer
 * selado, fundo escuro com o ponto vermelho quer dizer aberto. E ele **tomba de
 * verdade** — o sprite gira em torno do próprio pé, que é o que um corpo rígido
 * faz ao ser entornado, e a boca descreve o arco junto. O modelo calcula esse
 * mesmo arco (`giro`, `mouth`, `corePos`): mira e desenho nunca se separam.
 */
function drawBody(scene, b, time) {
  const g = scene.bossGfx
  g.setDepth(b.y - 0.02)
  const th = scene.theme
  const { rise, roar } = scene.wake
  const aceso = Math.max(rise, roar)

  const f = setor(b.aim)
  const box = scene.crisolBoxes[f]
  const boca = scene.crisolMouth[f]
  const t = b.tilt
  const giro = b.giro
  const achata = 1 - ART.tiltSquash * t * Math.abs(Math.sin(b.aim))
  const d = C.bodyRadius * C.tiltShift * t
  const x = Math.round(b.x + Math.cos(b.aim) * d)
  const y = Math.round(b.y + Math.sin(b.aim) * d * 0.6)

  g.fillStyle(COLOR.shadow, 0.45)
  g.fillEllipse(Math.round(b.x), Math.round(b.y) + 4, C.bodyRadius * 2.2, C.bodyRadius * 0.85)

  const corpo = scene.crisolSpr
  corpo.setFrame(f)
  corpo.setOrigin(box.ox, box.oyBase)
  corpo.setPosition(x, y)
  corpo.setScale(ART.scale, ART.scale * achata)
  corpo.setRotation(giro)
  corpo.setDepth(b.y)
  // A arte já é pedra cinzenta: adormecido ele só escurece.
  corpo.setTint(sleepColor(0xffffff, rise))

  // A boca, no mundo: o mesmo ponto que o modelo usa para o núcleo.
  const nucleo = b.corePos()
  const mx = Math.round(nucleo.x)
  const my = Math.round(nucleo.y)
  const larg = boca.w * ART.scale
  const alt = boca.h * ART.scale * achata

  // Fundo da tigela: o buraco que sobrou quando o líquido saiu da pedra. Vazio,
  // é isto que se vê — e é o que faz o núcleo ter onde morar.
  const dentro = scene.crisolMouthGfx
  dentro.clear()
  dentro.setDepth(b.y + 0.005)
  dentro.fillStyle(sleepColor(th.wallFoot, rise), 1)
  dentro.fillEllipse(mx, my, larg, alt)

  // O líquido: mesma folha, repintada. O nível baixa encolhendo a superfície em
  // torno do próprio centro, e a cor esfria junto — os dois saem de `fill`.
  const lava = scene.crisolLavaSpr
  const nivel = 0.3 + 0.7 * b.fill
  const calor = (0.2 + 0.8 * b.fill) * aceso
  lava.setVisible(b.fill > 0.02)
  lava.setFrame(f)
  lava.setOrigin(boca.cx / ART.cell, boca.cy / ART.cell)
  lava.setPosition(mx, my)
  lava.setRotation(giro)
  lava.setScale(ART.scale * nivel, ART.scale * achata * nivel)
  lava.setDepth(b.y + 0.01)
  lava.setTint(mixColor(0x4a2a18, 0xffffff, calor))

  // Brilho subindo da boca, e o clarão do grito.
  const top = scene.bossTopGfx
  top.setDepth(b.y + 0.02)
  if (b.fill > 0.02) {
    const pulso = 0.85 + 0.15 * Math.sin(time * 2.5)
    // Fraco e curto: o brilho é a luz saindo da boca, não uma auréola. Grande
    // demais ele lavava a borda do caldeirão num anel marrom.
    top.fillStyle(th.lavaGlow, FX.bloomLava * 0.55 * b.fill * aceso * pulso)
    top.fillEllipse(mx, my, larg * 1.45, alt * 1.9)
  }
  if (roar > 0) {
    top.fillStyle(th.lavaOuterHot, 0.5 * roar)
    top.fillEllipse(mx, my, larg * (1 + 0.6 * roar), alt * (1 + 0.6 * roar))
    top.lineStyle(3, COLOR.flameCore, 0.8 * roar)
    top.strokeEllipse(mx, my, larg * (1.4 + roar), alt * (1.4 + roar))
  }

  drawCore(scene, b, time, mx, my, larg, alt)
}

/**
 * O núcleo, no fundo da tigela.
 *
 * Ele **responde à sua flecha**: com a flecha em brasa na mão ele abre, cresce
 * e ganha um anel de fogo; fria, ele fica encolhido e apagado. Era a peça que
 * faltava para a regra "só brasa mata" se explicar sozinha — antes o jogador
 * atirava, nada acontecia, e não havia nada na tela dizendo por quê.
 *
 * O tamanho sai da **boca**, não de um raio fixo: a boca é uma elipse achatada
 * de 29 x 10 px na tela, e um círculo do raio da hitbox transbordava dela e
 * lavava o caldeirão inteiro de vermelho. O que se vê é a luz que cabe pela
 * abertura — larga, baixa, e maior que a hitbox no eixo em que dá para errar.
 */
function drawCore(scene, b, time, x, y, larg, alt) {
  if (!b.open && !b.dead) return
  const top = scene.bossTopGfx
  top.setDepth(b.y + 0.02)
  const st = scene.outro.stage
  const vivo = b.dead ? (st === 'soul' ? 1 - Math.min(1, scene.outro.t / OUTRO.soulTime) : st ? 1 : 0) : 1
  const armado = Boolean(scene.arrow && scene.arrow.burning)
  const cx = Math.round(x)
  const cy = Math.round(y)
  const pulso = 0.75 + 0.25 * Math.sin(time * (armado ? 9 : 4))
  const forca = armado ? 1 : 0.45

  const k = armado ? 1 : 0.72
  if (vivo > 0.02) {
    top.fillStyle(COLOR.core, 0.24 * vivo * pulso * forca)
    top.fillEllipse(cx, cy, larg * 1.7 * k, alt * 2.4 * k)
    top.fillStyle(COLOR.core, 0.42 * vivo * pulso * forca)
    top.fillEllipse(cx, cy, larg * 1.05 * k, alt * 1.6 * k)
  }
  // Frio, o núcleo é brasa morta; armado, ele é a única cor saturada da tela.
  const corpo = mixColor(COLOR.coreDead, COLOR.core, vivo * (armado ? 1 : 0.5))
  top.fillStyle(corpo, 1)
  top.fillEllipse(cx, cy, larg * 0.82 * k, alt * 1.3 * k)

  if (armado && vivo > 0.02) {
    // Anel de fogo: "agora dá". É o convite, e some quando a flecha apaga.
    top.lineStyle(2, COLOR.flameCore, 0.5 + 0.4 * pulso)
    top.strokeEllipse(cx, cy, larg * (1 + 0.08 * pulso), alt * (1.7 + 0.15 * pulso))
  }

  // Chiado: a flecha fria caiu na tigela e apagou. É o aviso de que faltou
  // fogo, não de que faltou pontaria.
  if (b.doused > 0) {
    const f = b.doused / C.dousedShow
    const sobe = (1 - f) * 22
    top.fillStyle(0xffffff, 0.5 * f)
    top.fillEllipse(cx, cy - sobe, C.coreRadius * (2 + 4 * (1 - f)), C.coreRadius * (1.2 + 3 * (1 - f)))
    top.fillStyle(0xffffff, 0.3 * f)
    top.fillEllipse(cx + 6, cy - sobe * 1.3, C.coreRadius * (1 + 2.5 * (1 - f)), C.coreRadius * (0.8 + 2 * (1 - f)))
  }
}
