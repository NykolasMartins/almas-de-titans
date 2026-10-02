// node src/game.test.js
// Testa as máquinas de estado de jogador e flecha sem Phaser: os dois módulos
// só dependem de tuning.js e collision.js.
import assert from 'node:assert/strict'
import { STEP, TUNING, MONOLITO, SINO, SENTINELA, CORO, CRISOL, PLAYER_BOX, JUICE } from './tuning.js'
import { circleHit } from './collision.js'
import { testRoom, monolitoRoom, sinoRoom, sentinelaRoom, crisolRoom } from './data/rooms.js'
import Player from './player.js'
import Arrow, { HELD, FLYING, STUCK, GROUND, RETURNING } from './arrow.js'
import Monolito, { PHASE } from './bosses/monolito.js'
import Sino, { SWING, DOWN, TOPPLED, STRAIN, YANK } from './bosses/sino.js'
import { AIM, BEAM, HOLD, RECOVER, RING, SCRAMBLE } from './bosses/coro.js'
import Crisol, { CHEIO, MIRA, VERTE, VAZIO, TOMBADO, BEBE } from './bosses/crisol.js'
import Sentinela, { TRACK, CHARGE, FIRE, BLIND } from './bosses/sentinela.js'
import { Dust, Trail } from './fx.js'
import { run, loadSlots } from './run.js'
import { hsl, THEMES_NOVOS, COLOR_NOVO } from './palette.js'

const grid = testRoom.grid
const noInput = { dirX: 0, dirY: 0, aiming: false, rollPressed: false }

// Coordenadas em tiles, não em pixels fixos: sobrevivem a mudança de resolução.
const T = TUNING.tileSize
const PLAYER_HW = PLAYER_BOX.hw
const at = (col, row) => ({ x: col * T + T / 2, y: row * T + T / 2 })
const P0 = at(2, 10) // ponto de partida, longe de qualquer parede
const ALVO = at(16, 10) // alvo dos testes de flecha
const BLOCO = at(3, 3) // linha do bloco interno, para testar parede no meio
const DIST_ALVO = ALVO.x - P0.x

function makeTarget() {
  return { x: ALVO.x, y: ALVO.y, r: 22, core: { dx: 17, dy: 0, r: 6 } }
}

/** A flecha não conhece chefe: recebe um `hitTest` que devolve 'core' | 'body' | null. */
function hitTestFor(t) {
  return (x, y) => {
    if (circleHit(x, y, TUNING.arrowRadius, t.x + t.core.dx, t.y + t.core.dy, t.core.r)) return 'core'
    if (circleHit(x, y, TUNING.arrowRadius, t.x, t.y, t.r)) return 'body'
    return null
  }
}
const semAlvo = () => null

/** Roda a flecha até ela sair do estado atual, com teto de segurança. */
function runArrow(arrow, ctx, until, maxSteps = 600) {
  for (let i = 0; i < maxSteps; i++) {
    arrow.step(STEP, ctx)
    if (until()) return i
  }
  throw new Error(`flecha travou em ${arrow.state} após ${maxSteps} passos`)
}

// --- jogador -----------------------------------------------------------------

{
  const p = new Player(P0.x, P0.y)
  for (let i = 0; i < 60; i++) p.step(STEP, { ...noInput, dirX: 1 }, grid)
  assert.ok(p.x > P0.x, 'andou para a direita')
  assert.ok(Math.abs(p.x - (P0.x + TUNING.walkSpeed)) < 3, `~walkSpeed em 1 s, x=${p.x}`)
}

{
  const p = new Player(P0.x, P0.y)
  for (let i = 0; i < 60; i++) p.step(STEP, { ...noInput, dirX: -1 }, grid)
  const parede = T + PLAYER_HW
  assert.ok(Math.abs(p.x - parede) <= 1.5, `parou colado na parede da esquerda, x=${p.x}`)
}

{
  // Mirando, anda devagar. É o que dá o custo de atirar.
  const p = new Player(P0.x, P0.y)
  for (let i = 0; i < 60; i++) p.step(STEP, { ...noInput, dirX: 1, aiming: true }, grid)
  assert.ok(Math.abs(p.x - (P0.x + TUNING.aimSpeed)) < 3, `~aimSpeed em 1 s, x=${p.x}`)
}

{
  // Rolamento: direção travada no início, não obedece input novo, e é mais rápido que andar.
  const p = new Player(P0.x, P0.y)
  p.step(STEP, { ...noInput, dirX: 1, rollPressed: true }, grid)
  assert.ok(p.rolling, 'entrou em rolamento')
  const start = p.x
  for (let i = 0; i < 10; i++) p.step(STEP, { ...noInput, dirX: -1 }, grid) // tenta virar no meio
  assert.ok(p.x > start, 'ignorou o input contrário durante o rolamento')

  const rollFrames = Math.round(TUNING.rollDuration / (STEP * 1000))
  for (let i = 0; i < rollFrames + 2; i++) p.step(STEP, noInput, grid)
  assert.ok(!p.rolling, 'rolamento termina sozinho')
}

// --- flecha ------------------------------------------------------------------

{
  // Crava na parede e volta quando chamada.
  const arrow = new Arrow()
  const player = new Player(P0.x, P0.y)
  const target = makeTarget()
  const ctx = { grid, player, hitTest: hitTestFor(target), recallHeld: true,
    onHit: (kind) => assert.equal(kind, 'body', 'não devia acertar núcleo') }

  arrow.shoot(player.x, player.y, 0, -1, 1) // para cima, longe do alvo
  assert.equal(arrow.state, FLYING)
  runArrow(arrow, ctx, () => arrow.state === STUCK)
  assert.equal(arrow.stuckTo, 'wall', 'cravou na parede')
  assert.ok(arrow.y < T + 8, `cravou na parede de cima, y=${arrow.y}`)

  arrow.recall()
  assert.equal(arrow.state, RETURNING)
  runArrow(arrow, ctx, () => arrow.state === HELD)
  assert.equal(arrow.state, HELD, 'voltou para a mão')
}

{
  // Não atravessa parede fina: sem sweep, a 7,5 px por quadro ela passaria direto.
  const arrow = new Arrow()
  const player = new Player(P0.x, P0.y)
  const ctx = { grid, player, hitTest: hitTestFor(makeTarget()), onHit: () => {}, recallHeld: true }
  arrow.shoot(P0.x, P0.y, 1, 0, 1)
  runArrow(arrow, ctx, () => arrow.state === STUCK)
  assert.ok(arrow.x < ALVO.x, `parou no alvo antes de qualquer parede, x=${arrow.x}`)
}

{
  // Tiro de frente: crava no corpo, não mata. O corpo é imune.
  const arrow = new Arrow()
  const player = new Player(P0.x, P0.y)
  const target = makeTarget()
  let coreHits = 0
  const ctx = { grid, player, hitTest: hitTestFor(target), recallHeld: true,
    onHit: (kind) => { if (kind === 'core') coreHits++ } }

  arrow.shoot(player.x, player.y, 1, 0, 1)
  runArrow(arrow, ctx, () => arrow.state === STUCK)
  assert.equal(arrow.stuckTo, 'boss', 'cravou no alvo')
  assert.equal(coreHits, 0, 'corpo não conta como acerto')
  assert.ok(Math.abs(arrow.x - (ALVO.x - 22)) < 8, `cravou na borda de frente, x=${arrow.x}`)

  // Agora a mecânica central: dar a volta e chamar a flecha de volta pelo meio do alvo.
  player.x = ALVO.x + 90
  player.y = ALVO.y
  arrow.recall()
  runArrow(arrow, ctx, () => arrow.state === HELD)
  assert.equal(coreHits, 1, 'a volta atravessou o corpo e acertou o núcleo')
}

{
  // Acerto direto no núcleo também mata, quando dá para alcançá-lo.
  const arrow = new Arrow()
  const player = new Player(ALVO.x + 90, ALVO.y)
  const target = makeTarget()
  let coreHits = 0
  const ctx = { grid, player, hitTest: hitTestFor(target), recallHeld: true,
    onHit: (kind) => { if (kind === 'core') coreHits++ } }

  arrow.shoot(player.x, player.y, -1, 0, 1)
  runArrow(arrow, ctx, () => arrow.state === STUCK)
  assert.equal(coreHits, 1, 'núcleo exposto morre de frente')
}

{
  // Recall em pleno voo cancela o tiro.
  const arrow = new Arrow()
  const player = new Player(P0.x, P0.y)
  const ctx = { grid, player, hitTest: hitTestFor(makeTarget()), onHit: () => {}, recallHeld: true }
  arrow.shoot(P0.x, P0.y, 0, -1, 1)
  arrow.step(STEP, ctx)
  assert.equal(arrow.state, FLYING)
  arrow.recall()
  assert.equal(arrow.state, RETURNING, 'dá para chamar a flecha no meio do voo')
  runArrow(arrow, ctx, () => arrow.state === HELD)
}

{
  // Encostar na flecha cravada recupera ela, sem precisar chamar.
  const arrow = new Arrow()
  const player = new Player(P0.x, P0.y)
  const ctx = { grid, player, hitTest: hitTestFor(makeTarget()), onHit: () => {}, recallHeld: true }
  arrow.shoot(P0.x, P0.y, 0, -1, 1)
  runArrow(arrow, ctx, () => arrow.state === STUCK)
  player.x = arrow.x
  player.y = arrow.y
  arrow.step(STEP, ctx)
  assert.equal(arrow.state, HELD, 'pegou a flecha andando por cima')
}

{
  // Só existe uma flecha: atirar de novo enquanto ela está fora não faz nada.
  const arrow = new Arrow()
  const player = new Player(P0.x, P0.y)
  const ctx = { grid, player, hitTest: hitTestFor(makeTarget()), onHit: () => {}, recallHeld: true }
  arrow.shoot(P0.x, P0.y, 0, -1, 1)
  const before = { x: arrow.x, y: arrow.y, dirY: arrow.dirY }
  arrow.shoot(P0.x, P0.y, 1, 0, 1)
  assert.equal(arrow.dirY, before.dirY, 'segundo tiro ignorado')
}

// --- força, queda e recall ---------------------------------------------------

{
  // Carga é alcance. O alvo do teste fica a 264 px: carga cheia passa dele, toque não chega.
  const player = new Player(P0.x, P0.y)
  const ctx = { grid, player, hitTest: semAlvo, onHit: () => {}, recallHeld: true }
  const alcance = (carga) => {
    const a = new Arrow()
    a.shoot(P0.x, P0.y, 1, 0, carga)
    runArrow(a, ctx, () => a.state !== FLYING)
    return a.x - P0.x
  }

  const cheia = alcance(1)
  const toque = alcance(0)
  assert.ok(cheia > DIST_ALVO, `carga cheia passa do alvo, alcance=${cheia}`)
  assert.ok(toque < DIST_ALVO, `toque seco não chega no alvo, alcance=${toque}`)
  assert.ok(cheia > toque * 2, `carga cheia vai bem mais longe (${cheia} contra ${toque})`)
}

{
  // Soltar o botão no meio da volta não corta na hora: ela desacelera e cai.
  const arrow = new Arrow()
  const player = new Player(P0.x, P0.y)
  const base = { grid, player, hitTest: semAlvo, onHit: () => {} }
  arrow.shoot(P0.x, P0.y, 0, -1, 1)
  runArrow(arrow, { ...base, recallHeld: true }, () => arrow.state === STUCK)
  arrow.recall()
  runArrow(arrow, { ...base, recallHeld: true }, () => arrow.speed > TUNING.recallSpeedMin * 2)

  const solta = { ...base, recallHeld: false }
  arrow.step(STEP, solta)
  assert.equal(arrow.state, RETURNING, 'não para no mesmo quadro em que solta')
  assert.ok(arrow.speed > TUNING.arrowRestSpeed, 'ainda tem velocidade')
  runArrow(arrow, solta, () => arrow.state !== RETURNING)
  assert.equal(arrow.state, GROUND, 'desacelera até cair')
}

{
  // A volta para na parede em vez de atravessar: o bloco interno fica entre os dois.
  const arrow = new Arrow()
  const player = new Player(BLOCO.x, BLOCO.y)
  const ctx = { grid, player, hitTest: semAlvo, onHit: () => {}, recallHeld: true }
  const faceDireita = T * 12 // o bloco vai da coluna 8 à 11
  arrow.state = STUCK
  arrow.x = T * 20
  arrow.y = BLOCO.y
  arrow.recall()
  runArrow(arrow, ctx, () => arrow.state === STUCK)
  assert.ok(arrow.x > faceDireita && arrow.x < faceDireita + 8, `parou na face do bloco, x=${arrow.x}`)
  assert.ok(arrow.recallBlocked, 'cravar na volta exige soltar e puxar de novo')
}

// --- Vínculo -----------------------------------------------------------------

function tetherTo(p, ax, ay, maxSteps = 300) {
  p.startTether()
  for (let i = 0; i < maxSteps && p.tethering; i++) {
    p.step(STEP, { ...noInput, anchorX: ax, anchorY: ay }, grid)
  }
  return p
}

{
  // Puxa o jogador até pouco antes da flecha.
  const p = tetherTo(new Player(P0.x, P0.y), ALVO.x, P0.y)
  assert.ok(Math.abs(p.x - (ALVO.x - TUNING.tetherStopGap)) < 2, `parou antes da flecha, x=${p.x}`)
}

{
  // Não atravessa parede: o bloco interno fica no caminho.
  const p = tetherTo(new Player(BLOCO.x, BLOCO.y), T * 20, BLOCO.y)
  assert.ok(p.x < T * 8, `barrado pelo bloco, x=${p.x}`)
}

{
  // Rolamento não é interrompido pelo Vínculo.
  const p = new Player(P0.x, P0.y)
  p.step(STEP, { ...noInput, dirX: 1, rollPressed: true }, grid)
  p.startTether()
  assert.ok(!p.tethering, 'Vínculo não corta um rolamento em curso')
}

console.log('game: ok')

// --- Monólito de Obsidiana ---------------------------------------------------

{
  // O spawn não pode encostar num gêiser: morrer em loop congela a simulação
  // inteira, porque o hitstop também para o chefe.
  const seguro = TUNING.playerRadius + MONOLITO.geyserRadius + 8
  for (const g of monolitoRoom.geysers) {
    const d = Math.hypot(monolitoRoom.spawn.x - g.x, monolitoRoom.spawn.y - g.y)
    assert.ok(d > seguro, `spawn a ${Math.round(d)} px do gêiser (${g.x},${g.y}), mínimo ${seguro}`)
  }
}

{
  // A cadeia: quatro quedas racham a pirâmide, calor a estilhaça, núcleo morre
  // em um acerto.
  const room = monolitoRoom
  const boss = new Monolito(room)
  const player = new Player(room.spawn.x, room.spawn.y)
  const ctx = { player, grid: room.grid, kill: () => {} }
  const ateQue = (cond, max = 3000) => {
    for (let i = 0; i < max && !cond(); i++) boss.update(STEP, ctx)
    assert.ok(cond(), 'condição alcançada dentro do limite de passos')
  }

  assert.ok(!boss.grounded, 'começa no ar, não mata por contato')
  assert.equal(boss.hitTest(boss.x, boss.y), null, 'no ar a flecha passa por baixo')

  // Cada queda soma uma rachadura; só na quarta ela fica frágil.
  player.x = monolitoRoom.spawn.x
  player.y = monolitoRoom.spawn.y
  for (let n = 1; n <= MONOLITO.crackSlams; n++) {
    ateQue(() => boss.cracks === n)
    assert.equal(boss.fragile, n === MONOLITO.crackSlams, `frágil só na ${MONOLITO.crackSlams}ª queda`)
  }
  // Entulho acumula: cada batida deixa mais obsidiana no chão da arena.
  assert.equal(
    boss.debris.length,
    MONOLITO.crackSlams * MONOLITO.slamDebris,
    'cada batida somou destroços ao chão',
  )

  // Frágil mas fria: flecha comum não abre nada.
  boss.onArrowHit('body', { burning: false })
  assert.equal(boss.phase, PHASE.ARMOR, 'flecha fria não estilhaça')

  // Flecha em brasa numa carapaça já frágil abre na hora.
  boss.onArrowHit('body', { burning: true })
  ateQue(() => boss.phase === PHASE.CORE, 10)
  assert.equal(boss.hitTest(boss.x, boss.y), 'core', 'núcleo exposto')

  // Na fase do núcleo a sala começa a cuspir jatos das paredes.
  ateQue(() => boss.jets.length > 0)
  // Os três lados são conferidos no sorteio, não na luta: na janela de 8 s cabem
  // uns nove jatos, e faltar um dos lados por azar acontecia em ~40% das rodadas.
  const lados = new Set()
  for (let i = 0; i < 60; i++) {
    boss.spawnJet()
    lados.add(boss.jets[boss.jets.length - 1].side)
  }
  assert.ok(lados.has('top') && lados.has('left') && lados.has('right'), `jatos das três paredes: ${[...lados]}`)
  boss.jets = []

  boss.onArrowHit('core', { burning: false })
  assert.ok(boss.dead, 'núcleo morre em um acerto')
}

{
  // Cacos: são arremessados, assentam no chão, e ele os recolhe sorteando um a um.
  // Ao fim da janela a armadura se refaz inteira e a luta volta à fase 1.
  const boss = new Monolito(monolitoRoom)
  const player = new Player(monolitoRoom.spawn.x, monolitoRoom.spawn.y)
  const ctx = { player, grid: monolitoRoom.grid, kill: () => {} }
  boss.cracks = MONOLITO.crackSlams
  boss.onArrowHit('body', { burning: true })
  assert.equal(boss.debris.length, MONOLITO.shatterDebris, 'estilhaçou em cacos')
  assert.ok(boss.debris.every((d) => !d.landed), 'cacos saem voando, não nascem parados')

  // Deslizam, param, e ficam parados um tempo antes de ele começar a recolher.
  for (let i = 0; i < 150; i++) boss.update(STEP, ctx)
  const parados = boss.debris.filter((d) => d.landed && !d.pulled)
  assert.ok(parados.length >= 8, `a maioria assentou no chão (${parados.length} de ${MONOLITO.shatterDebris})`)
  const dist = parados.reduce((a, d) => a + Math.hypot(d.x - boss.x, d.y - boss.y), 0) / parados.length
  assert.ok(dist > 80, `assentaram espalhados, não colados no corpo (${Math.round(dist)} px)`)

  // Recolhe ao longo da janela, um de cada vez.
  const antes = boss.debris.length
  for (let i = 0; i < 240; i++) boss.update(STEP, ctx)
  assert.ok(boss.debris.length < antes, `recolheu cacos (${antes} -> ${boss.debris.length})`)

  // Passada a janela de 8 s, volta à fase 1 com a carapaça inteira.
  for (let i = 0; i < 700 && boss.phase === PHASE.CORE; i++) boss.update(STEP, ctx)
  assert.equal(boss.phase, PHASE.ARMOR, 'armadura se refaz e volta à fase 1')
  assert.equal(boss.cracks, 0, 'carapaça refeita não guarda rachadura')
  assert.equal(boss.debris.length, 0, 'sem cacos sobrando')
}

{
  // A queda avisa a cena para sacudir a tela.
  const boss = new Monolito(monolitoRoom)
  const player = new Player(monolitoRoom.spawn.x, monolitoRoom.spawn.y)
  let tremores = 0
  const ctx = { player, grid: monolitoRoom.grid, kill: () => {}, shake: () => tremores++ }
  for (let i = 0; i < 400 && tremores === 0; i++) boss.update(STEP, ctx)
  assert.equal(tremores, 1, 'a batida no chão dispara o tremor')
  assert.equal(boss.cracks, 1, 'e conta uma rachadura')
}

{
  // Caminho alternativo: sem flecha em brasa, ficar em cima da lava também
  // esquenta — só que devagar.
  const boss = new Monolito(monolitoRoom)
  const player = new Player(monolitoRoom.spawn.x, monolitoRoom.spawn.y)
  boss.cracks = MONOLITO.crackSlams
  boss.state = 'recover'
  const g = boss.geysers[0]
  boss.x = g.x
  boss.y = g.y

  const ctx = { player, grid: monolitoRoom.grid, kill: () => {} }
  for (let i = 0; i < 200 && boss.phase === PHASE.ARMOR; i++) {
    g.state = 'erupt'
    g.t = MONOLITO.geyserErupt // mantém irrompendo sob ele
    boss.update(STEP, ctx)
  }
  assert.equal(boss.phase, PHASE.CORE, 'lava por baixo estilhaça sozinha')
}

{
  // A flecha racha por conta própria, e a brasa que fecha a quarta rachadura
  // quebra a carapaça no mesmo acerto.
  const boss = new Monolito(monolitoRoom)
  for (let i = 1; i < MONOLITO.crackSlams; i++) {
    boss.onArrowHit('body', { burning: false })
    assert.equal(boss.cracks, i, 'flecha comum racha e só')
    assert.equal(boss.phase, PHASE.ARMOR)
  }
  boss.onArrowHit('body', { burning: true })
  assert.equal(boss.cracks, MONOLITO.crackSlams, 'a brasa também racha')
  assert.equal(boss.phase, PHASE.CORE, 'e a quarta rachadura em brasa abre a carapaça')
}

{
  // Ela se levanta mais rápido conforme racha, mas nunca tão rápido quanto antes.
  const boss = new Monolito(monolitoRoom)
  const inteiro = boss.recoverTime
  boss.cracks = MONOLITO.crackSlams
  const rachado = boss.recoverTime
  assert.ok(inteiro > rachado, `inteira demora mais (${inteiro} > ${rachado})`)
  assert.ok(rachado > 1600, `mesmo rachada dá mais respiro que os 1600 ms antigos (${rachado})`)
}

{
  // Destroço recém-lançado não corta: dá tempo de reagir a uma batida ao lado.
  // Posição dentro da arena do Monólito: em cima de lava eles assentariam na hora.
  const boss = new Monolito(monolitoRoom)
  const player = new Player(monolitoRoom.spawn.x, monolitoRoom.spawn.y)
  let mortes = 0
  const ctx = { player, grid: monolitoRoom.grid, kill: () => mortes++ }
  boss.x = player.x
  boss.y = player.y
  boss.throwDebris(MONOLITO.slamDebris, MONOLITO.slamDebrisSize)
  boss.stepDebris(STEP, ctx)
  assert.equal(mortes, 0, 'destroço nasce inerte em cima do jogador')

  // Passado o tempo de armar, o que ainda estiver voando corta.
  const maior = boss.debris.find((d) => d.size === MONOLITO.slamDebrisSize)
  assert.ok(maior, 'destroço de batida usa o tamanho menor')
  boss.debris.forEach((d) => {
    d.age = MONOLITO.debrisArmTime
    d.x = player.x
    d.y = player.y
  })
  boss.stepDebris(STEP, ctx)
  assert.ok(mortes > 0, 'depois de armar, corta')
}

{
  // Os cacos da carapaça são maiores que os da batida.
  const boss = new Monolito(monolitoRoom)
  boss.throwDebris(MONOLITO.shatterDebris, MONOLITO.shatterDebrisSize)
  assert.ok(
    MONOLITO.shatterDebrisSize > MONOLITO.slamDebrisSize && boss.debris.every((d) => d.size === MONOLITO.shatterDebrisSize),
    'caco de quebra é maior',
  )
}

{
  // O calor fica retido antes de escorrer: aquecimentos parciais se somam.
  const boss = new Monolito(monolitoRoom)
  const player = new Player(monolitoRoom.spawn.x, monolitoRoom.spawn.y)
  const ctx = { player, grid: monolitoRoom.grid, kill: () => {} }
  // Todos os gêiseres têm relógio aleatório: sem calar os outros nove, um podia
  // abrir sob o chefe no meio da medição e reaquecê-lo.
  const calar = () =>
    boss.geysers.forEach((x) => {
      x.state = 'dormant'
      x.t = 1e6
    })
  const g = boss.geysers[0]
  boss.state = 'recover'
  boss.x = g.x
  boss.y = g.y

  // meio segundo sobre a lava
  for (let i = 0; i < 30; i++) {
    calar()
    g.state = 'erupt'
    boss.update(STEP, ctx)
  }
  const aquecido = boss.heat
  assert.ok(aquecido > 0.2, `esquentou parcialmente (${aquecido.toFixed(2)})`)

  // sai da lava: segura por heatHold antes de perder qualquer coisa
  boss.x = monolitoRoom.width / 2
  boss.y = monolitoRoom.height / 2
  for (let i = 0; i < Math.round((MONOLITO.heatHold / 1000) * 60) - 30; i++) {
    calar()
    boss.update(STEP, ctx)
  }
  assert.equal(boss.heat, aquecido, 'não perdeu calor durante a retenção')

  for (let i = 0; i < 90; i++) {
    calar()
    boss.update(STEP, ctx)
  }
  assert.ok(boss.heat < aquecido, `passada a retenção, esfria (${boss.heat.toFixed(2)})`)
}

{
  // Ao morrer a arena se cala: nada de jato, entulho ou gêiser aberto sobrando.
  // (A sequência de desfecho em si vive no World, que importa o Phaser e por isso
  // é verificada no navegador.)
  const boss = new Monolito(monolitoRoom)
  const player = new Player(monolitoRoom.spawn.x, monolitoRoom.spawn.y)
  const ctx = { player, grid: monolitoRoom.grid, kill: () => {} }
  boss.cracks = MONOLITO.crackSlams
  boss.onArrowHit('body', { burning: true })
  for (let i = 0; i < 200; i++) boss.update(STEP, ctx)
  assert.ok(boss.debris.length > 0 || boss.jets.length > 0, 'em luta há coisa ativa na arena')

  boss.onArrowHit('core', { burning: false })
  assert.ok(boss.dead)
  assert.equal(boss.jets.length, 0, 'jatos cessam')
  assert.equal(boss.debris.length, 0, 'destroços somem')
  assert.equal(boss.geysers.filter((g) => g.state === 'erupt').length, 0, 'gêiseres fecham')
}

console.log('monolito: ok')

// --- O Sino ---------------------------------------------------------------
// A regra da luta é uma só: o Vínculo move o corpo mais leve. Testa que o
// balanço recusa o puxão, que a parada no alto cede, e que o núcleo só existe
// depois de tombado.

/** Roda o sino até o estado pedido, com teto de segurança. */
function ateEstado(boss, ctx, estado, maxSteps = 2000) {
  for (let i = 0; i < maxSteps && boss.state !== estado; i++) boss.update(STEP, ctx)
  assert.equal(boss.state, estado, `chegou em ${estado}`)
}

/**
 * Roda até a janela do Vínculo abrir. Ela não é mais um estado — é o começo da
 * queda, então quem espera por ela espera pela **condição**, não pelo nome.
 */
function ateLeve(boss, ctx, maxSteps = 2000) {
  for (let i = 0; i < maxSteps && !boss.light; i++) boss.update(STEP, ctx)
  assert.ok(boss.light, 'chegou na janela (começo da queda)')
}

{
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  const ctx = { player, grid: sinoRoom.grid, kill: () => {}, shake: () => {} }

  assert.equal(boss.state, SWING)
  assert.equal(boss.tetherPull(player), 'slam', 'em movimento ele não cede: quem vai é o jogador')
  assert.equal(boss.state, SWING, 'e o puxão errado não muda o estado dele')

  ateLeve(boss, ctx)
  assert.ok(boss.light, 'começando a descer ele fica leve')
  assert.ok(!boss.grounded, 'no alto do arco ele está levantado')
  assert.equal(boss.hitTest(boss.x, boss.y), null, 'levantado, a flecha passa por baixo')
  assert.ok(!boss.lethal, 'e ele não encosta em ninguém')

  const px0 = player.x
  const py0 = player.y
  const antesDoPuxao = Math.hypot(boss.x - px0, boss.y - py0)
  assert.equal(boss.tetherPull(player), 'yield', 'parado, é ele quem vem')
  assert.ok(player.rolling, 'e o jogador leva um trancão de reação')

  // Aqui o jogador anda junto: o trancão é metade do que decide onde o sino pousa.
  for (let i = 0; i < 900 && (boss.state !== DOWN || player.rolling); i++) {
    player.step(STEP, noInput, sinoRoom.grid)
    boss.update(STEP, ctx)
  }
  assert.equal(boss.state, DOWN)
  assert.equal(boss.hits, 1)

  const andou = Math.hypot(player.x - px0, player.y - py0)
  assert.ok(andou > 20, `o trancão jogou o jogador para a frente (${Math.round(andou)} px)`)
  assert.ok(
    Math.hypot(boss.x - px0, boss.y - py0) < antesDoPuxao,
    'e o trancão foi na direção do sino',
  )
  const folga = Math.hypot(boss.x - player.x, boss.y - player.y)
  assert.ok(folga <= SINO.yankGap + 4, `caiu ao lado do jogador (${Math.round(folga)} px)`)
  assert.ok(folga > SINO.bellRadius + TUNING.playerRadius, 'e não em cima dele')
}

{
  // Três puxões no alto derrubam. E a janela do alto encurta a cada rodada.
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  const ctx = { player, grid: sinoRoom.grid, kill: () => {}, shake: () => {} }
  const balancoInicial = boss.period

  for (let n = 0; n < SINO.toppleHits; n++) {
    ateLeve(boss, ctx)
    assert.equal(boss.tetherPull(player), 'yield')
    // Resistir e vir são dois estados: o puxão só acaba quando ele pousa.
    for (let i = 0; i < 400 && (boss.state === 'strain' || boss.state === 'yank'); i++) boss.update(STEP, ctx)
  }

  assert.equal(boss.state, TOPPLED, 'três puxões arrebentam o gancho')
  // A janela encurta porque o balanço acelera: ela é uma fatia da fase, e não
  // um temporizador próprio. Um número a menos para manter em sincronia.
  assert.ok(
    boss.period < balancoInicial,
    `o balanço acelerou (${balancoInicial} -> ${Math.round(boss.period)}), e a janela encolhe junto`,
  )
  assert.ok(!boss.lethal, 'tombado ele não mata: é a janela para chegar perto')

  const c = boss.corePos()
  assert.equal(boss.hitTest(c.x, c.y), 'core', 'o badalo fica exposto')
  // A posição do badalo muda com a guinada: offset radial descolava do desenho.
  const antes = boss.mouthSector
  boss.mouth = { x: 1, y: 0 }
  assert.notEqual(boss.mouthSector, antes, 'outra direção, outro setor')
  const leste = boss.corePos()
  assert.ok(leste.x !== c.x || leste.y !== c.y, 'e outro ponto para o badalo')
  boss.onArrowHit('core', { burning: false })
  // **O badalo não morre: ele desvia.** Quem mata é o coro, na fase seguinte.
  assert.ok(!boss.dead, 'o acerto no badalo não mata: ele escapa')
  assert.ok(boss.coro, 'o coro acorda no lugar')
  assert.ok(boss.husk, 'o corpo fica onde caiu')
  assert.equal(boss.lethal, false, 'o corpo oco não machuca mais')
}

{
  // Flecha cravada no bronze acompanha o balanço, senão a corda liga ao vazio.
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  const ctx = { player, grid: sinoRoom.grid, kill: () => {}, shake: () => {} }
  const arrow = { x: boss.x + SINO.bellRadius, y: boss.y }
  boss.onArrowHit('body', arrow)

  const antes = boss.x
  for (let i = 0; i < 30; i++) boss.update(STEP, ctx)
  boss.carryArrow(arrow)
  assert.notEqual(boss.x, antes, 'o sino andou')
  assert.equal(arrow.x, boss.x + SINO.bellRadius, 'e a flecha andou junto')
}

{
  // A altura é que decide: rente ao chão ele atinge e é atingido; no alto, nem
  // um nem outro — e quem estiver na pegada leva o feixe.
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  const ctx = { player, grid: sinoRoom.grid, kill: () => mortes++, shake: () => {} }
  let mortes = 0

  // Meio do arco: rente ao chão.
  for (let i = 0; i < 2000 && !boss.grounded; i++) boss.update(STEP, ctx)
  assert.ok(boss.grounded, 'no meio do arco ele fica rente ao chão')
  assert.equal(boss.hitTest(boss.x, boss.y), 'body', 'e aí a flecha o encontra')
  assert.ok(boss.lethal, 'e o contato mata')

  // Barriga para baixo, e a pegada sobe: ela cobre a boca, não o chão vazio à
  // frente. Antes de subir, o meio-disco inteiro ficava abaixo do sino.
  const R = SINO.bellRadius
  assert.equal(boss.footY, boss.y - SINO.footRise, 'a pegada sobe em relação ao ponto do chão')
  assert.ok(boss.touches(boss.x, boss.footY + R * 0.8, 1), 'pega o chão à frente da boca')
  // A caixa 3:4 sobe pela aresta reta e pega o corpo, que o meio-disco deixava de fora.
  assert.ok(boss.touches(boss.x, boss.footY - SINO.bodyBoxH * 0.8, 1), 'a caixa pega o corpo')
  assert.ok(
    !boss.touches(boss.x + SINO.bodyBoxW, boss.footY - SINO.bodyBoxH * 0.6, 1),
    'mas não pega o ar ao lado dele',
  )

  // No alto, com o jogador embaixo: o feixe se arma, e só depois mata.
  for (let i = 0; i < 2000 && boss.grounded; i++) boss.update(STEP, ctx)
  assert.ok(!boss.grounded)
  mortes = 0
  player.x = boss.x
  player.y = boss.footY + R * 0.5
  boss.update(STEP, ctx)
  assert.ok(boss.laser, 'entrar na pegada arma o feixe')
  assert.equal(mortes, 0, 'e não mata na hora: ele ainda está se formando')

  // Metade da carga: ainda nada. O jogador segue embaixo dele, que é o que
  // mata — o feixe cai reto sob a boca e acompanha o corpo.
  const grudar = () => {
    player.x = boss.x
    player.y = boss.footY
  }
  for (let i = 0; i < Math.floor(SINO.laserCharge / 2 / (STEP * 1000)); i++) {
    grudar()
    boss.update(STEP, ctx)
  }
  assert.equal(mortes, 0, `nada antes de ${SINO.laserCharge} ms`)
  assert.ok(!boss.laser.fired)

  for (let i = 0; i < 2000 && !boss.laser?.fired; i++) {
    grudar()
    boss.update(STEP, ctx)
  }
  assert.equal(mortes, 1, 'no fim da carga, mata quem ficou embaixo')
}

{
  // Sair de baixo a tempo escapa: é para isso que a carga existe.
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  let mortes = 0
  const ctx = { player, grid: sinoRoom.grid, kill: () => mortes++, shake: () => {} }
  for (let i = 0; i < 2000 && boss.grounded; i++) boss.update(STEP, ctx)

  player.x = boss.x
  player.y = boss.footY + SINO.bellRadius * 0.5
  boss.update(STEP, ctx)
  assert.ok(boss.laser, 'feixe armado')

  player.y = boss.footY + SINO.bellRadius * 4 // saiu de baixo
  for (let i = 0; i < 2000 && !boss.laser?.fired; i++) boss.update(STEP, ctx)
  assert.ok(boss.laser.fired, 'o feixe sai de qualquer jeito')
  assert.equal(mortes, 0, 'mas quem saiu de baixo a tempo escapa')
}

{
  // A flecha cravada acompanha a altura, senão ela escorrega no corpo dele.
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  const ctx = { player, grid: sinoRoom.grid, kill: () => {}, shake: () => {} }
  for (let i = 0; i < 2000 && !boss.grounded; i++) boss.update(STEP, ctx)

  const arrow = { x: boss.x + 10, y: boss.y - boss.lift - 12 }
  boss.onArrowHit('body', arrow)
  ateLeve(boss, ctx)
  boss.carryArrow(arrow)
  assert.ok(boss.lift > 0, 'ele subiu')
  assert.equal(arrow.y, boss.y - boss.lift - 12, 'a flecha subiu junto, sem escorregar')
}

console.log('sino: ok')

// --- A Sentinela Espelhada ---------------------------------------------------
// A regra da luta: a frente devolve a flecha, o núcleo fica nas costas, e ela
// encara você o tempo todo — menos quando o próprio feixe a cega.

{
  const boss = new Sentinela(sentinelaRoom)
  const player = new Player(boss.x, boss.y + 120)
  const ctx = { player, grid: sentinelaRoom.grid, kill: () => {}, shake: () => {} }

  // Vira para encarar. Devagar: é a folga que permite contorná-la a pé.
  boss.face = -Math.PI / 2 // de costas para o jogador
  for (let i = 0; i < 120; i++) boss.update(STEP, ctx)
  const alvo = Math.atan2(player.y - boss.y, player.x - boss.x)
  assert.ok(Math.abs(Math.atan2(Math.sin(boss.face - alvo), Math.cos(boss.face - alvo))) < 0.2, 'ela vira para encarar')

  // Frente devolve; costas, com carapaça, são só pedra.
  const frente = { x: boss.x + boss.nx * SENTINELA.bodyRadius, y: boss.y + boss.ny * SENTINELA.bodyRadius }
  assert.equal(boss.hitTest(frente.x, frente.y), 'reflect', 'a frente é espelho')
  const c = boss.corePos()
  assert.ok(!boss.isFront(c.x, c.y), 'o núcleo fica do lado de trás')
  assert.ok(boss.shell, 'a carapaça começa fechada')
  assert.equal(boss.hitTest(c.x, c.y), 'body', 'com carapaça a flecha não chega no núcleo')

  boss.shell = false
  assert.equal(boss.hitTest(c.x, c.y), 'core', 'aberta, o núcleo é alcançável')
}

{
  // O feixe que volta nas costas dela é a única coisa que abre a carapaça — e
  // ele reflete na própria face espelhada dela, não só na muralha.
  const boss = new Sentinela(sentinelaRoom)
  const player = new Player(boss.x, boss.y + 150)
  let tremores = 0
  const ctx = { player, grid: sentinelaRoom.grid, kill: () => {}, shake: () => tremores++ }

  // Encostada na muralha de cima e mirando nela: o feixe volta, bate no espelho,
  // vai e volta — o suficiente para o traçado achar as costas em algum quique.
  boss.x = sentinelaRoom.width / 2
  boss.y = 110
  boss.face = -Math.PI / 2
  const tiro = boss.traceBeam(sentinelaRoom.grid)
  assert.ok(tiro.points.length > 2, 'quicou na muralha e voltou para o espelho')

  // Forçando a situação: o feixe engolido pelas costas quebra a carapaça.
  boss.state = CHARGE
  boss.t = boss.chargeTime
  boss.face = Math.PI / 2 // de costas para a muralha de cima
  boss.update(STEP, ctx)
  const abriu = !boss.shell
  if (abriu) {
    assert.equal(boss.fireEvery, SENTINELA.exposedFireEvery, 'na fase 2 ela atira muito mais cedo')
    assert.ok(boss.turnSpeed > SENTINELA.turnSpeed, 'e gira mais rápido')
  }

  // O caminho direto, sem depender da geometria da sala: a carapaça abre e a
  // fase 2 troca os números.
  const b2 = new Sentinela(sentinelaRoom)
  b2.breakShell({ shake: () => {} })
  assert.ok(!b2.shell)
  assert.ok(b2.chargeTime < SENTINELA.chargeTime, 'carrega mais rápido')
  assert.ok(b2.traceBeam(sentinelaRoom.grid).points.length >= 2)
}

{
  // Rebater é espelhar a direção na normal da face.
  const boss = new Sentinela(sentinelaRoom)
  boss.face = 0 // encarando o leste
  const arrow = { x: boss.x + 20, y: boss.y, dirX: -1, dirY: 0, speed: 1000 }
  boss.onArrowHit('reflect', arrow)
  assert.ok(arrow.dirX > 0.99, 'flecha de frente volta por onde veio')
  assert.ok(arrow.speed < 1000, 'e perde parte da velocidade')

  const obliqua = { x: boss.x + 20, y: boss.y, dirX: -0.6, dirY: 0.8, speed: 1000 }
  boss.onArrowHit('reflect', obliqua)
  assert.ok(Math.abs(obliqua.dirX - 0.6) < 0.01, 'oblíqua: inverte só o eixo da normal')
  assert.ok(Math.abs(obliqua.dirY - 0.8) < 0.01, 'e mantém o outro')
}

{
  // Mantém distância: quem move ela é o jogador.
  const boss = new Sentinela(sentinelaRoom)
  const player = new Player(boss.x, boss.y + 400)
  const ctx = { player, grid: sentinelaRoom.grid, kill: () => {}, shake: () => {} }
  const longe = Math.hypot(boss.x - player.x, boss.y - player.y)
  for (let i = 0; i < 120 && boss.state === TRACK; i++) boss.update(STEP, ctx)
  assert.ok(Math.hypot(boss.x - player.x, boss.y - player.y) < longe, 'longe demais, ela avança')

  const boss2 = new Sentinela(sentinelaRoom)
  const perto = new Player(boss2.x, boss2.y + 60)
  const ctx2 = { player: perto, grid: sentinelaRoom.grid, kill: () => {}, shake: () => {} }
  for (let i = 0; i < 120 && boss2.state === TRACK; i++) boss2.update(STEP, ctx2)
  assert.ok(Math.hypot(boss2.x - perto.x, boss2.y - perto.y) > 60, 'perto demais, ela recua')
}

{
  // O ciclo, e a cegueira que abre a janela para chegar às costas.
  const boss = new Sentinela(sentinelaRoom)
  const player = new Player(boss.x, boss.y + 150)
  let mortes = 0
  const ctx = { player, grid: sentinelaRoom.grid, kill: () => mortes++, shake: () => {} }

  for (let i = 0; i < 3000 && boss.state !== FIRE; i++) boss.update(STEP, ctx)
  assert.equal(boss.state, FIRE)
  assert.ok(boss.beam.length >= 2, 'o feixe tem caminho')
  // Na linha do feixe mata; fora dela, não.
  const meio = { x: (boss.beam[0].x + boss.beam[1].x) / 2, y: (boss.beam[0].y + boss.beam[1].y) / 2 }
  assert.ok(boss.beamHits(meio.x, meio.y, TUNING.playerRadius), 'na linha do feixe')
  assert.ok(!boss.beamHits(boss.beam[0].x - boss.ny * 200, boss.beam[0].y + boss.nx * 200, TUNING.playerRadius), 'fora dela, não')

  const antes = boss.fireEvery
  for (let i = 0; i < 3000 && boss.state !== BLIND; i++) boss.update(STEP, ctx)
  assert.equal(boss.state, BLIND)
  assert.ok(boss.fireEvery < antes, 'cada ciclo ela atira mais cedo')

  // Cega ela não vira: é a janela para se pôr atrás dela.
  const face = boss.face
  player.x = boss.x - 200
  player.y = boss.y - 200
  for (let i = 0; i < 30; i++) boss.update(STEP, ctx)
  assert.equal(boss.face, face, 'cega, ela não acompanha')
  assert.ok(boss.blind)
}

console.log('sentinela: ok')

{
  // Suco: poeira e rastro morrem sozinhos. Partícula que não some é vazamento —
  // isto roda a cada quadro e a cena nunca limpa a lista na mão.
  const po = new Dust()
  // Leque estreito: com o `spread` padrão ela sai para todo lado, e aí não há
  // direção para conferir.
  po.spawn(100, 100, 10, { dirX: 1, dirY: 0, spread: 0.4, speed: 60 })
  assert.equal(po.parts.length, 10)
  po.step(0.05)
  assert.ok(
    po.parts.every((p) => p.x > 100),
    'a poeira sopra na direção dada',
  )
  // Bem além da vida mais longa possível (life * 1.3).
  for (let i = 0; i < 60; i++) po.step(0.05)
  assert.equal(po.parts.length, 0, 'toda partícula morre')

  // Teto: o enfeite não pode competir com o jogo.
  po.spawn(0, 0, JUICE.dustMax + 50, {})
  assert.ok(po.parts.length <= JUICE.dustMax, 'a poeira tem teto')

  const r = new Trail()
  for (let i = 0; i < JUICE.trailPoints + 20; i++) r.push(i * 10, 0)
  assert.ok(r.points.length <= JUICE.trailPoints, 'o rastro tem teto')
  r.push(JUICE.trailPoints * 10, 0)
  const n = r.points.length
  r.push(JUICE.trailPoints * 10, 0) // parada, não acumula ponto em cima de ponto
  assert.equal(r.points.length, n)
  r.step((JUICE.trailLife + 50) / 1000)
  assert.equal(r.points.length, 0, 'o rastro se apaga sozinho')
}

console.log('suco: ok')

{
  // O Coro. Uma fase só, em ciclo: embaralho, badaladas, mira e volta — e o
  // coração só é alcançável enquanto o corpo está inclinado.
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  let mortes = 0
  const ctx = { player, grid: sinoRoom.grid, kill: () => mortes++, shake: () => {} }

  for (let n = 0; n < SINO.toppleHits; n++) {
    ateLeve(boss, ctx)
    boss.tetherPull(player)
    // Resistir e vir são dois estados: o puxão só acaba quando ele pousa.
    for (let i = 0; i < 400 && (boss.state === 'strain' || boss.state === 'yank'); i++) boss.update(STEP, ctx)
  }
  boss.onArrowHit('core', { burning: false })
  const coro = boss.coro
  assert.equal(coro.bells.length, sinoRoom.hangingBells.length, 'os sete sinos da câmara')

  const ate = (estado) => {
    for (let i = 0; i < 6000 && coro.state !== estado; i++) boss.update(STEP, ctx)
    assert.equal(coro.state, estado, 'chegou em ' + estado)
  }

  // Enquanto ele não se inclina, a flecha passa por baixo de todos.
  ate(SCRAMBLE)
  const escondido = coro.corePos()
  assert.equal(coro.hitTest(escondido.x, escondido.y), null, 'de pé o badalo está dentro da boca')

  // Embaralho de verdade: os corpos trocam de lugar.
  const antes = coro.bells.map((b) => ({ x: b.x, y: b.y }))
  for (let i = 0; i < 60; i++) boss.update(STEP, ctx)
  assert.ok(
    coro.bells.some((b, i) => Math.hypot(b.x - antes[i].x, b.y - antes[i].y) > 10),
    'eles se embaralham no céu',
  )

  // Badalada: a onda sai do sino e a frente mata — quem está atrás dela, não.
  ate(RING)
  for (let i = 0; i < 900 && coro.waves.length === 0; i++) boss.update(STEP, ctx)
  assert.ok(coro.waves.length > 0, 'a badalada solta uma onda')
  // Ela mata num raio curto e daí em diante só se apaga: a sala tem 720 x 480 e
  // a frente letal não pode cobrir nem metade dela.
  assert.ok(CORO.waveFade < CORO.waveRange, 'a onda se dissipa antes de sumir')
  assert.ok(CORO.waveFade < 260, 'a frente letal é curta')

  // A forma da onda, isolada: só a **frente** mata. Com a onda recém-saída o
  // centro ainda está dentro da frente, então ela é posta longe de propósito.
  coro.waves = [{ x: 300, y: 200, r: 120 }]
  assert.ok(120 < CORO.waveFade, 'a 120 px ela ainda está cheia')
  const mortesAntes = mortes
  player.x = 300 + 120
  player.y = 200
  coro.stepWaves(STEP, ctx)
  assert.equal(mortes, mortesAntes + 1, 'a frente da onda mata')
  player.x = 300
  player.y = 200
  coro.stepWaves(STEP, ctx)
  assert.equal(mortes, mortesAntes + 1, 'dentro do que já passou, não')
  coro.waves = []

  // A mira trava: o feixe sai onde você estava, não onde você foi parar.
  player.x = sinoRoom.spawn.x
  player.y = sinoRoom.spawn.y
  ate(AIM)
  assert.equal(coro.waves.length, 0, 'a mira só começa com a sala limpa de ondas')
  for (let i = 0; i < 10; i++) boss.update(STEP, ctx)
  const mira = { x: coro.aimX, y: coro.aimY }
  player.x = sinoRoom.spawn.x - 200
  for (let i = 0; i < 30; i++) boss.update(STEP, ctx)
  assert.equal(coro.aimX, mira.x, 'a direção não persegue')
  assert.equal(coro.aimY, mira.y, 'a direção não persegue')
  assert.ok(coro.tilt > 0, 'ele se inclina enquanto mira')

  // Inclinado, o coração aparece — e é a única coisa que a flecha encontra.
  const alvo = coro.corePos()
  assert.equal(coro.hitTest(alvo.x, alvo.y), 'core', 'inclinado, o badalo fica exposto')
  ate(BEAM)
  assert.ok(coro.beam.length >= 2, 'o feixe tem caminho')
  ate(HOLD)
  assert.ok(coro.exposed && coro.tilt > 0.9, 'passado o tiro ele fica aberto no lugar')
  const alvoHold = coro.corePos()
  assert.equal(coro.hitTest(alvoHold.x, alvoHold.y), 'core', 'e é a melhor hora de acertar')
  ate(RECOVER)
  assert.ok(coro.exposed, 'ele volta devagar, ainda exposto')

  const fim = coro.corePos()
  boss.onArrowHit('core', { burning: false })
  assert.ok(coro.dead && boss.dead, 'acertar o coração exposto mata')
  assert.equal(coro.hitTest(fim.x, fim.y), null, 'morto, não há mais alvo')
}

console.log('coro: ok')

{
  // A física do puxão: ele resiste, vem **pelo arco da corrente** e acelerando.
  // Linha reta em velocidade constante era o que não parecia peso nenhum.
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  const ctx = { player, grid: sinoRoom.grid, kill: () => {}, shake: () => {}, dust: () => {} }

  ateLeve(boss, ctx)
  // Do outro lado do pivô: é aí que arco e reta são caminhos diferentes, e é o
  // caso que a linha reta desenhava atravessando o meio da sala.
  player.x = boss.pivot.x - (boss.x - boss.pivot.x) * 0.8
  player.y = boss.pivot.y - (boss.y - boss.pivot.y) * 0.8
  const partida = { x: boss.x, y: boss.y }
  assert.equal(boss.tetherPull(player), 'yield')
  assert.equal(boss.state, STRAIN, 'ele resiste antes de ceder')

  for (let i = 0; i < 6; i++) boss.update(STEP, ctx)
  assert.ok(Math.hypot(boss.x - partida.x, boss.y - partida.y) < 1, 'resistindo, ele não anda')

  for (let i = 0; i < 400 && boss.state === STRAIN; i++) boss.update(STEP, ctx)
  assert.equal(boss.state, YANK, 'passada a resistência, ele cede')

  const alvo = { x: boss.targetX, y: boss.targetY }
  const caminho = []
  for (let i = 0; i < 400 && boss.state === YANK; i++) {
    boss.update(STEP, ctx)
    caminho.push({ x: boss.x, y: boss.y })
  }
  assert.ok(caminho.length > 13, 'o trajeto leva tempo: ' + caminho.length + ' quadros')

  // Arco: algum ponto do caminho fica longe da reta partida -> alvo.
  const vx = alvo.x - partida.x
  const vy = alvo.y - partida.y
  const len2 = vx * vx + vy * vy
  const desvio = Math.max(
    ...caminho.map((p) => {
      const t = Math.max(0, Math.min(1, ((p.x - partida.x) * vx + (p.y - partida.y) * vy) / len2))
      return Math.hypot(p.x - (partida.x + vx * t), p.y - (partida.y + vy * t))
    }),
  )
  assert.ok(desvio > 8, `ele vem pelo arco, não pela reta (desvio ${Math.round(desvio)} px)`)

  // Aceleração: o primeiro quarto do trajeto anda menos que o último.
  const anda = (a, b) => {
    let soma = 0
    for (let i = a + 1; i < b; i++) soma += Math.hypot(caminho[i].x - caminho[i - 1].x, caminho[i].y - caminho[i - 1].y)
    return soma
  }
  const q = Math.floor(caminho.length / 4)
  assert.ok(anda(0, q) < anda(caminho.length - q, caminho.length), 'ele acelera até chegar')

  // E ao bater ele quica antes de assentar.
  assert.equal(boss.state, DOWN)
  assert.ok(boss.lift > 0, 'a batida levanta o corpo de volta um pouco')
  for (let i = 0; i < 60; i++) boss.update(STEP, ctx)
  assert.ok(boss.lift < SINO.yankBounce, 'e o quique amortece')
}

{
  // Perder a janela do tombo devolve ele à corrente **andando**: sem trajeto
  // montado, o primeiro quadro já dava o percurso por encerrado e ele voltava
  // teleportado para o centro.
  const boss = new Sino(sinoRoom)
  const player = new Player(sinoRoom.spawn.x, sinoRoom.spawn.y)
  const ctx = { player, grid: sinoRoom.grid, kill: () => {}, shake: () => {}, dust: () => {} }
  for (let n = 0; n < SINO.toppleHits; n++) {
    ateLeve(boss, ctx)
    boss.tetherPull(player)
    for (let i = 0; i < 400 && (boss.state === STRAIN || boss.state === YANK); i++) boss.update(STEP, ctx)
  }
  assert.equal(boss.state, TOPPLED)
  for (let i = 0; i < 1000 && boss.state === TOPPLED; i++) boss.update(STEP, ctx)
  assert.equal(boss.state, 'rise')
  const antes = { x: boss.x, y: boss.y }
  boss.update(STEP, ctx)
  const passo = Math.hypot(boss.x - antes.x, boss.y - antes.y)
  assert.ok(passo < 30, `ele volta andando, não de um quadro para o outro (${Math.round(passo)} px)`)
  assert.ok(Math.hypot(boss.x - boss.pivot.x, boss.y - boss.pivot.y) > 10, 'e ainda não chegou')
}

console.log('física do sino: ok')

{
  // Morrer guarda **a estatística**, não o progresso: a contagem de mortes é o
  // placar do jogo e não pode sumir ao fechar a aba, mas alma ganha continua
  // valendo só depois do obelisco.
  const disco = new Map()
  globalThis.localStorage = {
    getItem: (k) => (disco.has(k) ? disco.get(k) : null),
    setItem: (k, v) => disco.set(k, String(v)),
  }

  run.start(0)
  run.addSoul('piramide')
  run.deaths = 3
  run.timeMs = 12000
  assert.ok(run.saveDeaths(), 'a morte grava')
  let lido = loadSlots()[0]
  assert.equal(lido.deaths, 3, 'a morte conta em disco')
  assert.equal(lido.timeMs, 12000, 'e o tempo junto')
  assert.deepEqual(lido.bosses, [], 'a alma não: isso é coisa de obelisco')

  run.save() // agora sim, no obelisco
  run.addSoul('sino')
  run.deaths = 5
  run.saveDeaths()
  lido = loadSlots()[0]
  assert.equal(lido.deaths, 5)
  assert.deepEqual(lido.bosses, ['piramide'], 'a alma nova só entra no próximo obelisco')

  run.slot = null
  assert.equal(run.saveDeaths(), false, 'partida solta não tem onde guardar')
  delete globalThis.localStorage
}

console.log('mortes em disco: ok')

{
  // Opções. Elas não pertencem a um vínculo: apagar save não pode desligar o
  // tremor de ninguém, então o endereço no disco é outro e a leitura é própria.
  const disco = new Map()
  globalThis.localStorage = {
    getItem: (k) => (disco.has(k) ? disco.get(k) : null),
    setItem: (k, v) => disco.set(k, String(v)),
  }
  const { opcoes, saveOptions, tremor, TREMOR } = await import('./options.js')

  assert.equal(tremor(), 1, 'de fábrica a câmera treme inteiro')
  assert.equal(opcoes.contornos, false, 'e os contornos ficam desligados')

  opcoes.tremor = TREMOR.findIndex((t) => t.valor === 0)
  assert.equal(tremor(), 0, '"desligado" zera o tremor, e é por aqui que todo shake passa')
  opcoes.contornos = true
  assert.ok(saveOptions(), 'grava')
  assert.ok(!disco.has('almas-de-titans'), 'em endereço próprio, longe dos vínculos')

  const lido = JSON.parse(disco.get('almas-de-titans:opcoes'))
  assert.equal(lido.tremor, opcoes.tremor)
  assert.equal(lido.contornos, true)

  // Lixo no disco não derruba o jogo: vale o padrão.
  disco.set('almas-de-titans:opcoes', 'não é json')
  delete globalThis.localStorage
  assert.equal(saveOptions(), false, 'sem storage, só não guarda')
}

console.log('opções: ok')

{
  // Áudio. No node não existe `AudioContext`, então o módulo tem que **ficar
  // mudo sem estourar** — é o mesmo contrato do resto: o teste roda sem
  // navegador, e quem depende de navegador se cala em vez de quebrar.
  const { NOMES, toca, contexto, SOM_ACERTO } = await import('./audio.js')
  assert.equal(contexto(), null, 'sem navegador, sem contexto')
  assert.equal(toca('tiro'), false, 'e tocar não faz nada')
  assert.equal(toca('nome que não existe'), false, 'nome desconhecido também não')

  // **Nome de som é ligação sem verificação do compilador**: um erro de digitação
  // em `toca('nucleo')` falharia calado, e o jogo ficaria mudo naquele acerto
  // sem ninguém notar. Este teste é o que segura isso.
  const fs = await import('node:fs')
  const arquivos = [
    'scenes/World.js',
    'scenes/Pausa.js',
    'scenes/Titulo.js',
    'scenes/Slots.js',
    'bosses/crisol.js',
    'bosses/sino.js',
    'bosses/coro.js',
    'bosses/monolito.js',
    'bosses/sentinela.js',
  ]
  const pedidos = new Set()
  for (const f of arquivos) {
    const txt = fs.readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const linha of txt.split(/\r?\n/)) {
      if (!/\b(toca|som)\??\.?\(/.test(linha) || linha.trimStart().startsWith('//')) continue
      for (const m of linha.matchAll(/'([a-zA-Z]+)'/g)) pedidos.add(m[1])
    }
  }
  for (const nome of Object.values(SOM_ACERTO)) pedidos.add(nome)
  assert.ok(pedidos.size >= 10, 'o jogo pede som em vários lugares: ' + pedidos.size)
  for (const nome of pedidos) {
    assert.ok(NOMES.includes(nome), `som pedido e inexistente: ${nome}`)
  }
}

console.log('áudio: ok')

{
  // As duas regras da paleta, em forma de teste. Elas são o que mantém três
  // áreas de cores diferentes parecendo o mesmo jogo, e é barato demais deixar
  // uma cor nova furar isso sem ninguém notar.
  assert.equal(hsl(0, 1, 0.5), 0xff0000, 'vermelho puro')
  assert.equal(hsl(120, 1, 0.5), 0x00ff00, 'verde puro')
  assert.equal(hsl(0, 0, 1), 0xffffff, 'branco')

  // Saturação **de HSL**, que é a escala em que a paleta foi escrita. A de HSV
  // pune cor clara: o núcleo, que nasce em 100%, media menos que uma brasa
  // média só por ser claro.
  const sat = (n) => {
    const r = ((n >> 16) & 255) / 255
    const g = ((n >> 8) & 255) / 255
    const b = (n & 255) / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const l = (mx + mn) / 2
    if (mx === mn) return 0
    return ((mx - mn) / (1 - Math.abs(2 * l - 1))) * 100
  }

  // 1) Pedra, poeira e entulho perdem cor.
  const pedra = ['floor', 'floorPanel', 'floorInlay', 'wall', 'wallStripe', 'rubble', 'dust']
  for (const [nome, t] of Object.entries(THEMES_NOVOS)) {
    for (const k of pedra) {
      assert.ok(sat(t[k]) <= 30, `${nome}.${k} tem saturação de pedra (${Math.round(sat(t[k]))}%)`)
    }
  }

  // 2) O que é quente é a única coisa saturada — e o núcleo é o teto.
  const quentes = [COLOR_NOVO.heat, COLOR_NOVO.geyserErupt, COLOR_NOVO.core, THEMES_NOVOS.fogo.lavaOuterMid]
  for (const c of quentes) assert.ok(sat(c) >= 70, 'o que é quente é saturado')
  assert.ok(
    sat(COLOR_NOVO.core) >= Math.max(...Object.values(COLOR_NOVO).map(sat)),
    'o núcleo é a cor mais saturada do jogo',
  )
  // A lava da câmara é mais saturada que a crosta do campanário, e essa é a
  // diferença entre as duas salas da mesma região.
  assert.ok(sat(THEMES_NOVOS.fogo.lavaOuterMid) > sat(THEMES_NOVOS.campanario.lavaOuterMid) + 15)
}

console.log('paleta: ok')

{
  // O Crisol. O ciclo derrama chão, abre o núcleo, e **só flecha em brasa
  // mata** — o fogo que acende a flecha é o que ele mesmo despejou.
  const boss = new Crisol(crisolRoom)
  const player = new Player(crisolRoom.spawn.x, crisolRoom.spawn.y)
  let mortes = 0
  const ctx = { player, grid: crisolRoom.grid, kill: () => mortes++, shake: () => {}, dust: () => {} }
  const ate = (estado, limite = 2000) => {
    for (let i = 0; i < limite && boss.state !== estado; i++) boss.update(STEP, ctx)
    assert.equal(boss.state, estado, 'chegou em ' + estado)
  }

  // Cheio, a boca está selada: a flecha crava no corpo e não acha núcleo nenhum.
  // O núcleo mora **dentro da tigela**, 55 px acima do pé, que é onde ele é
  // desenhado: mirar no que se vê tem que valer, fechado ou aberto.
  assert.equal(boss.state, CHEIO)
  const c0 = boss.corePos()
  assert.ok(c0.y < boss.y - 40, 'o núcleo está no alto da tigela, não no chão')
  assert.equal(boss.hitTest(c0.x, c0.y), 'body', 'selado, só o corpo')
  assert.equal(boss.hitTest(boss.x, boss.y), 'body', 'e o corpo no chão também para tiro')
  assert.equal(boss.pools.size, 0, 'e a sala começa seca')

  // Ele mira onde você **estava**: andar depois não muda o jorro.
  ate(MIRA)
  const mira = boss.aim
  player.x += 200
  for (let i = 0; i < 30; i++) boss.update(STEP, ctx)
  assert.equal(boss.aim, mira, 'a direção trava na inclinação')

  // Verter **cospe gotas**: elas voam em arco e só molham o chão ao cair.
  ate(VERTE)
  const raioMax = () => {
    let m = 0
    for (const q of boss.pools.values()) m = Math.max(m, Math.hypot(q.x - boss.x, q.y - boss.y))
    return m
  }
  // Os pingos da inclinação ainda estão no ar quando o jorro começa: eles caem
  // nos primeiros quadros e molham **junto ao lábio**, não no alcance do jorro —
  // pingo que cai longe deixa de ser aviso.
  assert.ok(boss.gouts.length > 0, 'inclinar já pôs pingos no ar')
  for (let i = 0; i < 8; i++) boss.update(STEP, ctx)
  // O teto é o alcance do jorro, não uma medida do pingo anterior: pingo tem
  // distância sorteada, e um longo depois de um curto reprovava sozinho. Com o
  // caldeirão cheio o jorro cai a ~215 px; o pingo mais comprido molha até ~121
  // contando o respingo. Qualquer coisa entre os dois separa um do outro.
  const perto = CRISOL.pourFar * 0.7
  const pingo = raioMax()
  assert.ok(pingo > 0, 'e eles caem no chão')
  assert.ok(pingo < perto, 'junto ao lábio')
  for (let i = 0; i < 10; i++) boss.update(STEP, ctx)
  assert.ok(boss.gouts.length > 0, 'o jorro põe lava no ar')
  assert.ok(raioMax() < perto, 'e nada cai longe enquanto ela voa')
  for (let i = 0; i < 60; i++) boss.update(STEP, ctx)
  assert.ok(raioMax() > pingo + 40, 'depois do voo, a lava chega longe')
  const espalhou = boss.pools.size
  for (let i = 0; i < 40; i++) boss.update(STEP, ctx)
  assert.ok(boss.pools.size > espalhou, 'e a poça avança escorrendo')

  // Física: o líquido procura o nível, esfria pelas bordas, e só o que está
  // fundo mata. Conferido isolado, longe do jato — que também mata.
  {
    const teste = new Crisol(crisolRoom)
    let mortas = 0
    const p2 = new Player(360, 240)
    const ctx2 = { player: p2, grid: crisolRoom.grid, kill: () => mortas++, shake: () => {} }
    // Uma torre de volume numa célula só: ela tem que se espalhar para as
    // vizinhas. A célula do fluido é mais fina que o tile do terreno, então a
    // conta sai da posição em px — é ela que manda, não o número da grade.
    const tc = Math.floor(p2.x / CRISOL.cell)
    const tr = Math.floor(p2.y / CRISOL.cell)
    teste.poe(tc, tr, 2)
    assert.equal(teste.pools.size, 1)
    for (let i = 0; i < 30; i++) teste.stepFluid(STEP, ctx2)
    assert.ok(teste.pools.size > 1, 'o volume escorre para os vizinhos')
    assert.ok(teste.volAt(tc, tr) < 2, 'e o ponto alto baixa')
    const antes = [...teste.pools.values()].reduce((a, p) => a + p.vol, 0)
    for (let i = 0; i < 60; i++) teste.stepFluid(STEP, ctx2)
    const depois = [...teste.pools.values()].reduce((a, p) => a + p.vol, 0)
    assert.ok(depois < antes, 'e esfria, perdendo volume')

    // Fundo mata e acende; filme fino é crosta e não faz nem uma coisa nem outra.
    const t3 = new Crisol(crisolRoom)
    const p3 = new Player(360, 240)
    const ctx3 = { player: p3, grid: crisolRoom.grid, kill: () => mortas++, shake: () => {} }
    const c = Math.floor(p3.x / CRISOL.cell)
    const r = Math.floor(p3.y / CRISOL.cell)
    t3.poe(c, r, CRISOL.lethalVol * 0.6)
    const antesRaso = mortas
    t3.stepFluid(STEP, ctx3)
    assert.equal(mortas, antesRaso, 'crosta fina não mata')
    assert.equal(t3.igniteAt(p3.x, p3.y), false, 'nem acende a flecha')
    t3.poe(c, r, CRISOL.lethalVol)
    assert.ok(t3.igniteAt(p3.x, p3.y), 'lava viva acende')
    t3.stepFluid(STEP, ctx3)
    assert.equal(mortas, antesRaso + 1, 'e mata quem está em cima')
  }

  // Vazio: o núcleo aparece — e flecha fria não faz nada.
  ate(VAZIO)
  const c1 = boss.corePos()
  assert.equal(boss.hitTest(c1.x, c1.y), 'core', 'vazio, o núcleo está à mostra')
  // Aberto, a borda para de segurar tiro: senão o núcleo é inalcançável.
  assert.equal(boss.hitTest(boss.x + CRISOL.bodyRadius * 0.8, boss.y), null, 'a boca engole a flecha')
  boss.onArrowHit('core', { burning: false })
  assert.ok(!boss.dead, 'flecha fria chia e apaga')
  assert.ok(boss.doused > 0, 'e o chiado aparece na tela')

  // Vazio ele é casca: a corda tomba ele e ele **entorna aos próprios pés**,
  // em gotas — caldeirão deitado vaza, não arremessa.
  const antesPocas = boss.pools.size
  const jaMolhado = new Set(boss.pools.keys())
  assert.equal(boss.tetherPull(player), 'yield', 'vazio, quem cede é ele')
  assert.equal(boss.state, TOMBADO)
  assert.ok(boss.gouts.length > 0, 'o resto da lava sai em gotas')
  const longe = { player: new Player(40, 40), grid: crisolRoom.grid, kill: () => mortes++, shake: () => {} }
  for (let i = 0; i < 120 && boss.gouts.length; i++) boss.stepGouts(STEP, longe)
  assert.equal(boss.gouts.length, 0, 'e todas caem')
  assert.ok(boss.pools.size > antesPocas, 'formando poça em volta dele')
  assert.ok(
    [...boss.pools.values()].some((q) => !jaMolhado.has(q.c + ',' + q.r)),
    'em chão que ainda estava seco',
  )

  // E a brasa mata.
  boss.onArrowHit('core', { burning: true })
  assert.ok(boss.dead, 'flecha em brasa no núcleo mata')

  // Cheio, a corda não tomba nada: aí é você quem viaja.
  const outro = new Crisol(crisolRoom)
  assert.equal(outro.tetherPull(player), 'slam', 'cheio ele é uma tonelada')

  // Bebe de volta o que ainda é líquido, e a cada rodada recupera menos.
  const terceiro = new Crisol(crisolRoom)
  const ctx4 = { player: new Player(10, 10), grid: crisolRoom.grid, kill: () => {}, shake: () => {} }
  for (let i = 0; i < 3000 && terceiro.state !== VAZIO; i++) terceiro.update(STEP, ctx4)
  const volume = () => [...terceiro.pools.values()].reduce((a, p) => a + p.vol, 0)
  const derramou = volume()
  assert.ok(derramou > 0, 'derramou volume no chão')
  for (let i = 0; i < 3000 && terceiro.round === 0; i++) terceiro.update(STEP, ctx4)
  assert.ok(volume() < derramou, 'ele bebe de volta')
  assert.ok(terceiro.drinkRate < CRISOL.drinkRate, 'e na rodada seguinte recupera menos')
  assert.ok(terceiro.sweep > CRISOL.pourSweep, 'e derrama mais')

  // **O jorro é chuva, não feixe.** Duas coisas têm que valer, senão o arco é
  // enfeite em cima de um laser: a gota **não mata no ar** — ela passa por cima
  // de quem está embaixo —, e a queda mata. O jogador fica grudado debaixo dela
  // o voo inteiro, que é o pior caso possível.
  {
    const gota = new Crisol(crisolRoom)
    let mortas = 0
    const p6 = new Player(300, 200)
    const ctx6 = { player: p6, grid: crisolRoom.grid, kill: () => mortas++, shake: () => {} }
    gota.lanca(200, 200, 0, 160, 0.6, CRISOL.mouthZ)
    const g = gota.gouts[0]
    assert.ok(g.z > 0 && g.vz > 0, 'a gota nasce no ar, subindo')
    let voo = 0
    while (gota.gouts.length && voo < 200) {
      p6.x = g.x
      p6.y = g.y
      const antes = mortas
      gota.stepGouts(STEP, ctx6)
      if (gota.gouts.length && g.z > CRISOL.goutLowZ) {
        assert.equal(mortas, antes, 'gota alta passa por cima')
      }
      voo++
    }
    assert.ok(mortas > 0, 'e a queda mata quem está embaixo')
    assert.ok(voo > 24, 'com folga para ler a sombra: ' + voo + ' quadros de voo')
    assert.ok(gota.pools.size > 0, 'a queda é o que molha o chão')
    assert.ok(gota.splashes.length > 0, 'e deixa o respingo na tela')

    // **Beber é puxar por baixo.** A lava não some de longe: ela volta
    // escorrendo pelo chão, e continua letal no caminho — é o que dá tensão à
    // janela do núcleo.
    const bebe = new Crisol(crisolRoom)
    const p8 = new Player(40, 40)
    const ctx8 = { player: p8, grid: crisolRoom.grid, kill: () => {}, shake: () => {} }
    const cc = Math.floor((bebe.x + 150) / CRISOL.cell)
    const rr = Math.floor(bebe.y / CRISOL.cell)
    for (let c = cc - 2; c <= cc + 2; c++) {
      for (let r = rr - 2; r <= rr + 2; r++) bebe.poe(c, r, 1.5)
    }
    const centro = () => {
      let x = 0
      let peso = 0
      for (const q of bebe.pools.values()) {
        x += q.x * q.vol
        peso += q.vol
      }
      return x / peso
    }
    const longe = centro()
    bebe.startDrink()
    for (let i = 0; i < 60; i++) bebe.update(STEP, ctx8)
    assert.ok(centro() < longe - 8, 'a poça anda na direção dele: ' + Math.round(longe - centro()) + ' px')
    assert.ok(
      [...bebe.pools.values()].some((q) => q.vol >= CRISOL.lethalVol),
      'e continua lava viva enquanto volta',
    )

    // Tombado ele **entorna aos próprios pés**: o leque não atravessa a sala,
    // e é esse anel em volta dele que acende a flecha do tiro seguinte.
    const tomba = new Crisol(crisolRoom)
    tomba.state = VAZIO
    tomba.fill = 0
    const p7 = new Player(tomba.x + 200, tomba.y)
    const ctx7 = { player: p7, grid: crisolRoom.grid, kill: () => {}, shake: () => {} }
    assert.equal(tomba.tetherPull(p7), 'yield')
    for (let i = 0; i < 200 && tomba.gouts.length; i++) tomba.stepGouts(STEP, ctx7)
    const raio = [...tomba.pools.values()].map((q) => Math.hypot(q.x - tomba.x, q.y - tomba.y))
    assert.ok(raio.length > 0, 'o resto da lava cai em volta dele')
    // Teto: o leque mais longo, mais o lábio de onde ele sai e o respingo.
    const teto = CRISOL.toppleFar + CRISOL.bodyRadius + CRISOL.splashRadius + 24
    assert.ok(Math.max(...raio) < teto, 'e não na sala inteira')
    assert.ok(teto < CRISOL.pourFar, 'bem mais curto que o jorro de pé')
  }

  // **Momento**: a lava continua para onde foi jogada. Mesmo despejo, duas
  // direções opostas, e o centro de massa da poça tem que ir para lados
  // contrários — senão o momento não está fazendo nada e a poça só infla.
  {
    const centro = (boss2) => {
      let x = 0
      let peso = 0
      for (const q of boss2.pools.values()) {
        x += q.x * q.vol
        peso += q.vol
      }
      return x / peso
    }
    const p5 = new Player(360, 240)
    const ctx5 = { player: p5, grid: crisolRoom.grid, kill: () => {}, shake: () => {} }
    const leste = new Crisol(crisolRoom)
    const oeste = new Crisol(crisolRoom)
    for (let i = 0; i < 30; i++) {
      leste.derrama(300, 200, 6, 1, 0)
      oeste.derrama(300, 200, 6, -1, 0)
      leste.stepFluid(STEP, ctx5)
      oeste.stepFluid(STEP, ctx5)
    }
    assert.ok(centro(leste) > 300, 'a lava jogada para leste escorre para leste')
    assert.ok(centro(oeste) < 300, 'e a jogada para oeste, para oeste')
    assert.ok(centro(leste) - centro(oeste) > 6, 'e a diferença é visível, não ruído')
  }
}

console.log('crisol: ok')
