const TILE = 24

/**
 * Salas do mundo.
 *
 * `grid[row][col]`: 0 chão, 1 muralha, 2 porta (sólida enquanto fechada),
 * 3 lava externa. Tudo não-zero é sólido para a colisão.
 *
 * Uma sala é: geometria, tema, saídas e o que vive nela. As saídas são o grafo —
 * `exits.norte = 'obelisco'` quer dizer que sair pela porta de cima leva ali, e o
 * jogo entra pela porta oposta. `locked` é o portão selado da seção 7 do DESIGN:
 * ele só abre com N almas.
 */

const LADOS = { norte: 'sul', sul: 'norte', leste: 'oeste', oeste: 'leste' }

/** O lado oposto, que é por onde se entra na sala de destino. */
export function oposto(lado) {
  return LADOS[lado]
}

/**
 * Gera uma sala retangular ou octogonal com muralha de espessura constante, e
 * abre uma passagem de `doorSpan` tiles no meio de cada lado que tem saída.
 *
 * Devolve também `floor` (a caixa do chão em px) e `doors` (onde cada passagem
 * ficou), que são o que a câmera, os espelhos e a troca de sala precisam.
 */
export function buildArena({
  cols,
  rows,
  inset,
  chamfer,
  wallThick,
  geyserTiles = [],
  outside = 3,
  exits = {},
  doorSpan = 3,
}) {
  const x0 = inset
  const x1 = cols - 1 - inset
  const y0 = inset
  const y1 = rows - 1 - inset
  const dentro = (c, r) => {
    if (c < x0 || c > x1 || r < y0 || r > y1) return false
    // Corta os quatro cantos: é o que tira a leitura de caixa.
    return Math.min(c - x0, x1 - c) + Math.min(r - y0, y1 - r) >= chamfer
  }
  const pertoDoChao = (c, r) => {
    for (let dr = -wallThick; dr <= wallThick; dr++) {
      for (let dc = -wallThick; dc <= wallThick; dc++) {
        if (dentro(c + dc, r + dr)) return true
      }
    }
    return false
  }

  const grid = []
  for (let r = 0; r < rows; r++) {
    const linha = []
    for (let c = 0; c < cols; c++) linha.push(dentro(c, r) ? 0 : pertoDoChao(c, r) ? 1 : outside)
    grid.push(linha)
  }

  // Passagens: um corredor do chão até a borda da sala, no meio de cada lado com
  // saída. A porta em si fica na boca do corredor, encostada no chão.
  const meiaC = Math.floor((x0 + x1) / 2)
  const meiaR = Math.floor((y0 + y1) / 2)
  const metade = Math.floor(doorSpan / 2)
  const doors = {}

  for (const lado of Object.keys(exits)) {
    const tiles = []
    if (lado === 'norte' || lado === 'sul') {
      const rIni = lado === 'norte' ? 0 : y1 + 1
      const rFim = lado === 'norte' ? y0 - 1 : rows - 1
      for (let c = meiaC - metade; c <= meiaC + metade; c++) {
        for (let r = rIni; r <= rFim; r++) grid[r][c] = 0
        tiles.push([c, lado === 'norte' ? y0 : y1])
      }
    } else {
      const cIni = lado === 'oeste' ? 0 : x1 + 1
      const cFim = lado === 'oeste' ? x0 - 1 : cols - 1
      for (let r = meiaR - metade; r <= meiaR + metade; r++) {
        for (let c = cIni; c <= cFim; c++) grid[r][c] = 0
        tiles.push([lado === 'oeste' ? x0 : x1, r])
      }
    }
    doors[lado] = tiles
  }

  const geysers = geyserTiles
    .filter(([c, r]) => grid[r]?.[c] === 0)
    .map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }))

  return {
    grid,
    geysers,
    doors,
    width: cols * TILE,
    height: rows * TILE,
    // Caixa do chão em px. Espelho e câmera precisam disso; deduzir de `inset`
    // espalhado pelo código já deu errado uma vez.
    floor: { x0: x0 * TILE, y0: y0 * TILE, x1: (x1 + 1) * TILE, y1: (y1 + 1) * TILE },
  }
}

// Sala de teste: 30 x 20 tiles, borda mais um bloco em (8..11, 2..4). O bloco
// existe só para exercitar parede no meio do caminho. Usada só por game.test.js.
const TEST = [
  '##############################',
  '#............................#',
  '#.......####.................#',
  '#.......####.................#',
  '#.......####.................#',
  ...Array.from({ length: 14 }, () => '#' + '.'.repeat(28) + '#'),
  '##############################',
]

function build(ascii) {
  const grid = ascii.map((row) => [...row].map((c) => (c === '.' ? 0 : c === '~' ? 3 : 1)))
  return {
    grid,
    geysers: [],
    doors: {},
    width: ascii[0].length * TILE,
    height: ascii.length * TILE,
    floor: { x0: TILE, y0: TILE, x1: (ascii[0].length - 1) * TILE, y1: (ascii.length - 1) * TILE },
  }
}

export const testRoom = { ...build(TEST), id: 'teste', spawn: { x: TILE * 2.5, y: TILE * 10.5 } }

// --- O mundo ---------------------------------------------------------------
// Cinco salas: o obelisco no meio, três arenas e um portão selado. Pequeno de
// propósito — é o bastante para o grafo, a câmera com scroll, o portão de almas
// e o save existirem de verdade, e cada sala nova depois é só mais um objeto.

const ARENA_MONOLITO = {
  cols: 30,
  rows: 20,
  inset: 3,
  chamfer: 4,
  wallThick: 2,
  // Espalhados sem simetria óbvia: alinhamento fácil demais tira a graça de
  // acender a flecha.
  geyserTiles: [
    [7, 5], [18, 4], [23, 7], [5, 10], [13, 7],
    [21, 12], [9, 14], [24, 11], [17, 15], [11, 4],
    [20, 9], [6, 13], [15, 10],
  ],
  // A câmara é o meio do caminho: a saída do fundo leva ao Crisol, mais para
  // dentro do vulcão.
  exits: { leste: 'obelisco', oeste: 'crisol' },
}

// O Crisol precisa de chão para perder: a arena é limpa, sem gêiser nenhum, e o
// que a preenche é o que ele mesmo derrama.
const ARENA_CRISOL = {
  cols: 30,
  rows: 20,
  inset: 3,
  chamfer: 4,
  wallThick: 2,
  exits: { leste: 'piramide' },
}

const ARENA_SINO = { cols: 30, rows: 20, inset: 3, chamfer: 4, wallThick: 2, exits: { sul: 'obelisco' } }

const ARENA_SENTINELA = {
  cols: 30,
  rows: 20,
  inset: 3,
  chamfer: 0,
  wallThick: 3,
  outside: 1,
  exits: { oeste: 'portao' },
}

// O obelisco é maior que a tela de propósito: é onde a câmera com scroll da
// seção 2.5 do DESIGN aparece. 44 x 28 tiles = 1056 x 672.
const SALA_OBELISCO = {
  cols: 44,
  rows: 28,
  inset: 4,
  chamfer: 6,
  wallThick: 2,
  outside: 1,
  exits: { oeste: 'piramide', norte: 'sino', leste: 'portao' },
}

const SALA_PORTAO = {
  cols: 30,
  rows: 20,
  inset: 5,
  chamfer: 2,
  wallThick: 2,
  outside: 1,
  exits: { oeste: 'obelisco', leste: 'sentinela' },
}

/** Centro do chão de uma sala, que é o ponto de partida padrão. */
const centro = (r) => ({ x: (r.floor.x0 + r.floor.x1) / 2, y: (r.floor.y0 + r.floor.y1) / 2 })

const monolito = {
  ...buildArena(ARENA_MONOLITO),
  id: 'piramide',
  theme: 'fogo',
  boss: 'piramide',
  // Longe de qualquer gêiser: nascer em cima de um matava o jogador em loop, e
  // como a simulação para no hitstop, o chefe congelava junto. Ver game.test.js.
  spawn: { x: 15 * TILE + 12, y: 13 * TILE + 12 },
  bossSpawn: { x: 15 * TILE + 12, y: 6 * TILE + 12 },
  exits: ARENA_MONOLITO.exits,
}

const sino = {
  ...buildArena(ARENA_SINO),
  id: 'sino',
  theme: 'campanario',
  boss: 'sino',
  // Os outros sinos da câmara, apagados, pendurados fora da linha de varredura —
  // encostar neles não faz nada, eles estão no ar. Bem menores que o chefe: perto
  // do tamanho dele, competiam com ele pela atenção.
  // Todos do mesmo tamanho de propósito: quando o Coro acorda eles trocam de
  // lugar, e tamanho diferente seria etiqueta em cima de cada um.
  hangingBells: [
    [168, 128],
    [360, 106],
    [556, 130],
    [110, 248],
    [612, 242],
    [196, 370],
    [524, 372],
  ],
  spawn: { x: 15 * TILE, y: 15 * TILE },
  bossSpawn: { x: 15 * TILE, y: 10 * TILE },
  exits: ARENA_SINO.exits,
}

const crisol = {
  ...buildArena(ARENA_CRISOL),
  id: 'crisol',
  theme: 'fogo',
  boss: 'crisol',
  spawn: { x: 22 * TILE, y: 15 * TILE },
  bossSpawn: { x: 15 * TILE, y: 10 * TILE },
  exits: ARENA_CRISOL.exits,
}

const sentinela = {
  ...buildArena(ARENA_SENTINELA),
  id: 'sentinela',
  theme: 'fortaleza',
  boss: 'sentinela',
  spawn: { x: 7 * TILE, y: 15 * TILE },
  bossSpawn: { x: 15 * TILE, y: 9 * TILE },
  exits: ARENA_SENTINELA.exits,
}

const obelisco = (() => {
  const base = buildArena(SALA_OBELISCO)
  return {
    ...base,
    id: 'obelisco',
    theme: 'campanario',
    boss: null,
    // Uns passos abaixo do obelisco: nascer em cima dele escondia o jogador
    // dentro da pedra.
    spawn: { x: centro(base).x, y: centro(base).y + TILE * 3 },
    obelisk: centro(base),
    exits: SALA_OBELISCO.exits,
  }
})()

const portao = (() => {
  const base = buildArena(SALA_PORTAO)
  return {
    ...base,
    id: 'portao',
    theme: 'fortaleza',
    boss: null,
    spawn: centro(base),
    // O portão para a Sentinela só abre com duas almas. É o único lugar do mundo
    // que obriga a ordem.
    locked: { leste: 2 },
    exits: SALA_PORTAO.exits,
  }
})()

export const ROOMS = {
  piramide: monolito,
  crisol,
  sino,
  sentinela,
  obelisco,
  portao,
}

export const ROOM_INICIAL = 'obelisco'

/** Todas as salas com chefe, na ordem em que aparecem no mundo. */
export const BOSS_ROOMS = Object.values(ROOMS)
  .filter((r) => r.boss)
  .map((r) => r.id)

// Nomes antigos, usados pelos testes e pelos endereços diretos de luta.
export const monolitoRoom = monolito
export const sinoRoom = sino
export const sentinelaRoom = sentinela
export const crisolRoom = crisol
