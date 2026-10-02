// node src/collision.test.js
import assert from 'node:assert/strict'
import { TUNING } from './tuning.js'
import { circleHit, solidAt, solidPoint, boxBlocked, moveBox, sweep, segmentHit, bounceRay } from './collision.js'

// Geometria em função do tile, não em números fixos: assim o teste sobrevive a
// mudanças de resolução.
const T = TUNING.tileSize
const MEIO = T * 1.5 // centro do único tile vazio, em (1,1)

// Sala 4x3 com parede na borda e um bloco em (2,1).
const grid = [
  [1, 1, 1, 1],
  [1, 0, 1, 1],
  [1, 1, 1, 1],
]

assert.ok(circleHit(0, 0, 5, 8, 0, 4), 'círculos sobrepostos')
assert.ok(!circleHit(0, 0, 5, 10, 0, 4), 'círculos separados')
assert.ok(circleHit(0, 0, 5, 9, 0, 4), 'encostando conta como acerto')

assert.ok(solidAt(grid, 0, 0), 'borda é sólida')
assert.ok(!solidAt(grid, 1, 1), 'miolo é vazio')
assert.ok(solidAt(grid, 99, 99), 'fora do mapa é sólido')
assert.ok(solidAt(grid, -1, 1), 'coluna negativa é sólida')

// O vazio (1,1) é o retângulo T..2T nos dois eixos.
assert.ok(!solidPoint(grid, MEIO, MEIO), 'centro do tile vazio')
assert.ok(solidPoint(grid, T * 0.5, MEIO), 'tile de parede à esquerda')

const PEQ = T / 4
const GRA = T * 0.6 // maior que meio tile: transborda para o vizinho
assert.ok(!boxBlocked(grid, MEIO, MEIO, PEQ, PEQ), 'caixa pequena cabe no tile vazio')
assert.ok(boxBlocked(grid, MEIO, MEIO, GRA, GRA), 'caixa grande encosta na parede vizinha')

// Andar para a esquerda a partir do centro do tile vazio para na parede, não a atravessa.
const left = moveBox(grid, MEIO, MEIO, -T * 6, 0, PEQ, PEQ)
assert.ok(left.hitX, 'bateu na parede da esquerda')
assert.ok(left.x >= T + PEQ - 1 && left.x <= T + PEQ + 1, `parou colado na parede, x=${left.x}`)

// Deslizar: empurrar na diagonal contra a parede esquerda ainda move no eixo livre.
const slide = moveBox(grid, MEIO, MEIO, -T * 6, 0.5, PEQ, PEQ)
assert.ok(slide.y > MEIO, 'desliza no eixo livre mesmo bloqueado no outro')

// Sem colisão: chega inteiro ao destino.
const free = moveBox(grid, MEIO, MEIO, 0, 0, PEQ, PEQ)
assert.equal(free.x, MEIO)
assert.equal(free.y, MEIO)

// sweep tem que enxergar uma parede fina no meio do caminho, não só o destino.
const crossed = sweep(T + 4, MEIO, T * 6, 0, 4, (x) => (solidPoint(grid, x, MEIO) ? { x } : null))
assert.ok(crossed, 'sweep achou a parede no meio do trajeto')
assert.ok(crossed.x < T * 2 + 8, `parou na primeira parede, x=${crossed.x}`)

const clear = sweep(T + 2, MEIO, 8, 0, 4, (x) => (solidPoint(grid, x, MEIO) ? { x } : null))
assert.equal(clear, null, 'trajeto livre não acusa acerto')


// --- Feixe que ricocheteia ---------------------------------------------------
assert.ok(segmentHit(0, 5, 6, -10, 0, 10, 0), 'ponto perto do meio do segmento')
assert.ok(!segmentHit(0, 5, 4, -10, 0, 10, 0), 'longe demais não encosta')
assert.ok(segmentHit(-14, 2, 5, -10, 0, 10, 0), 'perto da ponta conta pela ponta')
assert.ok(!segmentHit(-20, 0, 5, -10, 0, 10, 0), 'além da ponta, não')

{
  // Do único tile vazio, indo para a esquerda: bate na muralha e volta.
  const caminho = bounceRay(grid, MEIO, MEIO, -1, 0, 200, 2).points
  assert.ok(caminho.length >= 3, `quicou pelo menos uma vez (${caminho.length} pontos)`)
  assert.ok(caminho[2].x > caminho[1].x, 'depois do quique ele volta para a direita')
  for (const p of caminho) {
    assert.ok(!solidPoint(grid, p.x, p.y), `nenhum ponto dentro da muralha (${p.x},${p.y})`)
  }
}

{
  // Sem quique permitido ele simplesmente para na muralha.
  const curto = bounceRay(grid, MEIO, MEIO, -1, 0, 200, 0).points
  assert.equal(curto.length, 2, 'sem quique: só ida')
  assert.ok(curto[1].x < MEIO, 'e andou para o lado certo')
}

{
  // Superfície que engole: o raio para ali e avisa.
  const alvo = bounceRay(grid, MEIO, MEIO, -1, 0, 200, 2, 4, (x) => (x < MEIO - 8 ? 'stop' : null))
  assert.ok(alvo.absorbed, 'terminou engolido')
  assert.ok(alvo.points[alvo.points.length - 1].x < MEIO, 'no ponto certo')
}

console.log('collision: ok')
