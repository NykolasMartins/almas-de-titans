# Contexto — Almas de Titans

Estado do projeto, decisões que ainda valem e armadilhas já pagas. Escrito por **estado**, não
como diário: o histórico completo está no git, aqui fica só o que muda o que fazer a seguir.

Última atualização: **2026-09-13**

---

## Estado atual

**Fases 0 a 5 e 7 do DESIGN.md prontas, a 6 em andamento (cinco titãs, quatro salas).** O jogo se joga do
título ao terceiro titã sem digitar endereço nenhum: título → vínculo → obelisco → salas → chefes,
com portão de almas e save. Os endereços diretos (`/piramide`, `/sino`, `/sentinela`) continuam
existindo como atalho de trabalho, e abrem partida solta que não guarda nada.

O que funciona hoje:

- Andar, rolar (direção travada, sem invencibilidade), morrer em um toque e reaparecer.
- **Folha do protagonista v2** (`assets/protagonist v2`): trouxe as oito poses de `slide`, que
  viraram a animação do rolamento — antes ele reusava a corrida e a esquiva não se lia —, e a
  corrida **norte**, que faltava e caía na direção vizinha. Nada disso custou código de arte:
  `makePlayerAnims` monta tudo lendo o JSON do PixelLab, e a cadência do rolamento sai de
  `rollDuration`, então as sete poses cobrem exatamente o dash. A animação do rolamento segue
  a direção do **dash**, não a que ele encara: no trancão do Vínculo as duas diferem.
- **Mira pela direção que o jogador encara**, não pelo mouse. Carregar o arco desacelera, e a
  carga se lê na própria flecha, que recua ao ser puxada.
- Flecha única: voa, crava, cai no chão, volta pelo recall (que exige segurar), acende ao cruzar
  lava, e serve de âncora do **Vínculo**.
- **Monólito de Obsidiana** completo: duas fases, rachar progressivo, choque térmico, núcleo
  exposto, barragem de jatos, morte com desfecho de quatro etapas.
- Pegada do Sino: meio-disco de barriga para baixo, levantado 25 px, **mais uma caixa 3:4
  (36 × 48) por cima**, que pega o corpo — o disco sozinho deixava o sino inteiro de fora.
- **Puxar o sino tem reação:** o jogador é arrastado para a frente ~28 px, sem controle. O alvo do
  sino desconta esse avanço, senão o puxão certo matava quem acertou o tempo. `player.shove()`
  reusa a máquina do rolamento com velocidade própria.
- **O Sino** completo: pêndulo que **orbita** o chão em elipses que precessam, janela no
  **começo da queda** (anunciada por ele estar alto e lento, sem indicador de tempo), três puxões, tombo com o
  badalo exposto. **A altura decide**: rente ao chão ele
  atinge e é atingido, no alto nem um nem outro — e quem entra na pegada arma um feixe da boca,
  que leva 0,5 s se formando antes de matar.
  A pegada é meio-disco de barriga para baixo, levantado 18 px para cobrir a boca. Arte em
  `assets/sino.png` e `assets/sino-caido.png`, repintadas em pedra no carregamento; o quadro do
  caído e a posição do badalo saem de tabelas por setor em `SINO_ART`.
- **O Crisol** completo, quinto titã e irmão do Monólito, na sala além da câmara dele. Ciclo de
  quatro tempos (cheio, inclina e verte, vazio, bebe) que **derrama o chão em cima do jogador**
  e encolhe a sala a cada rodada. **Só flecha em brasa mata**, e o único fogo é o que ele mesmo
  despejou — o tiro certo é o que atravessa uma poça. Aberto, a boca engole a flecha (a borda
  para de segurar tiro); vazio, ele é casca e o Vínculo **tomba** ele, derramando o resto aos
  pés de quem puxou. As poças são estado do chefe, não terreno: nada de grade mutável — a
  mesma escolha que os gêiseres do Monólito já tinham feito.
- **O Coro** completo, e ele é a **segunda metade da luta do Sino**: o badalo não morre quando
  você acerta — desvia e foge para dentro de um dos sete sinos apagados da câmara. Eles acordam,
  se embaralham no céu, tocam soltando **ondas de som cuja frente mata** — sólidas até 220 px e
  se dissipando até sumir em 300, a 210 px/s e com 2 s entre uma e outra —, e o que carrega o
  coração **se entrega ao se inclinar** para mirar — e só depois que a última onda apaga, senão
  eram duas leituras disputando a mesma atenção. São 2,4 s com a linha travada à mostra, feixe de
  0,7 s na direção antiga, **0,9 s parado e aberto** (a melhor hora de atirar) e só então a volta
  lenta — 5 s de janela no total. O feixe sai do próprio coração, que é o que abre a janela de acerto. **Arte nova: nenhuma** — corpo de pé é
  `sino.png` na escala dos enfeites, inclinado é `sino-caido.png`, e a tabela do badalo por
  setor já existia.
- **Efeito condicional precisa de sinal no alvo.** "Só flecha em brasa mata" era invisível: o
  jogador atirava, nada acontecia, e nada na tela explicava. O núcleo do Crisol passou a
  **responder à flecha** — grande e com anel de fogo quando ela está acesa, encolhido e apagado
  quando não —, e a flecha fria caindo na tigela solta um chiado longo. A regra só existe se o
  alvo a contar.
- **A lava do Crisol é líquido de verdade.** O fluido corre numa **sub-grade de 12 px** (metade
  do tile do terreno) e cada célula guarda **volume**, que é profundidade: o jato despeja num
  ponto, o volume escorre para a vizinha mais baixa (um quarto do desnível por passo), esfria a
  taxa fixa e é sugado de volta pelo caldeirão. Fundo mata e acende a flecha; raso é crosta,
  escura e inofensiva. Nada disso é animação — é o mesmo número que decide o dano, então o que
  se vê é o que mata. Viscosidade (`flowMin`) é o que impede o filme fino de virar mancha na
  sala inteira. Como volume é profundidade, tudo que entra e sai do campo passa por um fator de
  área: **`cell: 24` devolve o comportamento antigo** sem tocar em mais nada.
- **O jorro é chuva, não feixe.** Ele desenhava um segmento aceso do lábio até o ponto de queda
  e matava em toda a extensão — lia como laser, não como lava. A lava despreende do lábio já em
  **gotas de arco balístico**, com gravidade de verdade, altura de tela e **sombra no chão**. A
  sombra é a leitura: chega ~0,6 s antes da lava e fecha conforme a gota desce. A regra de dano
  ficou honesta — **no ar a gota passa por cima de você**; quem mata é a queda e a gota rasante.
  Uma versão intermediária guardou um toco do segmento antigo como corda no lábio: **o toco lia
  como laser cortado** e foi tirado — não sobrou traço reto nenhum, só um bolo de lava
  engrossando no lábio antes de a gota desprender. Isso abriu um
  bolso seguro **debaixo do arco**, que encolhe durante o jorro porque o alcance cai por
  **Torricelli**: velocidade no lábio proporcional à raiz da lava que sobrou dentro, e é o mesmo
  `fill` que já desenhava o nível na boca. As gotas saem espaçadas de propósito (120 ms, duas por
  cuspida, leque, alcance e empuxo sorteados): a 55 ms elas saíam a cada 11 px do caminho e o
  jorro voltava a parecer um feixe feito de contas.
- **Lava derramada mata, e o limiar é o que sobra depois de espalhar.** Com 0,5 só **31% da
  poça** era letal (33 de 107 células medidas): o resto era filme com cara de lava, e atravessar
  laranja sem morrer é a pior mentira que esta sala pode contar. Em 0,16 a poça mata inteira (61%
  logo após derramar, 72% assentada) e o que sobra fora é a franja da borda. A crosta ganhou teto
  de cor — chega a cinza-brasa e para — e o contorno passou a ser traçado **no próprio limiar
  letal**, então nada que pareça lava deixa de matar e nada que mate parece seguro.
- **Hitbox de corpo alto sobe com a arte.** A âncora do Crisol é o pé dele; o círculo centrado ali
  ficava debaixo do sprite, no chão vazio. Subiu para a barriga (`bodyLift: 30`), e com o círculo
  da boca por cima os dois cobrem a silhueta. `desperta` passou a aceitar o `hitTest` do chefe
  além do círculo da pegada: quem acorda o titã é acertar **nele**, não no chão sob ele.
- **O Crisol tem arte** (`assets/crisol.png`): folha 3×3 de células 128, 8 guinadas de 45°, sem
  pose tombada — tombar é **girar o sprite em torno do pé**, e o modelo calcula o mesmo arco
  (`giro`, `mouth`, `corePos`), então boca desenhada e boca mirada são a mesma. O núcleo subiu
  55 px com a arte: ele mora **dentro da tigela**, que é onde o brilho aparece, e fechado a boca
  também para tiro (sem isso a flecha mirada nela passava por cima do corpo, que é um círculo no
  chão).
- **Camada manipulável vem em cor que não existe na paleta.** O líquido do Crisol foi desenhado
  em **ciano**: no carregamento uma conta por pixel separa a folha em pedra (boca vira buraco, a
  view pinta o fundo) e líquido, repintado **por luminância** na rampa quente do tema. Daí a lava
  dentro dele baixa de nível e esfria de cor com o mesmo `fill` da física, sem um quadro a mais.
  Vale para qualquer arte futura que precise mudar de cor ou de quantidade em jogo.
- **Antes de jorrar, ele pinga.** Passada a inclinação em que a lava alcança o lábio, caem gotas
  curtas junto dele — escorrendo pela borda, não arremessadas. Aviso final, e ele aponta **de que
  borda** a varredura começa.
- **Líquido fica nivelado; é o vaso que inclina.** A lava dentro dele mantém o eixo na tela e
  escorrega para o lado do lábio. Girando junto com o corpo ela parecia sólido pintado de
  laranja, e a inclinação — que é o aviso principal do ataque — perdia metade da força.
- **Beber é puxar por baixo.** A poça encolhia sozinha e ninguém ligava uma coisa à outra. Agora
  ele aponta o momento de cada célula para si e a lava **volta escorrendo pelo chão**, pelo mesmo
  passo de fluido que a espalhou; engolir só acontece dentro de 52 px dele. Ela **continua
  matando** enquanto volta, e é isso que dá tensão à janela do núcleo. Puxando, ele **para de
  procurar o nível**: nivelar espalhava a lava de lado justamente enquanto ela corria e ela
  chegava diluída em crosta (258 células viravam 299). Sem nivelamento ela anda inteira — 258
  viram 111, 90 px/s de centro de massa, e chega viva.
- **Caldeirão deitado vaza, não arremessa.** Tombado pelo Vínculo ele entorna num leque de gotas
  a 48–96 px de si, para o lado de quem puxou, em vez de despejar num ponto longe. O anel de fogo
  fica em volta dele, que é justamente por onde a flecha tem que passar para chegar ao núcleo: o
  prêmio e o caminho do tiro passaram a ser a mesma coisa.
- **Pêndulo não para no alto.** O sino congelava meio segundo na ponta do arco — era a janela do
  Vínculo, e era também o que quebrava a ilusão que a órbita tinha acabado de construir. A janela
  virou uma **fatia da fase**: acima de 0,78 de seno e **descendo**. Medido: 400 ms na primeira
  rodada, 233 ms no balanço mínimo (o antigo `dwellMin` valia 210), velocidade mínima de 22 px/s
  contra 579 no meio do arco, e **nenhum quadro parado**.

  De brinde, um número a menos: a curva de dificuldade era `period` **e** `dwell` encurtando em
  paralelo; agora é só o período, e a janela encolhe junto porque é a mesma fase. O `reset` também
  passou a começar no meio do arco como o `restartSwing` — pendurado na ponta ele já nasceria
  dentro da janela, e a luta abria com ela escancarada.
- **Pêndulo pendurado não é trilho.** O Sino saltava o plano da varredura no instante em que
  cruzava o centro: cada travessia era uma reta nova pelo mesmo ponto, com virada seca no meio —
  um asterisco, não um balanço. Agora a ida vai por um lado e a volta pelo outro (`orbitB`, 42%
  da amplitude), fechando uma **elipse**, e essa elipse **precessa devagar o tempo todo**
  (`planeSpin`). Ele nunca passa pelo centro exato: medido, nunca a menos de 58 px.

  A precessão é lenta por medida. Herdando o ritmo antigo (0,47 rad/s) ela girava 39° dentro de
  uma travessia, somando com a barriga numa metade da elipse e cancelando na outra: saía um arco
  gordo seguido de uma reta, e a flecha do arco despencava de 63 px para 8. A 0,15 rad/s toda
  travessia tem a mesma curva (~15% da corda) e a elipse ainda vira ~34° por volta.

  O que não mudou é a leitura: no meio da travessia ele está no ponto baixo da órbita — rente ao
  chão, rápido e letal —, e nas pontas está no alto, lento e leve. É a mesma elipse que dá as
  duas coisas. O que mudou de graça foi o **centro virar abrigo**: ficar embaixo do pivô com uma
  tonelada de bronze girando em volta é lugar novo para estar.
- **Nível sozinho não é escoamento: falta momento.** Procurar o nível espalha igual para todo
  lado, e a poça inflava em círculo não importava de onde vinha a lava. Cada célula guarda agora
  a **direção em que a lava chegou**: a favor dela o escoamento ganha, contra ela perde, e a
  favor a lava avança **mesmo em nível**. O jorro virou língua atravessando o chão, e o momento
  se apaga em ~0,3 s para a poça assentar. Medido: mesma derramada para leste e para oeste, e o
  centro de massa termina em lados opostos do caldeirão.
- **Lava nova tem que ser pintada como a lava velha.** A poça do Crisol tinha desenho próprio e
  não parecia líquido. Agora ela chama `paintLavaSurface`, a mesma do mar de lava — só no tile
  inteiramente molhado, porque meio tile decorado vazaria para o chão seco.
- **Contorno se tira do campo, não da grade.** Retângulo por célula lê como tabuleiro por mais
  bojo que se ponha na borda. A poça é desenhada por **marching squares** sobre o volume: cada
  canto vale a média das células de chão em volta, e a linha de nível é interpolada dentro da
  célula. A mesma linha serve três vezes — brilho grosso na pedra em volta, borda quente e o
  recorte da massa. Ela passa **abaixo** do limiar letal de propósito, e cada célula que mata
  ainda ganha o miolo pintado: desenho nunca mais estreito que a hitbox (regra 12), senão alguém
  morre em cima do que parece crosta.
- **Chão que muda é estado de chefe, não terreno.** As poças do Crisol não mexem na grade da
  sala: são um mapa de tiles dentro do chefe, desenhado pela view dele e testado por ele. Sai
  de graça (nada de repintar terreno nem desencalhar jogador de tile que virou sólido) e ainda
  deixa a flecha **voar por cima da lava**, que é o que a luta inteira exige — grade mutável a
  teria parado na margem.
- **Chefe pode delegar a chefe.** `sino.js` cria `coro.js` e repassa `update`/`hitTest`/
  `onArrowHit`; a cena continua falando com um chefe só. Mais barato que ensinar `World` a
  trocar de chefe no meio da sala, e `run.souls` continua contando **salas**, não fases — o
  Campanário dá uma alma só.
- **A física do puxão tem peso.** Ele resiste 0,17 s com a corrente esticando, vem **pelo arco**
  em volta do pivô (não em linha reta) com aceleração constante, despenca na mesma curva, levanta
  poeira pela saia e **quica** antes de assentar; a corrente cede a barriga enquanto ele está no
  chão. Piso de 0,26 s no trajeto, senão de perto ele chegava em quatro quadros. O chefe pede
  poeira pela `ctx.dust` da cena — ele não conhece tema nem camada.
- **O Vínculo move o corpo mais leve dos dois** — a regra que o Sino ensina, e que vale para os
  próximos chefes.
- **A Sentinela Espelhada** completa, e com ela a **região fria**: salão retangular de pedra
  azulada, fechado por muralha maciça em vez de lava. Duas fases:
  **1)** costas blindadas, e só o **próprio feixe dela** abre a carapaça — ele reflete na muralha
  **e na face espelhada dela**, e quem o mira é o jogador escolhendo onde se põe. A prévia do
  traçado fica ligada o tempo todo e acende em vermelho quando aquele ângulo resolve.
  **2)** aberta, ela dobra alcance e ritmo, e o núcleo das costas vira alvo do recall atravessando
  o corpo. Ela devolve a flecha pela frente, e **a flecha rebatida mata**.
  O salão é de espelhos: muralha de chapa polida que **reflete os corpos de verdade** — jogador e
  flecha como sprite virado do avesso, o chefe como silhueta, e **o feixe continuando para dentro
  do espelho** em cada quique, tudo sumindo no fundo por uma névoa que engrossa para dentro da
  muralha. Liga por `mirrorWalls` no tema; a cena expõe `mirrorPolyline` para a view refletir o
  que quiser.
- A Sentinela **desliza o tempo todo** (radial suavizada + vaivém lateral) e **para seco ao
  carregar** — 133 px em 2 s rastreando, 0 px na carga.
- **Dano da volta da flecha finalmente é cobrado por um chefe.** Era a mecânica da seção 3.3 do
  DESIGN que nenhum chefe exigia.
- Arena vulcânica octogonal com gêiseres em tubo, mar de lava animado, bloom por emissor.
- **Mundo ligado:** cinco salas (obelisco, três arenas, um portão selado de 2 almas), portas que
  trancam a arena durante a luta e abrem quando o chefe cai, câmera com scroll no obelisco
  (1056×672) e travada nas arenas.
- **A luta começa com a flecha.** O titã dorme **acinzentado e no chão** até levar o primeiro
  tiro: entrar na arena não começa nada, a porta fica aberta e dá para olhar e sair. O tiro
  acorda, tranca a sala e liga o relógio do chefe. Quem desperta é o **corpo inteiro**, não a
  hitbox — a hitbox recusaria o tiro justamente num titã que passa a luta invulnerável.
- **Despertar em duas partes, 2,6 s:** levantar do chão recuperando a cor (1,6 s) e o **grito**
  (1 s), com a tela tremendo. O grito é de cada um: a pirâmide acende todas as rachaduras em
  laranja e apaga, o sino solta uma badalada em anéis, a sentinela estoura a face em branco. A
  cena só publica `scene.wake = { rise, roar }`; quem sabe dormir é a view.
- **Tecla e botão atravessam a porta apertados.** O estado real do navegador vive em
  `src/held.js` (teclado) e no ponteiro global (mouse), e é reaplicado na entrada da sala.
- **Suco (fase 7):** hitstop por tipo de acerto (4 quadros no corpo, 8 no núcleo, 3 na flecha
  devolvida), câmera lenta de 0,9 s ao derrubar o titã, rastro da flecha na cor dela, poeira no
  rolamento e na pedra onde ela crava, e a imagem quebrando em blocos na morte. Poeira e rastro
  moram em `src/fx.js`, sem Phaser, e rodam no delta real.
- **O jogo não tem mais HUD.** O texto de estado virou ferramenta: só aparece com `H` ligado,
  junto dos contornos de colisão.
- **Travessia contínua.** O jogador entra na boca do corredor do outro lado, com o mesmo desvio
  lateral e o mesmo rumo com que saiu: é um corredor só, cortado por 90 ms de escurecimento. Antes
  ele era teleportado para dentro da sala e o passo dava um pulo.
- **Morrer não para o mundo.** O chefe segue o padrão, os gêiseres seguem o ciclo, e o que acaba é
  a visão: a câmera fecha no corpo enquanto um véu preto avermelhado sobe, em 1,7 s. Depois a
  partida volta ao **último vínculo guardado**, não à sala da morte — é o que dá peso a ir até o
  obelisco.
- **Save de verdade:** quatro vínculos em `localStorage`. **Progresso** (almas e sala) grava só
  no obelisco; **estatística** (mortes e tempo) grava **a cada morte**, por `run.saveDeaths` —
  placar que some ao fechar a aba não conta nada, e gravar alma na morte viraria checkpoint de
  graça. A partida viva mora em `src/run.js`, fora da cena, porque `World` reinicia a cada sala.
- **Apagar vínculo tem duas etapas**: o botão liga o modo, o alvo ganha moldura tracejada
  vermelha, e escolher um vínculo é a confirmação — o mesmo botão, agora `cancelar`, desfaz.
  Antes ele apagava na hora e no último vínculo em que o cursor tinha estado.
- **O jogo tem som** (`src/audio.js`), **sintetizado em código**: nenhum arquivo de áudio e
  nenhuma biblioteca — cada som é uma receita de osciladores e ruído do Web Audio, do mesmo jeito
  que a fonte é desenhada com `fillRect`. Quatorze sons cobrem tiro, flecha na pedra, corpo e
  núcleo do titã, flecha devolvida, rolamento, Vínculo, brasa acendendo, respingo de lava,
  despertar, rugido, titã caindo, morte, obelisco e os três do menu.

  Quem toca chama `toca('nome')`; o chefe pede pelo `ctx.som`, o mesmo contrato da poeira. A
  mistura foi **medida com um analisador**, não estimada: núcleo e morte no topo (0,30), menu no
  fundo (0,05), e o raspão do rolamento precisou de quase três vezes o volume do estalo na pedra
  para chegar ao mesmo lugar, porque o passa-baixa come o resto.

  Três coisas que o navegador cobrou: o contexto **só nasce num gesto**, e a espera por ele mora
  no **boot**, não numa cena — em `Titulo.create` o endereço direto de luta ficava mudo a partida
  inteira; cada som tem **intervalo mínimo** próprio (a lava pinga dez vezes por segundo); e o
  primeiro som da sessão saía cortado, o que se resolveu agendando tudo 8 ms à frente em vez de em
  `currentTime` cravado.

  **Nome de som é ligação que nenhum compilador confere.** `npm test` varre as cenas e o chefe
  atrás de `toca(...)`/`som(...)` e cobra que todo nome pedido exista — um erro de digitação
  deixaria aquele acerto mudo sem ninguém notar. Por isso o mapa de acerto virou tabela
  (`SOM_ACERTO`) em vez de ternário solto na cena.

  **O que faz sentido fazer som, faz** — 31 receitas. Titã caindo, bronze batendo, corrente
  rangendo no alto do arco, gêiser abrindo, carga e feixe da Sentinela, jorro e gole do Crisol,
  pedra rachando, carapaça estourando, lava borbulhando. O chefe pede pelo `ctx.som?.()`, que é
  opcional de propósito: o teste roda sem ele. E quem dispara é sempre a **transição**, nunca o
  estado.

  O **bronze** ganhou desenho próprio: parciais inarmônicas (1 : 1,51 : 2,66), que é o que faz o
  rolar de sino — afinado em oitavas sai órgão de igreja. Os sete sinos do Coro tocavam em
  silêncio até agora; conferido, três badaladas criam exatamente 9 osciladores e 3 ruídos.

  **Fundo de sala** (`ambiente`): um leito contínuo por área — `lava`, `cinza` e `frio` —, de
  ruído filtrado com oscilador lento mexendo no corte. Não recomeça ao trocar de sala na mesma
  área, **abafa a 25% na pausa** (medido) em vez de cortar, e **engrossa conforme o chão vira
  fogo**: a poça do Crisol entra na conta.

  Um bug só apareceu porque medi: `tema.calor` não existia no objeto do tema — ficava no
  parâmetro de `tema()` e nunca era devolvido —, então toda sala caía no fundo errado. Agora o
  tema carrega o próprio calor, como carrega a cor.
- **Volume entrou nas opções junto com o som**, e não antes: opção que não faz nada foi o defeito
  que a tela de opções veio consertar.
- **Pausa e opções** (`src/scenes/Pausa.js`): `ESC` em jogo abre um painel **por cima** da cena,
  que fica pausada de verdade — nada corre por baixo, nem a simulação, nem a poeira, nem o
  relógio da partida (pausar não conta como tempo jogado). Dali saem `continuar`, `opções` e
  `abandonar` (em duas etapas, como o apagar vínculo: o progresso só existe até o último
  obelisco). A pausa também é o único lugar que **mostra** almas, mortes e tempo — estavam
  gravados desde a fase 5 e não apareciam em canto nenhum.

  As opções são as mesmas no título e em jogo, no mesmo arquivo e nos mesmos dois modos, e **todas
  fazem alguma coisa hoje**: tela cheia, tremor da câmera (cheio/metade/desligado) e contornos.
  Volume entra quando houver som — `OPÇÕES` já levou a lugar nenhum por três fases, e trocar isso
  por botões vazios seria o mesmo defeito com mais tela. Elas moram em `src/options.js`, fora de
  `run.js` e com endereço próprio no disco.

  Duas coisas o navegador cobrou: **tela cheia só é concedida dentro do evento de tecla** (o laço
  do Phaser roda depois, e o pedido chega sem gesto e é recusado em silêncio), então essa linha —
  e só ela — tem um ouvinte nativo; e o valor mostrado é lido de `scale.isFullscreen`, nunca de
  uma cópia nossa, porque tela cheia cai por fora (F11, `esc`).
- **Todo tremor passa por `World.shake`.** Eram cinco `camera.shake` soltos, e com a opção em
  "desligado" quatro continuariam sacudindo.
- **`H` e a opção "contornos" são o mesmo interruptor**, um estado só, e o que a tecla liga
  sobrevive ao fim da partida.
- **Menus montados**: título em `/` e escolha de vínculo, agora lendo save de verdade. Fonte de bitmap própria,
  fundo de sala de verdade escurecida, cursor de flecha. `OPÇÕES`/`CRÉDITOS` não levam a lugar
  nenhum e qualquer vínculo cai na primeira luta — a lógica é da fase 5.
- **Paleta travada** (`src/palette.js`): toda cor nasce de uma paleta mestra e cada área é uma
  fatia dela — matiz, saturação e duas luminâncias, mais `brasa`/`calor`/`brilho`. **Sombra puxa
  para o frio e ganha saturação, luz puxa para o quente e perde** — é essa conta que separa
  pedra pintada de pedra cinzenta, e na fortaleza a luz é céu (196°) em vez de sol. As três
  salas têm pesos diferentes de propósito: câmara escura (chão L35), campanário claro (L82),
  fortaleza de contraste frio (L46 com chapa clara). Duas regras,
  cobradas por teste: **pedra, gelo e cinza em 9% a 22% de saturação**, e **só o que é quente é
  saturado** (70% a 100%, com o núcleo no teto). O contraste da tela deixou de ser claro contra
  escuro e passou a ser **morto contra aceso**. Para voltar atrás: `PALETA = 'antiga'`, que
  devolve as cores antigas guardadas em `palette-antiga.js`.
- **Três áreas com cara própria:** `fogo` (caverna vermelha do Monólito), `campanario` (câmara de
  cinza do Sino, com anéis no piso, lava encrostada, cinza caindo e sete sinos mortos pendurados) e
  `fortaleza` (salão azul da Sentinela, retangular e sem lava). Trocar a área é trocar o tema, e o
  tema agora carrega o motivo do piso além das cores.
- **`buildArena` aceita `outside`:** com `1` a sala é fechada por muralha maciça em vez de mar de
  lava. E `chamfer: 0` dá salão retangular — o feixe que quica precisa de muralha reta, porque
  canto chanfrado é escada de tiles e o quique sai imprevisível.

Ainda **não** existe: os outros cinco chefes, áudio, opções, créditos e final. Depois do desfecho
o jogador fica numa sala vazia com o coração apagado.

## Como rodar e verificar

```bash
npm run dev
```

```bash
npm test
```

`npm test` roda `collision.test.js` e `game.test.js` no node — sem navegador, sem framework. Só
funciona porque `collision.js`, `player.js`, `arrow.js` e `bosses/monolito.js` **não importam o
Phaser**. Manter assim.

**Ponto cego do `npm test`:** ele não carrega `World.js`. Erro de render, referência quebrada ou
API do Phaser passa batido. Isso já deixou o jogo quebrado com os testes verdes.

No dev server, `window.game` fica exposto. Tecla **`H`** liga os contornos de colisão.

**Telas de conferência de arte** valem o custo: `/badalo.html` mostra as oito orientações do sino
caído com grade numerada e a posição atual marcada. Acertar tabela de arte olhando o chefe em
combate custa uma luta inteira por tentativa — e detecção automática de "onde fica a peça" falhou
três vezes seguidas antes disso. Grade numerada + quem conhece a arte apontando a célula resolveu
em uma rodada.

## Mapa dos arquivos

| Arquivo | O que é |
|---|---|
| `src/tuning.js` | Todas as constantes: `TUNING`, `FX`, `THEMES`, `TERRAIN`, `MONOLITO`, `MONOLITO_ART`, `SINO`, `OUTRO`, `SPRITES`, `PLAYER_BOX`, `COLOR` |
| `src/fights.js` | Registro dos chefes por id, e o chefe vazio das salas de passagem |
| `src/run.js` | A partida viva e o `localStorage`: almas, mortes, tempo, sala |
| `src/held.js` | O que está apertado agora no navegador; sobrevive ao restart da cena |
| `src/options.js` | Volume, tremor e contornos, em endereço próprio no disco. Opção não é partida |
| `src/audio.js` | Som sintetizado: receitas, mixagem medida, intervalo por som e teto de vozes |
| `src/palette.js` | A paleta mestra: toda cor do jogo, e o interruptor para voltar à antiga |
| `src/palette-antiga.js` | Retrato das cores de antes. Só existe para dar o caminho de volta |
| `src/fx.js` | Poeira e rastro da flecha: cosmético puro, sem Phaser, no delta real |
| `src/bosses/coro.js` | A segunda metade da luta do Sino: sete corpos, um coração |
| `src/bosses/crisol.js` | O caldeirão: derrama o chão, e só brasa o mata |
| `src/ui/font.js` | Fonte de bitmap 5×7 desenhada com `fillRect`; acento é a letra mais a marca |
| `src/ui/chrome.js` | Moldura dos menus: fundo, vinheta, réguas, placas, elos, ícones de alma |
| `src/scenes/Titulo.js` | Tela de título: logo de pedra rachada, menu, cursor de flecha |
| `src/scenes/Slots.js` | Escolha de vínculo: quatro painéis, almas carregadas, apagar em duas etapas |
| `src/scenes/Pausa.js` | Pausa e opções, dois modos do mesmo painel, lançado por cima de quem chamou |
| `src/draw.js` | `DEPTH` (camadas) e `mixColor`, comuns a quem desenha |
| `src/terrain.js` | Pinta chão, muralha e mar de lava a partir de um **tema**. Serve qualquer sala |
| `src/collision.js` | `circleHit`, `halfDiscHit`, `solidPoint`, `boxBlocked`, `moveBox`, `sweep` |
| `src/player.js` | Andar, mirar devagar, rolamento, Vínculo |
| `src/arrow.js` | `HELD → FLYING → STUCK → GROUND → RETURNING`, carga, brasa, dano na volta |
| `src/bosses/monolito.js` | Fases, gêiseres, jatos, destroços, calor |
| `src/bosses/monolitoView.js` | Desenho da pirâmide, coração, gêiseres, jatos e cacos |
| `src/bosses/sino.js` | Pêndulo, janela do alto, puxão, tombo, badalo |
| `src/bosses/sinoView.js` | Desenho do sino, corrente, anel da janela e badalo |
| `src/bosses/sentinela.js` | Mira, deriva por distância, espelho, feixe com quique, cegueira |
| `src/bosses/sentinelaView.js` | Desenho do disco espelhado, prévia do feixe e núcleo |
| `src/scenes/World.js` | Cena: entrada, laço, jogador, flecha, câmera, desfecho. **Não conhece chefe** |
| `src/data/rooms.js` | `buildArena` (octógono por código), sala de teste, arena do Monólito e a do Sino |
| `assets/` | Jogador (folha + JSON), flecha, pirâmide, coração, 4 fragmentos |
| `screenshots/` | Referências: `fogo1..3.png` e `print1..7` |

## Próximo passo

Com a paleta travada, gerar arte nova deixou de ser risco.

**Fase 6: os chefes que faltam.** Os dois irmãos já desenhados no elenco são **O Crisol** (fogo,
irmão do Monólito: bebe e devolve o mar de lava, e o chão pisável encolhe) e **O Prisma** (região
fria, irmã da Sentinela: o feixe se parte em três e congela o chão onde encosta).

**Fase 6: os outros chefes.** O elenco está na seção 6.1 do DESIGN, e o custo por chefe hoje
é uma máquina de estados, uma view e uma sala — o resto (registro, portas, save, câmera, temas)
já existe. Antes do primeiro deles: **travar a paleta**, que é o retrabalho mais caro do projeto.

A fase 8 continua aberta em **créditos e final** — som (com fundo de sala), opções e pausa já
estão de pé. Nada ainda reage a juntar todas as almas: o jogo acaba com o jogador numa sala vazia. A 7 saiu na frente da 6 de propósito: suco é ajuste em cima do que já
existe, e sai muito mais caro depois de oito chefes escritos.

**Decidir a leitura da fase 1 da Sentinela.** A prévia do feixe só aparece na carga, quando a
mira já está travada — então o jogador não tem laço de retorno enquanto se posiciona. Medido com
o jogador **parado**: a carapaça abre em 12 a 49 s em seis de sete pontos da sala, e num deles não
abre em 60 s. Jogando ativo é melhor, mas o alvo de ritmo do DESIGN é 30 s por luta.

Três consertos possíveis, do mais discreto ao mais explícito: mostrar o traçado **só quando ele
resolve** (aparece no instante em que você achou, e nada fora disso); mostrar **enquanto o arco
está armado** (mira sob demanda); ou mostrar **só o primeiro trecho**, dando direção sem entregar
o quique. A prévia ligada o tempo todo existiu e foi tirada de propósito, por entregar a luta.

Fechar a leitura do Sino jogando de verdade. Depois do primeiro teste ele subiu de dificuldade:
janela 520 ms (era 700), período 2900 ms (era 3400), mínimos 210 e 1700, e o plano da varredura
passou a girar a cada travessia — antes dava para ficar parado fora da linha a luta inteira.
Pico medido no meio do arco: 571 px/s contra 158 px/s de caminhada.

Nenhuma pendência de arte no Sino: as duas folhas são repintadas em pedra no carregamento.

A paleta está travada — era o retrabalho mais caro possível neste projeto, e deixou de ser risco.

## Decisões que ainda valem

- **Phaser 4.2.1 como framework, não como motor de física.** Arcade Physics desligado; toda
  colisão em `collision.js`. A flecha anda dezenas de px por quadro e precisa de `sweep`.
- **Matter.js avaliado e recusado**, para o líquido e para o resto. Ele já vem dentro do Phaser
  4.2.1 (942 KB de fonte, nenhuma dependência nova), mas **não tem solver de fluido**: líquido
  só sairia como centenas de corpos rígidos, e medido no próprio jogo isso custa 0,57 ms com 200
  gotas, 3,6 ms com 800 e 10,3 ms com 1600 — contra 0,2 ms do campo de volume com a poça de uma
  rodada e 0,8 ms com o chão inundado de propósito. Fora o custo: seria um **segundo sistema de
  colisão** (regra 1), que não roda no `npm test` sem DOM e levaria embora a rede que pegou todos
  os bugs deste chefe; a flecha a 42 px por quadro atravessaria solver discreto sem substep; e
  visto de cima, sem gravidade, o que Matter faz de melhor (empilhar, repousar, rampa) não
  existe. Corrente do Sino, se um dia incomodar, sai em ~20 linhas de verlet à mão.
- **720×480, 3:2.** Custo assumido: perde a escala inteira exata para 1080p (vira ×2 com tarjas) e
  sai do 16:9 das referências. 640×360 seria a alternativa que preserva o encaixe.
- **Ao mudar resolução:** velocidades e distâncias do mundo escalam junto; **raios presos a sprite
  não**. A densidade de pixel da arte não muda — é a arena que cresce.
- **Vínculo** é a mecânica própria: recall traz a flecha, Vínculo leva o jogador até ela. Não
  adiciona sistema, reusa o estado que a flecha já tinha.
- **Uma flecha, uma vida, só chefes, sem HUD, sem progressão.** Nada de stamina, item ou melhoria.
- **Chefe morto silencia a arena** e o coração fica como marca, apagado.
- **Identificadores em inglês, comentários e docs em português.**
- **Terreno é pintado por tema, não por sala.** `src/terrain.js` recebe um tema de `THEMES` e
  pinta chão, muralha e lava. Área nova troca cores, não código de desenho. A arena vem de
  `buildArena` em `data/rooms.js`, também parametrizada.
- **Chefe são três peças, e a cena não conhece nenhuma:** máquina de estados sem Phaser, view que
  desenha, e sala. `src/fights.js` junta e o endereço escolhe. Sem isso o `World.js` ganharia um
  `if` por chefe — ele já tinha 1098 linhas com um chefe só; hoje tem 676 com dois.
- **O Vínculo move o corpo mais leve.** `boss.tetherPull(player)` devolve `'yield'` (ele vem) ou
  `'slam'` (você vai, e vai **até** ele, sem parar antes). Chefe que não implementa mantém o
  comportamento antigo. Foi assim que o Sino nasceu sem sistema novo nenhum.
- **A luta começa quando a flecha encosta no titã**, não quando o jogador entra na sala. A cena
  guarda `lutando`: antes dele o chefe não recebe `update` nenhum — nem relógio, nem gêiser, nem
  dano — e a porta não tranca. Sai de um campo só, sem ramo por chefe.
- **Morrer devolve ao checkpoint**, que é o último obelisco guardado (`run.checkpoint`). A morte
  não interrompe a simulação: só o controle some, e o véu sobe por cima do mundo rodando.
- **Chefe barato é objeto rígido que gira.** Sem membro, sem direção, sem ciclo de andar: é o que
  fez o Monólito caber numa folha e é o filtro para escolher os próximos.

## Armadilhas já pagas

Estas custaram tempo e vão se repetir se esquecidas.

**Asserção sobre direção de partícula com `spread` padrão é loteria.** O teste do suco passou
nas duas primeiras rodadas e falhou em oito das dez seguintes: o leque padrão é 2π, então a
partícula sai para qualquer lado. Teste de direção pede leque estreito — e teste novo roda dez
vezes antes de ser considerado verde.

**Trajeto que acabou não se reusa sozinho.** Trocar `moveToward` (que sempre anda) por um
trajeto com duração deixou um caminho sem trajeto montado: ao perder a janela do tombo, o sino
voltava **teleportado** para o centro, porque o arco antigo já constava encerrado no primeiro
quadro. Toda entrada em estado de deslocamento tem que montar o seu.

**Blend aditivo e `setTint` não fazem nada sobre pixel preto.** ADD soma a cor da textura e o
tint a multiplica: obsidiana some nos dois. A pirâmide adormecida só virou cinza com uma
**textura própria** em pedra clara, cruzada por alpha com a acordada. Duas rodadas foram gastas
achando que o desenho não estava aparecendo.

**Teclas nascem soltas a cada `scene.restart`.** O objeto `Key` do Phaser é novo, e o jogador
parava seco do outro lado da porta até o navegador repetir o evento. O estado físico do teclado
tem que morar fora da cena.

**Parede que fecha em cima do jogador prende ele para sempre.** `moveBox` anda 1 px por vez e
testa o destino: um corpo já dentro do sólido é barrado em todas as direções. A porta que tranca
no primeiro tiro pode fechar sobre quem atirou da soleira, então quem fecha é quem desencalha.

**Referência de câmera guardada antes de um `scene.restart` mente.** O objeto continua
respondendo, com o zoom do último quadro antes do reinício, enquanto a câmera viva já voltou ao
normal — parece que o zoom da morte ficou preso. Ler sempre por `scene.cameras.main` na hora.

**Medir no meio do caminho dá falso positivo.** Três vezes: testei `arrow.shoot()` direto em vez
do caminho input→carga→tiro e não vi que a carga chegava zerada; chamei `shakeEffect.update()`
fora da ordem do motor e "provei" um tremor que não existia; setei `s.aiming` (saída) em vez de
`s.aimHeld` (entrada). **Medir sempre pela entrada real.**

**Efeito de câmera se verifica com `game.step(time, delta)`**, que roda o quadro inteiro na ordem
verdadeira. O painel do navegador roda com a aba oculta, então nada anima sozinho, e avançar
chamando `scene.update` na mão inverte a ordem em relação ao `CameraManager`.

**Estado de luta não sobrevive entre chamadas de ferramenta.** Montar, rodar e medir precisam
estar no mesmo passo, reforçando o estado a cada quadro — o chefe rearma, os gêiseres ciclam e a
cena reinicia sozinha.

**Captura de tela dentro de um `browser_batch` mostra o quadro anterior.** Montar o estado num
passo e fotografar em outra chamada. Para segurar a cena parada: `scene.freeze = 1e7`. Trocar
`scene.update` não funciona — o Phaser guarda a referência no boot.

**Cheiro de folha de rotação: a sequência de quadros por direção é cíclica.** Ao ler o mapeamento
do sino caído à mão errei duas vezes, e as duas passaram na conferência porque o sul calhava de
cair no mesmo quadro nas três hipóteses. O que resolveu foi desenhar **os oito setores em roda no
renderizador de verdade**, cada um com uma seta na direção esperada — quatro deles grandes numa
tela só bastam para decidir. Ler quadro pequeno em folha de contato não decide nada.

**Feixe que entorta lê como perseguição.** Travar o ponto no chão e desenhar da boca até ele fazia
o feixe inclinar quando o sino se afastava — e isso lia como se ele estivesse mirando no jogador.
Reto embaixo da boca, acompanhando o corpo, diz a coisa certa: o feixe é do sino.

**Efeito que sai de baixo de um corpo desenha na camada de baixo.** O feixe estava em
`bossTopGfx` e cruzava a frente do sino em vez de sair da saia.

**Ataque do chefe que reflete no próprio chefe fecha um laço de mira.** O feixe da Sentinela
quica na muralha e na face dela; o jogador aponta o raio **se movendo**, porque a direção dela sai
de onde ele está e a posição dela sai de quão longe. Medir antes de confiar valeu: 5% dos pares
posição/ângulo resolvem, mas 377 de 405 posições têm algum ângulo — o que só é jogável **porque a
prévia fica ligada fora da carga**.

**Driver de verificação que morre reinicia o chefe.** Perdi três rodadas achando que a fase 2
estava quebrada: o piloto morria numa espera, o `respawn` chamava `boss.reset()` e a carapaça
voltava. O passo do driver tem que desfazer a morte antes do respawn.

**Um controle de profundidade só.** O reflexo apagava por distância do objeto **e** por névoa;
os dois se somavam e ele sumia bem antes do fundo do espelho. A névoa faz o trabalho sozinha, e
ainda apaga ao longo do traçado em vez de dar um valor único para o trecho inteiro.

**`scene.restart` mantém a instância da cena.** Um objeto de desenho criado sob demanda
(`this.x ?? (this.x = add.graphics())`) sobrevive à troca de sala apontando para um objeto já
destruído, e some da tela sem erro nenhum. Tudo que desenha nasce em `create()`.

**`import()` no console do painel devolve outra instância do módulo.** Passei três rodadas achando
que o save estava quebrado: eu chamava `run.start(0)` por importação dinâmica, e a cena enxergava
outro `run`, com `slot: null`. Verificação de estado global tem que ler pelo que a cena expõe, ou
dirigir pelo menu de verdade.

**Tecla simulada precisa de `keyCode`.** `JustDown` olha o estado interno da tecla, que só o evento
do navegador atualiza, e o Phaser casa pelo `keyCode`. Setar `key.isDown` na mão não dispara nada.

**Travessia de sala não pode testar a borda da caixa.** A colisão segura o jogador dentro da grade,
então ele nunca passa dela — o gatilho é o último tile do corredor.

**Projétil do próprio jogador precisa de teste próprio.** A flecha rebatida voltava inofensiva:
nada no jogo testava flecha contra jogador. Está no `World`, pelo trecho percorrido — com carga
cheia ela anda 42 px por quadro e passaria direto por cima.

**Chefe que vira sozinho invalida mira parada.** Testar tiro nas costas dela mirando e carregando
10 quadros errava, porque ela girava nesse meio tempo. Não é bug, é a luta.

**Corpo pendurado não usa a mesma pegada de corpo apoiado.** A pirâmide apoia e ocupa o espaço
**acima** da base: meio-disco com a barriga para cima. O sino pende, e o chão que ele ocupa fica
**à frente** da boca, na direção da câmera: meio-disco invertido. `halfDiscHit` recebe `down`.

**Âncora de coisa presa a um corpo tem que incluir a altura.** A flecha cravada no sino era
guardada contra o ponto do chão, então escorregava no bronze toda vez que ele subia.

**"Metal polido" e "pedra" diferem no teto de brilho, não no matiz.** A cor média das duas folhas
do sino é quase idêntica (86,67,46 contra 76,65,48); o que separava era o especular, 240 contra
196. Normalizar o teto e repintar resolveu.

**Medir direção por pixel só funciona se a marca for isolável.** Na pirâmide o matiz separava as
rachaduras; no sino caído a boca é preta e a sombra do bronze também, e o centroide escuro caiu
para baixo nos oito quadros. Mapeamento lido à mão, em `SINO_ART.fallenOrder`.

**Chefe novo esbarra no que a cena assume do antigo.** `igniteAt` era chamado direto e o Sino não
tem fogo: quebrou no primeiro tiro. O que é de um chefe só entra como opcional na cena.

**Substituição por âncora textual falha em silêncio.** Duas vezes ancorei numa linha que tinha
deixado de existir; o código novo ficou perfeito e nunca era chamado. Conferir que a âncora existe
antes de confiar no resultado.

**O console do painel não esvazia entre recargas.** Erros de módulos antigos do HMR ficam lá e
parecem bugs vivos. Confirmar rodando o caminho suspeito dentro de um `try/catch`.

**`textures.addCanvas` devolve `null` se a chave já existe**, e `create` roda de novo num
`scene.restart()`. Remover antes de registrar.

**Parâmetros de filtro da v4 se ajustam por propriedade**, não por argumentos posicionais — chutar
a assinatura apagou a cena inteira. `quality` e `distance` do `Glow` são só leitura.

**Sprite gerado por IA varia de quadro para quadro.** A base da pirâmide oscilava 16 px entre os 8
quadros de rotação; com origem única ela balançava e lia como se flutuasse. A âncora é medida
**por quadro** no carregamento.

**Classificar cor por distância RGB não pega franja anti-serrilhada.** Um ciano a 30% fica longe
do ciano puro mas mantém o matiz. Classificar **por matiz** resolveu e zerou os 1774 pixels que
sobravam no corpo.

**Desenho não pode ser mais estreito que a hitbox.** Os jatos afinam, então o desenho vai de 1,7×
a 1,2× da faixa letal — sempre maior, para nada matar fora do que se vê.

**Evento instantâneo não se mistura com acumulador que decai.** A flecha em brasa punha `heat = 1`
e o decaimento comia antes do teste do limiar. Brasa chama `shatter()` direto; `heat` é só do
caminho gradual da lava.

**Ruído de cenário precisa de gerador determinístico.** `drawRoom` roda de novo a cada
`scene.restart()`; com `Math.random` o piso mudaria de cara a cada morte.

**A flecha sai da mão, a mira sai dos pés.** `faceX/faceY` é a direção do corpo e a flecha nasce
9 px acima (`bowHeight`), então mirar "direto" num alvo pequeno erra por esses 9 px. Alvo de raio
7 exige o jogador se posicionar contando com isso. Não é bug — mas qualquer script de verificação
que mire do centro do jogador vai errar e parecer bug.

## Divergências entre hitbox e visual, para decidir

- O sino tem meio-disco de raio 34 sob um desenho de 68 × 65 px. O corpo desenhado sobe bem
  acima do arco de colisão — é seguro (nada mata fora do que se vê), mas dá para passar "atrás"
  dele sem morrer. Mesmo dilema da pirâmide.
- `playerRadius` 9 dá 18 px de diâmetro para um personagem de ~10 px de largura. Generoso demais
  para um jogo que mata em um toque; 5 ou 6 casaria com o desenho.
- A pegada letal do chefe é um meio-disco de raio 51 sob uma base de ~151 px. Círculo não casa com
  losango achatado: 51 acerta a profundidade, ~75 acertaria a largura.

## Decisões em aberto

- **Editor de salas:** Tiled ou mapas em código. Decidir na fase 5, quando o número real de salas
  for conhecido. Menos de 10 salas não justifica pipeline de Tiled.
- **Chefe 3D pré-renderizado** (DESIGN 2.4): decidido que será pré-renderizado do Blender quando
  algum chefe pedir; nenhum pediu ainda.
- **Áudio:** sem direção sonora definida. Fase 8.

## Riscos conhecidos

- **Paleta não travada.** Cada arte nova entra por conta própria; refazer por inconsistência é o
  retrabalho mais caro do projeto.
- **Ajuste de game feel** é o risco central e não some com planejamento. Por isso a fase 4 veio
  antes dos outros chefes.
- **Colosso Adormecido em 128×128** é a faixa onde a geração por IA perde coerência. Plano B no
  DESIGN.md: gerar em partes e montar em código.
