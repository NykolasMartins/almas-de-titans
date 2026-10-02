/**
 * Fonte de bitmap 5x7, desenhada com `fillRect`. Existe porque menu é texto e o
 * jogo não tem fonte de bitmap nenhuma — e texto do Phaser com fonte do sistema
 * não é pixel art, ele borra em qualquer escala inteira.
 *
 * Acentuação não tem glifo próprio: a letra base é desenhada e a marca vai duas
 * linhas acima. Sai mais barato que dobrar a tabela, e é o que a caixa alta
 * portuguesa precisa.
 */
const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['#..#.', '#..#.', '#..#.', '#####', '...#.', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  "'": ['.##..', '.##..', '.#...', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '·': ['.....', '.....', '.....', '.##..', '.##..', '.....', '.....'],
}

/** Cedilha tem glifo próprio: a cauda desce abaixo da linha de base. */
const CEDILHA = ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.']
const CAUDA = ['..#..', '.##..']

/** Acentos, desenhados duas linhas acima da letra. */
const MARCAS = {
  agudo: ['...#.', '..#..'],
  circunflexo: ['..#..', '.#.#.'],
  til: ['.##.#', '#..##'],
  grave: ['.#...', '..#..'],
}

const ACENTUADAS = {
  Á: ['A', 'agudo'],
  É: ['E', 'agudo'],
  Í: ['I', 'agudo'],
  Ó: ['O', 'agudo'],
  Ú: ['U', 'agudo'],
  Â: ['A', 'circunflexo'],
  Ê: ['E', 'circunflexo'],
  Ô: ['O', 'circunflexo'],
  Ã: ['A', 'til'],
  Õ: ['O', 'til'],
  À: ['A', 'grave'],
}

export const GLYPH_W = 5
export const GLYPH_H = 7
const ESPACO = 1 // colunas entre letras, antes da escala

/** Largura em px de um texto nesta escala, incluindo os espaços entre letras. */
export function textWidth(txt, escala = 1) {
  const n = txt.length
  return n === 0 ? 0 : (n * (GLYPH_W + ESPACO) - ESPACO) * escala
}

/**
 * Desenha texto em caixa alta. `align` aceita 'left' | 'center' | 'right'.
 * Devolve a largura desenhada, que é o que quase todo layout precisa depois.
 */
export function drawText(g, txt, x, y, opts = {}) {
  const { scale = 1, color = 0xffffff, alpha = 1, align = 'left' } = opts
  const texto = String(txt).toUpperCase()
  const larg = textWidth(texto, scale)
  let cx = align === 'center' ? Math.round(x - larg / 2) : align === 'right' ? Math.round(x - larg) : Math.round(x)

  g.fillStyle(color, alpha)
  for (const ch of texto) {
    const acento = ACENTUADAS[ch]
    const base = acento ? G[acento[0]] : ch === 'Ç' ? CEDILHA : G[ch]
    if (base) {
      desenha(g, base, cx, Math.round(y), scale)
      if (acento) desenha(g, MARCAS[acento[1]], cx, Math.round(y) - 2 * scale, scale)
      if (ch === 'Ç') desenha(g, CAUDA, cx, Math.round(y) + GLYPH_H * scale, scale)
    }
    cx += (GLYPH_W + ESPACO) * scale
  }
  return larg
}

function desenha(g, linhas, x, y, escala) {
  for (let r = 0; r < linhas.length; r++) {
    const linha = linhas[r]
    let c = 0
    while (c < linha.length) {
      if (linha[c] !== '#') {
        c++
        continue
      }
      // Junta pixels vizinhos numa barra só: menos chamadas de desenho.
      let fim = c
      while (fim + 1 < linha.length && linha[fim + 1] === '#') fim++
      g.fillRect(x + c * escala, y + r * escala, (fim - c + 1) * escala, escala)
      c = fim + 1
    }
  }
}
