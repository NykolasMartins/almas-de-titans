import { mixColor } from './draw.js'

/**
 * A paleta mestra. **Toda cor do jogo nasce aqui**, e cada área é uma fatia
 * desta paleta em vez de um punhado de valores inventados na hora.
 *
 * Duas regras, e elas valem para qualquer área nova:
 *
 * 1. **Pedra, gelo e cinza perdem cor.** Civilização e frio ficam em saturação
 *    baixa (8% a 22%) — é o que faz a sala parecer pedra de verdade em vez de
 *    plástico colorido, e é o que abre espaço para a segunda regra.
 * 2. **O que é quente é a única coisa saturada.** Lava, brasa, rachadura acesa e
 *    núcleo vivem em 70% a 100%. O contraste da tela não é claro contra escuro:
 *    é **morto contra aceso**.
 *
 * Um tema, então, são quatro números: matiz da pedra, saturação da pedra,
 * luminância do chão e da muralha. As diferenças entre chão, sulco, muralha,
 * aresta e treliça são **sempre os mesmos degraus** — é isso que faz três áreas
 * de cores diferentes terem o mesmo peso e a mesma leitura.
 *
 * Para **voltar atrás**: trocar `PALETA` para `'antiga'` devolve exatamente as
 * cores de antes, guardadas em `palette-antiga.js`.
 */
export const PALETA = 'nova'

/** O caminho mais curto de um matiz até outro, em graus com sinal. */
function gira(de, para) {
  let d = (para - de) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

/** HSL para 0xRRGGBB. `h` em graus, `s` e `l` de 0 a 1. */
export function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(Math.max(0, Math.min(1, v)) * 255)
  }
  return (f(0) << 16) | (f(8) << 8) | f(4)
}

/**
 * A família quente, compartilhada por todas as áreas. Fogo é fogo em qualquer
 * lugar do mundo: se cada sala tivesse a sua brasa, nada leria como perigo.
 */
export const BRASA = {
  carvao: hsl(14, 0.55, 0.20),
  brasa: hsl(18, 0.86, 0.42),
  chama: hsl(28, 0.94, 0.56),
  clarao: hsl(44, 0.96, 0.76),
  nucleo: hsl(6, 1.0, 0.64), // a cor mais saturada do jogo, e só o núcleo a usa
}

/** A família de osso: texto, moldura e a flecha. Quente, mas lavada. */
const OSSO = {
  claro: hsl(42, 0.30, 0.86),
  medio: hsl(40, 0.18, 0.58),
  apagado: hsl(40, 0.12, 0.47),
  escuro: hsl(12, 0.22, 0.11),
}

/**
 * Os degraus de um tema, em luminância relativa ao chão e à muralha. Mexer aqui
 * mexe nas três áreas de uma vez — que é exatamente o ponto.
 */
const DEGRAUS = {
  floorInlay: [+0.075, +0.02],
  floorGroove: [-0.085, 0],
  floorPanel: [+0.042, +0.01],
  floorSpeck: [-0.04, 0],
  floorStainDark: [-0.105, -0.03],
  floorStainLight: [+0.115, -0.01],
  floorCrack: [-0.13, +0.02],
  rubble: [+0.15, -0.02],
  dust: [+0.30, -0.05],
}

const DEGRAUS_MURALHA = {
  wallTop: [+0.135, -0.02],
  wallStripe: [-0.10, +0.01],
  wallTrim: [-0.17, +0.02],
  wallFoot: [-0.33, +0.03],
}

/**
 * Um tema de terreno.
 *
 * `h`/`s` são a pedra da área; `chao` e `muralha` são as duas luminâncias de
 * base. `brasa` é o quanto de calor a aresta acesa da muralha puxa, `calor` é a
 * força do mar de lava lá fora, e `brilho` é o quanto a superfície é polida.
 *
 * **A cor não é a mesma tinta mais clara ou mais escura.** Cada degrau anda na
 * temperatura junto com a luminância: o que está na sombra puxa para o frio e
 * **ganha** saturação, o que está na luz puxa para o quente e **perde**. É isso
 * que separa pedra pintada de pedra cinzenta — e é de graça, porque sai do
 * mesmo degrau que já existia.
 */
export function tema({
  h,
  s,
  chao,
  muralha,
  sombraAlvo = 250, // o azul-violeta para onde toda sombra caminha
  luzAlvo = 45, // o amarelo para onde a luz caminha (ou o céu, numa sala fria)
  sombraForca = 0.38,
  luzForca = 0.34,
  brasa = 0,
  calor = 1,
  brilho = 0,
  ...resto
}) {
  const lMin = chao - 0.12
  const lMax = muralha + 0.32 + brilho
  const pedra = (l, ds = 0) => {
    const lc = Math.max(0, Math.min(1, l))
    const k = Math.max(0, Math.min(1, (lc - lMin) / (lMax - lMin)))
    // Sombra fria e saturada, luz quente e lavada, meio-tom no matiz da área.
    const hh = h + gira(h, sombraAlvo) * sombraForca * (1 - k) ** 2 + gira(h, luzAlvo) * luzForca * k ** 2
    const ss = s * (1 + 0.55 * (1 - k) - 0.5 * k) + ds
    return hsl(hh, Math.max(0, ss), lc)
  }
  const c = (dl, ds = 0) => pedra(chao + dl, ds)
  const m = (dl, ds = 0) => pedra(muralha + dl, ds)

  const t = { floor: c(0), wall: m(0) }
  for (const [k, [dl, ds]] of Object.entries(DEGRAUS)) t[k] = c(dl, ds)
  for (const [k, [dl, ds]] of Object.entries(DEGRAUS_MURALHA)) t[k] = m(dl, ds)

  // Aresta e treliça são onde a luz bate: elas puxam para o calor da área, e é
  // esse puxão que diz se a sala é quente ou fria antes de qualquer outra coisa.
  // `brilho` é o quanto a superfície é polida: chapa devolve luz, rocha não.
  t.wallCap = mixColor(m(+0.235 + brilho, -0.04), BRASA.clarao, brasa)
  t.wallLattice = mixColor(m(+0.30 + brilho, -0.06), BRASA.chama, brasa * 0.45)

  t.lavaOuter = mixColor(c(-0.06), hsl(12, 0.82, 0.40), calor)
  t.lavaOuterMid = mixColor(c(-0.02), hsl(24, 0.90, 0.52), calor)
  t.lavaOuterHot = mixColor(c(+0.06), hsl(40, 0.96, 0.72), calor)
  t.lavaGlow = mixColor(c(0), hsl(20, 0.95, 0.54), calor)

  // `calor` sai junto: ele decide a lava lá fora **e o fundo sonoro da área**,
  // e quem lê o tema não tem como adivinhar um número que ficou no parâmetro.
  return { ...t, calor, ...resto }
}

/**
 * As três áreas.
 *
 * Elas não são três paletas: são a mesma estrutura com três matizes. A quente é
 * a única que deixa a pedra subir de saturação, e mesmo assim pouco — quem
 * carrega a cor é a lava.
 */
export const THEMES_NOVOS = {
  // **Câmara vulcânica: sala escura com a borda pegando fogo.** A rocha é a
  // parte morta — quem ilumina é o mar lá fora, e por isso o chão desce bem
  // abaixo do que estava. O contraste da sala inteira é a lava contra a pedra.
  fogo: tema({ h: 12, s: 0.20, chao: 0.15, muralha: 0.43, brasa: 0.45, calor: 1 }),

  // **Campanário: a sala clara.** A mesma região com o fogo já apagado, e o
  // oposto da câmara em tudo — pedra pálida e chapada, quase sem cor, onde os
  // sinos pretos se recortam. A lava lá fora é só crosta.
  campanario: tema({
    h: 272,
    s: 0.075,
    chao: 0.34,
    muralha: 0.50,
    brasa: 0.14,
    calor: 0.6,
    motif: 'anel',
  }),

  // Fortaleza: região fria, chapa polida, sem lava nenhuma. A aresta acesa aqui
  // não puxa brasa — puxa céu.
  fortaleza: tema({
    // **Fortaleza: o contraste de volta, mas frio.** Chão fundo e chapa clara,
    // que é o que faz o salão parecer aço em vez de pedra pintada de azul.
    h: 212,
    s: 0.19,
    chao: 0.205,
    muralha: 0.52,
    // Aqui a luz não é sol: é céu frio entrando pela chapa polida.
    luzAlvo: 196,
    brasa: 0,
    // Chapa polida devolve luz: a aresta dela é a mais clara das três áreas.
    brilho: 0.13,
    calor: 0.12,
    wallMotif: 'espelho',
    mirrorWalls: true,
  }),
}

/**
 * As cores que não são terreno. Mesmas duas regras: corpo e metal perdem cor,
 * fogo e núcleo ficam com ela toda.
 */
export const COLOR_NOVO = {
  bg: hsl(350, 0.30, 0.055),
  vignette: hsl(348, 0.42, 0.06),

  arrow: OSSO.claro,
  arrowBurning: hsl(32, 0.95, 0.62),
  flameCore: hsl(46, 0.96, 0.84),
  flameMid: BRASA.chama,
  flameEdge: hsl(12, 0.80, 0.46),
  cord: hsl(258, 0.22, 0.60),
  soul: 0xffffff,

  // Interface: osso e brasa. A mesma família da região de fogo, sem competir
  // com o vermelho do núcleo.
  uiInk: OSSO.claro,
  uiDim: OSSO.apagado,
  uiAccent: hsl(32, 0.85, 0.62),
  uiFrame: OSSO.medio,
  uiPlate: OSSO.escuro,
  ash: hsl(300, 0.07, 0.78), // cinza no ar, no campanário

  // Bronze do Sino: metal quente, mas metal — saturação de liga, não de fogo.
  bell: hsl(26, 0.32, 0.34),
  bellLight: hsl(34, 0.38, 0.50),
  bellDark: hsl(20, 0.36, 0.15),
  bellLip: hsl(38, 0.44, 0.68),
  chain: hsl(22, 0.17, 0.34),
  // Silhueta contra o chão claro do campanário: a 0,36 eles sumiam nele.
  bellDead: hsl(282, 0.09, 0.25),

  // A Sentinela. O feixe é frio de propósito: o único ponto quente da sala tem
  // que continuar sendo o núcleo.
  mirror: hsl(200, 0.38, 0.87),
  mirrorDim: hsl(210, 0.10, 0.50), // embaçado, enquanto ela está cega
  sentinelStone: hsl(214, 0.17, 0.26),
  sentinelEdge: hsl(208, 0.24, 0.64),
  beamCold: hsl(198, 0.92, 0.72),
  beamHot: hsl(190, 0.88, 0.94),
  shellPlate: hsl(214, 0.19, 0.19),
  shellSeam: hsl(216, 0.24, 0.11),

  obsidian: hsl(268, 0.17, 0.12),
  obsidianEdge: hsl(266, 0.27, 0.33),
  crack: hsl(18, 0.70, 0.46),
  heat: hsl(30, 0.98, 0.60),
  shadow: 0x000000,
  shard: hsl(268, 0.33, 0.74),
  geyserDormant: hsl(12, 0.34, 0.16),
  geyserWarn: hsl(22, 0.74, 0.42),
  geyserErupt: hsl(30, 0.98, 0.58),
  jetWarn: hsl(16, 0.62, 0.28),
  core: BRASA.nucleo, // única cor saturada do jogo
  coreDead: hsl(280, 0.09, 0.27),
}

/** Pedra clara, para o que é repintado no carregamento (as folhas do Sino). */
export const PEDRA_CLARA = hsl(40, 0.13, 0.83)
/** Pedra adormecida: o titã antes do primeiro tiro. */
export const PEDRA_MORTA = hsl(258, 0.07, 0.63)
/** Obsidiana, nas duas luminâncias que a pirâmide usa. */
export const OBSIDIANA = { escura: 0x000000, clara: hsl(264, 0.14, 0.11) }
/** Reflexo na chapa polida da fortaleza. */
export const REFLEXO = hsl(208, 0.25, 0.76)
