import { TUNING, TERRAIN } from './tuning.js'

/**
 * Pintura de chão, muralha e mar de lava. Vale para qualquer sala: o que muda de
 * área para área é o **tema** (cores), não este código.
 *
 * Convenção da grade, a mesma de `data/rooms.js`:
 *   0 = chão   1 = muralha   3 = lava externa (cenário sólido)
 */

/** Gerador determinístico. A pintura é refeita a cada `scene.restart()`. */
export function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const hash = (a, b, c = 0) => ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0

/**
 * Chão: pedra velha primeiro (manchas, placas puídas, fissuras), lavra por cima
 * (sulcos concêntricos e painel central). Essa ordem importa — lavrar antes de
 * envelhecer faz o desgaste cobrir o entalhe.
 */
export function paintFloor(g, room, th) {
  const t = TUNING.tileSize
  const W = room.width
  const H = room.height
  const rnd = makeRng(TERRAIN.seed)

  g.fillStyle(th.floor, 1)
  g.fillRect(0, 0, W, H)

  for (let i = 0; i < TERRAIN.stainsBig; i++) {
    const rx = 14 + rnd() * 46
    g.fillStyle(rnd() > 0.5 ? th.floorStainDark : th.floorStainLight, 0.08 + rnd() * 0.1)
    g.fillEllipse(rnd() * W, rnd() * H, rx * 2, rx * (1.1 + rnd() * 0.8))
  }
  for (let i = 0; i < TERRAIN.stainsSmall; i++) {
    const rx = 3 + rnd() * 11
    g.fillStyle(rnd() > 0.45 ? th.floorStainDark : th.floorStainLight, 0.13 + rnd() * 0.19)
    g.fillEllipse(rnd() * W, rnd() * H, rx * 2, rx * (1 + rnd()))
  }
  // Placas gastas: manchas largas e chapadas, de pedra puída pelo uso.
  for (let i = 0; i < TERRAIN.wornPlates; i++) {
    const rx = 40 + rnd() * 70
    g.fillStyle(th.floorStainDark, 0.06 + rnd() * 0.05)
    g.fillEllipse(rnd() * W, rnd() * H, rx * 2, rx * (0.5 + rnd() * 0.5))
  }
  // Fissuras: linhas quebradas curtas, como pedra antiga assentando.
  for (let i = 0; i < TERRAIN.cracks; i++) {
    let fx = rnd() * W
    let fy = rnd() * H
    let ang = rnd() * Math.PI * 2
    g.lineStyle(1, th.floorCrack, 0.3 + rnd() * 0.25)
    g.beginPath()
    g.moveTo(fx, fy)
    for (let k = 0; k < 3 + Math.floor(rnd() * 3); k++) {
      ang += (rnd() - 0.5) * 1.5
      fx += Math.cos(ang) * (5 + rnd() * 13)
      fy += Math.sin(ang) * (5 + rnd() * 13)
      g.lineTo(fx, fy)
    }
    g.strokePath()
  }

  // Lavra do piso. O que muda de área para área é o **motivo**, escolhido pelo
  // tema — não este código.
  if (th.motif === 'anel') paintRings(g, W, H, t, th)
  else paintPanel(g, W, H, t, th)

  // Cascalho e poeira, por cima de tudo.
  for (let i = 0; i < TERRAIN.specks; i++) {
    const h = hash(i, i >> 3)
    const grande = h % 11 === 0
    g.fillStyle(grande ? th.rubble : h & 1 ? th.floorSpeck : th.floorInlay, grande ? 0.9 : 0.65)
    g.fillRect(h % W, (h >>> 9) % H, grande ? 2 : 1, grande ? 2 : 1)
  }
}

/**
 * Muralha: rocha com estrias verticais — a assinatura das faces de penhasco das
 * referências —, face de topo acesa só onde não há muralha acima, e sombra com
 * entulho onde ela encontra o chão.
 */
export function paintWalls(g, grid, th) {
  const t = TUNING.tileSize
  const eParede = (c, r) => grid[r]?.[c] === 1

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== 1) continue
      const x = c * t
      const y = r * t

      g.fillStyle(th.wall, 1)
      g.fillRect(x, y, t, t)
      if (th.wallMotif === 'espelho') paintMirrorFace(g, x, y, t, c, r, th)
      else {
        for (let sx = 1; sx < t; sx += 3) {
          const h = hash(c, r, sx)
          g.fillStyle(th.wallStripe, 0.25 + (h % 40) / 100)
          g.fillRect(x + sx, y, 1, t)
        }
      }

      if (!eParede(c, r - 1)) {
        const capH = Math.round(t * 0.5)
        g.fillStyle(th.wallTop, 1)
        g.fillRect(x, y, t, capH)
        g.fillStyle(th.wallCap, 1)
        g.fillRect(x, y, t, 2)
        g.fillStyle(th.wallTrim, 1)
        g.fillRect(x, y + capH - 2, t, 2)
        for (let i = 0; i < 2; i++) {
          const dx = 5 + i * 12
          g.fillStyle(th.wallLattice, 0.85)
          g.fillRect(x + dx, y + 7, 5, 1)
          g.fillRect(x + dx + 2, y + 5, 1, 5)
        }
      }

      if (!eParede(c, r + 1) && grid[r + 1]?.[c] === 0) {
        g.fillStyle(th.wallFoot, 0.45)
        g.fillRect(x, y + t, t, 4)
        for (let i = 0; i < 3; i++) {
          const h = hash(c, r, i + 31)
          g.fillStyle(th.rubble, 0.9)
          g.fillRect(x + (h % (t - 3)), y + t + 2 + ((h >>> 6) % 5), 2 + (h % 2), 2)
        }
      }
    }
  }
}

/**
 * Mar de lava além das muralhas. Redesenhado a cada quadro: correntes e cristas
 * deslizam por senos de frequências que não batem, e um halo derrama sobre a
 * pedra vizinha — é o que dá brilho sem depender de shader.
 */
/**
 * A superfície de um tile de lava: correntes que sobem e descem, e cristas
 * menores e mais rápidas por cima.
 *
 * Está fora de `paintLava` porque **a poça de um chefe usa a mesma pintura**.
 * Lava que o Crisol derrama tem que ser a mesma coisa que o mar lá fora, senão
 * o jogador não reconhece o que está vendo — e foi exatamente isso que
 * aconteceu na primeira versão dele.
 */
export function paintLavaSurface(g, th, c, r, time) {
  const t = TUNING.tileSize
  const x = c * t
  const y = r * t
  const waveSpeed = TERRAIN.waveSpeed
  for (let i = 0; i < 2; i++) {
    const h = hash(c, r, i)
    const fase = (h % 628) / 100 + time * waveSpeed
    g.fillStyle(th.lavaOuterMid, 0.9)
    g.fillRect(
      x + 2 + ((h >>> 4) % (t - 10)) + Math.cos(fase * 0.7) * 4,
      y + 4 + ((h >>> 11) % (t - 12)) + Math.sin(fase) * 5,
      7,
      3,
    )
  }
  for (let i = 0; i < 2; i++) {
    const h = hash(c, r, i + 7)
    const fase = (h % 628) / 100 + time * waveSpeed * 1.8
    g.fillStyle(th.lavaOuterHot, 0.55 + 0.45 * Math.sin(fase * 1.3))
    g.fillRect(x + 3 + ((h >>> 6) % (t - 9)) + Math.sin(fase) * 5, y + 3 + ((h >>> 13) % (t - 6)), 3, 2)
  }
}

export function paintLava(g, grid, th, time, bloom) {
  const t = TUNING.tileSize
  g.clear()

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== 3) continue
      const x = c * t
      const y = r * t
      g.fillStyle(th.lavaOuter, 1)
      g.fillRect(x, y, t, t)
      paintLavaSurface(g, th, c, r, time)

      // Halo para dentro, em duas camadas: a larga bem fraca, para o brilho cair
      // suave em vez de virar uma faixa dura.
      const pulso = bloom + 0.06 * Math.sin(time * 2 + c * 0.6 + r * 0.4)
      for (const [larg, forca] of [
        [14, pulso * 0.35],
        [5, pulso],
      ]) {
        g.fillStyle(th.lavaGlow, forca)
        if (grid[r][c + 1] === 1) g.fillRect(x + t, y, larg, t)
        if (grid[r][c - 1] === 1) g.fillRect(x - larg, y, larg, t)
        if (grid[r + 1]?.[c] === 1) g.fillRect(x, y + t, t, larg)
        if (grid[r - 1]?.[c] === 1) g.fillRect(x, y - larg, t, larg)
      }
    }
  }
}

/**
 * Motivo padrão: molduras retangulares e um painel central com losango inscrito.
 * É o marco visual do piso nas referências de fogo.
 */
function paintPanel(g, W, H, t, th) {
  for (let i = 0; i < TERRAIN.grooveRings; i++) {
    const m = t * 2.2 + i * t * 1.5
    g.lineStyle(2, th.floorGroove, 0.9)
    g.strokeRoundedRect(m, m, W - m * 2, H - m * 2, t * 1.6)
    g.lineStyle(1, th.floorInlay, 0.5)
    g.strokeRoundedRect(m + 1, m + 1, W - m * 2 - 2, H - m * 2 - 2, t * 1.6)
  }

  const pw = t * 9
  const ph = t * 5.5
  const cx = W / 2
  const cy = H / 2
  g.fillStyle(th.floorPanel, 0.55)
  g.fillRect(cx - pw / 2, cy - ph / 2, pw, ph)
  g.lineStyle(2, th.floorGroove, 0.85)
  g.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph)
  g.lineStyle(1, th.floorInlay, 0.6)
  g.strokeRect(cx - pw / 2 + 3, cy - ph / 2 + 3, pw - 6, ph - 6)
  g.lineStyle(2, th.floorGroove, 0.7)
  g.beginPath()
  g.moveTo(cx, cy - ph / 2 + 8)
  g.lineTo(cx + pw / 2 - 10, cy)
  g.lineTo(cx, cy + ph / 2 - 8)
  g.lineTo(cx - pw / 2 + 10, cy)
  g.closePath()
  g.strokePath()
}

/**
 * Motivo de anéis: círculos concêntricos em volta do centro da sala, achatados
 * na proporção do piso — nesta câmera, círculo no chão lê como elipse, e anel
 * redondo ficaria "de pé". No miolo, a marca gasta de onde bate o que pende.
 */
function paintRings(g, W, H, t, th) {
  const cx = W / 2
  const cy = H / 2
  for (let i = 0; i < TERRAIN.motifRings; i++) {
    const rx = t * 2.6 + i * t * 2.1
    const ry = rx * 0.58
    g.lineStyle(2, th.floorGroove, 0.6)
    g.strokeEllipse(cx, cy, rx * 2, ry * 2)
    g.lineStyle(1, th.floorInlay, 0.35)
    g.strokeEllipse(cx, cy, rx * 2 - 4, ry * 2 - 4)
  }
  g.fillStyle(th.floorPanel, 0.6)
  g.fillEllipse(cx, cy, t * 3.6, t * 2.1)
  g.lineStyle(2, th.floorGroove, 0.9)
  g.strokeEllipse(cx, cy, t * 3.6, t * 2.1)
  g.fillStyle(th.floorCrack, 0.55)
  g.fillEllipse(cx, cy, t * 1.2, t * 0.7)
}

/**
 * Face de espelho, no lugar das estrias de rocha. Chapa polida em painéis, com
 * uma linha de brilho contínua atravessando toda a muralha: a linha é o que faz
 * ler como superfície polida em vez de pedra clara. Não há reflexo aqui — este é
 * o material; quem reflete é a cena, que sabe onde estão as coisas.
 */
function paintMirrorFace(g, x, y, t, c, r, th) {
  // Painéis de dois tiles: com junta a cada meio tile a muralha lia como xadrez,
  // não como chapa. A paridade da coluna e da linha faz o painel grande.
  g.fillStyle((c + r) % 2 ? th.wallStripe : th.wallTop, 0.16)
  g.fillRect(x, y, t, t)

  if (c % 2 === 0) {
    g.fillStyle(th.wallFoot, 0.55)
    g.fillRect(x, y, 1, t)
    g.fillStyle(th.wallCap, 0.22)
    g.fillRect(x + 1, y, 1, t)
  }
  if (r % 2 === 0) {
    g.fillStyle(th.wallFoot, 0.45)
    g.fillRect(x, y, t, 1)
    g.fillStyle(th.wallLattice, 0.4)
    g.fillRect(x, y + 1, t, 1)
  }

  // Brilho especular correndo em diagonal pelo painel: é o que separa chapa
  // polida de pedra clara.
  const h = hash(c, r, 5)
  g.fillStyle(th.wallCap, 0.18)
  for (let i = 0; i < t; i += 2) {
    const dx = Math.round(i * 0.6) + ((h >>> 3) % 6)
    if (dx < t) g.fillRect(x + dx, y + i, 2, 1)
  }

  // Manchas leves de embaçado, para não virar plástico liso.
  if (h % 3 === 0) {
    g.fillStyle(th.wallTop, 0.1)
    g.fillEllipse(x + (h % t), y + ((h >>> 5) % t), t * 1.1, t * 0.7)
  }
}
