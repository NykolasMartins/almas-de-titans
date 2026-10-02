# Almas de Titans — Documento de Design

Continuação indireta de *Titan Souls*. Jogo de navegador. Sem inimigos comuns, só chefes,
um mundo silencioso entre eles, uma flecha, uma vida.

## 1. Premissa

Os Titãs já foram derrotados. As almas que estavam presas neles escaparam e se enterraram em
corpos novos — mais frios, mais mecânicos, feitos do que sobrou do mundo antigo. O jogador
carrega o mesmo arco, mas a corda agora prende: a flecha não só volta, ela puxa.

## 2. Decisões técnicas

| Item | Escolha | Motivo |
|---|---|---|
| Stack | **Phaser 4.2.1** + Vite, sem React | React não ajuda: não existe árvore de UI, o estado muda 60x por segundo. Phaser ajuda: entrega pronta toda a casca chata (ver 2.1). |
| Renderização | Phaser WebGL, `pixelArt: true`, `roundPixels: true` | Nearest-neighbor, sem sub-pixel. **Na v4 `roundPixels` vem `false` por padrão** — tem que ser ligado à mão, senão o sprite treme em sub-pixel. |
| Resolução interna | **720 × 480** (3:2), escala inteira | Mais pixel para a pixel art detalhada. Custo assumido em 2.2. |
| Física | **Arcade Physics desligado.** Colisão própria: círculos para entidades, grade de tiles para paredes, raycast para a flecha | Ver 2.1 — é a parte que o Phaser não resolve. |
| Save | `localStorage` | Um JSON pequeno. |

### 2.1 Phaser sim, mas como framework — não como motor de física

O que se usa do Phaser: carregador de assets, animação de spritesheet, cenas, input (teclado,
mouse e gamepad), áudio (a política de autoplay dos navegadores é chata de verdade), tweens,
emissor de partículas, efeitos de câmera (shake, flash, fade) e leitura de tilemap do Tiled.
São umas 400 linhas de casca que não precisam ser escritas, e são exatamente as áreas de onde
vem a sensação de acabamento.

O que **não** se usa: Arcade Physics para jogador, flecha e chefes. Motivos:

- O movimento daqui não é modelo de corpo com velocity/gravity. Rolamento com direção travada,
  puxão do Vínculo e mira que desacelera são todos controle direto de posição. Usar Arcade
  significaria desligar metade dele e brigar com a outra metade.
- A flecha anda 7,5 px por quadro com raio de 3 px. Arcade Physics não faz colisão contínua —
  a flecha atravessaria parede fina. O raycast tem que ser escrito de qualquer forma.
- Misturar dois sistemas de colisão é pior que usar só um.

Então toda detecção de acerto mora em `collision.js`. Phaser desenha e toca som; o jogo decide
o que encosta em quê.

### 2.1.1 Notas da v4 (renderizador novo, quebra coisas da v3)

A v4 trocou todo o pipeline WebGL da v3 por uma arquitetura de nós de renderização. Cenas,
input, áudio, loader, animação, tilemap, partículas e Arcade Physics continuam iguais — o que
mudou é renderizador, tint, máscaras/FX, shaders e iluminação. Pontos que tocam este projeto:

- `roundPixels` agora nasce `false`. Ligar explicitamente.
- `setTintFill()` não existe mais: virou `setTint()` + `setTintMode()`, com seis modos de
  mistura. Afeta direto o flash branco de acerto no chefe — é o uso clássico de `setTintFill`.
- FX e máscaras viraram um sistema único de **filtros**, com biblioteca embutida bem maior.
  Três interessam aqui:
  - **GradientMap** — troca de paleta por shader. É como o núcleo pulsa, como o chefe pisca ao
    ser acertado e como a alma brilha, tudo sem gerar sprite extra.
  - **Blocky** — pixelização que respeita pixel art. Serve para a transição de morte e para o
    dissolver do chefe.
  - **Glow** — usado fraco, na câmera, para amarrar o brilho. A **Vignette** foi testada e
    descartada: escurecia a borda, que é onde o mar de lava vive. O bloom de verdade é desenhado
    por emissor (lava, colunas, jatos, chama da flecha e rachaduras quentes).
- Removidos: `Geom.Point` (usar `Vector2`), `Struct.Set` e `Struct.Map` (usar `Set`/`Map` do
  JS), `Mesh`, `Plane`, `BitmapMask`. Nada disso estava no plano.
- `Math.TAU` foi **corrigido** de `PI/2` para `PI*2`. Qualquer trecho copiado de tutorial de
  v3 que use `TAU` está errado agora. A rotação da flecha usa `Math.atan2` direto e ignora isso.
- `SpriteGPULayer` (milhões de sprites) existe e **não** será usado: este jogo desenha algumas
  dezenas de sprites por quadro. Ferramenta para outro problema.

Esses filtros reforçam a decisão de usar Phaser: são exatamente o acabamento da fase 7, e
escrevê-los à mão em WebGL cru seria o item mais caro do projeto inteiro.

### 2.2 Resolução: 720 × 480, e o que isso custou

Começou em 480×270 por causa da escala inteira exata para 1920×1080 (×4) e 3840×2160 (×8).
Mudou para 720×480 a pedido, por mais espaço de pixel para a arte detalhada — 2,7× mais pixels.

**O custo, assumido conscientemente:** 720×480 é 3:2, não 16:9. Em 1920×1080 a escala inteira
cai para ×2 (1440×960) e sobram tarjas; e a proporção do quadro passa a diferir das
referências, que são todas 16:9. A alternativa que preservaria o encaixe seria 640×360 (×3
exato para 1080p), com menos pixel que 720×480.

**Regra ao mexer na resolução de novo:** velocidades e distâncias do mundo escalam junto; raios
presos a sprite, **não**. A densidade de pixel da arte fica igual — é a arena que cresce. Foi
assim na passagem de 480×270 para 720×480: as velocidades subiram 1,5× e os raios do jogador,
do corpo e do núcleo ficaram como estavam.

Vale registrar: a qualidade percebida de *Titan Souls* não vem de contagem de pixel. Vem de
paleta restrita, silhueta limpa, quadros de animação suficientes e juice pesado.

### 2.3 Medições nas referências (`screenshots/`)

Números tirados dos prints, não deduzidos:

- **Pixel de arte = 4 px de tela em 1920×1080** (degraus de print7, blocos de print3). Confirma
  480×270 como resolução interna da referência.
- **Jogador: 10 a 13 px internos de altura** nas quatro telas medidas. O placeholder atual, de
  14 px, está no lugar certo.
- **Chefes: 67 px** (cavaleiro, print1) e **94 px** (flor, print2) de altura interna. Razão
  jogador/chefe entre 6:1 e 12:1.
- **Sombra**: elipse escura sob jogador e chefe, visível em print1. Confirma desenhar a sombra
  em código em vez de embutir no sprite.
- **Chão** com padrão de losango sutil: textura sem virar ruído.
- **Moldura escura** nas bordas da tela nas arenas de chefe.

### 2.4 Volume: cenário com altura, e a questão dos chefes 3D

*Titan Souls* é 2D, mas **parte dos titãs são modelos 3D de verdade** renderizados dentro da
cena — os próprios desenvolvedores confirmaram. É o que explica a rotação suave de alguns
chefes, que não lê como sprite. O cenário e o jogador continuam pixel art 2D.

São dois problemas diferentes, com custos muito diferentes:

**Cenário com volume — barato, e é o que mais rende.** Os pilares, penhascos e muros das
referências não são 3D: são tiles desenhados com face de topo e face lateral, mais **ordenação
por profundidade**. O jogador some atrás do pilar quando está acima dele e reaparece na frente
ao descer. Isso é `setDepth(y)` e arte, nada mais. Já está no código (regra 8 do CLAUDE.md) e a
arte de parede alta entra na fase 5, junto com as salas.

**Chefe 3D — caro em tempo real, barato pré-renderizado.** Phaser 4 não tem 3D, e a v4 até
removeu `Mesh` e `Plane`. As opções:

- **Pré-renderizar (recomendado).** Modelar o chefe no Blender, renderizar da câmera fixa do
  jogo em N passos de rotação × M quadros de animação, reduzir para a paleta e exportar como
  spritesheet. O jogo continua 2D puro, nada muda no motor, e a rotação fica tão suave quanto o
  número de passos. Custo: uma pipeline de Blender no lugar do PixelLab para esses chefes, e
  folhas grandes (36 rotações × 8 quadros = 288 células).
- **3D em tempo real com three.js sobre a cena.** Dois renderizadores, composição de camadas
  para intercalar sprites 2D com o modelo 3D, shader de pixelização e casamento de paleta, mais
  uma dependência pesada. Muito custo para um efeito visual — só se um chefe específico exigir
  rotação livre que a pré-renderização não cubra.

Decisão: **pré-renderizar**. Fica registrado para quando um chefe pedir esse tratamento.

### 2.5 Câmera: arena travada, exploração com scroll

Correção de uma suposição errada do plano original, que dizia "uma sala = uma tela" para tudo.

As referências mostram duas coisas diferentes:

- **Arena de chefe** (print1, print2): tela única, enquadrada, câmera parada. A luta inteira
  cabe num quadro.
- **Área de exploração** (print3, print6, print7): mapa maior que a tela, câmera seguindo o
  jogador.

Então a sala passa a ter tamanho próprio em tiles. Quando ela mede exatamente 30×17, a câmera
fica travada e o resultado é a arena de tela única. Em Phaser isso é `setBounds` mais
`startFollow`, então o custo é baixo — mas muda o formato dos dados de sala, que ganham largura
e altura. Entra na fase 5, junto com o grafo de salas.

### 2.6 Estrutura de arquivos

O que existe hoje:

```
index.html
src/main.js              config do Phaser, zoom inteiro, boot
src/tuning.js            todas as constantes, em blocos (ver seção 11)
src/scenes/World.js      cena única: entrada, laço, desenho, desfecho, processamento de arte
src/player.js            movimento, rolamento, mira, Vínculo
src/arrow.js             máquina de estados da flecha, carga, brasa, recall
src/collision.js         círculo, meio-disco, tile, sweep contínuo
src/data/rooms.js        sala de teste, arena do Monólito e a do Sino, geradas por código
src/fights.js            registro de lutas e o endereço que escolhe (/piramide, /sino)
src/draw.js              camadas de profundidade e mistura de cor
src/terrain.js           chão, muralha e lava, pintados por tema
src/bosses/monolito.js   fases, gêiseres, jatos, destroços, calor
src/bosses/monolitoView.js  desenho da pirâmide, coração, gêiseres e cacos
src/bosses/sino.js       pêndulo, janela do alto, puxão, tombo
src/bosses/sinoView.js   desenho do sino, corrente, anel da janela e badalo
src/audio.js             som sintetizado: receitas, mixagem medida e o teto de vozes
src/options.js           opções do jogador, em endereço próprio no disco
src/scenes/Pausa.js      pausa e opções: dois modos do mesmo painel
src/*.test.js            rodam no node, sem Phaser
assets/                  jogador, flecha, pirâmide, coração, fragmentos
screenshots/             referências visuais
```

Planejado e ainda **não** criado: `src/save.js` (fase 5) e `src/fx.js` — o suco vive hoje dentro
do `World.js`, e só vale extrair quando uma segunda cena precisar dele.

O laço: Phaser roda com delta variável, então `World.update` acumula o tempo e chama a
simulação em passos fixos de 1/60 s. São ~10 linhas e garantem que o jogo se comporte igual em
monitor de 60, 120 ou 144 Hz — obrigatório num jogo que morre em um toque.

### 2.7 Paleta: uma só, com duas regras

**Pronta.** Toda cor do jogo nasce em `src/palette.js`, e cada área é uma **fatia** da mesma
paleta em vez de um punhado de valores inventados na hora. Duas regras, e elas valem para
qualquer área nova:

1. **Pedra, gelo e cinza perdem cor.** Civilização e frio ficam entre 9% e 22% de saturação. É o
   que faz a sala parecer pedra em vez de plástico colorido — e é o que abre espaço para a regra
   seguinte.
2. **O que é quente é a única coisa saturada.** Lava, brasa, rachadura acesa e núcleo vivem entre
   70% e 100%, e o núcleo é o teto de todos. O contraste da tela não é claro contra escuro: é
   **morto contra aceso**.

Um tema, então, são quatro números — matiz da pedra, saturação da pedra, luminância do chão e da
muralha — mais três temperos: `brasa` (quanto a aresta acesa puxa para o fogo), `calor` (a força
do mar lá fora) e `brilho` (o quanto a superfície é polida). As diferenças entre chão, sulco,
muralha, aresta e treliça são **sempre os mesmos degraus**, e é isso que faz três áreas de cores
diferentes terem o mesmo peso e a mesma leitura.

**Terceira regra, e é a que faz parecer pintado: cor anda com a luz.** Nenhum degrau é a mesma
tinta mais clara ou mais escura. O que está na sombra **puxa para o frio e ganha saturação**; o
que está na luz **puxa para o quente e perde**. Na câmara do Monólito o sulco do chão cai para o
violeta e a aresta da muralha sobe para a areia acesa; na fortaleza a luz não é sol, é céu — o
alvo dela é 196° em vez de 45°. Pedra cinzenta é pedra sem essa conta.

**As três salas não podem ter o mesmo peso.** A câmara é escura com a borda pegando fogo, o
campanário é claro e chapado (é onde os sinos pretos se recortam) e a fortaleza volta ao
contraste, mas frio: chão fundo e chapa clara. Em luminância: chão 35, 82 e 46 numa escala de
255, contra 47, 71 e 60 na paleta antiga, que era a mesma sala pintada de três cores.

| Área | Matiz | Saturação | Chão / muralha | Calor do mar |
|---|---|---|---|---|
| Câmara do Monólito | 12° (rocha morna) | 20% | 0,15 / 0,43 — escura | 1,0 — lava viva |
| Campanário | 272° (violeta-cinza) | 7,5% | 0,34 / 0,50 — clara | 0,6 — crosta |
| Fortaleza | 212° (azul frio) | 19% | 0,21 / 0,52 — contraste | 0,12 — não tem mar |

As duas regras estão em `npm test`: nenhuma cor de pedra passa de 30% de saturação, nada quente
fica abaixo de 70%, e o núcleo é a cor mais saturada do jogo. Cor nova que fure isso quebra o
teste em vez de passar batido.

**Para voltar atrás:** `PALETA = 'antiga'` em `src/palette.js` devolve exatamente as cores de
antes, guardadas inteiras em `palette-antiga.js`.

## 3. Mecânicas do jogo original (todas obrigatórias)

### 3.1 Uma vida
Qualquer contato com o chefe ou com um projétil mata na hora. Sem barra de vida, sem HUD, sem
tela de game over, sem carregamento.

**Morrer não para o mundo.** O chefe continua o padrão, os gêiseres continuam o ciclo, a flecha
continua caindo — o que acaba é a visão do jogador: a câmera fecha nele enquanto um véu preto
avermelhado sobe por cima de tudo, em ~1,7 s. É a diferença entre "o jogo pausou" e "você
morreu e o lugar continua lá".

Depois disso a partida volta ao **último vínculo guardado**, não à sala onde morreu (seção 8).
O ciclo morrer→tentar de novo continua sem menu nenhum no meio, mas o custo da morte agora é o
caminho de volta — que é o que dá peso à decisão de ir até o obelisco guardar.

### 3.2 Uma flecha
O jogador tem exatamente uma flecha no mundo inteiro. Enquanto ela estiver no chão, cravada
numa parede ou no corpo do chefe, o jogador está desarmado. Recuperar a flecha é parte do
combate, não uma interrupção dele.

### 3.3 Máquina de estados da flecha

```
GUARDADA   → (soltar tiro)         → VOANDO
VOANDO     → (bate em parede)      → CRAVADA_SOLIDO
VOANDO     → (bate em chefe)       → CRAVADA_CHEFE
VOANDO     → (perde velocidade)    → NO_CHAO
qualquer*  → (segurar recall)      → RETORNANDO
RETORNANDO → (bate em parede)      → CRAVADA_SOLIDO
RETORNANDO → (solta o botão)       → NO_CHAO
RETORNANDO → (alcança o jogador)   → GUARDADA
qualquer*  → (jogador encosta)     → GUARDADA
```

A flecha **causa dano no caminho de volta**. Isso é central: cravar a flecha atrás do chefe e
chamá-la de volta atravessando o corpo dele é uma forma legítima — às vezes a única — de
acertar o núcleo.

A volta atravessa o corpo do chefe mas **para na parede**. Isso transforma a geometria da
arena em parte do problema: com um pilar entre você e a flecha, chamar não resolve, é preciso
reposicionar primeiro.

`CRAVADA_SOLIDO` e `CRAVADA_CHEFE` servem de âncora para o Vínculo. `NO_CHAO` não: flecha caída
só pode ser chamada ou recolhida a pé.

### 3.3.1 A flecha está sempre em cena
Ela nunca some. Guardada, fica nas costas **como mochila: ponta para baixo e colada ao corpo**,
cobrindo o tronco da cintura ao ombro — atrás do corpo quando o jogador encara a câmera, por
cima quando ele está de costas. Mirando, ela se encaixa no arco e **recua
conforme a corda é puxada**: a carga se lê na própria flecha, não num indicador. Em brasa, ganha
línguas de fogo que tremem e sobem.

### 3.4 Tiro com carga
Segurar o botão: o jogador desacelera para ~35% da velocidade, mira, e **o arco carrega**.
Soltar dispara com velocidade proporcional à carga, de `arrowSpeedMin` (toque seco) a
`arrowSpeedMax` (carga cheia, ~550 ms).

A flecha **perde velocidade em voo** e, abaixo de `arrowRestSpeed`, cai no chão. A perda usa os
dois termos do arrasto de ar real, `-(arrowDrag * v + arrowDragFast * v²)`, que em função da
distância vira:

```
dv/dx = -(arrowDrag + arrowDragFast * v)
```

O ponto é que a perda é sempre **proporcional à velocidade atual**, então **a própria
desaceleração vai diminuindo** conforme a flecha afrouxa: nunca há freada seca, e a queda é
progressiva do começo ao fim. Desaceleração constante em px/s² deixava o voo chapado, sem soco
inicial; e um termo quadrático alto (0,0039) virava freio de mão, tirando 437 px/s nos primeiros
50 px. O termo quadrático fica baixo, só como leve peso extra enquanto está rápida.

Três botões independentes: `arrowSpeedMax` é o soco inicial, `arrowDragFast` é quanto a queda se
concentra na frente, `arrowDrag` e `arrowRestSpeed` são o corpo e o comprimento da cauda.

Medido pelo caminho real de input:

| carga | sai a | 50 px | 100 px | 150 px | 200 px | 264 px | alcance |
|---|---|---|---|---|---|---|---|
| cheia | 1599 px/s | 1342 | 1201 | 1023 | 878 | 723 | 407 px |
| toque | 497 | 352 | 232 | 114 | — | — | 169 px |

A taxa de perda cai de ~5,1 px/s por pixel no arranque para ~2,4 no fim do voo: desacelera
sempre, cada vez menos. A carga cheia chega a um alvo a 264 px ainda com 45% da velocidade de
saída e crava na parede oposta; o toque seco morre em 169 px.

Isso dá ao tiro um custo que ele não tinha. Carregar exige ficar quase parado perto de um chefe
que mata em um toque, e atirar sem carregar significa ir buscar a flecha longe.

Dá para cancelar a mira rolando. **A mira é pela direção que o jogador encara**, não pela posição
do mouse — como no original. Virar o corpo com o arco armado faz parte do custo.

### 3.4.1 Recall com força
O recall usa o mesmo princípio ao contrário: a flecha **só vem enquanto o botão está segurado**,
e vai **acelerando** de `recallSpeedMin` até `recallSpeedMax` enquanto você puxa. Soltar no meio
não corta na hora — ela desacelera e cai, plainando ~143 px.

A desaceleração do recall (`recallDrag`) é bem mais forte que a do voo de propósito. Com a curva
do voo, soltar planaria ~357 px, quase a sala inteira, e soltar não custaria nada — o que
anularia a regra de ter que continuar puxando.

Consequência de design: matar pela volta da flecha deixa de ser automático. Uma volta lenta
atravessa o chefe devagar e te obriga a segurar durante o ataque dele; puxar até ficar rápido
custa tempo parado.

Se a volta crava numa parede, é preciso soltar e puxar de novo — senão ela ficaria num laço de
cravar e repuxar no mesmo ponto.

### 3.4.2 Leitura na tela (câmera)
As duas ações têm resposta de câmera proporcional à força, para que o jogador **sinta** a carga
sem HUD nenhum. Constantes em `FX` no `tuning.js`.

- **Carga do arco**: o efeito é **enquanto puxa a corda**, não no disparo. Zoom e tremor crescem
  junto com a carga (medido: 1,0004 e tremor zero no início; 1,033 e 0,0038 da tela na carga
  cheia). Soltar zera a carga, então os dois se desfazem sozinhos em ~0,2 s. O disparo em si não
  tem soco: a tensão está em segurar, e soltar é alívio.
- **Recall**: enquanto puxa, a tela escurece e dá zoom, ambos acompanhando a velocidade da
  flecha. Medido: a 168 px/s o efeito é quase nulo; a 620 px/s chega a 0,26 de escurecimento e
  1,057 de zoom. Ao soltar, desfaz em ~0,2 s.

Tudo isso roda no delta real do monitor, **não** no passo fixo: é cosmético e precisa ficar liso
em qualquer taxa de quadros. O zoom de câmera é fracionário e mexe no alinhamento do pixel art —
aceitável porque é sutil e passageiro, mas é o motivo de não subir muito esses valores.

### 3.5 Rolamento
Dash rápido, direção travada no instante em que começa, não pode ser interrompido, **não dá
invencibilidade**. É deslocamento, não defesa. Sem stamina, sem cooldown — o custo é o
comprometimento: por ~260 ms você não escolhe mais para onde vai.

### 3.6 Só chefes
Nenhum inimigo comum. O espaço entre as salas é vazio de propósito: paisagem, silêncio,
tensão. O ritmo é caminhada longa e calma → luta de 20 segundos → morte → repetir.

**O titã dorme até você atirar nele.** Ele fica **acinzentado e no chão**, parado, e a arena com
ele: nenhum relógio corre, nenhum gêiser abre. A porta fica aberta e dá para dar a volta, olhar e
sair. A luta começa no instante em que a flecha encosta nele — e é aí que a sala se tranca. Quem
escolhe a hora é o jogador, e o primeiro tiro deixa de ser um acidente do caminho.

O despertar tem duas partes, ~2,6 s ao todo:

1. **Levantar** (1,6 s): o corpo sobe do chão e a cor volta a ele.
2. **O grito** (1 s): cada titã faz a sua, e a tela treme junto. O Monólito acende **todas as
   rachaduras em laranja** e as apaga de volta; o Sino solta uma badalada em anéis, com a luz do
   badalo estourando por baixo da saia; a Sentinela estoura a face espelhada em branco.

Só depois disso o chefe ganha relógio. É um contrato de três valores entre a cena e a view —
`rise` (0 dormindo, 1 desperto) e `roar` (a força do grito) —, então **cada chefe novo escolhe
como dorme e como grita sem tocar na cena**.

O teste do despertar é o **corpo inteiro**, não a hitbox do chefe: a hitbox diz onde ele pode ser
ferido, e num titã que passa a maior parte do tempo invulnerável ela recusaria justamente o tiro
que devia acordá-lo.

### 3.7 Ponto fraco único
Cada chefe tem um núcleo. Acertar o núcleo mata em um tiro. O resto do corpo é imune. A
dificuldade está em **expor** o núcleo, nunca em repetir dano. Alguns chefes exigem quebrar
uma armadura ou provocar uma abertura antes.

### 3.8 Mundo interligado
Salas conectadas num grafo, portas que se abrem conforme chefes caem, portões selados que
exigem N almas. Obeliscos salvam. Chefe morto deixa a sala vazia e atravessável.

### 3.9 Sem números
Nenhum HUD, nenhum XP, nenhum item, nenhuma progressão de dano. O jogador termina o jogo com
exatamente o mesmo poder que tinha no início. O que cresce é a habilidade dele.

## 4. Mecânica nova: **Vínculo**

A corda entre o arqueiro e a flecha funciona nos dois sentidos.

- **Recall** (segurar `E` / botão direito): a flecha vem até você.
- **Vínculo** (`Shift` / botão do meio): **você vai até a flecha.**

Regras:

1. Só funciona com a flecha em `CRAVADA_SOLIDO` ou `CRAVADA_CHEFE`.
2. O jogador é puxado em linha reta e em alta velocidade (≈4× a caminhada) até parar um pouco
   antes da flecha; ao chegar, a flecha volta sozinha para a aljava.
3. Durante o puxão o jogador **não tem controle e não é invulnerável**. Ele atravessa vãos e
   buracos, mas não atravessa paredes nem o corpo do chefe.
3.1. **A corda move o corpo mais leve dos dois.** Contra parede e contra chefe pesado quem viaja
   é o jogador, e aí o puxão vai **até** a âncora, sem parar antes — aterrissar em cima do chefe
   é o preço. Um chefe pode ceder e vir até você; é o que o Sino faz no começo da queda. Na
   implementação isso é `boss.tetherPull(player)` devolvendo `'yield'` ou `'slam'`; chefe que não
   implementa fica com o comportamento antigo.
4. Se a flecha estiver cravada num chefe que se move, o jogador é arrastado junto — dá para
   se pendurar num chefe.
5. Sem custo, sem cooldown, sem recurso novo. O limite é o que já existia: você só tem uma
   flecha.

Por que essa e não outra: ela não adiciona sistema nenhum, reaproveita o estado que a flecha
já tinha. Mas dobra o vocabulário de design de chefe, porque **atirar passa a ser também se
mover**, e cada tiro vira uma decisão dupla — "onde quero acertar" e "onde quero estar depois".

O que o Vínculo destrava no design:
- Arenas com vãos, lava, buracos: a única travessia é cravar a flecha do outro lado.
- Núcleos altos ou no teto: só alcançáveis subindo pela própria flecha.
- Fuga: cravar a flecha longe antes do ataque em área e se puxar para fora.
- Armadilha: se você cravou a flecha no chefe e se puxa, aterrissa em cima dele. Rápido e
  quase sempre burro. É exatamente a tensão certa.
- Puzzle fora das lutas: alavancas do outro lado de um abismo.

### 4.1 O que **não** vem junto
Nada de stamina, melhorias, flecha secundária ou árvore de habilidade. Uma mecânica nova, um
botão novo. O jogo continua explicável em uma frase.

## 5. Controles

Gamepad entra junto desde a fase 0 — o Phaser já traz o wrapper, não custa fase própria.

| Ação | Teclado/Mouse | Gamepad |
|---|---|---|
| Mover | WASD / setas | Analógico esquerdo |
| Rolar | Espaço | A |
| Mirar e atirar | Segurar botão esquerdo, soltar | Segurar RT, soltar |
| Recall (flecha vem) | `E` / botão direito | LT |
| Vínculo (você vai) | `Shift` / botão do meio | LB |
| Interagir | `E` | A |

## 6. Especificação de chefes

Cada chefe é um módulo que exporta um objeto:

```js
export default {
  id: 'guardiao_de_barro',
  sprite: 'boss_barro',
  radius: 28,
  core: { offset: [0, -6], radius: 6, exposed: false },
  phases: [ /* cada fase: update(dt, ctx) + condições de transição */ ],
  onArrowHit(part, arrow) { /* núcleo = morte; corpo = a flecha crava */ },
}
```

O núcleo é uma hitbox separada com uma flag `exposed`. Tudo que o chefe faz é máquina de
estados com temporizadores: sem IA, sem pathfinding. Padrões legíveis e repetíveis, porque o
jogador precisa aprendê-los de cor.

### 6.1 Elenco proposto (9 + final)

1. **Monólito de Obsidiana** — o primeiro. **Câmara octogonal de pedra sobre um mar de lava**,
   no estilo das referências de fogo (`screenshots/fogo*.png` e `print5.jpg`): rocha com
   **estrias verticais densas** — a assinatura das faces de penhasco da referência —, aresta
   superior acesa, faixa lavrada com treliça de losangos, sombra e entulho acumulados no pé da
   muralha; chão sóbrio com sulcos escavados (linha escura mais realce) e um painel central com
   losango inscrito,
   cantos chanfrados para o quadro não ler como caixa, lava visível **além** das muralhas, e
   vinheta escurecendo as bordas. Paleta quase monocromática em vermelho — só lava, fogo e o
   núcleo saem dela. Doze gêiseres no chão. Uma pirâmide flutuante de obsidiana. Duas fases:
   1. **A carapaça.** A colisão dela é um **meio-disco**: a pirâmide ocupa o espaço acima da
      própria base, e um círculo inteiro sobraria para debaixo do chão. Flutua, trava a mira e
      desaba para esmagar; o impacto lança uma onda
      circular de estilhaços. Cada queda **racha mais a pirâmide**, e na quarta ela fica frágil.
      Os estilhaços são a mesma obsidiana dos cacos do estilhaçamento — só que menores: saem
      arremessados, desaceleram e **assentam no chão**, cortando só enquanto estão em movimento
      **e depois de meio segundo armando**. Recém-lançados eles saem com a cor de repouso e não
      machucam, senão uma batida ao seu lado mataria sem tempo de reação. O entulho acumula a
      cada batida, e na fase 2 ele reabsorve o que estiver caído.
      **A flecha também racha.** Cada acerto no corpo soma uma rachadura, e se a que fechar a
      quarta vier em brasa, a carapaça cede no mesmo acerto. E ela **se levanta mais rápido
      conforme racha** — 3,2 s inteira, 1,8 s com as quatro.
      Aí é preciso **esquentá-la**: flecha em brasa (cruzando um gêiser aberto) abre na hora, ou
      deixá-la parada sobre um gêiser irrompendo abre devagar. O calor acumulado **fica retido
      por 8 s** antes de começar a escorrer, então aquecimentos parciais de gêiseres diferentes
      se somam.
   2. **Coração Instável.** A carapaça cede, os cacos são arremessados e o núcleo de plasma
      fica exposto por **8 segundos**. A sala passa a cuspir **jatos de lava das paredes de
      cima, esquerda e direita**, em posição aleatória: primeiro uma faixa fina de aviso, depois
      o jato. Enquanto isso ele recolhe os cacos do chão, um de cada vez, sorteados. Passada a
      janela a armadura se refaz **inteira** — as rachaduras zeram e a luta volta à fase 1. Um
      acerto no núcleo mata.

   **Ao morrer**, a tela estoura em branco e volta ao normal ao longo de 1,4 s, e a arena se cala
   na hora: jatos, destroços e gêiseres param de existir. O
   jogador perde o controle do movimento, mas **é ele quem puxa**: a flecha ficou cravada no
   coração e sai segurando o recall por ~2 s. A tela usa a mesma linguagem do recall comum —
   escurecer e dar zoom — só que **mais forte**, porque desencravar custa mais: 0,55 de escuro
   contra 0,32, e 0,11 de zoom contra 0,07, mais um tremor que o recall comum não tem. Soltar o
   botão pausa a sequência. Quando ela cede há outro clarão, e a câmera **se afasta de volta ao
   normal** — o aperto do esforço soltando junto com a flecha. Quando ela chega à mão, fragmentos de alma brancos **saem do coração** e convergem para o peito dele
   durante 4 s enquanto o corpo levita ~12 px, e então ele desce de volta ao chão.
   **O coração permanece na arena**, apagando da cor viva para o cinza escuro conforme a alma
   sai, e fica ali como marca da luta.

   Os gêiseres são **tubos de lava**, não buracos chapados: boca de pedra com cratera escura
   quando apagados; fundo brilhando e soltando fagulhas no aviso; e uma **coluna subindo** da
   poça quando irrompem, afinando e ondulando mais quanto mais alto — jato perdendo pressão. O
   raio letal continua sendo o da boca; a coluna é leitura.

   Os gêiseres do chão têm relógio próprio e espera aleatória, então só alguns estão quentes por
   vez, e o aviso é longo o bastante para se ver de longe qual vai abrir.

2. **O Sino** — **pronto.** Pêndulo de pedra pendurado no centro de **O Campanário**, a segunda
   sala da região de fogo, e a primeira com identidade visual própria: mesma região, outra fatia
   da paleta. Aqui o fogo já baixou — pedra clara empoeirada, chão de cinza fria com **anéis
   concêntricos gastos** no lugar do losango, mar de lava encrostado em vez de aceso, cinza caindo
   no ar. Sem gêiser nenhum: o chão fica limpo porque a leitura da luta é a curva que ele varre.

   Pendurados perto das muralhas, **sete outros sinos, apagados e menores**, fora da linha de
   varredura. Contam de onde o chefe saiu sem uma linha de texto, e por estarem no ar o jogador
   passa por baixo sem esbarrar em nada. São dado da sala (`hangingBells`), desenhados pela view.

   Encostar no chefe mata.

   A luta inteira sai de **uma regra nova, que vale para o jogo todo daqui em diante: o Vínculo
   move o corpo mais leve dos dois.** No meio do arco o sino é uma tonelada em movimento e quem
   viaja é o jogador — e nesse caso o puxão **não para antes**, ele leva você até a própria
   flecha, ou seja, contra o bronze. **Começando a descer** ele ainda não tem inércia, e aí o
   puxão o arranca da corrente e o traz até você.

   **Ele não para lá em cima.** Um pêndulo de verdade desacelera, inverte e acelera sem pausa, e
   meio segundo congelado no alto quebrava justamente a ilusão que a órbita construiu. A janela
   virou uma fatia da fase — acima de 0,78 de seno e **descendo** —, o que dá 400 ms na primeira
   rodada. Medido no perfil de velocidade: mínimo de 22 px/s contra 579 no meio do arco, e nenhum
   quadro parado.

   Ciclo: atravessa o arco → **para no alto** (a janela) → volta. A flecha cravada nele acompanha
   o balanço **e a altura** — presa ao ponto do chão, ela escorregava sozinha a cada subida.

   **A altura decide tudo.** Rente ao chão, no meio do arco, ele atinge por contato e é o único
   momento em que a flecha o encontra — que é também onde ele corre mais, então o tiro é difícil
   de propósito. Nas pontas ele sobe: não encosta em ninguém e a flecha passa por baixo, **mas
   quem entra na pegada dele arma um feixe da boca**. A pegada acende enquanto ele está levantado,
   e o feixe leva **0,3 s se formando** — anel fechando no chão, luz juntando na boca, o feixe
   engrossando de um fio até a largura cheia — antes de causar dano.

   O feixe **cai reto debaixo da boca e acompanha o corpo**: ele é do sino, não uma mira no
   jogador. Armado, sai de qualquer jeito; quem escapa é quem sai de baixo. Ficar embaixo de um
   sino levantado por três décimos de segundo é o que mata.

   A pegada é um **meio-disco com a barriga para baixo e levantado 18 px** (`footRise`): ele
   pende, então o chão que ocupa fica à frente da boca, na direção da câmera, e não no ar acima
   dela — mas centrado no ponto do chão o meio-disco caía inteiro **abaixo** do sino, sobre piso
   vazio. É o inverso da pirâmide, que apoia no chão e ocupa o espaço acima da base.

   **Ele orbita, não risca.** Um pêndulo pendurado por uma corrente não é um trilho: empurrado de
   lado, ele descreve uma **elipse** em volta do ponto de suspensão, e essa elipse vai girando. A
   primeira versão dava um salto no plano no instante em que ele cruzava o centro, e o desenho
   disso é um asterisco — retas diferentes pelo mesmo ponto, com virada seca no meio de cada uma.

   São duas coisas contínuas: a **barriga** (42% da amplitude), que joga a ida para um lado e a
   volta para o outro e fecha a elipse, e a **precessão** (0,15 rad/s), que gira essa elipse
   devagar o tempo todo. O centro exato deixou de ser passagem obrigatória: ele passa **ao lado**
   dele — medido, nunca a menos de 58 px —, e por um lado diferente a cada vinda.

   A precessão é lenta **por medida**. A 0,47 rad/s ela girava 39° dentro de uma travessia só:
   numa metade da elipse somava com a barriga e na outra cancelava, e saía um arco gordo seguido
   de uma reta — a flecha do arco caía de 63 px para 8. A 0,15 rad/s toda travessia tem a mesma
   curva (flecha de 34 a 57 px sobre cordas de 220 a 372, ~15%) e a elipse ainda vira ~34° por
   volta, que é o que impede ele de repetir faixa.

   A amplitude sai de uma elipse encaixada na sala (215 × 110), senão um plano quase vertical o
   enfiava na muralha.
   O seno já deixa o meio mais rápido, e um fator `swoop` exagera o contraste: pico medido de
   571 px/s no meio contra os 158 px/s do jogador. Três puxões certos e o gancho arrebenta: ele tomba
   de lado, a boca vira para quem o derrubou e o **badalo** — o núcleo — fica exposto por 4,2 s.
   Deitado ele é inofensivo, e é aí que dá para recuperar a flecha e contornar até a boca.

   A curva de dificuldade é uma só: a cada rodada o balanço encurta (2900 ms → mínimo 1700), e a
   janela **encolhe junto de graça**, porque ela é uma fatia da fase e não um temporizador
   próprio — medido, 400 ms na primeira rodada e 233 ms no balanço mínimo, quase exatamente o que
   o antigo tempo de parada valia. Um número a menos para manter em sincronia. Perder a janela do tombo não devolve os três puxões — ele
   volta a balançar já frágil.

   Ajuste que custou uma leitura errada: ele pousa a **56 px** de você, e tem que ser mais que
   `bellRadius + playerRadius` (43), senão acertar o tempo mata quem acertou. A pressão vem da
   volta dele para a corrente, que atropela no caminho.

   **Puxar é física, não teletransporte.** Uma tonelada não sai do lugar na hora: a corrente
   **estica primeiro** (0,17 s em que ele só inclina na direção da corda, sem andar), e só então
   cede. Aí ele vem **pelo arco da corrente** — ângulo e raio interpolados em volta do pivô, não
   uma reta pelo chão —, com **aceleração constante**: começa parado e chega na sua frente na
   velocidade cheia. A altura cai pela mesma curva, então ele **despenca** em vez de descer
   parelho. Na batida levanta poeira pela saia, **quica uma vez** e assenta, e a corrente
   **cede a barriga** enquanto ele está no chão — é ela que diz que parou de segurar o peso.
   Há um piso de 0,26 s no trajeto: puxado de perto, ele aparecia do lado do jogador em quatro
   quadros, e peso nenhum se move assim.

   **Puxar tem reação.** O sino é uma tonelada: arrancá-lo arrasta o jogador para a frente junto,
   um trancão de ~28 px sem controle. O alvo do sino desconta esse avanço, senão o prêmio por
   acertar o tempo virava morte na hora — e mesmo assim ele pousa perto o bastante para incomodar.

   **Deitado ele vira cenário baixo: a flecha passa por cima do bronze e só o badalo a para.**
   Sem isso o núcleo era inalcançável — ele fica dentro da boca, atrás da borda, e todo tiro
   cravava no corpo antes de chegar lá.

   Leitura na tela, sem HUD: **sombra** marcando a linha que ele varre, a **pegada acesa** quando
   ele está levantado, e a **luz vazando mais forte** quanto mais ele descola do chão.

   **Sem indicador de tempo para a janela do puxão.** Chegou a existir um anel contando os
   milissegundos em volta dele; saiu porque entregava demais. O que anuncia a janela é ele estar
   **no alto e lento** — a altura já se lê pela sombra encolhendo, e a lentidão se vê. É a mesma
   coisa que o jogador tem que aprender a ler.

   Arte: `assets/sino.png` e `assets/sino-caido.png`, duas folhas 3×3 de células 256 com 8
   quadros. O quadro do sino caído sai da **direção da boca**, e a posição do badalo sai de uma
   **tabela por setor** — deslocamento radial não serve, porque a arte tem perspectiva e o badalo
   aparece num lugar diferente em cada guinada. As duas tabelas estão em `SINO_ART`.

   A tabela do badalo foi fechada com uma **tela de conferência** (`/badalo.html`): as oito
   orientações lado a lado com grade numerada, para apontar a célula em vez de adivinhar
   coordenada. Detecção automática não resolve — o vão da boca é tão escuro quanto a sombra do
   bronze e as rachaduras da arte fatiam a região em dezenas de pedaços.

   **As duas folhas são repintadas em pedra acinzentada no carregamento**: vinham em tons
   diferentes, e o que separava "pedra fosca" de "bronze polido" não era o matiz — a cor média das
   duas é quase a mesma — e sim o **teto de brilho**, 240 contra 196. Cada folha vai a luminância,
   é normalizada para o mesmo teto e repintada na cor de pedra. De pé os oito quadros são guinadas de um objeto quase simétrico, então valem como
   **giro lento** e não como direção. Caído são 8 guinadas de 45°, e o quadro sai da direção da
   boca — **a ordem foi lida à mão**, porque medir por pixel não separa o vão escuro da sombra do
   bronze (o centroide escuro cai sempre para baixo, em todos os quadros).

   Luz: de pé o badalo não aparece, então a **luz dele vaza por baixo da saia** — e vaza mais no
   alto do arco, onde ele descola do chão, o que reforça a janela. Caído, o badalo é um **ponto
   aceso dentro da boca**, na única cor saturada do jogo, desenhado numa camada acima do corpo
   porque ele é o alvo.

   ---

   **Segunda metade: O Coro** — **pronto.** O quarto titã do elenco, e ele não tem sala própria:
   vive dentro da luta do Sino, no mesmo Campanário.

   **O badalo não morre quando você acerta.** Ele desvia, e foge para dentro de um dos **sete
   sinos apagados** que estão pendurados na câmara desde o primeiro quadro da luta. O corpo do
   sino grande fica onde caiu, oco, como marca. Os sete acordam e a cor volta ao bronze deles.

   Uma fase só, em ciclo:

   1. **Embaralho** — os sete trocam de lugar no céu, em arcos que se cruzam, quatro rodadas.
      Sete corpos iguais — por isso eles são todos **do mesmo tamanho** desde o começo do jogo,
      quando ainda eram enfeite: tamanho diferente seria etiqueta em cima do que carrega o
      coração.
   2. **Badaladas** — de volta aos ganchos, eles tocam em ordem sorteada. Cada badalada chacoalha
      o sino, acende a boca por meio segundo de aviso e solta uma **onda de som**. Duas regras:
      **só a frente mata** — dá para ficar dentro do que já passou —, e ela **se dissipa perto do
      meio da sala**: sólida até 220 px, e daí até 300 é só luz se abrindo e apagando. Como eles
      pendem perto das muralhas, o que cruza o meio já é rastro, e sempre sobra meia sala inteira
      onde o som chega fraco demais. A onda abre a 210 px/s e leva 1,4 s para se apagar, com 2 s
      entre uma badalada e a seguinte: é som pesado, não estalo, e entre duas delas a sala volta
      a ficar limpa.
   3. **A mira** — passada a rodada **e apagada a última onda**, o coração se entrega: o sino dele
      se inclina na sua direção e leva 2,4 s assim, com a linha do tiro à mostra. A direção
      **trava no começo** — o feixe sai onde você **estava**, e sair de cima da linha é o que
      salva. Onda aberta e feixe carregando ao mesmo tempo eram duas leituras disputando a mesma
      atenção.
   4. **O tiro e a pausa** — o feixe dura 0,7 s, e depois dele o sino **fica quase um segundo
      parado, deitado e aberto**. É o convite: a melhor hora de atirar no badalo.
   5. **A volta** — ele demora mais um tanto para se endireitar, e o coração continua exposto.

   **O feixe sai do próprio coração**, e é isso que fecha a luta: inclinado, a boca vira para
   fora e o badalo aparece. De pé ele está dentro da boca e a flecha passa por baixo de todos —
   eles estão no ar, como sempre estiveram nesta câmara. A janela para acertar é a inclinação
   inteira, do começo da mira até o fim da volta.

   Arte: **nenhuma nova.** O corpo de pé é `sino.png` na escala dos enfeites, e o inclinado é
   `sino-caido.png` — os oito quadros de guinada e a tabela do badalo por setor já existiam para
   o chefe grande, e dizem exatamente onde o coração aparece em cada direção.

   Uma alma só: é a mesma luta e a mesma sala.

3. **A Sentinela Espelhada** — **pronta.** Primeira sala da região fria: **A Fortaleza**, salão
   retangular de pedra azulada, fechado por muralha maciça em vez de mar de lava — o feixe dela
   ricocheteia nas paredes, e canto chanfrado vira escada de tiles com quique imprevisível.

   Não anda atrás de você: **desliza mantendo distância** (`keepDist` 150) e encara você o tempo
   todo, girando devagar. **Quem move ela é o jogador:** chegar perto a empurra para a muralha,
   afastar-se a traz para o meio da sala — que é onde dá para contorná-la.

   **A frente é espelho e devolve a flecha contra quem atirou**, guardando 85% da velocidade. O
   tiro direto, que é o reflexo natural, é o erro — e não é um erro barato: a flecha rebatida
   **mata**. É o primeiro projétil do jogo que é do próprio jogador.

   Ciclo: rastreia → carrega → dispara → **fica cega**. O espelho embaça com o calor do próprio
   feixe e ela para de virar: é a única janela para se pôr atrás dela sem que ela acompanhe.

   **Fase 1 — a carapaça.** As costas são blindadas e a flecha não faz nada ali. **Só o próprio
   feixe dela abre**, e o feixe reflete tanto na muralha quanto na face espelhada dela. Quem mira
   esse raio é o jogador, sem tocar nele: a direção dela sai de **onde** você está, e a posição
   dela sai de **quão longe** você está. Achar o ângulo em que o traçado dá a volta na sala e
   bate nas próprias costas dela é a luta.

   Medido: de 405 posições de sala, **377 têm algum ângulo que resolve** — mas só 5% dos pares
   posição/ângulo funcionam. **A prévia do feixe só aparece durante a carga**, não o tempo todo: a
   sala fica limpa, e o jogador aprende o ângulo vendo para onde o tiro anterior foi. Quando o
   traçado volta nas costas dela ele **acende em vermelho** durante a carga — tarde demais para
   mudar de lugar, mas é assim que se aprende o que uma solução parece.

   Chegou a existir uma prévia ligada fora da carga, para o jogador mirar andando. Saiu porque
   entregava a luta. O custo assumido é a fase 1 depender de tentativa e observação; se virar
   tédio, é ela que volta.

   **Fase 2 — o núcleo.** Aberta a carapaça, ela abre o jogo: alcance de 1500 para 2600 px, cinco
   quiques em vez de quatro, tiro a cada 1300 ms em vez de 2600, carga de 0,42 s e giro de 3,0
   rad/s. Aí o núcleo das costas é alcançável, e o jeito de matar é plantar a flecha na muralha
   atrás dela e **chamá-la de volta atravessando o corpo** — a mecânica que a seção 3.3 chama de
   central e que nenhum chefe cobrava até aqui.

   **O salão é de espelhos.** As muralhas são chapa polida — painéis grandes com junta e um
   brilho especular correndo em diagonal — e **refletem de verdade**: cada corpo perto de uma
   parede aparece dentro dela, espelhado no eixo certo, escurecido, sumindo conforme se afasta.
   Jogador e flecha são reflexos reais (o mesmo sprite, virado do avesso); o chefe entra como
   silhueta, porque é desenhado com `Graphics` e não dá para virar. **O feixe também reflete**:
   em cada quique ele continua para dentro do espelho em vez de simplesmente virar na parede.
   Tudo isso **some no fundo do espelho** por uma névoa desenhada por cima, que engrossa para
   dentro da muralha — sem ela o reflexo acabava num corte seco na borda. A névoa é o único
   controle de profundidade: descontar também por objeto fazia os dois se somarem e apagava o
   reflexo cedo demais. Custa um punhado de sprites reaproveitados por quadro, nenhum passe extra
   de render.

   **Ela desliza o tempo todo** e **para seco ao começar a carregar**. A componente radial segura
   a distância e afrouxa perto do anel ideal — sem faixa morta, que a deixava parada e dura — e
   por cima vem um vaivém lateral. A velocidade é suavizada, então ela acelera e desacelera em vez
   de ligar e desligar. Medido: 133 px em 2 s rastreando, **0 px durante a carga**. Essa parada
   seca é o melhor aviso de que o tiro começou, justamente porque ela nunca fica quieta.

   Arte: nenhuma ainda, `Graphics`. O contrato é o de sempre — objeto rígido, 8 guinadas de 45° —
   com uma exigência a mais: **frente e costas óbvias na silhueta**, porque saber para onde ela
   encara é a informação da luta inteira.

4. **O Coro** — **pronto.** Segunda metade da luta do Sino, descrita acima.
5. **Coração Suspenso** — flutua alto, núcleo virado para cima. Ensina o Vínculo: crave a
   flecha na parede alta, puxe-se, atire de perto.
6. **Serpente de Areia** — some sob a areia. A flecha cravada no chão vira isca; ela morde a
   flecha e você se puxa direto para dentro da boca aberta.
7. **Forja Viva** — plataformas sobre lava, sem chão contínuo. Toda travessia é Vínculo. Erro
   de mira é queda.
8. **O Crisol** — **pronto.** Irmão do Monólito e mais fundo no vulcão (sai pelo fundo da
   câmara dele): o caldeirão que fez os gêiseres. **Ele derrama o chão em cima de você, e é
   esse mesmo fogo que arma a sua flecha.**

   Ciclo de quatro tempos: **cheio** (a lava dentro sela a boca, a flecha ricocheteia),
   **inclina e verte** (tomba numa direção e **cospe lava em arco**; o jorro varre um setor e
   aquele setor vira lava — a inclinação é o aviso, e a direção trava onde você **estava**),
   **vazio** (o
   interior à mostra, com o núcleo no fundo da tigela) e **bebe** (**puxa a lava por baixo**:
   ela volta escorrendo pelo chão, matando no caminho). A cada rodada **derrama mais e bebe
   menos**: a sala encolhe, e é esse o relógio da luta.

   **Só flecha em brasa mata.** Fria, ela chia e apaga contra a pedra. O único fogo da sala é o
   que ele acabou de derramar, então o tiro certo é aquele cuja linha **atravessa uma poça** —
   o Monólito ensinou que flecha cruzando fogo acende, e o irmão cobra.

   **Aberto, a boca engole a flecha:** a borda para de segurar tiro e só o núcleo a para. É a
   mesma regra do Sino tombado, e sem ela o núcleo seria inalcançável.

   **A hitbox do corpo sobe com a arte.** A âncora do caldeirão é o **pé** dele, e o círculo
   centrado ali ficava metade no chão vazio debaixo do sprite — grande, torto e em lugar nenhum.
   Ele agora fica na barriga (`bodyLift`), e com o da boca por cima os dois cobrem a silhueta,
   que é o que a flecha vê.

   E a regra do Sino volta pelo outro lado: **o Vínculo move o corpo mais leve.** Cheio, ele é
   uma tonelada e quem viaja é você. **Vazio, ele é casca** — o puxão o tomba e ele **entorna
   aos próprios pés**, num leque de gotas para o lado de quem puxou, e fica com o núcleo aberto
   o dobro do tempo. Caldeirão deitado vaza, não arremessa: o anel de fogo fica em volta dele,
   que é justamente por onde a flecha tem que passar para chegar ao núcleo — o prêmio e o
   caminho do tiro são a mesma coisa. É prêmio para quem entendeu, não pedágio: dá para vencer
   sem isso.

   A lava avisa antes de matar — a **sombra** de cada gota chega ~0,6 s antes dela —, e o miolo
   da sala nunca é inundado: a pressão é o encolhimento, não a cilada. Encostar no caldeirão não
   machuca; o que mata é o chão, a corda no lábio e a gota caindo.

   **Leitura, que foi onde a primeira versão falhou inteira.** Três coisas mudaram depois de
   jogar:

   - **A lava tem física de líquido, não estados de tile.** O fluido corre numa **sub-grade de
     12 px**, metade do tile do terreno, e cada célula guarda **volume** — que é
     profundidade, não litro: célula menor com a mesma profundidade guarda menos lava, e a
     conversão é feita na entrada e na saída do campo, então voltar para 24 px devolve o
     comportamento antigo sem tocar em mais nada.

     O que molha o chão é a **queda** de cada gota: um respingo num ponto. Dali o volume
     **procura o nível sozinho** — cada célula passa um quarto da diferença para a vizinha mais
     baixa —, e é só isso que faz a poça avançar, contornar e parar. Ela também **esfria** a uma
     taxa fixa, então a borda fina seca primeiro e a mancha encolhe de fora para dentro.

     **Mas procurar o nível espalha igual para todo lado**, e sozinho ele faz a lava inflar em
     círculo em vez de escorrer. Por isso cada célula guarda também **momento**: a direção em
     que a lava chegou. A favor dela o escoamento ganha, contra ela perde, e a favor a lava
     avança **mesmo em nível** — é essa parcela que transforma o jorro em língua atravessando o
     chão. O momento se apaga em ~0,3 s, porque é lava e não bala, e é ele que faz a poça ter
     uma direção em vez de um raio. Medido: mesma derramada, mirada para leste e para oeste, e o
     centro de massa termina 250 px de cada lado do caldeirão.

     A mesma conta dá a regra de dano: **fundo o bastante (0,16) é lava viva e mata; menos que
     isso é crosta**, escura e inofensiva, que também não acende a flecha. O jogador não
     precisa aprender um limiar — o que brilha mata, o que escureceu esfriou.

     **O limiar é o que sobra depois de espalhar, não o que cai da boca.** Com 0,5 a conta
     batia na boca e mentia no chão: medido, só **31% da poça matava** (33 de 107 células) e o
     resto era filme com cara de lava — o jogador atravessava laranja e não morria, que é a pior
     mentira que esta sala pode contar. Em 0,16 a poça mata inteira (61% logo depois de derramar,
     72% já assentada) e o que não mata é a franja da borda, que é justamente a que esfriou. A
     crosta também ganhou teto de cor: ela chega a cinza-brasa e para aí, em vez de subir a 90%
     da cor da lava viva.

     E o contorno passou a ser traçado **no próprio limiar letal**: as duas inclusões valem, e
     valem nos dois sentidos. Nada que pareça lava deixa de matar (o contorno não passa do que
     mata) e nada que mate parece seguro (cada célula letal ganha o miolo pintado).

     Lava é viscosa: abaixo de 0,09 de desnível ela para de escorrer. Com um valor baixo demais
     o filme fino se espalhava pela sala inteira e a poça perdia contorno.

     Beber é o inverso: ele suga volume dos tiles mais próximos para fora, **e recupera menos
     do que derramou**. A diferença é o chão que a sala perdeu — o relógio da luta, medido:
     sobra de 0, 2,1, 4,9 e 7,4 de volume ao fim das quatro primeiras rodadas.
   - **A poça é pintada pelo mesmo código do mar de lava** (`paintLavaSurface`). Com desenho
     próprio ela não parecia líquido — era mancha laranja com bolinhas. Reaproveitar a pintura
     do mar resolve de graça e ainda amarra o que ele derrama ao que está além da muralha. Ela
     entra só no tile inteiramente molhado: meio tile decorado vazaria para o chão seco.
   - **O jorro é chuva, não feixe.** Esta foi a queixa mais dura: a primeira versão desenhava um
     segmento aceso do lábio até o ponto de queda e matava em toda a sua extensão. Aquilo não
     lia como lava caindo — lia como laser.

     Agora a lava despreende do lábio já em **gotas de arco balístico**: `z` é altura de tela,
     a gravidade é de verdade e cada gota tem a sua **sombra no chão**. A leitura passou a ser a
     sombra: ela chega ~0,6 s antes da lava e fecha conforme a gota desce.

     Uma versão intermediária guardou um toco daquele segmento como "corda" no lábio, e **o toco
     lia como laser cortado** — foi tirado. Não sobrou nenhum traço reto no chefe: o lábio tem um
     **bolo de lava** engrossando antes de a gota desprender, que é massa, não linha.

     E com isso a regra de dano ficou honesta: **no ar a gota passa por cima de você**. Quem
     mata é a queda (respingo de 13 px) e a gota rasante. Isso abriu um bolso
     seguro **debaixo do arco**, perto do caldeirão — e ele encolhe durante o jorro, porque o
     alcance cai: a velocidade no lábio sai de **Torricelli**, proporcional à raiz da coluna de
     lava que sobrou dentro, então ele começa jogando longe e termina escorrendo pela própria
     borda. Nada disso é script: é o mesmo `fill` que já desenhava o nível na boca.

     As gotas saem espaçadas de propósito (120 ms, duas por cuspida, leque e alcance sorteados,
     empuxo sorteado). Com 55 ms elas saíam a cada 11 px do caminho e o jorro voltava a parecer
     um feixe, agora feito de contas: **gota grande e rara lê como lava; gota miúda e contínua,
     como laser.**

     E antes de jorrar ele **pinga**: passada a inclinação em que a lava alcança o lábio, caem
     gotas curtas junto dele, escorrendo pela borda em vez de arremessadas. É o aviso final, é o
     que qualquer coisa entornada faz, e ele diz **de que borda** o jorro vai sair — o pingo
     aponta o começo da varredura.
   - **Líquido fica nivelado; é o vaso que inclina.** A lava dentro dele mantém o eixo na tela,
     escorrega para o lado do lábio e desaparece conforme a boca fecha. Girando junto com o
     corpo, como estava, o conteúdo parecia sólido pintado de laranja — e a inclinação, que é o
     aviso principal do ataque, perdia metade da força.
   - **Beber é puxar por baixo.** A poça encolhia sozinha e ninguém ligava uma coisa à outra.
     Agora ele aponta o momento de cada célula para si e a lava **volta escorrendo pelo chão**,
     pelo mesmo passo de fluido que a espalhou; engolir mesmo só acontece dentro de 52 px dele.
     Enquanto volta ela **continua matando** — e é isso que dá tensão à janela do núcleo: a hora
     de atirar nele é a hora em que o chão inteiro está andando na sua direção.

     Puxando, ele **para de procurar o nível**. Nivelar espalharia a lava de lado justamente
     enquanto ela corre, e ela chegava diluída em crosta em vez de chegar como lava: medido, 258
     células viravam 299 e o que sobrava era filme. Sem nivelamento ela anda inteira — 258
     células viram 111, o centro de massa cobre 90 px/s, e ela chega **viva**.
   - **O contorno sai do campo, não da grade.** O desenho é um **marching squares** sobre o
     volume: cada canto de célula vale a média das células de chão em volta dele, e a linha de
     nível é interpolada dentro da célula. É isso que dá margem curva de verdade — retângulo
     por célula lia como tabuleiro por mais bojo que se pusesse na borda, e era a queixa que
     sobrou depois da primeira física. A mesma linha serve três vezes: brilho grosso e fraco
     derramando na pedra em volta, borda quente (a tensão de superfície, que separa o líquido da
     crosta a olho) e o recorte da massa.

     O contorno é traçado **abaixo** do limiar letal de propósito, e cada célula que mata ainda
     ganha o miolo pintado: desenho nunca mais estreito que a hitbox, senão alguém morre em cima
     do que parece crosta.
   - **O núcleo responde à sua flecha.** Com a flecha em brasa na mão ele abre, cresce e ganha
     um anel de fogo; fria, ele fica encolhido e apagado. Sem esse par a regra "só brasa mata"
     não tinha como ser descoberta: o jogador atirava, nada acontecia, e não havia nada na tela
     dizendo por quê. O chiado da flecha fria caindo na tigela dura quase um segundo pelo mesmo
     motivo.
   - **Ele tomba de verdade.** A primeira versão espremia a boca uns pixels e ninguém entendia
     que era uma inclinação. Agora o corpo inteiro escorrega e encurta no eixo do jorro.

   E a primeira rodada molha **um setor**, não meia sala (0,55 rad, crescendo até 2,0): a ameaça
   é o chão encolhendo aos poucos, e inundar tudo de uma vez não se lê como nada.

   **Arte: `crisol.png`, folha 3×3 de células 128 com 8 guinadas de 45°** — e nenhuma pose
   tombada, porque não precisa: tombar é **girar o sprite em torno do próprio pé**, que é o que
   um caldeirão rígido faz ao ser entornado. O mesmo giro é calculado no modelo (`giro`,
   `mouth`, `corePos`), então a boca desenhada e a boca mirada são a mesma.

   **O líquido veio em ciano de propósito, e é o que torna o resto possível.** Ciano não existe
   em nenhum outro lugar da paleta, então uma passada no carregamento separa a folha em duas
   texturas: a pedra sem líquido — a boca fica um buraco, e a view pinta o fundo escuro dela — e
   o líquido sozinho, **repintado por luminância** na rampa quente da sala (o escuro do ciano
   vira o escuro da lava, a crista clara vira o clarão). Repintar por luminância, e não por
   tabela de cor, é o que faz os meios-tons do desenho sobreviverem à troca.

   Com as duas separadas, a lava dentro dele **baixa de nível e esfria de cor** com o mesmo
   `fill` que a física já usava: a superfície encolhe em torno do próprio centro e a tintura
   escurece, sem um quadro de arte a mais. O núcleo também deixou de ser um raio fixo — ele é
   desenhado pela **boca**, que é uma elipse achatada de 29 × 10 px na tela; um círculo do raio
   da hitbox transbordava dela e lavava o caldeirão inteiro de vermelho.
9. **O Prisma** — irmã da Sentinela, na sala seguinte da região fria. Ela reflete; ele
   **refrata**: o feixe se parte em três ao atravessar o corpo, e onde um ramo encosta no chão o
   chão **vira gelo** — a sala se estraga sozinha enquanto você joga.
10. **Colosso Adormecido** — enorme e lento, ocupa duas salas. Você se pendura nele pela flecha
   e sobe pelas costas enquanto ele anda.
11. **Titã Sem Nome** — final. Reflexo, plataformas, recall e Vínculo, tudo junto.

Alvo de ritmo: cada chefe vencível em menos de 30 segundos por quem já sabe, custando de 10 a
40 mortes para aprender.

## 6.2 Menus

Layout montado, ilustrativo — a lógica de save é da fase 5 e a de opções da fase 8. As referências
são `screenshots/tela1` e `tela2`, e a gramática delas foi mantida: **mundo do jogo escuro ao
fundo**, caixa alta pixelada, réguas finas com losango nas pontas, dicas de botão no canto
inferior esquerdo, e escolhido = claro contra apagado.

O que é nosso e não delas:

- **A fonte é do jogo**, não do sistema: bitmap 5×7 em `src/ui/font.js`, desenhada com `fillRect`.
  Acento não tem glifo próprio — a letra base é desenhada e a marca vai duas linhas acima, que é o
  que a caixa alta portuguesa precisa sem dobrar a tabela.
- **O fundo é uma sala de verdade**, pintada pelo mesmo `terrain.js` do jogo e escurecida. O menu
  mostra o mundo, não um papel de parede que não existe em lugar nenhum.
- **O cursor é a flecha**, encostada no item pela corda, com o mesmo pulso do arco armado. É o
  objeto em volta do qual o jogo inteiro gira.
- **O logo é pedra rachada com brasa por dentro** — o vocabulário da pirâmide — no lugar da vinha
  crescendo sobre osso da referência. As fissuras nascem dentro de uma letra sorteada, com gerador
  determinístico: soltas na caixa do texto liam como sujeira, e o logo não pode mudar de cara a
  cada vez que a tela abre.
- **Save slot virou "vínculo"**, que é a mecânica do jogo: cada partida é uma corda diferente. A
  lavra lateral dos painéis é de **elos de corrente**, não de vinha, e no lugar de miniatura do
  mapa cada vínculo mostra **as almas que carrega**, uma silhueta por titã derrubado.
- **Apagar tem duas etapas, sem caixa de diálogo.** O botão não apaga: ele liga o modo, o cursor
  volta para a lista e o vínculo mirado ganha uma **moldura tracejada vermelha correndo em
  volta**. Aí escolher um vínculo apaga aquele, e o botão lá embaixo — que passa a dizer
  `cancelar`, no mesmo lugar — desfaz; `esc` também. A confirmação é a própria escolha, então
  não existe janela de "tem certeza?" para inventar.

`/` abre o título; os endereços de luta continuam entrando direto no chefe, que é o que serve para
trabalhar.

## 7. Mundo

**Pronto.** Grafo de salas em `src/data/rooms.js`. Seis salas: o obelisco no meio, quatro arenas e
um portão selado — pequeno de propósito, porque é o bastante para o grafo, a câmera com scroll, o
portão de almas e o save existirem de verdade. Sala nova depois é só mais um objeto.

```
                        [sino]
                           |
[crisol] — [pirâmide] — [obelisco] — [portão·2] — [sentinela]
```

Uma sala é geometria, tema, saídas e o que vive nela. `exits.norte = 'obelisco'` é o grafo: sair
pela porta de cima leva ali, e o jogo entra pela porta oposta.

**A travessia é contínua.** O jogador entra na **boca do corredor** do outro lado — não no meio da
sala —, levando junto o desvio lateral com que saiu e a direção para onde andava. Do lado de cá ele
some andando por um corredor, do lado de lá aparece andando pelo mesmo corredor, na mesma altura e
no mesmo rumo: é um corredor só, cortado por uma troca de cenário de 90 ms.

Tecla e botão **atravessam a porta apertados**. A cena reinicia a cada sala e as teclas do Phaser
nascem soltas, o que parava o jogador seco do outro lado; o estado real do navegador vive fora da
cena (`src/held.js` para o teclado, o ponteiro global para o mouse) e é reaplicado na entrada.

**Portas** são tile 2, sólido enquanto fechado, e `buildArena` abre a passagem sozinho no meio de
cada lado que tem saída. Duas razões para uma ficar fechada: **a luta começou** (o primeiro tiro
tranca a arena, e ela abre quando o titã cai — ver 3.6) ou **o portão pede almas que você não
tem** — e aí ele mostra os losangos do que falta, apagados.

A porta que fecha no primeiro tiro pode fechar **em cima do jogador**, se ele atirou da soleira.
A cena empurra ele para dentro do chão nesse caso: a colisão anda 1 px por vez e um corpo já
dentro do sólido ficaria travado em todas as direções, para sempre.

A travessia dispara ao chegar no **último tile do corredor**, não ao sair da caixa da sala: a
colisão segura o jogador dentro da grade, e ele nunca chega a passar dela.

**O obelisco** guarda o vínculo e mostra quantas almas faltam, com uma marca por titã acendendo
pelo corpo da pedra. É o único lugar que grava.

Ao matar um chefe: a alma entra **no começo do desfecho**, não no fim — é o que abre as portas, e
o jogador precisa ver a sala destrancar enquanto a alma vem até ele.

## 8. Save

**Pronto.** Quatro vínculos em `localStorage`, um objeto cada:

```json
{ "bosses": ["piramide", "sino"], "deaths": 41, "timeMs": 1104000, "room": "obelisco" }
```

**Só o obelisco grava progresso**, e guardar também marca o **checkpoint**: é para lá que a morte
devolve o jogador. Morrer não grava alma nem sala e não devolve ao lugar onde morreu — é isso que
faz o obelisco valer alguma coisa, e a decisão de voltar até lá é a única aposta que o jogo pede.

**A morte grava a estatística.** Mortes e tempo vão para o disco no instante em que o jogador cai:
a contagem de mortes é o placar deste jogo, e placar que some ao fechar a aba não conta nada. É a
única coisa que a morte escreve — alma e sala continuam esperando o obelisco, senão cada morte
seria um checkpoint de graça.

As almas já ganhas **não** se perdem na morte: elas ficam na partida viva. O que se perde é o
caminho andado desde o último vínculo.

A partida viva mora em `src/run.js`, fora da cena: `World` é recriado a cada travessia de sala, e
o que o jogador conquistou não pode reiniciar junto com o cenário. Endereço direto de luta abre uma
**partida solta**, que não guarda nada — é o atalho de trabalho, não o caminho do jogo.

Storage bloqueado (aba privada, cota) não derruba nada: o jogo continua, só avisa que não há onde
guardar.

## 9. Contrato de arte (para gerar no PixelLab)

Regras gerais:
- PNG com transparência, sem anti-aliasing, sem sombra embutida — a sombra é uma elipse
  desenhada em código, por baixo do sprite.
- **Uma paleta única compartilhada por tudo**, 24–32 cores, gerada antes de qualquer sprite.
  Mas **cada área usa só uma fatia estreita dela**: nas referências, a caverna é toda vermelha,
  a fortaleza toda azul, a floresta toda verde. Área quase monocromática, paleta comum por baixo
  — é o que dá unidade sem deixar tudo igual.
- Reservar uma cor viva usada **só** para núcleos de chefe. É o único ponto saturado do jogo.
  Os estados desse ponto (pulsar, expor, apagar ao morrer) saem do filtro **GradientMap** do
  Phaser 4, não de quadros extras — o PixelLab gera o núcleo numa cor só.
- Folha de sprites: uma imagem por personagem, cada linha uma animação, cada coluna um quadro,
  célula de tamanho fixo. Um `.json` ao lado:
  `{ frameW, frameH, anims: { walk: { row, frames, fps } } }`.

**Jogador — célula 32×32** (corpo ocupando ~16×22, o resto é margem para o arco):

| Animação | Quadros | Direções | Nota |
|---|---|---|---|
| idle | 2 | 3 | respiração lenta, 4 fps |
| walk | 6 | 3 | 12 fps |
| roll | 6 | 3 | 16 fps, sem loop |
| aim | 3 | 3 (8 se der) | último quadro segura enquanto mira |
| shoot | 2 | 3 | recuo do arco |
| tether | 2 | 3 | corpo esticado na direção do puxão |
| death | 6 | 1 | genérica, sem direção |

Gerar apenas `down`, `up`, `right` — `left` é espelhado em código.

**Camada que o código precisa manipular vem numa cor que não existe na paleta.** O líquido do
Crisol foi desenhado em **ciano** por isso: no carregamento, uma conta por pixel separa a folha
em pedra e líquido, e o líquido é repintado por luminância na rampa da área. Sai de graça o que
custaria uma folha por nível e uma por temperatura — e a mesma receita serve para qualquer coisa
que precise mudar de cor ou de quantidade em jogo (uma barra, um cristal, uma tocha). A regra
para gerar: **a cor marcadora só pode aparecer no que vai ser separado**.

O jogador fica pequeno de propósito: corpo de ~20 px contra um chefe de 128 px é uma razão de
1 para 6,4. É essa desproporção que faz o chefe parecer um titã — aumentar o jogador diminui
o titã.

**Monólito de Obsidiana**: folha 3×3 de células 256×256, 8 quadros de rotação, desenhada em
escala 0,75 (a pirâmide fica com ~151×118 px na tela). **A âncora é medida por quadro**: a base
varia 16 px e o centro 14 px entre os oito, então uma origem única fazia a pirâmide subir,
descer e deslizar enquanto girava — lia como se estivesse flutuando. Ela ainda afunda 9 px
abaixo do ponto de colisão para cobrir a própria sombra. As rachaduras vêm **já desenhadas na arte**,
marcadas por cor só para separá-las em camadas — magenta na base, amarelo no meio, verde-limão na
segunda camada, ciano no topo. O jogo separa essas cores **por matiz** — a franja anti-serrilhada é a marcação
misturada com preto, longe da cor pura em RGB mas com o mesmo matiz —, substitui cada uma por
pedra (`#000000`/`#1C1C20`) no corpo, guarda a camada como máscara branca e as acende **de baixo
para cima**, uma por rachadura, todas na mesma cor, que esquenta
até virar lava. O coração usa a mesma folha 3×3 e gira igual.

**Demais chefes — célula 64×64 (padrão) ou 96×96 (grandes)**; o Colosso Adormecido, 128×128. Tamanhos
ajustados por medição nas referências (seção 2.3): os chefes de lá têm 67 e 94 px internos de
altura. Por chefe: `idle`, 1 a 3 ataques, `stagger` (núcleo exposto — é o quadro mais importante
do jogo inteiro, tem que gritar "atire aqui") e `death`.

Se o PixelLab entregar mal em 128, o Colosso é gerado em partes (cabeça, tronco, dois braços) e
montado em código — ele é lento e articulado, então partes separadas até ajudam a animar.

**Tile do cenário: 16 px** — 30 × 17 tiles por tela.

**Avulsos**: flecha 8×8 apontando para a direita (a rotação é feita em código), obelisco 48×64,
porta 32×48 fechada e aberta. Partículas (poeira, faíscas, alma) são geradas em código pelo
emissor do Phaser.

**Placeholders**: o código começa com retângulos coloridos. A arte entra trocando arquivos, sem
tocar em lógica. Nenhum sprite bloqueia programação.

## 10. Ordem de construção

| Fase | Entrega | Pronto quando |
|---|---|---|
| 0 | Phaser configurado, passo fixo de 60 Hz, escala inteira, input | Quadrado se move e colide com paredes |
| 1 | Rolamento, morte, respawn instantâneo | Morrer e voltar em menos de 1 s |
| 2 | Flecha completa: tiro, cravar, recall com dano no retorno | Dá para acertar um alvo pelo retorno |
| 3 | **Vínculo** | Dá para atravessar um vão pela flecha |
| 4 | **Monólito de Obsidiana**, arena, morte do chefe e desfecho | Uma luta completa e satisfatória |
| 5 | Grafo de salas, portas, obelisco, save | **Pronta.** Três chefes ligados por um mundo, com portão de almas |
| 6 | Os outros chefes | — |
| 7 | Suco: hitstop, screenshake, rastro da flecha, poeira, slow-mo na morte do chefe, Blocky na morte | **Pronta.** O impacto se sente sem que nada pare de se ler |
| 8 | Áudio, título, final, contagem de mortes | — |

### O que a fase 7 entregou

- **Hitstop** por tipo de acerto: 4 quadros no corpo do titã, 8 no núcleo, 3 na flecha devolvida
  pelo espelho. É a única coisa do suco que para a simulação — o resto do quadro continua
  animando, que é o que separa impacto de travamento.
- **Câmera lenta ao derrubar o titã**: 0,9 s a 30% da velocidade, voltando ao normal sozinha,
  antes de o desfecho assumir com o escuro e o zoom dele. O passo continua sendo 1/60 s: o que
  encolhe é quanto tempo entra no acumulador.
- **Rastro da flecha**, na cor dela — osso normalmente, brasa quando acesa, azul quando devolvida
  (que é o aviso de que ela agora mata). Com carga cheia ela anda 42 px por quadro e sem rastro
  sumia de um lado e aparecia do outro.
- **Poeira** atrás de quem rola e na pedra onde a flecha crava, com um tranco curto de câmera.
- **Blocky na morte**: a imagem se quebra em blocos junto com o véu vermelho.
- **O texto de estado saiu da tela.** O jogo não tem HUD (seção 3.9): ele virou ferramenta de
  verificação e mora atrás do mesmo `H` dos contornos de colisão.

Não entraram, e por quê: **Vignette** foi testada e descartada na fase 4 (escurece a borda, que é
onde o mar de lava vive — ver 2.1.1), e **GradientMap no núcleo** não se paga, porque o pulso do
núcleo já é desenhado por emissor e um shader de paleta para um sprite só é mais peça para manter.

### Som (fase 8)

**Sintetizado em código, sem um único arquivo de áudio** — a mesma escolha da fonte de bitmap:
o que não tem asset é feito em código, e o dia que houver `.ogg` a troca acontece dentro de
`src/audio.js`, sem tocar em quem chama.

O vocabulário sai do que a sala é — **pedra, bronze e fogo**. Tudo que bate tem um estalo curto de
ruído filtrado (a pedra) e um tom que desce (a massa); o que é fogo é ruído passa-alta sem tom; e
o que é titã soa sempre uma oitava abaixo do que o jogador faz. Nada sobe, com duas exceções que
são ganho de verdade: o Vínculo puxando e o vínculo guardado no obelisco.

A mistura foi **medida com um analisador pendurado na saída**, não estimada no olho — filtro come
volume de um jeito que não dá para adivinhar (o raspão do rolamento pedia quase três vezes o
volume do estalo na pedra para chegar ao mesmo lugar). Os picos, em amplitude: núcleo e morte 0,30
· titã caindo 0,23 · rugido 0,22 · corpo 0,21 · acorda 0,17 · tiro 0,16 · pedra 0,14 · brasa e
reflexo 0,12 · vínculo 0,10 · respingo 0,08 · rolar 0,08 · menu 0,05.

Três limites que o navegador impõe e o módulo respeita: o contexto **só nasce num gesto** do
jogador (por isso a espera mora no boot, e não numa cena — endereço direto de luta não passa pelo
título e ficava mudo); cada som tem **intervalo mínimo** próprio, senão a chuva de lava vira
metralhadora; e há **teto de vozes**, porque o Web Audio não limpa nó sozinho.

**O que faz sentido fazer som, faz.** O titã caindo, o bronze batendo, a corrente rangendo no alto
do arco, o gêiser abrindo, a lava borbulhando, o caldeirão bebendo. São 31 receitas, e a regra de
quando disparar é sempre a mesma: **transição, nunca estado** — ler "está rolando" tocaria o raspão
sessenta vezes por segundo.

Duas mereceram desenho próprio. O **bronze** não é um tom: são parciais inarmônicas batendo umas
nas outras (1 : 1,51 : 2,66), e é essa briga que faz o rolar de sino; afinado em oitavas sairia
órgão de igreja. E a **carga da Sentinela** é o único som do jogo que sobe e fica, porque é ameaça
crescendo — quem ouve tem que procurar a linha na tela antes de ela existir.

**Fundo de sala**, um leito contínuo por área: `lava` (o mar rosnando do outro lado da muralha),
`cinza` (o ar alto do campanário) e `frio` (a chapa da fortaleza). Ruído filtrado com um oscilador
lento mexendo no corte — é ele que faz o ruído respirar em vez de chiar. Três regras: o leito
**não recomeça ao trocar de sala dentro da mesma área** (cortar o som num corredor entrega que a
cena foi recriada), ele **abafa a 25% na pausa** em vez de cortar (cortar soa como bug), e ele
**engrossa conforme o chão vira fogo** — a poça do Crisol conta, então a sala fica mais barulhenta
à medida que ele a toma. Som que responde ao estado é informação; som fixo é papel de parede.

As bolhas não moram no leito: bolha é **evento**, sorteada entre 0,35 e 1,45 s, e só onde há mar de
lava. Em cadência fixa viraria metrônomo.

**Fases 0 a 5 e a 7 estão prontas, e a 6 está em andamento** (três chefes de oito).
O jogo agora se joga do título ao terceiro titã sem digitar endereço nenhum. A fase 4 era o marco
real, e foi: se o Monólito não for divertido, o problema é de ajuste, e ajustar antes de existirem
8 chefes é muito mais barato. O que falta da 6 é o elenco — e antes do primeiro chefe novo,
**travar a paleta**.

## 11. Onde ficam os números

Todos em pixels internos (720×480). **Este bloco não existe mais como tabela** — os valores reais
vivem em `src/tuning.js`, organizados em cinco blocos:

- `TUNING` — movimento, flecha, recall, Vínculo, raios, hitstop
- `FX` — suco de câmera e os parâmetros de bloom por emissor
- `MONOLITO` — tudo do primeiro chefe: fases, gêiseres, jatos, destroços
- `SINO` — tudo do segundo: balanço, janela do alto, puxão, tombo
- `THEMES` e `TERRAIN` — cores e densidade de padrão do terreno, por área
- `MONOLITO_ART` — como a arte dele se encaixa (escalas, marcadores, cores de rocha)
- `OUTRO` — a sequência de fim de luta
- `SPRITES`, `PLAYER_BOX`, `COLOR` — arte, caixa do jogador e paleta

Nenhum desses números é sagrado, e nenhum deve aparecer solto no código.
