import { PALETA, THEMES_NOVOS, COLOR_NOVO, PEDRA_CLARA, PEDRA_MORTA, OBSIDIANA, REFLEXO } from './palette.js'
import { THEMES_ANTIGOS, COLOR_ANTIGO } from './palette-antiga.js'

// Todos os valores ajustáveis do jogo. Nenhum número mágico fora daqui.
// Unidade: pixels internos (480x270) e milissegundos.

// 720x480 (3:2). Regra ao mudar a resolução: **velocidades e distâncias do mundo
// escalam junto; raios presos a sprite, não.** A arte fica na mesma densidade de
// pixel — é a arena que cresce.
export const VIEW = { w: 720, h: 480 }

export const STEP_MS = 1000 / 60
export const STEP = 1 / 60

export const TUNING = {
  walkSpeed: 158, // px/s
  aimSpeed: 57,
  rollSpeed: 428,
  rollDuration: 260, // ms
  // Tiro: a carga define a velocidade inicial.
  // Perda por segundo = -(arrowDrag * v + arrowDragFast * v²), os dois termos do
  // arrasto de ar real. Em função da distância isso vira:
  //   dv/dx = -(arrowDrag + arrowDragFast * v)
  // A perda por segundo é sempre proporcional à velocidade, então ela mesma vai
  // diminuindo conforme a flecha afrouxa: nunca há freada seca, e a desaceleração
  // é progressiva do começo ao fim. O termo quadrático adiciona só um leve peso a
  // mais enquanto está rápida — em 0,0039 ele virava freio de mão (tirava 437 px/s
  // nos primeiros 50 px), por isso está baixo.
  chargeTime: 550, // ms até a carga cheia
  arrowSpeedMin: 780, // toque seco: ~185 px de alcance
  arrowSpeedMax: 2550, // carga cheia: ~570 px, atravessa a sala
  arrowDrag: 2.2, // termo linear em px/s por px: não muda com a escala do mundo
  arrowDragFast: 0.00053, // quadrático: dividido por 1,5 porque multiplica a velocidade
  arrowRestSpeed: 105, // abaixo disso a flecha cai no chão

  // Recall: só vem enquanto você segura, e vai ganhando velocidade. Ao soltar,
  // desacelera e cai — progressivo, não instantâneo.
  recallSpeedMin: 225,
  recallSpeedMax: 930,
  recallAccel: 1650, // px/s^2 enquanto o botão está segurado
  // Bem maior que arrowDrag de propósito: com a curva do voo, soltar planaria
  // ~357 px, quase a sala inteira, e soltar não custaria nada. Assim plana ~143 px:
  // ainda lê como parada progressiva, mas manter o botão continua importando.
  recallDrag: 3.5,

  tetherSpeed: 630,
  tetherStopGap: 9, // para um pouco antes da flecha, não em cima dela
  playerRadius: 9,
  // Altura do arco acima do ponto de colisão, que fica nos pés. A flecha sai
  // daqui e volta para cá; sem isso ela nasce no chão. O corpo do personagem vai
  // de -15,7 a -1,2 px em relação à âncora, então -9 é a altura do peito.
  bowHeight: 9,
  arrowRadius: 3,
  tileSize: 24,
}

/**
 * Travessia de sala. O jogador **continua andando**: ele entra na boca do
 * corredor do outro lado, não no meio da sala, e leva junto o desvio lateral com
 * que saiu. O escurecimento é curto — é para cobrir a troca de cenário, não para
 * marcar um corte.
 */
export const TRAVESSIA = {
  fadeOut: 90, // ms escurecendo antes de trocar
  fadeIn: 150, // ms clareando na sala nova
  entryPad: 1.4, // tiles para dentro da borda; o gatilho de saída está em 0,9
}

/**
 * Suco (fase 7). Tudo cosmético e tudo curto: o que separa impacto de estorvo é
 * a duração. O hitstop é a única coisa daqui que para a simulação, e por isso é
 * medido em quadros, não em décimos.
 */
export const JUICE = {
  // Hitstop. 4 quadros no corpo, 8 no núcleo: o acerto que importa pesa o dobro.
  hitstopBody: 70, // ms
  hitstopCore: 140,
  hitstopReflect: 60, // a flecha devolvida na cara também é um acerto

  // Câmera lenta ao derrubar o titã. Roda **antes** do desfecho, que já tem
  // escuro e zoom próprios: aqui é só o tempo se arrastando no golpe final.
  slowTime: 900, // ms
  slowFactor: 0.3, // fração da velocidade normal no fundo da curva

  // Rastro da flecha. Com carga cheia ela anda 42 px por quadro; sem rastro,
  // some de um lado e aparece do outro.
  trailPoints: 16,
  trailLife: 190, // ms até o ponto mais velho sumir
  trailWidth: 3,

  // Poeira. Achatada de propósito: ela corre no chão, não sobe.
  dustSpeed: 46, // px/s
  dustDrag: 3.4, // por segundo
  dustLife: 420, // ms
  dustSize: 4,
  dustMax: 140, // teto: partícula é enfeite, não pode competir com o jogo

  // Morrer pixeliza a imagem junto com o véu: é o filtro Blocky da v4, e o
  // tamanho do bloco é em pixels internos. Acima de ~12 vira mancha e some a
  // leitura de onde o corpo está.
  deathBlocks: 11,

  rollDustEvery: 55, // ms entre baforadas durante o rolamento
  rollDustN: 2,
  wallDustN: 7, // ao cravar numa parede
  wallDustSpeed: 105,
  wallShakeMs: 90,
  wallShakeAmp: 0.0035,
}

/**
 * Despertar. O titã dorme **acinzentado e no chão**, e a arena com ele: nenhum
 * relógio corre. O primeiro tiro o levanta, a cor volta ao corpo, e ele solta um
 * grito antes de a luta começar de fato — o grito é de cada chefe, e é a view
 * quem o desenha, lendo `scene.wake`.
 */
export const WAKE = {
  rise: 1600, // ms levantando e recuperando a cor
  roar: 1000, // ms de grito
  roarShakeMs: 900,
  roarShakeAmp: 0.011,
  // Pedra adormecida, para quem já é claro o bastante para uma tinta funcionar.
  // Corpo escuro precisa de textura própria — ver `MONOLITO_ART.sleep*`.
  stone: PEDRA_MORTA,
}

/**
 * Morte. **O mundo não para**: chefe, gêiseres e flecha seguem seus relógios, e
 * o que acaba é só a visão — a câmera fecha no corpo enquanto o véu escurece em
 * vermelho. No fim a partida volta ao vínculo, não ao lugar onde morreu.
 */
export const DEATH = {
  time: 1700, // ms de agonia até voltar ao vínculo
  curve: 1.6, // expoente do véu: deixa ver o mundo rodando antes de fechar
  tint: 0x2a0206, // preto avermelhado
  zoom: 0.55, // aproximação no corpo ao fim
  followLerp: 0.08, // a câmera vai até ele, não pula
}

// Suco. Tudo cosmético: roda no delta real do monitor, não no passo fixo.
// O zoom de câmera é fracionário e por isso mexe no alinhamento do pixel art —
// aceitável porque é sutil e passageiro, mas não subir muito.
export const FX = {
  // Filtros de câmera da v4. O glow é fraco de propósito: alto demais ele lava o
  // sprite do jogador junto com a lava.
  // Sem vinheta: ela escurecia justamente a borda onde mora a lava. O brilho vem
  // de halos desenhados em cada emissor, mais um glow de câmera fraco por cima.
  glowOuter: 1.6, // padrão do Phaser é 4, que lava a cena inteira
  bloomLava: 0.34, // halo em volta do mar de lava
  bloomPlume: 0.16, // halo da coluna e dos jatos
  bloomFlame: 0.3, // halo da flecha em brasa
  bloomCrack: 0.55, // brilho das rachaduras quentes, na carga máxima de calor
  bloomCrackSpread: 1.09, // o quanto a cópia aditiva cresce
  bloomHeart: 0.7, // brilho do núcleo exposto
  bloomHeartSpread: 1.5,
  displacementAmount: 0.006,

  recallZoom: 0.07, // zoom extra no puxão máximo
  recallDark: 0.32, // escurecimento máximo da tela
  recallRise: 7, // suavização subindo (por segundo)
  recallFall: 16, // suavização caindo: solta e desfaz rápido

  // Enquanto o arco carrega, não no disparo: zoom e tremor crescem com a carga.
  // Soltar zera a carga, então os dois se desfazem sozinhos e rápido.
  chargeZoom: 0.035,
  // Tremor em pixels, deslocando o scroll da câmera direto. Não dá para usar
  // `camera.shake` aqui: o CameraManager roda ANTES do `scene.update`, então
  // rearmar o efeito a cada quadro zera o offset dele logo antes de renderizar
  // e a câmera nunca sai do lugar.
  chargeShakePx: 2.0, // ao completar a carga
  chargeShakeFatiguePx: 4.0, // extra acumulado por segurar o arco armado
  chargeFatigueTime: 2.2, // s até a fadiga máxima
  chargeRise: 20, // acompanha a carga de perto
  chargeFall: 18, // desfaz rápido ao soltar
}

/**
 * Temas de terreno. Chão e muralha são pintados por `src/terrain.js` a partir
 * daqui, então **área nova troca o tema, não o código de desenho**.
 *
 * As cores em si não moram mais aqui: elas nascem em `src/palette.js`, onde um
 * tema é uma fatia da paleta mestra em vez de um punhado de valores inventados
 * na hora. Trocar `PALETA` lá para `'antiga'` devolve as cores de antes.
 */
export const THEMES = PALETA === 'nova' ? THEMES_NOVOS : THEMES_ANTIGOS

/** Quanto de cada padrão o terreno recebe. Igual para todo tema, por ora. */
export const TERRAIN = {
  stainsBig: 80,
  stainsSmall: 140,
  wornPlates: 16,
  cracks: 34,
  specks: 1100,
  grooveRings: 4,
  seed: 20260909, // fixo: o piso não pode mudar de cara a cada morte
  waveSpeed: 7, // ondulação do mar de lava, rad/s
  motifRings: 5, // anéis do piso no motivo 'anel'

  // Reflexo nas muralhas espelhadas. Profundidade em px: quem está mais longe da
  // parede que isso não aparece nela.
  mirrorDepth: 84,
  mirrorAlpha: 0.44,
  mirrorTint: REFLEXO,
  // Névoa por cima do reflexo, engrossando para dentro da muralha: é o que faz
  // ele **sumir no fundo do espelho** em vez de acabar num corte seco na borda
  // da faixa. Vale para tudo que é refletido de uma vez — corpo, flecha e feixe.
  mirrorFogSteps: 12,
  mirrorFogCurve: 1.25, // expoente: mais alto, some mais tarde e mais rápido
  mirrorFogMax: 0.95,
}

// Monólito de Obsidiana, o primeiro chefe. Três fases encadeadas: queda sísmica
// que derruba gelo sobre ele, choque térmico que estilhaça a armadura, e a janela
// curta no Coração Instável.
export const MONOLITO = {
  bodyRadius: 51, // proporcional à pirâmide desenhada, de ~151 px de base
  coreRadius: 7,

  // Fase 1: flutua, trava a mira, cai. Cada queda racha mais a pirâmide.
  hoverSpeed: 78, // px/s perseguindo o jogador no ar
  aimTime: 900, // ms de mira travada antes de cair
  slamSpeed: 1350, // px/s na descida
  // Quanto mais rachada, mais leve: o tempo caído encolhe conforme ela quebra.
  // Mesmo inteiramente rachada ela ainda dá um respiro maior que antes.
  slamRecoverMax: 3200, // ms sem nenhuma rachadura
  slamRecoverMin: 1800, // ms com todas
  crackSlams: 4, // rachaduras até ficar frágil

  // Frágil: precisa esquentar. Flecha em brasa resolve na hora; lava por baixo
  // leva tempo. O calor esfria sozinho se você não completar.
  heatFromLava: 0.9, // por segundo em cima de um gêiser irrompendo
  heatHold: 8000, // ms segurando o calor antes de começar a esfriar
  heatDecay: 0.35, // por segundo, depois que a retenção acaba
  heatShatter: 1, // acima disso a carapaça cede

  // Fase 2: núcleo exposto por 8 s enquanto ele recolhe os cacos. Depois a
  // armadura se refaz inteira e a luta volta à fase 1 do zero.
  coreWindow: 8000,
  rearmTime: 700,
  exposedSpeed: 51,
  // Ele só começa a recolher depois que a poeira baixa, senão nunca se vê caco
  // parado no chão.
  debrisSettle: 1800, // ms de janela intocada antes do primeiro recolhimento
  debrisGrabEvery: 500, // ms entre um caco e outro serem chamados de volta
  debrisPull: 165, // px/s voltando para o corpo
  jetEvery: 900, // ms entre jatos novos
  jetWarn: 650, // ms de aviso antes do jato sair
  jetActive: 550, // ms de jato ativo
  jetWidth: 18, // faixa letal, constante ao longo do jato
  jetSegments: 22,
  // O desenho afina da parede para o outro lado, mas **nunca fica mais estreito
  // que a faixa letal**: 1,7x na saída até 1,2x na ponta. Assim o jato visível
  // sempre cobre o que mata, mesmo com a ondulação.
  jetWideAtSource: 1.7,
  jetWideAtTip: 1.2,
  jetWobble: 2,

  // Destroços: o mesmo pedaço de obsidiana na batida e no estilhaçamento. Saem
  // arremessados, desaceleram, param na parede ou por conta própria, e assentam.
  // Só machucam enquanto estão em movimento — entulho parado é cenário.
  // Arremesso forte com arrasto fraco: deslizam ~130 px em ~2 s. Com 190 px/s e
  // arrasto 3.2 paravam a 50 px em 0,6 s, colados no corpo, e liam como fumaça.
  debrisSpeed: 390,
  debrisDrag: 1.6, // por segundo
  debrisRest: 25, // abaixo disso o caco assenta
  debrisRadius: 3,
  // Recém-lançado ele sai com a cor de repouso e não corta: sem isso uma batida
  // ao seu lado mata sem tempo de reação nenhum.
  debrisArmTime: 500, // ms inerte antes de virar perigo
  // Quatro artes de caco, sorteadas. Elas giram enquanto voam e travam ao assentar.
  debrisArtCount: 4,
  debrisArtScale: 1 / 13, // converte `size` do caco em escala do sprite de 32 px
  debrisSpin: 7, // rad/s, no máximo
  // Caco inerte é pedra fria: só acende quando passa a cortar.
  debrisInertTint: 0x4a4450,
  slamDebris: 8, // por batida no chão
  slamDebrisSize: 4, // px
  shatterDebrisSize: 6, // os da carapaça são pedaços maiores
  debrisMax: 64, // teto: ele bate indefinidamente se você não esquentar
  shatterDebris: 12, // ao estilhaçar a carapaça

  spinFps: 8, // rotação da pirâmide e do coração: 8 quadros, então 1 volta por segundo

  // Gêiseres do chão, cada um com relógio próprio: só alguns esquentam por vez.
  // O aviso é longo de propósito — dá para ver de longe qual vai abrir.
  geyserWarn: 1400,
  geyserErupt: 2400, // ficam abertos bem mais tempo
  geyserRestMin: 4200, // e a espera entre aberturas é bem maior
  geyserRestMax: 9000,
  geyserRadius: 16, // raio letal, na boca do tubo
  geyserPlume: 52, // altura da coluna quando irrompe
  geyserSegments: 16, // fatias da coluna; mais que isso vira gradiente liso
  geyserWaveSpeed: 7, // ondulação da coluna, rad/s

  // A queda sacode a tela. Impacto disparado uma vez, então `camera.shake` serve.
  slamShakeMs: 300,
  slamShakeAmp: 0.012,
}

// A pirâmide vem com as rachaduras já desenhadas, marcadas por cor só para
// separá-las em camadas. Elas nascem invisíveis e acendem de baixo para cima,
// uma por rachadura, todas na mesma cor — que vai virando lava com o calor.
export const MONOLITO_ART = {
  cell: 256,
  cols: 3,
  frames: 8,
  pyramidScale: 0.75, // 202x157 px de arte viram ~151x118 na tela
  // Ela desce um pouco além do ponto de colisão para cobrir a própria sombra;
  // alinhada exatamente no ponto, continuava lendo como se flutuasse.
  groundSink: 9,
  heartScale: 0.125,
  // Em ordem de rachadura: de baixo para cima.
  markers: [0xff00ff, 0xffff00, 0x55ff00, 0x00ffff],
  // A classificação é por **matiz**, não por distância à cor pura: a franja
  // anti-serrilhada é a marcação misturada com preto, então fica longe da cor
  // pura em RGB mas mantém o mesmo matiz. Distância RGB deixava franja colorida
  // no corpo; matiz pega tudo. A rocha é preta/cinza, com saturação perto de
  // zero, então nada legítimo é confundido.
  markerMinSat: 30,
  // Cópia da pirâmide em pedra adormecida. Obsidiana é quase preta: tinta
  // multiplicativa não clareia, e blend aditivo não soma nada sobre pixel preto.
  // Então o sono é uma textura inteira, cruzada com a acordada.
  sleepFloor: 58, // o quanto o preto sobe
  sleepGain: 1.5, // ganho na luminância que sobrou
  sleepCool: 1.06, // azul um pouco acima do resto: pedra fria, não papel
  // Onde a marcação sai, entra pedra — não buraco.
  rockDark: OBSIDIANA.escura,
  rockLight: OBSIDIANA.clara,
}

// O Sino, segundo chefe. Pêndulo de bronze pendurado no centro da câmara: ele
// varre o chão numa linha, para no alto do arco, e é só nessa parada que o
// Vínculo o move — a corda puxa o mais leve dos dois corpos.
export const SINO = {
  bellRadius: 34,
  coreRadius: 7,
  // A pegada sobe: ele pende, e o meio-disco centrado no ponto do chão ficava
  // inteiro à frente do sino, sobre chão vazio. Subindo, ele cobre a boca.
  footRise: 25,
  // Mais uma caixa, 3:4, apoiada na aresta reta do meio-disco e subindo por
  // cima dela: é o corpo do sino, que o disco sozinho deixava de fora. Continua
  // mais estreita que o desenho (~78 px), então nada mata fora do que se vê.
  bodyBoxW: 36,
  bodyBoxH: 48,

  // Balanço. Um vaivém completo leva `swingPeriod`; a fase vai de -PI/2 a +PI/2
  // e a posição sai do seno dela, então ele corre no meio e afrouxa nas pontas.
  swingPeriod: 2900, // ms
  periodSpeedUp: 0.87, // encurta a cada rodada
  periodMin: 1700,
  // O seno já deixa o meio mais rápido; isto exagera o contraste. A taxa de fase
  // é multiplicada por (1 + swoop*cos²), normalizada para o período continuar
  // valendo. Com 0,75 o meio corre ~27% mais que antes e as pontas afrouxam.
  swoop: 0.75,
  // Amplitude por direção: uma elipse encaixada na sala. Amplitude fixa num
  // plano vertical jogaria o sino dentro da muralha, porque a câmara é bem mais
  // larga que alta.
  ampX: 215,
  ampY: 110,
  /**
   * **Ele orbita, não risca.**
   *
   * Pêndulo pendurado por uma corrente não é um trilho: empurrado de lado, ele
   * descreve uma **elipse** em volta do ponto de suspensão e essa elipse vai
   * girando. Antes o plano dava um salto no instante em que ele cruzava o
   * centro, e o resultado era um asterisco — retas diferentes pelo mesmo ponto,
   * com uma virada seca no meio.
   *
   * Agora são duas coisas contínuas: a **barriga** (`orbitB`), que joga a ida
   * para um lado e a volta para o outro e fecha a elipse, e a **precessão**
   * (`planeSpin`), que gira essa elipse devagar, o tempo todo. O centro exato
   * deixa de ser passagem obrigatória: ele passa **ao lado** dele, e por um
   * lado diferente a cada vez.
   *
   * O que não muda é a leitura da luta: no meio da travessia ele está no ponto
   * mais baixo da órbita — rente ao chão, rápido e letal —, e nas pontas está
   * no alto, lento e leve. É a mesma elipse que dá as duas coisas.
   */
  orbitB: 0.42, // barriga, em fração da amplitude
  // **Precessão lenta, e por medida.** Com 0,47 rad/s ela girava 39° dentro de
  // uma travessia só: numa metade da elipse ela somava com a barriga e na outra
  // cancelava, e o resultado era um arco gordo seguido de uma reta. Medido, a
  // flecha do arco caía de 63 px para 8. A 0,15 a elipse mantém a forma e ainda
  // vira ~34° por volta, que é o que impede ele de repetir faixa.
  planeSpin: 0.15, // rad/s

  /**
   * **A janela é o começo da descida.**
   *
   * Ele não para mais lá em cima: pêndulo de verdade desacelera, inverte e
   * acelera sem pausa, e meio segundo congelado no alto quebrava justamente a
   * ilusão que a órbita construiu. A janela em que o Vínculo o arranca passou a
   * ser a **primeira parte da queda**, quando ele já virou e ainda está lento.
   *
   * O número é o seno da fase: acima dele, e descendo, ele é leve. Com 0,78 a
   * janela dura ~0,4 s na primeira rodada — e **encolhe sozinha** conforme o
   * balanço acelera, porque é a mesma fase. A curva de dificuldade deixou de
   * precisar de um temporizador próprio: no período mínimo ela fica em ~0,23 s,
   * quase exatamente o que o antigo `dwellMin` valia.
   */
  lightFrom: 0.78,

  // Puxar uma tonelada tem reação: a corda leva o jogador junto, para a frente,
  // enquanto o sino vem. O alvo do sino desconta esse avanço, senão o prêmio por
  // acertar o tempo virava morte na hora.
  shoveSpeed: 200, // px/s do trancão
  shoveTime: 140, // ms; anda ~28 px

  // **Uma tonelada não arranca do lugar.** Ele resiste primeiro, e só então
  // cede: o puxão é aceleração constante, começando em zero e chegando na sua
  // frente na velocidade máxima. `yankSpeed` é essa velocidade de chegada, e a
  // duração sai dela e da distância (média = metade da ponta).
  strainTime: 170, // ms de corrente esticando antes de ele ceder
  strainLean: 7, // px que ele inclina na direção do puxão enquanto resiste
  yankSpeed: 900, // px/s na chegada
  // Piso de duração: puxado de perto, o trajeto dava quatro quadros e ele
  // aparecia do lado do jogador. Peso nenhum se move assim.
  yankTimeMin: 260, // ms
  // Onde ele para ao vir até você. Tem que ser maior que `bellRadius` mais o
  // raio do jogador (34 + 9 = 43), senão o puxão certo mata quem acertou o
  // tempo. A pressão vem da volta dele para a corrente, que atropela no caminho.
  yankGap: 56,
  // A batida no chão: ele quica uma vez, assenta, e levanta poeira do tamanho do
  // que caiu.
  yankBounce: 10, // px do quique
  yankBounceTime: 430, // ms até assentar
  yankDust: 14,
  yankDustSpeed: 120,
  downTime: 1200, // ms caído antes de voltar para a corrente
  riseSpeed: 260,
  // Corrente frouxa enquanto ele está no chão: ela para de segurar o peso, e a
  // barriga dela é o que diz isso.
  chainSag: 16,

  toppleHits: 3, // puxões até o gancho arrebentar
  toppleWindow: 4200, // ms com o badalo à mostra

  // Altura no alto do arco. A colisão fica no chão, mas a altura decide se ele
  // está "embaixo" (atinge e é atingido) ou "no alto" (nem um nem outro).
  // Cinza caindo: a câmara inteira respira por isso.
  ashCount: 46,
  ashFall: 15, // px/s
  ashSway: 7,

  liftMax: 34,
  downLift: 0.3, // fração de liftMax abaixo da qual ele conta como embaixo
  // No alto ele não encosta em ninguém — mas quem estiver na pegada dele arma um
  // feixe, saído da mesma boca de onde a luz vaza. Ele **se forma antes de
  // matar**: entrar na pegada acende o aviso, e o dano só vem no fim da carga.
  laserCharge: 300, // ms formando; é a janela para sair de baixo
  laserShow: 340, // ms desenhado depois de disparar, para a morte se ler
  laserWidth: 14,
  laserHit: 30, // raio do estouro no chão, sob a boca
  // A corrente sobe para fora do quadro. Presa a um ponto dentro da sala ela
  // ficava quase horizontal e lia como vareta em vez de suspensão.
  chainAnchorY: -40,
  // Luz do badalo escapando por baixo da saia. De pé o badalo não aparece, e sem
  // isso nada na tela diz que o núcleo está ali dentro.
  underGlow: 0.3,
  underGlowLift: 0.55, // no alto do arco ele descola do chão e vaza mais luz
  yankShakeMs: 320,
  yankShakeAmp: 0.014,
  toppleShakeMs: 520,
  toppleShakeAmp: 0.02,
}

// Como a arte do Sino se encaixa. Duas folhas 3x3 de células 256, 8 quadros.
export const SINO_ART = {
  cell: 256,
  cols: 3,
  frames: 8,
  // De pé são rotações de um objeto quase simétrico: os oito quadros são
  // praticamente iguais, então servem como giro lento, não como direção.
  upScale: 0.36, // 218 px de arte viram ~78 na tela, sobre uma pegada de 68
  spinFps: 1.1,
  groundSink: 6, // desce um pouco além do ponto de colisão, para cobrir a sombra

  // Caído são 8 guinadas de 45°. **A ordem foi lida à mão**: medir a direção da
  // boca por pixel não funciona, porque a sombra do bronze é tão escura quanto o
  // vão e o centroide escuro cai sempre para baixo. Índice = setor de 45°, com 0
  // no leste girando no sentido horário da tela.
  fallenScale: 0.36,
  // Sequência **decrescente**: é a assinatura de uma folha de rotação de verdade,
  // e foi o que confirmou a leitura. A primeira tentativa foi crescente e só
  // passou na conferência porque o sul calhava de cair no mesmo quadro.
  fallenFrame: [1, 0, 7, 6, 5, 4, 3, 2],
  // Onde o badalo cai em cada setor, em px de tela a partir do centro do sprite.
  // Offset radial não serve: a arte tem perspectiva, e o badalo aparece num
  // lugar diferente em cada guinada — o brilho descolava dele na maioria delas.
  // Medido no carregamento por erosão do vão escuro (o miolo sobrevive, contorno
  // e risco de rachadura não) e transposto para cá.
  fallenCore: [
    [32, 4], // leste
    [23, 21], // sudeste
    [0, 30], // sul
    [-23, 21], // sudoeste
    [-36, 4], // oeste
    [-32, 4], // noroeste — badalo escondido atrás do corpo
    [0, -21], // norte
    [32, 4], // nordeste — badalo escondido atrás do corpo
  ],

  // As duas folhas vêm em tons diferentes — a de pé em pedra fosca, a caída em
  // bronze polido, com brilho especular bem mais alto. As duas passam por
  // luminância e são repintadas nesta cor, com o mesmo teto de brilho: é o teto
  // que separa "pedra" de "metal polido", não o matiz.
  stone: PEDRA_CLARA,
  stoneMax: 200,
}

/**
 * O Crisol, quinto titã e irmão do Monólito: o caldeirão que fez os gêiseres.
 *
 * Ele **derrama o chão em cima de você**, e é esse mesmo fogo que arma a sua
 * flecha — flecha fria bate na pedra do caldeirão e cai. O ciclo é cheio,
 * inclina, verte, fica aberto (núcleo à mostra) e bebe de volta; a cada rodada
 * derrama mais e bebe menos, e é o chão encolhendo que faz o relógio da luta.
 */
export const CRISOL = {
  bodyRadius: 30,
  // Alvo de chefe parado, no fundo de uma boca de 43 px: 11 é o que faz a mira
  // ser conta e não sorte.
  coreRadius: 11,
  // O núcleo está **dentro da tigela**, e a tigela é alta: o alvo sobe com ela,
  // senão o jogador mira no que vê (o brilho na boca) e acerta o vazio. Tirado
  // da arte, como `mouthZ`.
  coreLift: 55,
  // O corpo também: a âncora do caldeirão é o **pé** dele, e um círculo centrado
  // ali fica metade no chão vazio embaixo do sprite. Subindo até a barriga, o
  // círculo cobre o que se vê — e com o da boca por cima, a silhueta inteira.
  bodyLift: 30,
  // Tombar move a boca, e a boca é o alvo: por isso estes dois são regra de
  // jogo, não de desenho. O modelo calcula a posição do núcleo com eles e a
  // view desenha com os mesmos — é o que mantém mira e brilho no mesmo lugar.
  tiltRot: 0.45, // rad de giro no auge, em torno do pé, para o lado da boca
  tiltShift: 0.35, // fração do raio que o corpo escorrega na direção do jorro

  fillTime: 2200, // ms cheio, esquentando
  aimTime: 900, // ms inclinando: é o aviso de para onde vai
  pourTime: 1400, // ms jorrando
  openTime: 3200, // ms com o núcleo à mostra
  drinkTime: 1800, // ms sugando de volta

  pourArc: 0.5, // rad de largura do jorro
  // A primeira rodada tem que molhar **um setor**, não meia sala: a ameaça é o
  // chão encolhendo aos poucos, e inundar tudo de uma vez não se lê como nada.
  pourSweep: 0.55, // rad varridos enquanto ele tomba
  pourNear: 46, // px do lábio onde a lava cai quando ele está quase vazio
  pourFar: 230, // px de onde ela cai com o caldeirão cheio
  lipGlow: 15, // px do bolo de lava que se forma no lábio antes de desprender

  /**
   * **O jorro é chuva, e só chuva.** A lava despreende do lábio já em **gotas**,
   * que voam em arco e explodem no chão. A leitura é a **sombra**: cada gota tem
   * a dela, ela chega ~0,6 s antes do respingo, e sair de baixo é o que salva.
   *
   * Duas versões morreram aqui. A primeira era um segmento aceso do lábio até o
   * ponto de queda, matando em toda a extensão — lia como laser. A segunda
   * guardou um toco desse segmento como "corda" no lábio, e o toco lia como
   * laser cortado. Não sobrou nenhum traço reto: o lábio só tem um **bolo de
   * lava** engrossando antes de a gota desprender.
   *
   * O alcance sai de **Torricelli**: a velocidade no lábio cai com a coluna de
   * lava que sobrou dentro, então ele começa jogando longe e termina
   * escorrendo pela própria borda. É essa curva que faz o jorro varrer uma
   * faixa do chão em vez de pintar um arco de raio fixo.
   */
  // Antes de jorrar ele **pinga**: passada a inclinação em que a lava alcança o
  // lábio, caem gotas curtas no chão. É o aviso final, é o que qualquer coisa
  // entornada faz, e é ele que diz de que borda o jorro vai sair.
  dribbleAt: 0.55, // fração da inclinação em que a lava chega ao lábio
  dribbleEvery: 130, // ms entre pingos
  dribbleDist: 34, // px de alcance do pingo
  dribbleVol: 0.25,

  // Altura do lábio: é de lá que a lava desprende, e o número saiu da arte —
  // a boca do caldeirão está a ~55 px do pé dele na escala em que ele é
  // desenhado. Mudar `CRISOL_ART.scale` pede mexer aqui junto.
  mouthZ: 50,
  gravity: 420, // px/s² do arco das gotas
  goutLift: 90, // px/s de empuxo: é o que dá tempo de ler a sombra
  // Espaçado o bastante para as gotas não se tocarem: com 55 ms elas saíam a
  // cada 11 px do caminho e o jorro voltava a parecer um feixe — agora feito de
  // contas. Gota grande e rara lê como lava; gota miúda e contínua, como laser.
  goutEvery: 120, // ms entre uma cuspida e outra
  goutPer: 2, // gotas por cuspida
  goutSpread: 0.34, // rad de abertura do leque
  goutJitter: 0.45, // variação de alcance, em fração
  goutLiftJitter: 0.3, // variação do empuxo: arcos de alturas diferentes
  goutRadius: 7, // raio da gota, para acerto e desenho
  goutLowZ: 8, // abaixo desta altura a gota já é rasante e queima
  splashKill: 13, // px do respingo que matam no instante da queda
  splashShow: 200, // ms de clarão do respingo

  /**
   * **Beber é puxar por baixo.** A poça não some por conta: ele aponta o momento
   * de cada célula para si e a lava **volta escorrendo pelo chão** — o mesmo
   * passo de fluido que a espalhou é o que a recolhe. Ela continua matando no
   * caminho, e é isso que dá tensão à janela do núcleo: a hora de atirar nele é
   * a hora em que o chão inteiro está andando na sua direção.
   */
  drinkPull: 6, // multiplica o momento enquanto ele bebe: ~115 px/s de arrasto
  drinkRadius: 52, // px em volta dele onde a lava é engolida de fato

  // Tombado ele **entorna aos próprios pés**: caldeirão deitado não arremessa.
  // O anel de fogo fica em volta dele, que é justamente por onde a flecha tem
  // que passar para chegar ao núcleo.
  toppleGouts: 16,
  toppleArc: 1.5, // rad de leque, para o lado de quem puxou
  toppleNear: 48,
  toppleFar: 96,

  /**
   * **Física de líquido.** A lava não aparece pronta: o jato despeja *volume*
   * num ponto, e o volume procura o nível sozinho, escorrendo para o vizinho
   * mais baixo. Fundo o bastante, ele mata; filme fino é crosta esfriando, que
   * escurece e deixa de matar. É por isso que a poça avança, se espalha, para,
   * e encolhe pelas bordas — nada disso é animação, é o mesmo número.
   */
  // A célula do fluido é **metade do tile** do terreno: quatro vezes a
  // resolução do contorno. Medido no navegador: 0,2 ms por passo com a poça de
  // uma rodada (190 células) e 0,8 ms com o chão inundado de propósito (308),
  // contra os 0,57 ms de 200 corpos rígidos do Matter — que era a alternativa
  // avaliada e recusada. `cell: 24` devolve o comportamento de antes, porque
  // volume é profundidade e a conversão é feita na entrada e na saída do campo.
  cell: 12,

  // **Lava derramada mata.** Medido com 0,5: só 31% da poça (33 de 107 células)
  // era letal, e o resto era filme com cara de lava — o jogador atravessava
  // laranja e não morria. O espalhamento achata a poça em segundos, então o
  // limiar tem que ser o que sobra depois disso, não o que cai da boca. Com
  // 0,16 a poça mata inteira e o que não mata é a franja fina da borda, que é
  // justamente a que já esfriou.
  lethalVol: 0.16,
  volMax: 1.7, // teto por tile, senão ele empoça infinito no ponto de queda
  pourRate: 21, // volume por segundo saindo da boca
  splashRadius: 15, // px em volta da queda que recebem o primeiro volume
  flowRate: 6, // o quanto ele nivela por segundo
  // Lava é **viscosa**: abaixo deste desnível ela para em vez de continuar
  // escorrendo. Com o valor baixo demais o filme fino se espalhava pela sala
  // inteira e a poça perdia contorno.
  flowMin: 0.09,
  // Esfriar devagar: com o dobro disso a poça sumia sozinha antes de ele beber,
  // e a sala nunca encolhia de uma rodada para a outra.
  coolRate: 0.022,

  /**
   * **Momento.** Procurar o nível espalha igual para todo lado, e sozinho ele
   * faz a lava inflar em círculo em vez de escorrer. Cada célula guarda a
   * direção em que a lava chegou: a favor dela o escoamento ganha, contra ela
   * perde, e a favor a lava avança **mesmo em nível** — é o que faz o jorro
   * virar língua que atravessa o chão em vez de mancha que cresce.
   */
  flowPush: 0.9, // o quanto o nivelamento a favor do movimento ganha
  momentumFlow: 1.6, // fração do volume que avança por segundo, em nível
  momentumDrag: 3.2, // o momento se apaga em ~0,3 s: é lava, não bala
  // Bebe de volta o que ainda é líquido, dos tiles mais próximos para fora. A
  // crosta que já esfriou não volta: é rocha, e fica como cicatriz.
  // Ele recupera **menos do que derrama**: o que sobra é o chão que a sala
  // perdeu, e é essa diferença que vira o relógio da luta.
  drinkRate: 9, // volume por segundo sugado
  drinkFall: 0.14, // a cada rodada ele recupera menos ainda
  drinkMin: 3.5,

  // Aperta a cada rodada, como os outros quatro.
  speedUp: 0.9,
  fillMin: 1300,
  sweepGrow: 0.3,
  sweepMax: 2.0,

  // Vazio ele é casca: o Vínculo tomba ele, e o núcleo fica o dobro do tempo.
  toppleWindow: 6000,
  dousedShow: 900, // ms de chiado, quando a flecha fria acerta o núcleo

  // **Desenho.** O contorno da lava viva é traçado num limiar mais baixo que o
  // letal de propósito: desenho nunca mais estreito que a hitbox (regra 12).
  // O da crosta é só o que ainda dá para ver.
  // Perto de 1 agora: com o limiar letal baixo, traçar o contorno na metade
  // dele engolia a franja inteira e tudo passava a **parecer** letal. Quem dá a
  // margem da regra 12 é o miolo pintado célula a célula, não o contorno.
  lavaEdge: 1,
  crustEdge: 0.01,

  pourShakeMs: 900,
  pourShakeAmp: 0.005,
  toppleShakeMs: 520,
  toppleShakeAmp: 0.02,
}

/**
 * Como a arte do Crisol se encaixa. Uma folha 3x3 de células 128, 8 quadros de
 * rotação — o caldeirão de pé, girando de 45° em 45°.
 *
 * **O líquido vem em ciano de propósito.** Ciano não existe em nenhum outro
 * lugar desta paleta, então dá para separar cada pixel de lava do resto do
 * caldeirão numa passada só, no carregamento: a pedra vira uma textura e a lava
 * vira outra, repintada na rampa quente da área. É isso que deixa a lava dentro
 * dele **mudar de cor e de nível** enquanto ele esvazia, sem um quadro de arte a
 * mais — e é isso que a folha nova veio permitir.
 *
 * A ordem dos quadros não foi conferida à mão como a do Sino: o caldeirão é
 * quase simétrico, e a única assimetria é a alça. Setor = quadro, direto. Se um
 * dia a alça precisar apontar certo, é aqui que a tabela entra.
 */
export const CRISOL_ART = {
  cell: 128,
  cols: 3,
  frames: 8,
  // 90 px de arte viram ~63 na tela, sobre uma pegada de 60.
  scale: 0.7,
  // O achatamento é só desenho — girar e escorregar não são, porque **movem a
  // boca**, e a boca é onde o núcleo é mirado. Esses dois vivem em `CRISOL`.
  tiltSquash: 0.2, // achatamento no eixo em que ele tomba de frente
}

/**
 * O Coro — a segunda metade da luta do Sino, e o quarto titã do elenco.
 *
 * O badalo do sino grande **não morre quando você acerta**: ele desvia e foge
 * para um dos sete sinos apagados da câmara. Eles acordam, se embaralham no céu
 * e passam a tocar; quem carrega o coração só se entrega quando **se inclina
 * para mirar**, e é nessa inclinação que ele fica alcançável — o feixe sai do
 * próprio coração.
 */
export const CORO = {
  // Todos do mesmo tamanho: o embaralho só funciona se eles forem
  // indistinguíveis, e tamanho diferente é etiqueta.
  scale: 0.18,
  coreRadius: 6,
  coreRise: 6, // altura do badalo dentro da boca, com o sino de pé

  escapeTime: 900, // ms do coração voando do sino grande até o novo corpo

  // Embaralho: rodadas de troca de lugar, em arco para as trajetórias se
  // cruzarem de verdade.
  swaps: 4,
  swapTime: 620, // ms por rodada
  swapArc: 46, // px de desvio perpendicular no meio do caminho

  // Badaladas. Uma de cada vez, em sino sorteado: a onda cobre um pouco mais
  // que meia sala, então sempre existe um lado de fora — e é para lá que se
  // corre.
  rings: 5, // badaladas antes de o coração se entregar
  // Uma badalada por vez, com respiro. A onda leva 1,4 s para se apagar, então
  // neste intervalo a sala volta a ficar limpa entre uma e outra — é o silêncio
  // que faz a próxima badalada assustar.
  ringEvery: 2000, // ms entre uma e outra
  ringWarn: 520, // ms de chacoalho antes de a onda sair
  // Som pesado, não estalo: ela abre devagar o bastante para dar tempo de ler de
  // qual sino saiu e escolher o lado. Ainda mais rápida que a caminhada (158),
  // então correr na frente dela não salva — quem salva é a posição.
  waveSpeed: 210, // px/s
  // A onda **perde força perto do meio da sala**: até `waveFade` ela é sólida e
  // mata; daí em diante é só luz se abrindo e apagando até `waveRange`. Os sinos
  // pendem perto das muralhas, então do berço de um deles o meio está a uns
  // 250 px — a frente letal morre pouco antes disso, e o que cruza o meio já é
  // rastro. Sempre sobra metade da sala inteira para se pôr.
  waveFade: 220, // px; até aqui a frente mata
  waveRange: 300, // px; aqui ela já sumiu
  waveThick: 18, // frente letal
  ringShakePx: 3,

  // A mira. A direção trava no começo: o feixe sai na direção **antiga**, e sair
  // de cima dela é o que salva. Ela só começa depois que a última onda se
  // apagou — duas coisas para ler ao mesmo tempo viravam morte sem explicação.
  aimTime: 2400, // ms inclinando, com o traçado à mostra
  beamTime: 700,
  // Segurado no lugar depois do tiro, ainda deitado e com o badalo à mostra: é
  // o convite para atirar, e vale mais que a janela da volta.
  holdTime: 900,
  beamRange: 900,
  beamWidth: 16,
  recoverTime: 1050, // ms voltando a ficar de pé, com o coração ainda exposto

  // Aperta a cada rodada, como os outros três.
  ringSpeedUp: 0.9,
  ringEveryMin: 1000,
  aimSpeedUp: 0.88,
  aimTimeMin: 1600,
  recoverShrink: 0.85,
  recoverMin: 700,

  beamShakeMs: 240,
  beamShakeAmp: 0.009,
  escapeShakeMs: 420,
  escapeShakeAmp: 0.014,
}

/**
 * A Sentinela Espelhada, terceiro chefe. Não anda: **desliza mantendo distância**
 * e encara você o tempo todo.
 *
 * A frente é espelho e devolve a flecha contra quem atirou. O núcleo fica nas
 * costas, então o único jeito é plantar a flecha atrás dela e **chamá-la de
 * volta atravessando o corpo** — a mecânica que a seção 3.3 do DESIGN chama de
 * central e que nenhum chefe cobrava até aqui.
 */
export const SENTINELA = {
  bodyRadius: 26,
  coreRadius: 7,
  // O núcleo fica atrás, e um pouco além da borda do corpo: de trás a flecha o
  // encontra antes do bronze, de frente o espelho a devolve antes de chegar lá.
  coreOffset: 22,

  // Mira. Devagar o bastante para dar para contorná-la a pé — é essa folga que
  // faz a luta ser de posição e não de reflexo.
  turnSpeed: 2.2, // rad/s
  // Distância que ela procura manter. Longe, ela avança; perto, ela recua — o
  // jogador move ela se afastando, não chegando perto.
  keepDist: 150,
  // Ela desliza o tempo todo: a componente radial afrouxa perto do anel ideal
  // (sem faixa morta, que a deixava parada e dura) e por cima vem um
  // deslizamento lateral que varre para os dois lados. A velocidade é suavizada,
  // então ela acelera e desacelera em vez de ligar e desligar.
  driftSpeed: 138, // teto da componente radial
  radialGain: 2.4, // px/s por px fora do anel
  strafeSpeed: 112,
  strafePeriod: 2600, // ms de um vaivém lateral completo
  driftAccel: 4.5, // suavização por segundo

  // Ciclo: rastreia, carrega, dispara, cega.
  fireEvery: 2600, // ms rastreando antes de carregar
  chargeTime: 700, // ms de mira travada; o caminho inteiro do feixe aparece
  beamTime: 380, // ms de feixe ativo
  blindTime: 1500, // ms sem enxergar depois de disparar: a janela para contornar

  // Ela aperta a cada ciclo, como os outros dois.
  fireSpeedUp: 0.92,
  fireEveryMin: 1500,
  blindShrink: 0.9,
  blindTimeMin: 800,

  beamWidth: 22,
  beamBounces: 4, // quiques contando muralha e o próprio espelho dela
  beamRange: 1500, // px de alcance somando os trechos
  // O feixe sai um pouco à frente da face, senão o espelho dela reflete o
  // próprio disparo no primeiro passo.
  beamStartGap: 4,

  // Fase 1: a carapaça das costas. **Só o feixe dela quebra** — a flecha crava e
  // não faz nada. E o feixe reflete na própria face espelhada dela, então quem
  // mira o raio nas costas dela é o jogador, escolhendo onde se põe: a posição
  // dela sai da sua distância, e a direção dela sai de onde você está.
  shellBreakShakeMs: 520,
  shellBreakShakeAmp: 0.022,

  // Fase 2: sem carapaça ela abre o jogo — mais alcance, mais rápido, gira mais.
  exposedFireEvery: 1300,
  exposedCharge: 420,
  exposedRange: 2600,
  exposedBounces: 5,
  exposedTurn: 3.0,
  exposedBeamTime: 300,
  exposedBlind: 900,

  reflectKeep: 0.85, // quanto da velocidade a flecha guarda ao ser rebatida

  fireShakeMs: 260,
  fireShakeAmp: 0.01,
}

/**
 * Menus. A gramática vem das referências (`screenshots/tela*`): mundo do jogo ao
 * fundo, escuro; caixa alta pixelada; réguas com losango; dicas de botão no
 * canto. O que muda é a lavra — placas e elos no lugar de vinha — e o cursor,
 * que é a flecha do jogo encostada no item.
 */
export const UI = {
  // Escuro o bastante para o texto se ler, claro o bastante para o mundo ainda
  // estar lá: a 0,62 a sala virava um borrão roxo e o fundo não contava nada.
  veil: 0.46,
  vignetteSteps: 26,
  vignetteDepth: 130, // até onde a vinheta entra, em px
  vignetteMax: 0.72, // borda bem escura, miolo limpo
  vignetteCurve: 1.5,

  titleScale: 9, // "ALMAS"
  subtitleScale: 5, // "DE TITANS"
  menuScale: 2,
  menuStep: 22, // px entre itens do menu
  cursorGap: 18, // distância da flecha até o texto

  slotW: 372,
  slotH: 62,
  slotStep: 70,
  slotNumScale: 5,

  // Velocidade do risco correndo na moldura tracejada, em px por segundo.
  dashSpeed: 26,

  hintLeft: 14,
  hintBottom: 16,
  hintStep: 14,
}

// Fim da luta: a arena se cala, a flecha volta sob tensão, e a alma entra.
export const OUTRO = {
  // Desencravar a flecha do coração usa a mesma linguagem do recall — escurecer
  // e dar zoom — só que mais forte, porque custa mais: contra recallDark 0,32 e
  // recallZoom 0,07. O tremor é o que o recall comum não tem.
  killFlashMs: 1400, // clarão branco ao acertar o coração, voltando devagar

  pullRamp: 2000, // ms até o esforço cheio, contado só enquanto o botão está segurado
  pullDark: 0.55,
  pullZoom: 0.11,
  pullShakePx: 1.8,

  releaseFlashMs: 900, // clarão ao arrancar a flecha
  releaseZoomOut: 700, // ms desafastando a câmera de volta ao normal

  soulTime: 4000, // ms de fragmentos entrando no personagem
  soulEvery: 110, // ms entre fragmentos
  soulSpread: 15, // dispersão em volta do coração, de onde as almas saem
  soulSpeed: 210,
  liftPx: 12, // quanto o personagem levita

  landTime: 700, // ms descendo de volta
}

// Como a arte do PixelLab se encaixa na resolução interna.
export const SPRITES = {
  player: {
    // A folha é um upscale 2x exato (medido: blocos de 2x2 px iguais). Desenhar em
    // 0.5 desfaz esse upscale, então não borra nada: o personagem volta aos seus
    // 10x15 px lógicos, dentro da faixa medida nas referências.
    scale: 0.5,
    // A célula tem 148x128 com o personagem ocupando ~20x30 no meio: quase tudo é
    // margem. A âncora vai nos pés (y=79 de 128), não no centro da célula.
    originY: 0.62,
    runFps: 12,
  },
  arrow: {
    scale: 0.5,
    // Carregada nas costas como mochila: ponta para baixo e colada ao corpo. A
    // âncora do sprite é a ponta, então a posição abaixo é onde a ponta fica,
    // perto dos pés, e a haste sobe cobrindo o tronco.
    carryAngle: Math.PI / 2, // ponta para baixo
    carryLean: 0.2, // inclinação leve, espelhada com a direção que ele encara
    carryOffsetX: 2,
    carryOffsetY: -2,
    // Encaixada no arco, à frente do jogador na direção da mira. Em fração do
    // comprimento, não em pixels, para acompanhar a escala do sprite: 1.0 põe a
    // cauda encostando na mão, e acima disso a flecha se afasta do corpo.
    nockAheadFrac: 1.25,
    nockDraw: 3, // recuo na carga cheia; mínimo de propósito, é só sugerir o esforço
    // Chamas enquanto está em brasa.
    flameCount: 5,
    flameSpread: 5,
    flameSpeed: 9, // oscilações por segundo
    // Direção que a arte aponta sem rotação: baixo-esquerda, 135 graus. O código
    // gira por `anguloDaFlecha - angleOffset`, assumindo arte "para a direita".
    angleOffset: Math.PI * 0.75,
    // Âncora na ponta, que é o canto inferior esquerdo — é o ponto que colide.
    originX: 1 / 32,
    originY: 31 / 32,
  },
}

// Caixa do jogador contra parede: menor que o sprite, na altura dos pés.
export const PLAYER_BOX = { hw: 5, hh: 5 }

/**
 * Cores que não são terreno. Mesma história: elas nascem em `src/palette.js`.
 */
export const COLOR = PALETA === 'nova' ? COLOR_NOVO : COLOR_ANTIGO
