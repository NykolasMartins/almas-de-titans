# CLAUDE.md

Instruções para agentes trabalhando neste repositório.

## O que é

**Almas de Titans** — continuação indireta de *Titan Souls*, jogo de navegador. Só chefes, uma
vida, uma flecha. A mecânica própria é o **Vínculo**: o recall traz a flecha até o jogador, o
Vínculo puxa o jogador até a flecha.

O design completo está em [DESIGN.md](DESIGN.md). O estado atual e o histórico de decisões
estão em [contexto.md](contexto.md). **Leia os dois antes de mexer em qualquer coisa.**

## Stack

- **Phaser 4.2.1** — framework, não motor de física (ver regras abaixo)
- **Web Audio direto**, sem o gerenciador de som do Phaser e sem arquivo de áudio: cada som é
  sintetizado em `src/audio.js` (ver regra 16)
- **Vite** — dev server e build, sem mais nada
- **JavaScript puro, ES modules** — sem TypeScript, sem React, sem bibliotecas extras
- Resolução interna **720 × 480** (3:2), escala inteira

## Comandos

```bash
npm run dev
```

`/` abre o **título**. Uma luta por endereço para cair direto num chefe: `/piramide`, `/crisol`, `/sino` e
`/sentinela`.

`/badalo.html` é uma tela de conferência de arte: mostra as oito orientações do sino caído com
uma grade numerada, para acertar a tabela de posição do badalo sem ter que vencer o chefe.

```bash
npm test
```

```bash
npm run build
```

`npm test` roda `src/collision.test.js` e `src/game.test.js` no node, sem navegador e sem
framework. Só funciona porque `collision.js`, `player.js`, `arrow.js` e `bosses/monolito.js`
**não importam o Phaser**. Manter assim: é o que permite testar as máquinas de estado de verdade.
Rodar antes de considerar qualquer coisa pronta.

**Ponto cego:** `npm test` não carrega `World.js`. Erro de render, referência quebrada ou API do
Phaser passa batido — isso já deixou o jogo quebrado com os testes verdes. Mudança visível exige
olhar no navegador.

No dev server, `window.game` fica exposto para inspeção pelo console do navegador.

**`ESC` pausa** (painel por cima, cena de baixo pausada de verdade: nada corre, nem o relógio da
partida) e é de lá que se chega às **opções** — as mesmas do título, um arquivo só.

**Tecla `H` liga e desliga os contornos de colisão e o texto de estado** em jogo: jogador, chefe,
gêiseres ativos, destroços armados e flecha. É a forma de conferir se hitbox e desenho concordam —
e, desde a fase 7, a única forma de ver o texto de depuração, porque o jogo não tem HUD.

## Regras de arquitetura (não quebrar)

1. **Arcade Physics fica desligado** para jogador, flecha e chefes. Toda detecção de acerto
   mora em `src/collision.js`. Phaser desenha e toca som; o jogo decide o que encosta em quê.
   Nunca introduzir um segundo sistema de colisão.
2. **Simulação em passo fixo de 1/60 s.** `World.update` acumula o delta e chama a simulação em
   passos fixos. Câmera lenta e hitstop **não** mexem no passo: o hitstop pula o acúmulo e a
   câmera lenta multiplica o delta **antes** de acumular, então a simulação nunca sabe que o
   mundo desacelerou. Nunca usar o delta cru para mover nada — o jogo mata em um toque e não pode se
   comportar diferente em monitor de 144 Hz. Verificado: 60 passos por segundo simulado a 60,
   144 e 30 Hz, e o delta é limitado a 250 ms para não gerar espiral após um travamento.
3. **Entrada discreta é travada por evento, nunca amostrada.** Botão de mouse usa `pointerdown`
   e `pointerup`; um clique curto cujo down e up caem entre dois passos de simulação nunca
   apareceria na amostragem. Vale para qualquer ação nova de apertar e soltar.
4. **Terreno se pinta por tema, sala não desenha a si mesma.** Chão, muralha e lava saem de
   `src/terrain.js` com um tema de `THEMES`; a sala só diz qual tema usar. **Chefe que cria
   terreno usa a mesma pintura:** a poça do Crisol chama `paintLavaSurface`, a mesma função do
   mar lá fora. Lava desenhada de outro jeito não é reconhecida como lava. Área nova = tema novo,
   nunca código de desenho novo. O tema carrega cor **e motivo** do piso (`motif`) e da muralha
   (`wallMotif`); motivo novo entra como um ramo em `paintFloor`/`paintWalls`, não como sala que
   se desenha. `mirrorWalls: true` liga o reflexo dos corpos na muralha, desenhado pela cena. Geometria de arena vem de
   `buildArena` em `data/rooms.js`, e mobília fixa da sala (os sinos pendurados, por exemplo) é
   dado da sala, desenhado pela view do chefe.
5. **Chefe são três peças, e a cena não conhece nenhuma delas.** Máquina de estados
   (`bosses/x.js`, sem Phaser), view que desenha (`bosses/xView.js`) e sala. O
   registro fica em `src/fights.js`; quem diz qual chefe vive onde é a **sala**.
   Sala de passagem recebe `SEM_CHEFE`, um chefe que responde a tudo e não faz
   nada — sai mais barato que um `if (this.boss)` espalhado pela cena.
   `World.js` não pode ganhar um `if` por chefe — foi o que quase dobrou o arquivo.
   A view expõe `preload`, `create`, `draw(scene, boss, time)`, `hitboxes(g, boss)`
   e `status(boss)`; a cena é dona das camadas (`decalGfx`, `airGfx`, `bossGfx`) e
   as limpa antes de chamar a view.
   Um chefe pode **delegar a outro** sem que a cena saiba: o Sino entrega a luta
   ao Coro quando o badalo escapa, repassando `update`, `hitTest` e `onArrowHit`.
   É mais barato que ensinar a cena a trocar de chefe no meio da sala — e mantém
   `run.souls` contando salas, não fases.
   O **despertar** também é contrato, não ramo: a cena publica `scene.wake`
   (`rise` 0..1 e `roar` 0..1) e cada view decide como o seu chefe dorme, se
   levanta e grita. A cena não sabe o que é sono de ninguém.
6. **A cena reinicia a cada sala; o que o jogador conquistou vive em `src/run.js`.**
   Almas, mortes, tempo e sala atual não podem morar em `World`, que é recriado a
   cada travessia. **Progresso** (almas e sala) é explícito e só no obelisco — e
   é isso que faz o obelisco valer alguma coisa. Guardar também fixa o
   **checkpoint**: a morte devolve o jogador para lá, nunca para a sala da morte.
   **Estatística é outra coisa:** mortes e tempo vão para o disco **a cada
   morte** (`run.saveDeaths`), porque contagem que some ao fechar a aba não
   conta nada. O que a morte nunca grava é alma nem sala — isso viraria
   checkpoint de graça.
   **Opção não é partida:** tremor e contornos vivem em `src/options.js`, com
   endereço próprio no disco (`almas-de-titans:opcoes`). Apagar um vínculo não
   pode desligar o tremor de ninguém. E **toda opção tem que fazer alguma coisa
   hoje** — `OPÇÕES` levou a lugar nenhum por três fases, e trocar isso por
   botões que também não fazem nada seria o mesmo defeito com mais tela.
7. **Toda constante ajustável vive em `src/tuning.js`.** Nenhum número mágico solto no código.
   Se precisou de um valor novo, ele nasce lá. **Cor é exceção de lugar, não de regra:** ela
   nasce em `src/palette.js` e o `tuning` só reexporta `THEMES` e `COLOR`. Área nova é uma
   fatia da paleta (matiz + saturação + duas luminâncias), nunca um punhado de hexadecimais
   novos, e as duas regras — pedra dessaturada, quente saturado — são cobradas por `npm test`.
   `PALETA = 'antiga'` devolve as cores anteriores.
8. **Trabalhar sempre em pixels internos** (720×480). A escala para a tela é problema do Phaser,
   nunca do código de jogo.
9. **Nenhuma dependência nova sem perguntar.** Se algo parece exigir uma biblioteca, propor
   antes com o motivo.
10. **Arte nunca bloqueia código.** O que não tem arte é desenhado com `Graphics`; a arte entra
   trocando arquivo, sem tocar em lógica. Já valeu para jogador, flecha, pirâmide, coração e
   fragmentos. Vale também para texto: `src/ui/font.js` é uma fonte de bitmap 5×7 desenhada com
   `fillRect`, porque texto do Phaser com fonte do sistema não é pixel art — ele borra em qualquer
   escala. Menu novo usa `drawText`, nunca `add.text` (o overlay de debug é a exceção, e desde a
   fase 7 ele só aparece com `H` ligado).
11. **Profundidade é o `y` dos pés.** Entidades e cenário alto usam `setDepth(y)`, então quem
   está mais embaixo na tela desenha na frente e o jogador some atrás de um pilar. A faixa
   0..272 é reservada para isso; camadas sempre-por-cima ficam em `DEPTH` (corda 900,
   escurecimento 1000, debug 1001). Nunca usar profundidade fixa pequena para entidade.
12. **Desenho nunca mais estreito que a hitbox.** Se o visual afina e a colisão não, o jogador
   morre fora do que enxerga. Os jatos de parede desenham de 1,7× a 1,2× da faixa letal.
   Para quem pende do teto o desenho do corpo fica no ar e não cobre nada: aí **quem desenha a
   pegada é a sombra**, e ela tem que cobrir o meio-disco inteiro.
13. **Ruído de cenário usa gerador determinístico**, nunca `Math.random`: `drawRoom` roda de novo
    a cada `scene.restart()` e o piso não pode mudar de cara a cada morte.
14. **Ao mudar resolução:** velocidades e distâncias do mundo escalam junto; **raios presos a
    sprite não**. A densidade de pixel da arte não muda — é a arena que cresce.
15. **Uma mecânica nova é uma decisão de design, não de implementação.** O escopo é o da seção 3
    e 4 do DESIGN.md. Nada de stamina, itens, melhorias ou progressão de dano.
16. **O que faz sentido fazer som, faz.** Titã caindo, bronze batendo, corrente rangendo no alto
    do arco, gêiser abrindo, lava borbulhando, o caldeirão bebendo. Quem toca é a **transição**,
    nunca o estado: ler "está rolando" tocaria o raspão sessenta vezes por segundo. Fundo de sala
    é outra coisa — um leito contínuo por área (`ambiente`), que **não recomeça ao trocar de sala
    dentro da mesma área**, porque cortar o som num corredor entrega que a cena foi recriada; e
    que **abafa na pausa em vez de cortar**, porque cortar soa como bug.
17. **Som é sintetizado em código, e sai por pedido de nome.** `src/audio.js` monta cada som com
    osciladores e ruído do Web Audio — mesma escolha da fonte de bitmap: o que não tem asset é
    feito em código, e o dia que houver `.ogg` a troca é lá dentro. Quem toca chama `toca('nome')`
    e não sabe o que é Web Audio; chefe pede pelo `ctx.som` do contrato, do mesmo jeito que pede
    poeira. Três coisas que não se negocia: o contexto **só nasce num gesto** do jogador (a
    espera mora em `main.js`, não numa cena, senão endereço direto de luta fica mudo); todo som
    tem **intervalo mínimo** próprio, porque a lava pinga dez vezes por segundo; e a mistura é
    **medida com analisador**, não estimada — filtro come volume de um jeito que não dá para
    adivinhar. Nome de som é ligação que nenhum compilador confere: `npm test` varre o código e
    cobra que todo nome pedido exista.

## Pegadinhas do Phaser 4

A v4 reescreveu o renderizador. Tutoriais e respostas de v3 estão desatualizados nestes pontos:

- `roundPixels` nasce `false`. Ligar explicitamente na config, senão o sprite treme em sub-pixel.
- `setTintFill()` não existe: usar `setTint()` + `setTintMode()`. Afeta o flash de acerto.
- `Math.TAU` foi corrigido de `PI/2` para `PI*2`. Código copiado de v3 que use `TAU` está errado.
- `Geom.Point` removido, usar `Vector2`. `Struct.Set` e `Struct.Map` removidos, usar os nativos.
- `Mesh`, `Plane` e `BitmapMask` removidos. FX e máscaras viraram um sistema único de filtros.
- `SpriteGPULayer` existe e **não** deve ser usado: este jogo desenha dezenas de sprites, não
  milhões.
- **Filtros se ajustam por propriedade** (`glow.outerStrength`, `vig.radius`), não por argumentos
  posicionais — chutar a assinatura apaga a cena. `quality` e `distance` do `Glow` são só leitura.
- **`textures.addCanvas` devolve `null` se a chave já existe**, e `create` roda de novo num
  `scene.restart()`. Remover a textura antes de registrar.
- **`Graphics` não tem blend aditivo garantido.** Para brilho aditivo, usar `Image` com
  `setBlendMode(Phaser.BlendModes.ADD)`.
- **Blend aditivo soma a cor da textura, e `setTint` multiplica ela.** Sobre pixel preto os dois
  não fazem nada: nem clareiam, nem pintam. Corpo escuro que precisa virar cinza pede **textura
  própria**, cruzada por alpha — foi o que a pirâmide adormecida custou.
- **Efeito contínuo de câmera não pode ser feito rearmando `camera.shake` a cada quadro.** O
  `CameraManager` roda **antes** do `scene.update`: ele calcula o offset, e o `shake(..., force)`
  chamado em seguida zera esse offset logo antes de renderizar. A câmera nunca sai do lugar.
  Para efeito contínuo, deslocar `camera.setScroll` direto no `scene.update`. `camera.shake` só
  serve para impacto disparado uma vez.

## Como verificar no navegador

O painel roda com a aba oculta: `requestAnimationFrame` fica parado e nada anima sozinho. Para
avançar o jogo, use **`game.step(time, delta)`**, que executa o quadro inteiro na ordem verdadeira
(câmera, cena, render). Avançar chamando `scene.update` na mão inverte a ordem em relação ao
`CameraManager` e engana em qualquer coisa de câmera.

Quatro regras que já custaram tempo:

1. **Medir pela entrada real, nunca pelo meio do caminho.** Testar `arrow.shoot()` direto escondeu
   que a carga chegava zerada; setar `s.aiming` (saída) em vez de `s.aimHeld` (entrada) escondeu
   que o recuo não acontecia.
2. **Montar, rodar e medir no mesmo passo.** Estado de luta não sobrevive entre chamadas: o chefe
   rearma, os gêiseres ciclam, a cena reinicia. Reforçar o estado a cada quadro do laço.
3. **O console do painel não esvazia entre recargas.** Erro de módulo antigo do HMR parece bug
   vivo. Confirmar rodando o caminho suspeito dentro de `try/catch`.
4. **Substituição por âncora textual falha em silêncio.** Se a âncora sumiu, o código novo fica
   perfeito e nunca é chamado. Já aconteceu duas vezes.
5. **`import()` no console do painel devolve outra instância do módulo.** Mexer em `run.js` por
   importação dinâmica não afeta o jogo — o estado que a cena enxerga é outro, e a verificação
   mente inteira. Ler pelo que a cena expõe (`scene.debug.text`, `scene.room`) ou dirigir pelo
   menu de verdade.
6. **Tecla simulada precisa de `keyCode`.** `Phaser.Input.Keyboard.JustDown` olha o estado interno
   da tecla, que só o evento do navegador atualiza — e o Phaser casa pelo `keyCode`. Setar
   `key.isDown` na mão não dispara nada.
7. **Referência de câmera guardada antes de um `scene.restart` mente.** O objeto continua
   respondendo, com o zoom e o scroll do último quadro antes do reinício, enquanto a câmera viva
   já voltou ao normal. Ler sempre por `scene.cameras.main` na hora.
8. **Captura de tela dentro de um `browser_batch` mostra o quadro anterior.** Montar o estado
   num passo e tirar a captura em outra chamada, senão a imagem contradiz o estado medido — e
   parece bug onde não há. Para segurar a cena parada para a foto: `scene.freeze = 1e7`. Trocar
   `scene.update` **não** funciona: o Phaser guarda a referência no boot e ignora a troca.

Tecla **`H`** liga os contornos de colisão e o texto de estado em jogo.

## Convenções

- **Identificadores em inglês, comentários e documentação em português.** Evita misturar
  idioma com a API do Phaser.
- ES modules, um assunto por arquivo. Sem barril de `index.js` reexportando coisas.
- Chefes são dados + máquina de estados com temporizadores. Sem IA, sem pathfinding — o jogador
  precisa decorar os padrões.
- Comentário só onde a intenção não é óbvia pelo código. Nada de comentário narrando a linha.
- Marcar simplificação deliberada com um comentário `ponytail:` dizendo o teto e o caminho de
  upgrade.

## Manutenção destes documentos

Ao terminar qualquer trabalho relevante, atualizar:

- **contexto.md** — sempre. Estado atual, decisão nova (com o porquê), próximo passo.
- **DESIGN.md** — quando o design mudar de fato: mecânica, número de tuning, contrato de arte,
  elenco de chefes.
- **CLAUDE.md** — quando mudar stack, comando, convenção ou regra de arquitetura.

Decisão registrada é decisão que não precisa ser rediscutida na próxima sessão. Decisão perdida
custa uma conversa inteira de novo.
