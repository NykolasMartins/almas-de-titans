/**
 * A paleta de antes da fase da paleta, guardada inteira.
 *
 * Este arquivo existe por um motivo só: **poder voltar atrás**. Trocar `PALETA`
 * em `palette.js` para `'antiga'` devolve exatamente estas cores, sem tocar em
 * mais nada. Quando a paleta nova estiver aprovada de vez, este arquivo some.
 *
 * Não editar: ele é um retrato, não uma fonte.
 */

export const THEMES_ANTIGOS = {
  fogo: {
    floor: 0x4a2328,
    floorInlay: 0x582a2e, // marchetaria e realce dos sulcos
    floorGroove: 0x3d1c22, // sulco escavado
    floorPanel: 0x53272c, // painel central
    floorSpeck: 0x3a1b20,
    floorStainDark: 0x33161c, // desgaste
    floorStainLight: 0x5f2f33,
    floorCrack: 0x2a1116, // fissuras da pedra
    rubble: 0x5e2b2b,
    dust: 0x8a5548, // poeira: um tom acima do entulho, senão some no chão

    wall: 0x8a4a44, // massa de rocha
    wallTop: 0xb5716a, // face virada para a luz
    wallCap: 0xd79a90, // aresta superior acesa
    wallStripe: 0x6d3833, // estrias verticais
    wallTrim: 0x5c2c28, // sulco lavrado
    wallLattice: 0xc98a80, // treliça de losangos
    wallFoot: 0x2e1418, // sombra no pé da muralha

    lavaOuter: 0xc4451c,
    lavaOuterMid: 0xf07a30,
    lavaOuterHot: 0xffd88a,
    lavaGlow: 0xff7a2a, // halo derramando sobre a pedra
  },

  /**
   * Campanário: a mesma região de fogo, outra fatia dela. Aqui o fogo já baixou
   * — pedra clara empoeirada, chão de cinza fria, e o mar lá fora encrostado em
   * vez de aceso. É o contraste que faz a câmara do Monólito parecer quente.
   */
  campanario: {
    // Claro o bastante para o jogador se ler contra ele: a primeira tentativa
    // ficou tão escura que o personagem sumia no chão.
    floor: 0x4c4350,
    floorInlay: 0x5d5361,
    floorGroove: 0x393143,
    floorPanel: 0x554a5b,
    floorSpeck: 0x413848,
    floorStainDark: 0x342c3c,
    floorStainLight: 0x625769,
    floorCrack: 0x2a2333,
    rubble: 0x6a606e,
    dust: 0x9d93a2,

    wall: 0x6d6169,
    wallTop: 0x968894,
    wallCap: 0xbcaba9,
    wallStripe: 0x574c57,
    wallTrim: 0x453c47,
    wallLattice: 0xc2b0a4,
    wallFoot: 0x1a161d,

    // Lava velha: crosta escura por cima, brasa só nas frestas.
    lavaOuter: 0x6e2814,
    lavaOuterMid: 0xa8461a,
    lavaOuterHot: 0xdc9a52,
    lavaGlow: 0xb04a1c,

    motif: 'anel', // lavra do piso: anéis, não losango
  },

  /**
   * Fortaleza: a região fria das referências. Pedra azulada, e **sem lava** — a
   * sala do Sentinela é fechada por muralha maciça em vez de mar aceso, porque o
   * feixe dela ricocheteia nas paredes e a leitura pede muralha reta e limpa.
   */
  fortaleza: {
    floor: 0x333d4e,
    floorInlay: 0x435063,
    floorGroove: 0x262f3d,
    floorPanel: 0x3b4657,
    floorSpeck: 0x2c3543,
    floorStainDark: 0x212936,
    floorStainLight: 0x475666,
    floorCrack: 0x1c232e,
    rubble: 0x505d6d,
    dust: 0x8496ab,

    wall: 0x6a7c92,
    wallTop: 0x94a7bb,
    wallCap: 0xc3d4e4,
    wallStripe: 0x56657a,
    wallTrim: 0x3c4858,
    wallLattice: 0xc0cee0,
    wallFoot: 0x161c26,

    // Sem tile 3 nesta sala; ficam só para o halo da flecha em brasa não achar
    // `undefined` se um dia um gêiser aparecer aqui.
    lavaOuter: 0x2a3b52,
    lavaOuterMid: 0x3d5878,
    lavaOuterHot: 0x86a8cc,
    lavaGlow: 0x4a6f9c,

    // Salão de espelhos: a muralha é chapa polida, e reflete o que chega perto.
    wallMotif: 'espelho',
    mirrorWalls: true,
  },
}

export const COLOR_ANTIGO = {
  bg: 0x120a0c,
  // Câmara vulcânica: quase monocromática em vermelho, como nas referências.
  // Só a lava, o fogo e o núcleo saem dessa faixa.
  vignette: 0x1a0508,

  arrow: 0xe8e0c0,
  arrowBurning: 0xffb04a,
  flameCore: 0xfff0b0,
  flameMid: 0xff9430,
  flameEdge: 0xd84a1c,
  cord: 0x8a7fb0,
  soul: 0xffffff,

  // Interface. Tinta de osso, brasa no que está escolhido: o menu fica na mesma
  // família da região de fogo sem competir com o vermelho do núcleo.
  uiInk: 0xe4dcc6,
  uiDim: 0x7d7566,
  uiAccent: 0xf0a24a,
  uiFrame: 0x9c8f76,
  uiPlate: 0x241d1c,
  ash: 0xc9bfc4, // cinza no ar, no campanário

  // Bronze do Sino. Quente o bastante para não brigar com a paleta vermelha.
  bell: 0x7a4f2a,
  bellLight: 0xb0803f,
  bellDark: 0x3a2412,
  bellLip: 0xd7ab63,
  chain: 0x6b4f42,
  bellDead: 0x5c5560, // os sinos apagados que enfeitam a câmara

  // A Sentinela. O feixe é frio de propósito: o único ponto quente da sala tem
  // que continuar sendo o núcleo.
  mirror: 0xcfe4f2,
  mirrorDim: 0x707e8c, // embaçado, enquanto ela está cega
  sentinelStone: 0x39424f,
  sentinelEdge: 0x8fa3b8,
  beamCold: 0x8ed6ff,
  beamHot: 0xeaf9ff,
  shellPlate: 0x2a323d, // carapaça das costas, enquanto fechada
  shellSeam: 0x151b24,

  obsidian: 0x1d1a26,
  obsidianEdge: 0x4a3f6b,
  crack: 0xc4562a,
  heat: 0xff9540,
  shadow: 0x000000,
  shard: 0xb9a7d6,
  geyserDormant: 0x3a1f1c,
  geyserWarn: 0xb55a24,
  geyserErupt: 0xff8a2a,
  jetWarn: 0x7a3a1c,
  core: 0xff5a4a, // única cor saturada do jogo
  coreDead: 0x453d4a,
}
