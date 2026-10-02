import { opcoes } from './options.js'

/**
 * Som, **sintetizado em código**.
 *
 * Nenhum arquivo de áudio e nenhuma biblioteca: cada som é uma receita de
 * osciladores e ruído montada na hora pelo Web Audio. É a mesma escolha da
 * `ui/font.js`, que é uma fonte desenhada com `fillRect` em vez de um `.ttf`:
 * **o que não tem asset é feito em código**, e no dia em que houver `.ogg` a
 * troca acontece aqui dentro, sem tocar em quem chama.
 *
 * O vocabulário é curto de propósito e sai do que a sala é: **pedra, bronze e
 * fogo**. Tudo que bate tem um estalo curto de ruído filtrado (a pedra) e um
 * tom que desce (a massa); o que é fogo é ruído passa-alta sem tom nenhum; e o
 * que é titã é sempre uma oitava abaixo do que o jogador faz.
 *
 * Três regras que o navegador impõe e este arquivo respeita:
 *
 * 1. **Contexto só nasce num gesto.** Autoplay é bloqueado, então `destrava()`
 *    é chamado no primeiro toque de tecla ou clique, e antes disso `toca()` não
 *    faz nada em vez de estourar.
 * 2. **Um som por vez por nome.** A lava pinga dez vezes por segundo; sem o
 *    intervalo mínimo por som ela vira metralhadora.
 * 3. **Teto de vozes.** Com o chefe derramando e a flecha voltando dá para
 *    empilhar dezenas de nós por segundo, e o Web Audio não limpa sozinho.
 *
 * ponytail: teto assumido — só disparos curtos. Ambiente contínuo (o ronco da
 * lava na câmara) pede laço com pausa junto da cena, e entra quando a sala
 * precisar de fundo, não agora.
 */

let ctx = null
let master = null
let ruidoBuf = null
let vozes = 0
const ultimo = new Map()

/** Nasce no primeiro gesto do jogador: antes disso o navegador recusa. */
export function destrava() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    return null // sem áudio disponível: o jogo continua mudo
  }
  master = ctx.createGain()
  master.connect(ctx.destination)

  // Um segundo de ruído branco, criado uma vez e relido por todo estalo.
  ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const dados = ruidoBuf.getChannelData(0)
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
  // A sala já estava aberta antes do primeiro gesto: o fundo que ela pediu
  // entra agora, e não só quando ela trocar.
  if (pedido) ambiente(pedido)
  return ctx
}

/** Liga o primeiro gesto ao contexto. Chamado uma vez, na abertura do jogo. */
export function ouvirPrimeiroGesto() {
  if (typeof window === 'undefined') return
  const uma = () => {
    destrava()
    window.removeEventListener('keydown', uma)
    window.removeEventListener('pointerdown', uma)
  }
  window.addEventListener('keydown', uma)
  window.addEventListener('pointerdown', uma)
}

/**
 * Folga antes de tocar. Agendar em `currentTime` cravado perde o começo quando
 * a thread de áudio está atrás — e o primeiro som da sessão, logo depois de o
 * contexto nascer, saía mudo por isso. 8 ms ninguém percebe, e resolve.
 */
const FOLGA = 0.008

function fim(no, quando) {
  vozes++
  no.onended = () => {
    vozes--
  }
  no.stop(quando)
}

/**
 * Um tom com envelope. `de`/`para` em Hz: tudo neste jogo desce, porque som que
 * sobe lê como recompensa e aqui quase tudo é impacto.
 */
function tom({ de, para = de, tipo = 'sine', dur = 0.12, vol = 0.3, atraso = 0 }) {
  const t0 = ctx.currentTime + atraso + FOLGA
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(de, t0)
  if (para !== de) osc.frequency.exponentialRampToValueAtTime(Math.max(1, para), t0 + dur)
  // Ataque de 4 ms: instantâneo estala no alto-falante, e 4 ms ainda lê como seco.
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(master)
  osc.start(t0)
  fim(osc, t0 + dur + 0.02)
}

/** Estalo: ruído filtrado. É a pedra, o raspão e o chiado da lava. */
function ruido({ corte = 1200, corte2 = corte, q = 1, tipo = 'bandpass', dur = 0.1, vol = 0.3, atraso = 0 }) {
  const t0 = ctx.currentTime + atraso + FOLGA
  const src = ctx.createBufferSource()
  src.buffer = ruidoBuf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = tipo
  f.Q.value = q
  f.frequency.setValueAtTime(corte, t0)
  if (corte2 !== corte) f.frequency.exponentialRampToValueAtTime(Math.max(20, corte2), t0 + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t0, Math.random() * 0.5)
  fim(src, t0 + dur + 0.02)
}

/**
 * As receitas.
 *
 * Cada uma é o som **e o intervalo mínimo entre repetições dela**, que é o que
 * impede a chuva de lava de virar metralhadora.
 *
 * A mixagem foi medida com um analisador pendurado na saída, não estimada no
 * olho — filtro come volume de um jeito que não dá para adivinhar: o raspão do
 * rolamento pedia `vol` quase três vezes maior que o do estalo na pedra para
 * chegar ao mesmo lugar. Os picos, em amplitude de saída:
 *
 *     núcleo e morte  0,30   o que decide a luta
 *     titã caindo     0,23
 *     rugido          0,22
 *     corpo           0,21
 *     acorda          0,17
 *     tiro            0,16   o verbo central
 *     pedra           0,14
 *     brasa, reflete  0,12
 *     vínculo         0,10
 *     respingo        0,08   repete muito: fica embaixo de propósito
 *     rolar           0,07
 *     menu            0,05
 */
const SONS = {
  // Arco: a corda solta (ruído curto e agudo) e a flecha saindo (tom que desce).
  tiro: {
    espera: 40,
    toca: (f = 1) => {
      ruido({ corte: 2600, corte2: 900, dur: 0.07, vol: 0.3 * f, q: 0.8 })
      tom({ de: 520, para: 190, tipo: 'triangle', dur: 0.1, vol: 0.18 * f })
    },
  },
  // Flecha na pedra: estalo seco e um toc grave por baixo.
  pedra: {
    espera: 30,
    toca: (f = 1) => {
      ruido({ corte: 1800, corte2: 400, dur: 0.09, vol: 0.22 * f, q: 0.7 })
      tom({ de: 160, para: 70, tipo: 'triangle', dur: 0.09, vol: 0.14 * f })
    },
  },
  // Corpo do titã: a mesma pancada uma oitava abaixo e com mais cauda.
  corpo: {
    espera: 30,
    toca: (f = 1) => {
      ruido({ corte: 900, corte2: 220, dur: 0.13, vol: 0.24 * f, q: 0.6 })
      tom({ de: 110, para: 44, tipo: 'sine', dur: 0.22, vol: 0.24 * f })
    },
  },
  // Núcleo: o acerto que importa. Estala claro em cima e retumba embaixo.
  nucleo: {
    espera: 40,
    toca: (f = 1) => {
      ruido({ corte: 3200, corte2: 800, dur: 0.12, vol: 0.26 * f, q: 1.4 })
      tom({ de: 880, para: 220, tipo: 'square', dur: 0.16, vol: 0.14 * f })
      tom({ de: 90, para: 38, tipo: 'sine', dur: 0.5, vol: 0.3 * f })
    },
  },
  // Espelho: a flecha volta. Agudo e metálico, para não se confundir com acerto.
  reflete: {
    espera: 40,
    toca: (f = 1) => {
      tom({ de: 1400, para: 2100, tipo: 'square', dur: 0.07, vol: 0.09 * f })
      tom({ de: 2100, para: 900, tipo: 'sine', dur: 0.12, vol: 0.08 * f })
    },
  },
  // Rolar: raspão de pano e pó no chão.
  rolar: {
    espera: 120,
    toca: (f = 1) => ruido({ corte: 700, corte2: 1600, dur: 0.16, vol: 0.15 * f, q: 0.5, tipo: 'lowpass' }),
  },
  // Vínculo: a corda puxando. Sobe, porque é a única coisa aqui que é ganho.
  vinculo: {
    espera: 200,
    toca: (f = 1) => {
      tom({ de: 180, para: 520, tipo: 'sawtooth', dur: 0.18, vol: 0.14 * f })
      ruido({ corte: 400, corte2: 2200, dur: 0.2, vol: 0.16 * f, q: 0.6 })
    },
  },
  // Fogo pegando na flecha.
  brasa: {
    espera: 150,
    toca: (f = 1) => ruido({ corte: 3000, corte2: 5000, dur: 0.3, vol: 0.12 * f, q: 0.4, tipo: 'highpass' }),
  },
  // Lava caindo no chão: chiado curto, sem tom. É o som que mais repete.
  respingo: {
    espera: 70,
    toca: (f = 1) => ruido({ corte: 2200, corte2: 4200, dur: 0.12, vol: 0.1 * f, q: 0.5, tipo: 'highpass' }),
  },
  // O titã se levantando: ronco longo por baixo de tudo.
  acorda: {
    espera: 400,
    toca: (f = 1) => {
      tom({ de: 60, para: 42, tipo: 'sine', dur: 1.4, vol: 0.26 * f })
      ruido({ corte: 200, corte2: 90, dur: 1.2, vol: 0.14 * f, q: 0.4, tipo: 'lowpass' })
    },
  },
  // O grito. É o som mais alto do jogo, e é uma vez por luta.
  rugido: {
    espera: 400,
    toca: (f = 1) => {
      tom({ de: 150, para: 48, tipo: 'sawtooth', dur: 0.9, vol: 0.2 * f })
      tom({ de: 74, para: 36, tipo: 'square', dur: 1.1, vol: 0.16 * f })
      ruido({ corte: 600, corte2: 120, dur: 1, vol: 0.16 * f, q: 0.5, tipo: 'lowpass' })
    },
  },
  // Titã caindo: o estouro, e a alma subindo em seguida.
  titaCai: {
    espera: 500,
    toca: (f = 1) => {
      ruido({ corte: 700, corte2: 80, dur: 0.9, vol: 0.3 * f, q: 0.4, tipo: 'lowpass' })
      tom({ de: 120, para: 30, tipo: 'sine', dur: 1.2, vol: 0.3 * f })
      tom({ de: 300, para: 900, tipo: 'sine', dur: 0.9, vol: 0.07 * f, atraso: 0.55 })
    },
  },
  // Morrer. Desce e apaga — nenhum estalo, porque não houve impacto nenhum: o
  // chão é que estava quente.
  morte: {
    espera: 500,
    toca: (f = 1) => {
      tom({ de: 420, para: 55, tipo: 'triangle', dur: 0.8, vol: 0.22 * f })
      tom({ de: 70, para: 34, tipo: 'sine', dur: 1.1, vol: 0.2 * f })
    },
  },
  // Obelisco: o vínculo guardado. A única coisa do jogo que soa como alívio.
  vinculoGuardado: {
    espera: 300,
    toca: (f = 1) => {
      tom({ de: 523, tipo: 'sine', dur: 0.5, vol: 0.16 * f })
      tom({ de: 784, tipo: 'sine', dur: 0.6, vol: 0.12 * f, atraso: 0.09 })
    },
  },
  // ---- o que o mundo faz sozinho ---------------------------------------

  // Bolha de lava estourando. Sobe de tom porque a bolha **abre**: é a única
  // coisa do jogo que faz isso sem ser recompensa.
  bolha: {
    espera: 60,
    toca: (f = 1) => {
      tom({ de: 90 + Math.random() * 70, para: 260 + Math.random() * 180, tipo: 'sine', dur: 0.1, vol: 0.09 * f })
      ruido({ corte: 500, corte2: 1400, dur: 0.05, vol: 0.03 * f, q: 2, tipo: 'bandpass' })
    },
  },

  // ---- o Sino ------------------------------------------------------------

  /**
   * Bronze. Um sino não é um tom: são parciais **inarmônicas** que batem umas
   * contra as outras, e é essa briga que faz o rolar característico. Três
   * frequências em razões quebradas (1 : 1,51 : 2,66) dão isso com três
   * osciladores; afinar em oitavas daria órgão de igreja, não sino.
   */
  sinoBadala: {
    espera: 60,
    toca: (f = 1) => {
      const base = 190 + Math.random() * 40
      tom({ de: base, para: base * 0.985, tipo: 'sine', dur: 2.2, vol: 0.18 * f })
      tom({ de: base * 1.51, para: base * 1.5, tipo: 'sine', dur: 1.6, vol: 0.11 * f })
      tom({ de: base * 2.66, para: base * 2.63, tipo: 'sine', dur: 0.9, vol: 0.07 * f })
      ruido({ corte: 2400, corte2: 1200, dur: 0.06, vol: 0.1 * f, q: 1.2 })
    },
  },
  // O peso do sino no ar: a corrente rangendo no fim de cada arco.
  balanco: {
    espera: 250,
    toca: (f = 1) => {
      ruido({ corte: 320, corte2: 180, dur: 0.5, vol: 0.1 * f, q: 3, tipo: 'bandpass' })
      tom({ de: 74, para: 58, tipo: 'triangle', dur: 0.45, vol: 0.07 * f })
    },
  },
  // Tonelada de bronze no chão de pedra.
  baque: {
    espera: 120,
    toca: (f = 1) => {
      ruido({ corte: 500, corte2: 90, dur: 0.35, vol: 0.3 * f, q: 0.5, tipo: 'lowpass' })
      tom({ de: 130, para: 45, tipo: 'sine', dur: 0.5, vol: 0.28 * f })
      tom({ de: 260, para: 250, tipo: 'sine', dur: 0.8, vol: 0.08 * f })
    },
  },
  // Corpo grande tombando: o baque mais a rolagem depois dele.
  tomba: {
    espera: 300,
    toca: (f = 1) => {
      ruido({ corte: 600, corte2: 110, dur: 0.5, vol: 0.26 * f, q: 0.5, tipo: 'lowpass' })
      tom({ de: 100, para: 36, tipo: 'triangle', dur: 0.7, vol: 0.24 * f })
      ruido({ corte: 300, corte2: 500, dur: 0.4, vol: 0.1 * f, q: 1, atraso: 0.25 })
    },
  },

  // ---- o Monólito --------------------------------------------------------

  // A pirâmide caindo no chão. O som mais pesado que o jogo tem.
  pousa: {
    espera: 150,
    toca: (f = 1) => {
      ruido({ corte: 800, corte2: 70, dur: 0.5, vol: 0.34 * f, q: 0.4, tipo: 'lowpass' })
      tom({ de: 90, para: 28, tipo: 'sine', dur: 0.7, vol: 0.32 * f })
    },
  },
  // Gêiser: pressão saindo. Ruído subindo, sem tom — é gás, não corpo.
  geiser: {
    espera: 90,
    toca: (f = 1) => ruido({ corte: 400, corte2: 3000, dur: 0.45, vol: 0.16 * f, q: 0.6, tipo: 'bandpass' }),
  },
  // Jato de parede: a mesma pressão, mais curta e mais fina.
  jato: {
    espera: 80,
    toca: (f = 1) => ruido({ corte: 900, corte2: 2600, dur: 0.22, vol: 0.12 * f, q: 0.8, tipo: 'bandpass' }),
  },
  // Pedra rachando, e pedra se partindo.
  racha: {
    espera: 90,
    toca: (f = 1) => {
      ruido({ corte: 2800, corte2: 1400, dur: 0.08, vol: 0.16 * f, q: 2.5 })
      tom({ de: 300, para: 140, tipo: 'square', dur: 0.07, vol: 0.05 * f })
    },
  },
  estilhaca: {
    espera: 200,
    toca: (f = 1) => {
      ruido({ corte: 3400, corte2: 900, dur: 0.35, vol: 0.26 * f, q: 1.2 })
      tom({ de: 200, para: 60, tipo: 'sawtooth', dur: 0.4, vol: 0.16 * f })
      ruido({ corte: 1800, corte2: 2600, dur: 0.3, vol: 0.1 * f, q: 2, atraso: 0.12 })
    },
  },

  // ---- a Sentinela -------------------------------------------------------

  // Carregando: o único som do jogo que **sobe e fica**, porque é ameaça
  // crescendo. Quem ouve isso tem que procurar a linha na tela.
  carrega: {
    espera: 200,
    toca: (f = 1) => {
      tom({ de: 220, para: 760, tipo: 'sawtooth', dur: 0.55, vol: 0.09 * f })
      tom({ de: 440, para: 1520, tipo: 'sine', dur: 0.55, vol: 0.05 * f })
    },
  },
  // O feixe. Curto, seco e brilhante: é luz, não massa.
  feixe: {
    espera: 120,
    toca: (f = 1) => {
      ruido({ corte: 4000, corte2: 1600, dur: 0.25, vol: 0.2 * f, q: 0.8, tipo: 'highpass' })
      tom({ de: 1600, para: 400, tipo: 'sawtooth', dur: 0.2, vol: 0.1 * f })
    },
  },

  // ---- o Crisol ----------------------------------------------------------

  // O jorro começando: borbotão grosso saindo do lábio.
  jorro: {
    espera: 400,
    toca: (f = 1) => {
      ruido({ corte: 700, corte2: 1800, dur: 0.7, vol: 0.16 * f, q: 0.5, tipo: 'lowpass' })
      tom({ de: 120, para: 200, tipo: 'triangle', dur: 0.5, vol: 0.07 * f })
    },
  },
  // Bebendo: o contrário do jorro, e é assim que se lê — o filtro fecha em vez
  // de abrir, e o tom desce.
  sorve: {
    espera: 400,
    toca: (f = 1) => {
      ruido({ corte: 1800, corte2: 300, dur: 1.2, vol: 0.13 * f, q: 0.6, tipo: 'lowpass' })
      tom({ de: 200, para: 90, tipo: 'sine', dur: 1, vol: 0.06 * f })
    },
  },

  // Menu: mover, escolher e recusar. Curtos, para não cansar em tela de lista.
  cursor: { espera: 30, toca: (f = 1) => tom({ de: 660, para: 620, tipo: 'square', dur: 0.03, vol: 0.05 * f }) },
  escolhe: {
    espera: 30,
    toca: (f = 1) => {
      tom({ de: 520, para: 780, tipo: 'square', dur: 0.06, vol: 0.07 * f })
      ruido({ corte: 2000, corte2: 3000, dur: 0.05, vol: 0.05 * f })
    },
  },
  recusa: { espera: 120, toca: (f = 1) => tom({ de: 220, para: 150, tipo: 'square', dur: 0.12, vol: 0.08 * f }) },
}

/** Teto de vozes: acima disso o pedido é descartado em vez de engasgar. */
const MAX_VOZES = 24

/**
 * Toca um som pelo nome. `forca` de 0 a 1 escala o volume — é por onde o acerto
 * fraco soa mais baixo que o forte sem precisar de outra receita.
 */
export function toca(nome, forca = 1) {
  const som = SONS[nome]
  if (!som || !ctx || !master || opcoes.volume <= 0 || vozes > MAX_VOZES) return false
  const agora = ctx.currentTime * 1000
  if (agora - (ultimo.get(nome) ?? -1e9) < som.espera) return false
  ultimo.set(nome, agora)
  // O volume entra no master na hora de tocar: mudar a opção vale no som
  // seguinte, sem ninguém precisar avisar este módulo.
  master.gain.value = opcoes.volume
  try {
    som.toca(Math.max(0, Math.min(1, forca)))
  } catch {
    return false // contexto morreu no meio: ficar mudo é melhor que quebrar
  }
  return true
}

/**
 * **O fundo da sala.**
 *
 * Um leito contínuo de ruído filtrado, com um oscilador lento mexendo no corte:
 * é o que faz o ruído respirar em vez de chiar. Cada área tem o seu, e trocar de
 * sala dentro da mesma área **não recomeça o leito** — cortar o fundo no meio de
 * um corredor entrega que a sala foi recriada.
 *
 * O borbulhar em si não mora aqui: bolha é evento, e sai como disparo solto de
 * `bolha`, sorteado por quem sabe quanta lava a sala tem.
 */
const AMBIENTES = {
  // Câmara vulcânica: o mar de lava rosnando do outro lado da muralha.
  lava: { corte: 220, q: 0.7, tipo: 'lowpass', vol: 0.16, lfo: 0.13, desvio: 90 },
  // Campanário: o ar alto e a cinza caindo. Fino, quase só sopro.
  cinza: { corte: 1100, q: 0.5, tipo: 'bandpass', vol: 0.07, lfo: 0.09, desvio: 500 },
  // Fortaleza: chapa fria, sala grande e vazia. Um zumbido, e mais nada.
  frio: { corte: 140, q: 1.2, tipo: 'lowpass', vol: 0.09, lfo: 0.05, desvio: 40 },
}

let leito = null // { nome, src, filtro, ganho, lfo, forca, abafado }
// O que a cena pediu, mesmo antes de haver contexto: a sala abre antes do
// primeiro gesto do jogador, e sem isto o fundo só entraria na sala seguinte.
let pedido = null

/**
 * Liga (ou troca) o fundo. Chamar de novo com o mesmo nome não faz nada — é o
 * que deixa a cena chamar isto a cada sala sem cortar o som na travessia.
 */
export function ambiente(nome, forca = 1) {
  pedido = nome
  if (!ctx || !master) return false
  if (leito && leito.nome === nome) {
    ambienteForca(forca)
    return true
  }
  calaAmbiente()
  const a = AMBIENTES[nome]
  if (!a) return false

  const src = ctx.createBufferSource()
  src.buffer = ruidoBuf
  src.loop = true
  const filtro = ctx.createBiquadFilter()
  filtro.type = a.tipo
  filtro.Q.value = a.q
  filtro.frequency.value = a.corte
  const ganho = ctx.createGain()
  ganho.gain.value = 0
  // Entra por cima de 1,2 s: fundo que aparece de uma vez lê como erro.
  ganho.gain.linearRampToValueAtTime(a.vol * forca, ctx.currentTime + 1.2)

  // O oscilador lento é o que separa "fundo vivo" de "chiado de rádio".
  const lfo = ctx.createOscillator()
  const lfoGanho = ctx.createGain()
  lfo.frequency.value = a.lfo
  lfoGanho.gain.value = a.desvio
  lfo.connect(lfoGanho).connect(filtro.frequency)
  lfo.start()

  src.connect(filtro).connect(ganho).connect(master)
  src.start(0, Math.random() * 0.5)
  leito = { nome, src, filtro, ganho, lfo, forca, abafado: false, base: a.vol }
  return true
}

/** Quanta lava a sala tem agora: o fundo cresce com o chão que virou fogo. */
export function ambienteForca(forca) {
  if (!leito || !ctx) return
  leito.forca = forca
  const alvo = leito.base * forca * (leito.abafado ? 0.25 : 1)
  leito.ganho.gain.linearRampToValueAtTime(alvo, ctx.currentTime + 0.3)
  // O volume do menu vale para o fundo também, e ninguém precisa avisar ninguém.
  master.gain.value = opcoes.volume
}

/** Pausa abafa o fundo em vez de cortar: cortar soa como bug, abafar soa como pausa. */
export function ambienteAbafa(abafado) {
  if (!leito || !ctx) return
  leito.abafado = abafado
  leito.ganho.gain.linearRampToValueAtTime(
    leito.base * leito.forca * (abafado ? 0.25 : 1),
    ctx.currentTime + 0.25,
  )
}

export function calaAmbiente() {
  pedido = null
  if (!leito) return
  try {
    leito.ganho.gain.cancelScheduledValues(ctx.currentTime)
    leito.ganho.gain.setValueAtTime(leito.ganho.gain.value, ctx.currentTime)
    leito.ganho.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25)
    leito.src.stop(ctx.currentTime + 0.3)
    leito.lfo.stop(ctx.currentTime + 0.3)
  } catch {
    /* já parado */
  }
  leito = null
}

/** Qual fundo uma área pede. O tema decide, como decide a cor. */
export function fundoDoTema(tema) {
  if (!tema) return null
  // Medido nos temas: fogo 1, campanário 0,6, fortaleza 0,12. Só o primeiro tem
  // mar fervendo do outro lado da muralha — no campanário a lava já é crosta.
  if (tema.calor >= 0.8) return 'lava'
  if (tema.calor > 0.2) return 'cinza'
  return 'frio'
}

/** Os nomes que existem. Serve ao teste e a quem for acrescentar receita. */
export const NOMES = Object.keys(SONS)

/**
 * Que som cada tipo de acerto pede. É tabela, e não um ternário no meio da
 * cena, por dois motivos: o nome do som passa a morar junto das receitas, e o
 * teste consegue conferir que todos existem — nome de som é ligação que nenhum
 * compilador verifica, e um erro de digitação falharia calado.
 */
export const SOM_ACERTO = { core: 'nucleo', reflect: 'reflete', body: 'corpo' }

/**
 * O contexto e a saída, para quem precisar pendurar alguma coisa neles — uma
 * medição ao conferir no navegador, um ambiente contínuo quando houver. Fora
 * disso ninguém aqui de fora mexe: quem toca som chama `toca`.
 */
export const contexto = () => ctx
export const saida = () => master
