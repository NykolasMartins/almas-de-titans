// Toda detecção de acerto do jogo. Arcade Physics fica desligado (ver CLAUDE.md).
// Sem import do Phaser aqui de propósito: este arquivo roda no node, ver collision.test.js.

import { TUNING } from './tuning.js'

/** Círculo contra círculo. */
export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx
  const dy = ay - by
  const r = ar + br
  return dx * dx + dy * dy <= r * r
}

/**
 * Círculo contra meio-disco: o disco de raio R centrado em (cx, cy), mas só uma
 * das metades. Com `down` falso vale a de cima (y <= cy) — é a forma da
 * pirâmide, que ocupa o espaço acima da própria base, e um círculo inteiro
 * sobrava para baixo do chão. Com `down` verdadeiro vale a de baixo, que é a
 * pegada de quem pende do teto: o chão coberto fica à frente da boca, na
 * direção da câmera.
 */
export function halfDiscHit(px, py, pr, cx, cy, R, down = false) {
  if (down ? py >= cy : py <= cy) return circleHit(px, py, pr, cx, cy, R)
  // Do outro lado da aresta, o ponto mais próximo do meio-disco está nela.
  const nx = Math.max(cx - R, Math.min(cx + R, px))
  const dx = px - nx
  const dy = py - cy
  return dx * dx + dy * dy <= pr * pr
}

/** Círculo contra retângulo alinhado aos eixos, dado pelo centro e semi-lados. */
export function rectHit(px, py, pr, cx, cy, hw, hh) {
  const nx = Math.max(cx - hw, Math.min(cx + hw, px))
  const ny = Math.max(cy - hh, Math.min(cy + hh, py))
  const dx = px - nx
  const dy = py - ny
  return dx * dx + dy * dy <= pr * pr
}

/** Tile sólido? Qualquer valor não-zero é sólido; fora do mapa também. */
export function solidAt(grid, col, row) {
  const line = grid[row]
  if (!line) return true
  const t = line[col]
  return t === undefined ? true : t !== 0
}

/** Ponto do mundo dentro de tile sólido? */
export function solidPoint(grid, x, y) {
  const t = TUNING.tileSize
  return solidAt(grid, Math.floor(x / t), Math.floor(y / t))
}

/** Caixa centrada em (x, y) encostando em tile sólido? */
export function boxBlocked(grid, x, y, hw, hh) {
  const t = TUNING.tileSize
  const c0 = Math.floor((x - hw) / t)
  const c1 = Math.floor((x + hw - 0.001) / t)
  const r0 = Math.floor((y - hh) / t)
  const r1 = Math.floor((y + hh - 0.001) / t)
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (solidAt(grid, c, r)) return true
    }
  }
  return false
}

// Avança 1 px por vez até bater. Exato ao pixel e simples; o custo é no máximo
// ceil(velocidade/60) iterações por eixo, ou seja 5 no pior caso deste jogo.
function moveAxis(grid, x, y, delta, hw, hh, isX) {
  const dir = Math.sign(delta)
  let left = Math.abs(delta)
  let hit = false
  while (left > 0) {
    const s = Math.min(1, left) * dir
    const nx = isX ? x + s : x
    const ny = isX ? y : y + s
    if (boxBlocked(grid, nx, ny, hw, hh)) {
      hit = true
      break
    }
    x = nx
    y = ny
    left -= Math.abs(s)
  }
  return { x, y, hit }
}

/** Move uma caixa contra a grade, resolvendo eixo por eixo (permite deslizar na parede). */
export function moveBox(grid, x, y, dx, dy, hw, hh) {
  let hitX = false
  let hitY = false
  if (dx) {
    const m = moveAxis(grid, x, y, dx, hw, hh, true)
    x = m.x
    hitX = m.hit
  }
  if (dy) {
    const m = moveAxis(grid, x, y, dy, hw, hh, false)
    y = m.y
    hitY = m.hit
  }
  return { x, y, hitX, hitY }
}

/** Distância de um ponto a um segmento, para saber se um círculo encosta nele. */
export function segmentHit(px, py, pr, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const len2 = vx * vx + vy * vy
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0
  const dx = px - (ax + vx * t)
  const dy = py - (ay + vy * t)
  return dx * dx + dy * dy <= pr * pr
}

/**
 * Raio que ricocheteia. Devolve `{ points, absorbed }`: a polilinha por onde ele
 * passou, e se ele terminou engolido por uma superfície em vez de acabar o
 * alcance ou os quiques.
 *
 * O tile é alinhado aos eixos, então a face de onde veio se descobre testando um
 * eixo de cada vez: se só o passo em x entra no sólido, a face é vertical e
 * inverte `vx`. Os dois entrando ao mesmo tempo é quina, e inverte os dois.
 *
 * `surface(x, y)` é opcional e serve para espelhos que não são muralha:
 * devolvendo `{ nx, ny }` o raio reflete naquela normal, devolvendo `'stop'` ele
 * para ali e a volta vem com `absorbed`. `dx`/`dy` precisam ser unitários.
 */
export function bounceRay(grid, x, y, dx, dy, maxLen, bounces, step = 4, surface = null) {
  const points = [{ x, y }]
  let px = x
  let py = y
  let vx = dx
  let vy = dy
  let resta = maxLen
  let quiques = 0

  while (resta > 0) {
    const nx = px + vx * step
    const ny = py + vy * step

    if (surface) {
      const s = surface(nx, ny)
      if (s === 'stop') {
        points.push({ x: nx, y: ny })
        return { points, absorbed: true }
      }
      if (s) {
        if (quiques >= bounces) break
        // Espelho de normal `n`: v' = v - 2(v·n)n.
        const dot = vx * s.nx + vy * s.ny
        vx -= 2 * dot * s.nx
        vy -= 2 * dot * s.ny
        quiques++
        points.push({ x: px, y: py })
        continue
      }
    }

    if (solidPoint(grid, nx, ny)) {
      if (quiques >= bounces) break
      const emX = solidPoint(grid, nx, py)
      const emY = solidPoint(grid, px, ny)
      if (emX || (!emX && !emY)) vx = -vx
      if (emY || (!emX && !emY)) vy = -vy
      quiques++
      points.push({ x: px, y: py })
      continue
    }

    px = nx
    py = ny
    resta -= step
  }

  points.push({ x: px, y: py })
  return { points, absorbed: false }
}

/**
 * Percorre um segmento em passos de no máximo `maxStep` px chamando `at(x, y)`.
 * Para no primeiro retorno truthy e devolve `{ value, x, y, prevX, prevY }`, onde
 * `prev` é o último ponto livre — é onde a flecha crava, para não ficar enterrada
 * dentro do sólido e o recall não começar de dentro da parede.
 * A flecha anda vários px por quadro com raio 3: testar só a posição final
 * deixaria ela atravessar parede fina.
 */
export function sweep(x, y, dx, dy, maxStep, at) {
  const dist = Math.hypot(dx, dy)
  const steps = Math.max(1, Math.ceil(dist / maxStep))
  let prevX = x
  let prevY = y
  for (let i = 1; i <= steps; i++) {
    const px = x + (dx * i) / steps
    const py = y + (dy * i) / steps
    const value = at(px, py)
    if (value) return { value, x: px, y: py, prevX, prevY }
    prevX = px
    prevY = py
  }
  return null
}
