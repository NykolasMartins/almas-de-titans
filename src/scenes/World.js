import Phaser from 'phaser'
// Importados como módulo para o Vite empacotar no build; `assets/` não é publicDir.
import playerSheetUrl from '../../assets/protagonist v2/A_young_boy_hero_in-Idle.png'
import playerAtlas from '../../assets/protagonist v2/A_young_boy_hero_in-Idle.json'
import arrowUrl from '../../assets/arrow.png'
import {
  TUNING,
  PLAYER_BOX,
  FX,
  SPRITES,
  OUTRO,
  JUICE,
  WAKE,
  DEATH,
  TRAVESSIA,
  THEMES,
  TERRAIN,
  COLOR,
  STEP,
  STEP_MS,
  VIEW,
} from '../tuning.js'
import { DEPTH } from '../draw.js'
import { boxBlocked, circleHit, segmentHit } from '../collision.js'
import { paintFloor, paintWalls, paintLava } from '../terrain.js'
import { fightOf, isFight, roomFrom } from '../fights.js'
import { ROOMS, BOSS_ROOMS, oposto } from '../data/rooms.js'
import { run } from '../run.js'
import { restoreKeys } from '../held.js'
import { opcoes, saveOptions, tremor } from '../options.js'
import { toca, SOM_ACERTO, ambiente, ambienteForca, ambienteAbafa, fundoDoTema } from '../audio.js'
import { Dust, Trail } from '../fx.js'
import { drawText } from '../ui/font.js'
import Player from '../player.js'
import Arrow, { HELD, FLYING, STUCK, RETURNING } from '../arrow.js'

const BOSS_TOTAL = BOSS_ROOMS.length

export default class World extends Phaser.Scene {
  constructor() {
    super('World')
  }

  /**
   * Que sala carregar. A cena reinicia a cada troca de sala, então quem manda é
   * `run` — o que o jogador conquistou não pode reiniciar junto com o cenário.
   *
   * Endereço direto de luta (`/sino`) abre uma partida solta naquela sala, que
   * não guarda nada: é o atalho de trabalho, não o caminho do jogo.
   */
  init(data) {
    const caminho = typeof location === 'undefined' ? '' : location.pathname
    if (data && data.room) run.room = data.room
    else if (run.slot === null && isFight(caminho)) run.scratch(roomFrom(caminho))
    if (data && data.entrandoPor !== undefined) run.entrandoPor = data.entrandoPor

    this.room = ROOMS[run.room] ?? ROOMS[run.room = 'obelisco']
    this.fight = fightOf(this.room, run.killed(this.room.boss))
  }

  preload() {
    const cell = playerAtlas.spritesheet.cell_size
    this.load.spritesheet('player', playerSheetUrl, { frameWidth: cell.width, frameHeight: cell.height })
    this.load.image('arrow', arrowUrl)
    this.fight.view.preload(this)
  }

  create() {
    makePlayerAnims(this)
    this.input.mouse.disableContextMenu()

    this.view = this.fight.view
    // Grade própria da sala: as portas mudam de estado, e mexer na grade
    // compartilhada deixaria porta aberta em partida nova.
    this.grid = this.room.grid.map((linha) => [...linha])
    this.theme = THEMES[this.room.theme]
    // A luta só começa quando a flecha encosta no titã (ver `desperta`): até lá
    // ele é cenário e a sala não se tranca.
    this.lutando = false
    this.wakeT = 0 // ms desde o tiro que o acordou
    // Contrato com a view: `rise` 0 adormecido a 1 desperto, `roar` a força do
    // grito. A view desenha por isso; a cena não sabe como é o sono de ninguém.
    this.wake = { rise: 0, roar: 0 }
    // Criado aqui, não sob demanda: `scene.restart` mantém a instância da cena,
    // então um cache preguiçoso sobrevive à troca de sala apontando para um
    // objeto já destruído — e some da tela sem erro nenhum.
    this.doorGfx = this.add.graphics().setDepth(DEPTH.decal + 0.2)
    this.openDoors()
    this.drawRoom()

    const nasce = this.spawnPoint()
    this.player = new Player(nasce.x, nasce.y)
    // Entrou andando: continua encarando o lado para onde andava, senão a
    // travessia vira um giro brusco na porta.
    const rumo = RUMO[run.entrandoPor]
    if (rumo) {
      this.player.faceX = rumo[0]
      this.player.faceY = rumo[1]
    }
    this.arrow = new Arrow()
    this.boss = new this.fight.Boss(this.room)

    this.trocando = false // uma troca de sala por vez
    this.aviso = null // texto curto do obelisco
    this.freeze = 0
    this.dead = false
    this.morte = 0 // ms desde o golpe fatal
    this.accumulator = 0
    this.charge = 0
    this.aimAngle = 0

    // Placeholders desenhados por quadro: gêiseres no chão, corpo do chefe (que
    // entra na ordenação por y) e projéteis, que voam acima de tudo.
    // Suco: poeira rente ao chão, rastro da flecha no ar.
    this.dust = new Dust()
    this.trail = new Trail()
    this.dustGfx = this.add.graphics().setDepth(DEPTH.decal + 0.3)
    this.trailGfx = this.add.graphics().setDepth(DEPTH.air - 0.01)
    this.slow = 0 // ms restantes de câmera lenta
    this.rollDustT = 0

    this.lavaGfx = this.add.graphics().setDepth(DEPTH.lava)
    this.hitGfx = this.add.graphics().setDepth(DEPTH.hit)
    this.showHitboxes = opcoes.contornos
    this.decalGfx = this.add.graphics().setDepth(DEPTH.decal)
    this.bossGfx = this.add.graphics()
    // Camada por cima do corpo do chefe, para o que não pode sumir atrás dele —
    // hoje o badalo do Sino, que é o alvo.
    this.bossTopGfx = this.add.graphics()
    this.airGfx = this.add.graphics().setDepth(DEPTH.air)

    // Reflexo nas muralhas espelhadas: fantasmas reaproveitados, um por parede.
    this.mirrorGhosts = []
    this.mirrorGfx = this.add.graphics().setDepth(DEPTH.decal - 0.1)
    // Névoa por cima dos reflexos, para eles sumirem no fundo do espelho.
    this.mirrorFog = this.add.graphics().setDepth(DEPTH.decal - 0.02)

    // Sprites e texturas do chefe da vez. A cena não sabe qual é.
    this.view.create(this)

    this.playerSprite = this.add
      .sprite(this.player.x, this.player.y, 'player')
      .setScale(SPRITES.player.scale)
      .setOrigin(0.5, SPRITES.player.originY)
    this.arrowSprite = this.add
      .image(0, 0, 'arrow')
      .setScale(SPRITES.arrow.scale)
      .setOrigin(SPRITES.arrow.originX, SPRITES.arrow.originY)

    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      upArrow: 'UP',
      downArrow: 'DOWN',
      leftArrow: 'LEFT',
      rightArrow: 'RIGHT',
      roll: 'SPACE',
      recall: 'E',
      tether: 'SHIFT',
      hitboxes: 'H',
      pausa: 'ESC',
    })
    // A cena reinicia a cada sala, e as teclas nascem soltas: sem isto o jogador
    // para seco do outro lado da porta mesmo sem soltar nada. Voltar da pausa
    // cai no mesmo problema: as teclas ficaram paradas enquanto o painel estava
    // aberto, e o Phaser não as atualiza numa cena pausada.
    restoreKeys(this.keys)
    this.events.on('resume', () => {
      restoreKeys(this.keys)
      ambienteAbafa(false)
    })
    // Pausa abafa o fundo em vez de cortar: cortar soa como bug.
    this.events.on('pause', () => ambienteAbafa(true))

    // O fundo da sala sai do tema, como a cor. Trocar de sala dentro da mesma
    // área não recomeça o leito — cortar o som num corredor entrega que a cena
    // foi recriada.
    ambiente(fundoDoTema(this.theme))
    this.bolhaT = 0
    this.fundoT = 0

    // Filtros de câmera da v4: vinheta e um glow fraco fazem a lava e o núcleo
    // sangrarem luz sem custar desenho.
    this.applyCameraFilters()

    // A corda entre arqueiro e flecha: sem ela o Vínculo não se lê na tela.
    this.cord = this.add.graphics().setDepth(DEPTH.cord)

    // Escurecimento do recall. Bem maior que a tela para o shake e o zoom nunca
    // deixarem borda aparecendo.
    this.soulGfx = this.add.graphics().setDepth(DEPTH.soul)
    this.dim = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.dim)
    this.dim.fillStyle(0x000000, 1).fillRect(-VIEW.w, -VIEW.h, VIEW.w * 3, VIEW.h * 3)
    this.dim.setAlpha(0)

    this.pull = 0 // força do puxão suavizada, 0..1
    this.chargeFx = 0 // carga do arco suavizada, 0..1
    this.holdTime = 0 // s com o arco armado, alimenta a fadiga do tremor
    this.aiming = false
    this.recallActive = false
    this.outro = { stage: null, t: 0, soulTimer: 0 }
    this.souls = []
    this.playerLift = 0

    // Botões do mouse por evento, não por amostragem: a simulação roda a 60 Hz e
    // um clique curto cujo down e up caem entre dois passos jamais seria visto.
    // O ponteiro é global e atravessa a troca de cena: basta ler os botões que
    // já estão apertados.
    const botoes = this.input.activePointer.buttons
    this.aimHeld = (botoes & 1) !== 0
    this.shootQueued = false
    this.tetherQueued = false
    this.recallHeld = (botoes & 2) !== 0
    this.input.on('pointerdown', (p) => {
      if (p.button === 0) this.aimHeld = true
      if (p.button === 1) this.tetherQueued = true
      if (p.button === 2) this.recallHeld = true
    })
    this.input.on('pointerup', (p) => {
      if (p.button === 0 && this.aimHeld) {
        this.aimHeld = false
        this.shootQueued = true
      }
      if (p.button === 2) this.recallHeld = false
    })

    // ponytail: overlay de desenvolvimento, sai na fase 7. O jogo não tem HUD.
    this.debug = this.add
      .text(4, 3, '', { fontFamily: 'monospace', fontSize: '8px', color: '#6a6a80' })
      .setScrollFactor(0)
      .setDepth(DEPTH.debug)
    // Aviso do obelisco, na fonte do jogo. Fica preso à tela, não ao mundo.
    this.avisoGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.debug)

    this.setupCamera()
  }

  /**
   * Câmera. Sala do tamanho da tela fica travada, como nas arenas de chefe das
   * referências; sala maior acompanha o jogador. É a seção 2.5 do DESIGN, e sai
   * de graça agora que a sala tem tamanho próprio.
   */
  setupCamera() {
    const cam = this.cameras.main
    cam.setBounds(0, 0, this.room.width, this.room.height)
    this.seguindo = this.room.width > VIEW.w || this.room.height > VIEW.h
    if (this.seguindo) cam.startFollow(this.playerSprite, true, 0.14, 0.14)
    else cam.stopFollow()
    // Curto de propósito: cobre a troca de cenário sem virar um corte.
    cam.fadeIn(TRAVESSIA.fadeIn, 0, 0, 0)
  }

  /**
   * Onde o jogador nasce ao entrar. Vindo de outra sala, na porta pela qual
   * entrou — não no meio da sala, senão atravessar uma porta teleportaria.
   */
  spawnPoint() {
    const lado = run.entrandoPor
    const tiles = lado && this.room.doors[lado]
    if (!tiles) return this.room.spawn
    const t = TUNING.tileSize
    const c = this.doorCenter(tiles)
    // O desvio lateral com que ele saiu da sala anterior. Entrar sempre no meio
    // do corredor puxava o jogador de lado no meio do passo.
    const off = Phaser.Math.Clamp(run.entrandoEm ?? 0, -t, t)
    const pad = TRAVESSIA.entryPad * t
    if (lado === 'norte') return { x: c.x + off, y: pad }
    if (lado === 'sul') return { x: c.x + off, y: this.room.height - pad }
    if (lado === 'oeste') return { x: pad, y: c.y + off }
    return { x: this.room.width - pad, y: c.y + off }
  }

  /** Centro da boca de uma passagem, em px. */
  doorCenter(tiles) {
    const t = TUNING.tileSize
    const m = (i) => (tiles.reduce((soma, d) => soma + d[i], 0) / tiles.length + 0.5) * t
    return { x: m(0), y: m(1) }
  }

  /** Baforada de pó atrás de quem rola: é o que dá peso ao deslocamento. */
  stepRollDust(dt) {
    if (!this.player.rolling) {
      this.rollDustT = 0
      return
    }
    this.rollDustT -= dt * 1000
    if (this.rollDustT > 0) return
    this.rollDustT = JUICE.rollDustEvery
    this.dust.spawn(this.player.x, this.player.y + 2, JUICE.rollDustN, {
      dirX: -this.player.rollX,
      dirY: -this.player.rollY,
      spread: 1.1,
      color: this.theme.dust,
    })
  }

  /**
   * Estado das portas desta sala. Fechada vira tile 2, que é sólido.
   *
   * Duas razões para uma porta ficar fechada: o chefe da sala ainda está vivo
   * (a sala se tranca quando você entra, e abre quando ele cai), ou o portão
   * pede almas que você não tem.
   */
  openDoors() {
    // Trancada durante a luta, não pela simples presença do titã: quem começa a
    // luta é a flecha, e antes disso a arena é passagem como qualquer outra.
    const preso = this.lutando && !run.killed(this.room.boss)
    this.doorState = {}
    for (const [lado, tiles] of Object.entries(this.room.doors)) {
      const almas = this.room.locked?.[lado] ?? 0
      const fechada = preso || run.souls < almas
      this.doorState[lado] = { fechada, almas }
      for (const [c, r] of tiles) this.grid[r][c] = fechada ? 2 : 0
    }
    this.drawDoors()
  }

  /**
   * Portas. Fechada é laje atravessando a passagem; aberta é só a soleira, com
   * as ombreiras de cada lado. Portão selado ganha os losangos das almas que
   * pede, apagados enquanto faltam — é o único aviso de que ele abre um dia.
   */
  drawDoors() {
    const g = this.doorGfx
    g.clear()
    const t = TUNING.tileSize
    const th = this.theme

    for (const [lado, tiles] of Object.entries(this.room.doors)) {
      const est = this.doorState[lado]
      const vertical = lado === 'norte' || lado === 'sul'
      const c0 = Math.min(...tiles.map((d) => d[0]))
      const r0 = Math.min(...tiles.map((d) => d[1]))
      const larg = vertical ? tiles.length * t : t
      const alt = vertical ? t : tiles.length * t
      const x = c0 * t
      const y = r0 * t

      // Soleira, sempre visível: marca a passagem mesmo com a porta aberta.
      g.fillStyle(th.floorGroove, 0.9)
      g.fillRect(x, y, larg, alt)
      g.fillStyle(th.floorInlay, 0.5)
      g.fillRect(x + 2, y + 2, larg - 4, alt - 4)

      if (!est.fechada) continue

      g.fillStyle(th.wall, 1)
      g.fillRect(x, y, larg, alt)
      g.fillStyle(th.wallTop, 1)
      g.fillRect(x, y, vertical ? larg : 3, vertical ? 3 : alt)
      // Barras atravessando a laje.
      g.fillStyle(th.wallTrim, 0.9)
      for (let i = 1; i < (vertical ? larg : alt) / 8; i++) {
        if (vertical) g.fillRect(x + i * 8, y, 2, alt)
        else g.fillRect(x, y + i * 8, larg, 2)
      }
      g.lineStyle(1, th.wallCap, 0.7)
      g.strokeRect(x, y, larg, alt)

      // Selo de almas.
      if (est.almas > 0) {
        for (let i = 0; i < est.almas; i++) {
          const cx = x + larg / 2 + (i - (est.almas - 1) / 2) * 14
          const cy = y + alt / 2
          const tem = run.souls > i
          g.fillStyle(tem ? COLOR.core : COLOR.uiDim, tem ? 0.95 : 0.4)
          g.fillPoints(
            [
              { x: cx, y: cy - 5 },
              { x: cx + 5, y: cy },
              { x: cx, y: cy + 5 },
              { x: cx - 5, y: cy },
            ],
            true,
          )
        }
      }
    }
  }

  /** Filtros de câmera da v4. Ajustados por propriedade, não por argumentos
   *  posicionais: a assinatura varia entre filtros e chutar apaga a cena. */
  applyCameraFilters() {
    const f = this.cameras.main.filters?.internal
    if (!f) return
    f.clear()
    // Só o glow. A vinheta escurecia justamente a borda onde a lava vive.
    const glow = f.addGlow()
    glow.outerStrength = FX.glowOuter
    glow.innerStrength = 0 // `quality` e `distance` são só leitura: vêm do construtor

    // Pixelização da morte, nascida aqui e desligada: filtro criado sob demanda
    // sobreviveria ao `scene.restart` apontando para uma câmera destruída.
    // Bloco 1x1 é identidade, então ele só aparece quando a morte o abre.
    this.blocky = f.addBlocky()
    this.blocky.active = false
  }

  update(_time, delta) {
    // Pausar é parar a cena inteira, não pôr uma bandeira aqui: assim nada corre
    // por baixo do painel — nem simulação, nem poeira, nem o relógio da partida.
    if (Phaser.Input.Keyboard.JustDown(this.keys.pausa)) {
      this.scene.launch('Pausa', { voltar: 'World' })
      this.scene.pause()
      return
    }

    // O relógio da partida corre enquanto se joga, inclusive no hitstop: é tempo
    // de jogo, não de simulação.
    run.timeMs += Math.min(delta, 250)

    // Passo fixo: a simulação nunca vê o delta cru. Um jogo que mata em um toque
    // não pode se comportar diferente em monitor de 60, 120 ou 144 Hz.
    if (this.freeze > 0) {
      this.freeze -= delta
    } else {
      // Câmera lenta: o passo continua sendo 1/60 s: o que encolhe é quanto tempo
      // entra no acumulador. A simulação não sabe que o mundo desacelerou.
      let escala = 1
      if (this.slow > 0) {
        this.slow -= delta
        escala = 1 - (1 - JUICE.slowFactor) * Math.max(0, this.slow / JUICE.slowTime)
      }
      this.accumulator += Math.min(delta, 250) * escala // trava a espiral da morte após um travamento
      while (this.accumulator >= STEP_MS) {
        this.simulate(STEP)
        this.accumulator -= STEP_MS
      }
    }
    this.updateFx(delta)
    this.draw()
  }

  /** Suco de câmera. Roda no delta real, inclusive durante o hitstop. */
  updateFx(deltaMs) {
    const dt = Math.min(deltaMs, 100) / 1000

    // Força do puxão: 0 a 1 conforme a flecha acelera na volta.
    const pulling = this.arrow.state === RETURNING && this.recallActive
    const target = pulling
      ? Phaser.Math.Clamp(
          (this.arrow.speed - TUNING.recallSpeedMin) / (TUNING.recallSpeedMax - TUNING.recallSpeedMin),
          0,
          1,
        )
      : 0
    const rate = target > this.pull ? FX.recallRise : FX.recallFall
    this.pull += (target - this.pull) * Math.min(1, rate * dt)

    // Carga do arco: o efeito é enquanto puxa a corda, não no disparo. Soltar
    // zera `charge`, então o alvo cai a 0 e os dois se desfazem sozinhos.
    const chargeTarget = this.aiming && this.arrow.state === HELD ? this.charge / TUNING.chargeTime : 0
    const chargeRate = chargeTarget > this.chargeFx ? FX.chargeRise : FX.chargeFall
    this.chargeFx += (chargeTarget - this.chargeFx) * Math.min(1, chargeRate * dt)

    // Tremor do arco armado. Amplitude constante lê como zumbido de máquina; o que
    // vende esforço muscular é a irregularidade. Dois senos de frequências que não
    // batem dão um envelope que surge e afrouxa sem repetir, e a fadiga faz o
    // tremor crescer quanto mais tempo o arco fica armado — o que empurra a soltar.
    this.holdTime = chargeTarget > 0 ? this.holdTime + dt : 0
    const fatigue = Math.min(1, this.holdTime / FX.chargeFatigueTime)
    const wobble = Math.max(0.15, 0.4 + 0.3 * Math.sin(this.holdTime * 9.1) + 0.3 * Math.sin(this.holdTime * 3.7))
    const amp = this.chargeFx * (FX.chargeShakePx + FX.chargeShakeFatiguePx * fatigue) * wobble

    // O desfecho tem escuro, zoom e tremor próprios; vale o maior dos dois.
    const o = this.outro
    const pullF = o.stage === 'pull' ? Math.min(1, o.t / OUTRO.pullRamp) : 0
    let outroF = 0
    if (o.stage === 'pull') outroF = pullF
    else if (o.stage === 'release' || o.stage === 'soul') outroF = 1
    else if (o.stage === 'land') outroF = 1 - Math.min(1, o.t / OUTRO.landTime)
    const outroDark = OUTRO.pullDark * outroF
    // O zoom aperta durante o esforço e se afasta de volta assim que a flecha
    // sai; da alma em diante a câmera já está no normal.
    const zoomF =
      o.stage === 'pull' ? pullF : o.stage === 'release' ? 1 - Math.min(1, o.t / OUTRO.releaseZoomOut) : 0
    const outroZoom = OUTRO.pullZoom * zoomF
    // Tremor só no esforço de desencravar; durante a alma a cena fica quieta.
    const outroShake = OUTRO.pullShakePx * pullF

    const cam = this.cameras.main
    const shakePx = Math.max(amp, outroShake) * tremor()
    const sx = shakePx > 0.2 ? Math.round((Math.random() * 2 - 1) * shakePx) : 0
    const sy = shakePx > 0.2 ? Math.round((Math.random() * 2 - 1) * shakePx) : 0
    // Seguindo o jogador, o tremor vai no deslocamento do alvo: mexer no scroll
    // direto seria desfeito pelo próprio follow no quadro seguinte.
    if (this.seguindo) cam.setFollowOffset(sx, sy)
    else if (sx || sy || cam.scrollX || cam.scrollY) cam.setScroll(sx, sy)

    this.stepAmbiente(dt)
    this.dust.step(dt)
    this.trail.step(dt)

    this.lavaTime = (this.lavaTime ?? 0) + dt
    this.drawLava(this.lavaTime)

    // A morte ganha de tudo: daí em diante a tela só fecha. O expoente do véu
    // segura o escuro no começo, que é quando o mundo ainda tem que aparecer
    // rodando; o zoom entra desacelerando, fechando no corpo.
    const morteF = this.dead ? Math.min(1, this.morte / DEATH.time) : 0
    const morteDark = Math.pow(morteF, DEATH.curve)
    const morteZoom = DEATH.zoom * (1 - (1 - morteF) * (1 - morteF))

    // A imagem se quebra junto com o véu: o corpo vira bloco antes de sumir.
    if (this.blocky) {
      this.blocky.active = morteF > 0.02
      const n = 1 + Math.round(morteF * JUICE.deathBlocks)
      this.blocky.size.x = n
      this.blocky.size.y = n
    }

    this.dim.setAlpha(Math.max(this.pull * FX.recallDark, outroDark, morteDark))
    cam.setZoom(
      1 + Math.max(this.pull * FX.recallZoom, outroZoom, morteZoom) + this.chargeFx * FX.chargeZoom,
    )
  }

  readInput() {
    // Morto o mundo continua rodando — o que some é o controle.
    if (this.dead) return MORTO
    const k = this.keys
    const pad = this.input.gamepad?.pad1 // não testado ainda, sem controle na máquina
    let dirX = (k.right.isDown || k.rightArrow.isDown ? 1 : 0) - (k.left.isDown || k.leftArrow.isDown ? 1 : 0)
    let dirY = (k.down.isDown || k.downArrow.isDown ? 1 : 0) - (k.up.isDown || k.upArrow.isDown ? 1 : 0)
    if (pad) {
      if (Math.abs(pad.leftStick.x) > 0.25) dirX = pad.leftStick.x
      if (Math.abs(pad.leftStick.y) > 0.25) dirY = pad.leftStick.y
    }
    const len = Math.hypot(dirX, dirY)
    if (len > 1) {
      dirX /= len
      dirY /= len
    }

    // O gatilho do controle continua sendo amostrado; o Phaser não emite evento para ele.
    const padAiming = pad ? pad.R2 > 0.3 : false
    if (this.padWasAiming && !padAiming) this.shootQueued = true
    this.padWasAiming = padAiming

    return {
      dirX,
      dirY,
      aiming: this.aimHeld || padAiming,
      shoot: this.shootQueued,
      rollPressed: Phaser.Input.Keyboard.JustDown(this.keys.roll) || Boolean(pad?.A),
      recall: this.recallHeld || this.keys.recall.isDown || (pad ? pad.L2 > 0.3 : false),
      // Interagir é a mesma tecla do recall, por toque em vez de segurar: só o
      // obelisco escuta, e sala com obelisco não tem chefe.
      interactPressed: Phaser.Input.Keyboard.JustDown(this.keys.recall) || Boolean(pad?.A),
      tetherPressed: this.tetherQueued || Phaser.Input.Keyboard.JustDown(this.keys.tether) || Boolean(pad?.L1),
      // Âncora do Vínculo, lida a cada passo para acompanhar chefe em movimento.
      anchorX: this.arrow.state === STUCK ? this.arrow.x : null,
      anchorY: this.arrow.state === STUCK ? this.arrow.y : null,
    }
  }

  simulate(dt) {
    const o = this.outro
    // Só a alma e o pouso tiram o controle. Desencravar a flecha ainda é jogo:
    // você anda, rola e escolhe de onde puxar.
    if (o.stage === 'soul' || o.stage === 'land') {
      this.stepOutro(dt)
      return
    }

    // Levantando: o chefe ainda não corre, e no fim do movimento ele grita.
    if (this.lutando && !this.desperto) {
      const antes = this.wakeT
      this.wakeT += dt * 1000
      if (antes < WAKE.rise && this.wakeT >= WAKE.rise) {
        this.shake(WAKE.roarShakeMs, WAKE.roarShakeAmp)
        toca('rugido')
      }
    }

    if (this.dead) {
      this.morte += dt * 1000
      if (this.morte >= DEATH.time) {
        this.voltarAoVinculo()
        return
      }
    }

    const input = this.readInput()

    if (input.tetherPressed) {
      this.tetherQueued = false
      if (input.anchorX !== null) {
        // A corda puxa o mais leve dos dois corpos. Com a flecha cravada num
        // chefe, é ele quem decide: cedendo, vem até você; recusando, o puxão
        // vai até nele — sem parar antes, porque massa parada não devolve nada.
        const modo = this.arrow.stuckTo === 'boss' ? this.boss.tetherPull?.(this.player) : null
        if (modo !== 'yield') this.player.startTether(modo === 'slam' ? 0 : TUNING.tetherStopGap)
      }
    }

    this.player.step(dt, input, this.grid)
    this.stepRollDust(dt)
    if (this.stepRoomChange()) return
    this.stepObelisk(input)

    // Mira pela direção do jogador, não pelo mouse: é assim no Titan Souls, e é o
    // que dá peso ao ato de se virar enquanto o arco está armado.
    this.aimAngle = Math.atan2(this.player.faceY, this.player.faceX)

    // O tiro vem ANTES de mexer na carga. O `pointerup` zera `aimHeld` e marca o
    // tiro no mesmo evento, então neste passo `aiming` já é falso: zerar a carga
    // primeiro faria todo tiro sair com carga 0.
    if (input.shoot) {
      // Consome sempre, mesmo sem flecha na mão: senão o tiro sai atrasado depois.
      this.shootQueued = false
      if (this.arrow.state === HELD) {
        // Sai da mão, na direção que o jogador encara.
        this.arrow.shoot(
          this.player.x,
          this.player.handY,
          this.player.faceX,
          this.player.faceY,
          this.charge / TUNING.chargeTime,
        )
      }
      this.charge = 0
    } else if (input.aiming && this.arrow.state === HELD) {
      this.charge = Math.min(TUNING.chargeTime, this.charge + dt * 1000)
    } else if (!input.aiming) {
      this.charge = 0
    }

    this.aiming = input.aiming
    this.recallActive = input.recall

    if (o.stage === 'pull') {
      // A flecha está presa no coração e não cede: nem recall nem passar por cima
      // a tiram. Segurar o botão só acumula esforço; ela sai quando ele completa.
      if (input.recall) o.t += dt * 1000
      if (o.t >= OUTRO.pullRamp) {
        o.stage = 'release'
        o.t = 0 // vira o relógio do zoom out
        this.arrow.recall()
        this.cameras.main.flash(OUTRO.releaseFlashMs, 255, 255, 255)
      }
      return
    }

    if (o.stage === 'release') o.t += dt * 1000

    if (input.recall) this.arrow.recall()
    else this.arrow.recallBlocked = false // soltar libera puxar de novo

    const axAntes = this.arrow.x
    const ayAntes = this.arrow.y
    const estadoAntes = this.arrow.state
    // O som sai de transições, não de estado: é o mesmo motivo da regra 3 para
    // entrada. Ler "está rolando" tocaria o raspão a 60 por segundo.
    const rolandoAntes = this.player.rolling
    const puxandoAntes = this.player.tethering
    const brasaAntes = this.arrow.burning
    this.arrow.step(dt, {
      grid: this.grid,
      player: this.player,
      recallHeld: input.recall,
      hitTest: (x, y) => {
        if (!this.lutando) this.desperta(x, y)
        return this.lutando ? this.boss.hitTest(x, y) : null
      },
      // Nem toda arena tem fogo: sem fonte de brasa a flecha nunca acende.
      igniteAt: this.boss.igniteAt ? (x, y) => this.boss.igniteAt(x, y) : null,
      onHit: (kind, arrow) => this.hitBoss(kind, arrow),
    })

    // A força do tiro é a carga, lida da **velocidade de saída** da flecha: ela
    // é a carga já convertida, e não se desfaz no quadro seguinte como o valor
    // suavizado que o efeito de câmera usa.
    if (estadoAntes === HELD && this.arrow.state === FLYING) {
      const carga = (this.arrow.speed - TUNING.arrowSpeedMin) / (TUNING.arrowSpeedMax - TUNING.arrowSpeedMin)
      toca('tiro', 0.45 + 0.55 * Math.max(0, Math.min(1, carga)))
    }
    if (!rolandoAntes && this.player.rolling) toca('rolar')
    if (!puxandoAntes && this.player.tethering) toca('vinculo')
    if (!brasaAntes && this.arrow.burning) toca('brasa')

    if (this.arrow.state === FLYING || this.arrow.state === RETURNING) {
      this.trail.push(this.arrow.x, this.arrow.y)
    } else if (this.arrow.state === HELD) {
      this.trail.clear()
    }
    // Cravou na pedra: lasca e poeira saindo do ponto, contra a direção do voo.
    if (estadoAntes === FLYING && this.arrow.state === STUCK && this.arrow.stuckTo === 'wall') {
      this.dust.spawn(this.arrow.x, this.arrow.y, JUICE.wallDustN, {
        dirX: -this.arrow.dirX,
        dirY: -this.arrow.dirY,
        spread: 1.5,
        speed: JUICE.wallDustSpeed,
        color: this.theme.dust,
      })
      this.shake(JUICE.wallShakeMs, JUICE.wallShakeAmp)
      toca('pedra')
    }

    // **Flecha rebatida é hostil.** Ela volta com a força do próprio tiro, e é o
    // preço de atirar de frente num espelho. Testada pelo trecho percorrido, não
    // pela posição final: com carga cheia ela anda 42 px por quadro e passaria
    // direto por cima do jogador.
    if (
      this.arrow.state === FLYING &&
      this.arrow.bounces > 0 &&
      segmentHit(
        this.player.x,
        this.player.y,
        TUNING.playerRadius + TUNING.arrowRadius,
        axAntes,
        ayAntes,
        this.arrow.x,
        this.arrow.y,
      )
    ) {
      this.die()
    }

    // Arrancada: a flecha voltou à mão e aí sim a cena toma o controle.
    if (o.stage === 'release' && this.arrow.state === HELD) {
      o.stage = 'soul'
      o.t = 0
      o.soulTimer = 0
      this.player.moving = false // senão ele congela no meio da corrida
    }

    const wasAlive = !this.boss.dead
    if (this.desperto) {
      this.boss.update(dt, {
        player: this.player,
        grid: this.grid,
        kill: () => this.die(),
        shake: (ms, amp) => this.shake(ms, amp),
        // O chefe não conhece a cena nem o tema: pede poeira, e a cor é da sala.
        dust: (x, y, n, opts) => this.dust.spawn(x, y, n, { color: this.theme.dust, ...opts }),
        // Som pelo mesmo contrato: o chefe pede pelo nome e não sabe o que é
        // Web Audio, do mesmo jeito que não sabe o que é `Graphics`.
        som: (nome, forca) => toca(nome, forca),
      })
    }
    if (wasAlive && this.boss.dead) {
      this.shake(400, 0.012)
      toca('titaCai')
    }

    // Flecha cravada num chefe que se move vai junto com ele.
    // ponytail: por enquanto é opção do chefe. O caminho de upgrade é a flecha
    // guardar a âncora sozinha e todo chefe carregar a dele.
    if (this.arrow.state === STUCK && this.arrow.stuckTo === 'boss') this.boss.carryArrow?.(this.arrow)
  }

  /**
   * A flecha encostou no titã adormecido: a luta começa aqui, e é aqui que a
   * arena se tranca.
   *
   * O teste é o corpo inteiro, não a hitbox do chefe: a hitbox diz onde ele pode
   * ser **ferido**, e num titã que passa a maior parte do tempo invulnerável ela
   * recusaria o tiro que devia acordá-lo.
   */
  desperta(x, y) {
    if (this.lutando || this.boss.dead) return
    // Acerto conta pela forma que o chefe declara, com o círculo da pegada como
    // rede: o Crisol é alto e a âncora dele está no pé, então o círculo sozinho
    // ficava no chão embaixo do caldeirão em vez de na barriga dele.
    if (!this.boss.hitTest?.(x, y) && !circleHit(x, y, TUNING.arrowRadius, this.boss.x, this.boss.y, this.boss.radius)) {
      return
    }
    this.lutando = true
    this.wakeT = 0
    toca('acorda')
    this.openDoors()
    this.desencalha()
  }

  /** Acabou de se levantar e de gritar? Antes disso o chefe não tem relógio. */
  get desperto() {
    return this.lutando && this.wakeT >= WAKE.rise + WAKE.roar
  }

  /**
   * Tira o jogador de dentro de tile sólido, empurrando-o para o meio do chão.
   *
   * A porta se fecha no instante do primeiro tiro, e nada impede que ele o dê da
   * soleira. Encalhado ele não sairia nunca: a colisão testa 1 px por vez e um
   * corpo já dentro do sólido fica travado em todas as direções.
   */
  desencalha() {
    const p = this.player
    if (!boxBlocked(this.grid, p.x, p.y, PLAYER_BOX.hw, PLAYER_BOX.hh)) return
    const f = this.room.floor
    const dx = (f.x0 + f.x1) / 2 - p.x
    const dy = (f.y0 + f.y1) / 2 - p.y
    const d = Math.hypot(dx, dy) || 1
    for (let i = 0; i < TUNING.tileSize * 3; i++) {
      p.x += dx / d
      p.y += dy / d
      if (!boxBlocked(this.grid, p.x, p.y, PLAYER_BOX.hw, PLAYER_BOX.hh)) return
    }
  }

  hitBoss(kind, arrow) {
    const before = this.boss.phase // só chefe com fases tem; nos outros fica undefined
    // Hitstop: o núcleo pesa o dobro do corpo. É a única coisa do suco que para a
    // simulação, e por isso é medida em quadros.
    const parada = kind === 'core' ? JUICE.hitstopCore : kind === 'reflect' ? JUICE.hitstopReflect : JUICE.hitstopBody
    this.freeze = Math.max(this.freeze, parada)
    toca(SOM_ACERTO[kind] ?? SOM_ACERTO.body)
    this.boss.onArrowHit(kind, arrow)
    // Detectado aqui, não depois do `boss.update`: a flecha mata antes dele rodar,
    // então lá o chefe já constava morto e o efeito nunca disparava.
    if (this.boss.dead) this.startOutro()
    else if (this.boss.phase !== before) this.shake(260, 0.009)
  }

  startOutro() {
    // O tempo se arrasta no golpe final e volta ao normal sozinho, antes de o
    // desfecho assumir com o escuro e o zoom dele.
    this.slow = JUICE.slowTime

    // A alma entra aqui, não no fim do desfecho: é o que abre as portas, e o
    // jogador precisa ver a sala destrancar enquanto a alma vem até ele.
    run.addSoul(this.room.boss)
    this.openDoors()
    this.outro = { stage: 'pull', t: 0, soulTimer: 0 }
    this.souls = []
    this.playerLift = 0
    this.cameras.main.flash(OUTRO.killFlashMs, 255, 255, 255)
  }

  /**
   * Desfecho da luta. A arena já está calada; aqui o jogador perde o controle,
   * puxa a flecha sob tensão e recebe a alma antes de voltar ao chão.
   */
  /** Só a alma e o pouso: aqui o jogador já não controla nada. */
  stepOutro(dt) {
    const o = this.outro
    o.t += dt * 1000

    if (o.stage === 'soul') {
      o.soulTimer -= dt * 1000
      if (o.soulTimer <= 0) {
        o.soulTimer = OUTRO.soulEvery
        // Saem do coração, não em volta do jogador: é a alma dele que vem.
        this.souls.push({
          x: this.boss.x + (Math.random() - 0.5) * OUTRO.soulSpread,
          y: this.boss.y + (Math.random() - 0.5) * OUTRO.soulSpread,
        })
      }
      if (o.t >= OUTRO.soulTime) {
        o.stage = 'land'
        o.t = 0
      }
    } else if (o.stage === 'land' && o.t >= OUTRO.landTime) {
      // `null`, não 'done': qualquer string aqui é truthy e mantinha o jogador
      // travado no desfecho para sempre.
      o.stage = null
      this.playerLift = 0
      this.souls = []
      return
    }

    // Fragmentos convergindo para o peito.
    const tx = this.player.x
    const ty = this.player.handY - this.playerLift
    for (const f of this.souls) {
      const dx = tx - f.x
      const dy = ty - f.y
      const d = Math.hypot(dx, dy) || 1
      const step = OUTRO.soulSpeed * dt
      if (d <= step) f.done = true
      else {
        f.x += (dx / d) * step
        f.y += (dy / d) * step
      }
    }
    this.souls = this.souls.filter((f) => !f.done)

    // Sobe durante a alma, desce no fim.
    if (o.stage === 'soul') this.playerLift = OUTRO.liftPx * Math.min(1, o.t / OUTRO.soulTime)
    else if (o.stage === 'land') this.playerLift = OUTRO.liftPx * (1 - Math.min(1, o.t / OUTRO.landTime))
  }

  die() {
    if (this.dead || this.outro.stage) return // a luta acabou; nada mais mata
    this.dead = true
    this.morte = 0
    toca('morte')
    run.deaths++
    // A morte grava a estatística na hora: contagem que some ao fechar a aba não
    // conta nada. Progresso continua sendo do obelisco — ver `run.saveDeaths`.
    run.saveDeaths()
    this.cameras.main.flash(90, 255, 255, 255)
    // O véu vira preto avermelhado. Repintar o mesmo retângulo sai mais barato
    // que uma camada só para isto — a cena reinicia no vínculo logo em seguida e
    // ele volta a nascer preto.
    this.dim.clear().fillStyle(DEATH.tint, 1).fillRect(-VIEW.w, -VIEW.h, VIEW.w * 3, VIEW.h * 3)
    // A câmera fecha no corpo. Sem isso o zoom apertaria no meio da sala, que é
    // justamente onde o jogador não está mais.
    this.cameras.main.startFollow(this.playerSprite, true, DEATH.followLerp, DEATH.followLerp)
    this.seguindo = true
  }

  /**
   * Derrotado. A partida volta ao último vínculo — não à sala da morte —, e é o
   * que dá peso a atravessar o mundo de volta até o obelisco para guardar.
   */
  voltarAoVinculo() {
    if (this.trocando) return
    this.trocando = true
    run.room = run.checkpoint
    run.entrandoPor = null
    run.entrandoEm = 0
    this.scene.restart({ room: run.checkpoint, entrandoPor: null })
  }

  /**
   * Saiu pela porta? A única brecha na muralha é a passagem, então basta testar a
   * borda da sala — não precisa de gatilho separado para manter alinhado com o
   * desenho.
   *
   * O limite é o **último tile** do corredor, não a borda da caixa: a colisão
   * segura o jogador dentro da grade, então ele nunca chega a passar dela.
   */
  stepRoomChange() {
    if (this.trocando || this.dead || this.outro.stage) return false
    const p = this.player
    const m = TUNING.tileSize * 0.9
    const lado =
      p.y < m
        ? 'norte'
        : p.y > this.room.height - m
          ? 'sul'
          : p.x < m
            ? 'oeste'
            : p.x > this.room.width - m
              ? 'leste'
              : null
    const destino = lado && this.room.exits?.[lado]
    if (!destino) return false

    // O desvio lateral na porta viaja junto: do outro lado ele entra na mesma
    // altura do corredor em que saiu, e o passo não dá um pulo para o lado.
    const c = this.doorCenter(this.room.doors[lado])
    run.entrandoEm = lado === 'norte' || lado === 'sul' ? p.x - c.x : p.y - c.y

    this.trocando = true
    run.room = destino
    this.cameras.main.fade(TRAVESSIA.fadeOut, 0, 0, 0)
    this.time.delayedCall(TRAVESSIA.fadeOut + 10, () =>
      this.scene.restart({ room: destino, entrandoPor: oposto(lado) }),
    )
    return true
  }

  /**
   * O fundo da sala, por quadro.
   *
   * Duas coisas: **bolhas** estourando de vez em quando onde há lava, e o leito
   * engrossando conforme o chão vira fogo — a poça do Crisol conta, então a sala
   * fica mais barulhenta à medida que ele a toma. Som que responde ao estado é
   * informação; som fixo é papel de parede.
   */
  stepAmbiente(dt) {
    const quente = fundoDoTema(this.theme) === 'lava'
    this.fundoT -= dt
    if (this.fundoT <= 0) {
      this.fundoT = 0.25
      const poca = this.boss?.pools?.size ?? 0
      ambienteForca(quente ? Math.min(2, 1 + poca / 90) : 1)
    }
    if (!quente) return
    this.bolhaT -= dt
    if (this.bolhaT <= 0) {
      // Intervalo sorteado: bolha em cadência fixa vira metrônomo.
      this.bolhaT = 0.35 + Math.random() * 1.1
      toca('bolha', 0.6 + Math.random() * 0.4)
    }
  }

  /**
   * **Todo tremor de câmera passa por aqui.** É o único ponto de estrangulamento
   * que a opção precisa: cinco lugares chamavam `camera.shake` direto, e com
   * `tremor` em "desligado" quatro deles continuariam sacudindo.
   */
  shake(ms, amp) {
    const k = tremor()
    if (k > 0) this.cameras.main.shake(ms, amp * k)
  }

  /**
   * Obelisco: guarda o vínculo e diz quantas almas faltam. É o único lugar que
   * grava — morrer não grava, e é isso que faz ele valer alguma coisa.
   */
  stepObelisk(input) {
    const o = this.room.obelisk
    if (!o) return
    const perto = Math.hypot(this.player.x - o.x, this.player.y - o.y) < TUNING.tileSize * 2
    this.pertoDoObelisco = perto
    if (!perto || !input.interactPressed) return
    const ok = run.save()
    toca(ok ? 'vinculoGuardado' : 'recusa')
    this.aviso = {
      txt: ok ? `vínculo guardado · ${run.souls} de ${BOSS_TOTAL} almas` : 'não há onde guardar',
      t: 2200,
    }
  }

  draw() {
    this.playerSprite.setPosition(Math.round(this.player.x), Math.round(this.player.y - this.playerLift))
    // Ordenação por profundidade: quem está mais embaixo na tela desenha na frente.
    // É o que faz o jogador sumir atrás de um pilar e reaparecer ao descer.
    this.playerSprite.setDepth(this.player.y)
    // Rolar tem pose própria desde a folha v2 (`slide`), e ela segue a direção
    // do **dash**, não a que ele encara: no trancão do Vínculo as duas diferem, e
    // quem manda é para onde o corpo está indo.
    const rolando = this.player.rolling
    const dir = rolando
      ? compass(this.player.rollX, this.player.rollY)
      : compass(this.player.faceX, this.player.faceY)
    const key = `player-${rolando ? 'roll' : this.player.moving ? 'run' : 'idle'}-${dir}`
    // O rolamento não repete, então um segundo rolamento na mesma direção tem
    // que **recomeçar** a animação: `play(key, true)` sozinho a ignoraria, por
    // já ser a animação atual, e o segundo dash sairia com o boneco parado.
    if (rolando && !this.rolandoAntes) this.playerSprite.play(key)
    else if (this.playerSprite.anims.currentAnim?.key !== key) this.playerSprite.play(key, true)
    this.rolandoAntes = rolando

    this.drawArrow()
    this.drawFx()

    // Fragmentos de alma: por cima do escurecimento, senão o brilho some junto.
    this.soulGfx.clear()
    for (const f of this.souls) {
      this.soulGfx.fillStyle(COLOR.soul, 0.9)
      this.soulGfx.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 2, 2)
      this.soulGfx.fillStyle(COLOR.soul, 0.25)
      this.soulGfx.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 4, 4)
    }

    this.cord.clear()

    if (this.arrow.state === STUCK) {
      this.cord.lineStyle(1, COLOR.cord, this.player.tethering ? 0.9 : 0.35)
      this.cord.lineBetween(
        Math.round(this.player.x),
        Math.round(this.player.handY),
        Math.round(this.arrow.x),
        Math.round(this.arrow.y),
      )
    }

    this.drawReflections()

    // O despertar, na forma que a view lê: `rise` com suavização nas duas pontas
    // (ele não arranca nem freia de repente) e `roar` como um sino — sobe e
    // desce dentro da janela do grito.
    const p = this.lutando ? Math.min(1, this.wakeT / WAKE.rise) : 0
    const grito = this.wakeT - WAKE.rise
    this.wake.rise = p * p * (3 - 2 * p)
    this.wake.roar = this.lutando && grito > 0 && grito < WAKE.roar ? Math.sin((grito / WAKE.roar) * Math.PI) : 0

    // A cena é dona das camadas e as limpa; a view só desenha nelas.
    this.decalGfx.clear()
    this.airGfx.clear()
    this.bossGfx.clear()
    this.bossTopGfx.clear()
    this.view.draw(this, this.boss, this.lavaTime ?? 0)
    this.drawFlames(this.lavaTime ?? 0)
    this.drawObelisk()
    this.drawAviso()
    // O `H` e a opção são o **mesmo interruptor**: dois jeitos de alcançar, um
    // estado só, e o que a tecla liga sobrevive ao fim da partida.
    if (Phaser.Input.Keyboard.JustDown(this.keys.hitboxes)) {
      opcoes.contornos = !opcoes.contornos
      saveOptions()
    }
    this.showHitboxes = opcoes.contornos
    this.drawHitboxes()

    // O jogo não tem HUD (seção 3.9 do DESIGN): o texto de estado é ferramenta
    // de verificação e mora atrás do mesmo `H` dos contornos de colisão.
    this.debug.setVisible(this.showHitboxes)
    if (this.showHitboxes) this.debug.setText(
      `${this.room.id}${this.boss.dead || this.desperto ? '' : this.lutando ? ' (acordando)' : ' (dormindo)'}  flecha:${this.arrow.state}${this.arrow.burning ? '/brasa' : ''}  ${this.view.status(this.boss)}  almas:${run.souls}/${BOSS_TOTAL}${this.outro.stage ? '  desfecho:' + this.outro.stage : ''}  mortes:${run.deaths}`,
    )
  }

  /**
   * A flecha está sempre em cena: nas costas quando guardada, encaixada no arco
   * enquanto mira, e voando ou cravada no resto. Mirando, ela **é** a mira — não
   * há mais traço abstrato.
   */
  drawArrow() {
    const a = this.arrow
    const A = SPRITES.arrow
    const spr = this.arrowSprite
    const p = this.player
    spr.setVisible(true)
    // Rebatida ela muda de cor: o jogador precisa ver que aquilo agora o mata.
    spr.setTint(a.burning ? COLOR.arrowBurning : a.bounces > 0 ? COLOR.beamCold : 0xffffff)

    if (a.state === HELD) {
      if (this.aiming) {
        // A âncora do sprite é a ponta, então pôr a ponta a 80% do comprimento
        // deixa os 20% da cauda para trás, junto ao corpo. O recuo da carga é
        // pequeno: sugere o esforço sem tirar a flecha da frente.
        const carga = this.charge / TUNING.chargeTime
        const d = A.nockAheadFrac * spr.displayWidth - A.nockDraw * carga
        spr.setPosition(
          Math.round(p.x + Math.cos(this.aimAngle) * d),
          Math.round(p.handY - this.playerLift + Math.sin(this.aimAngle) * d),
        )
        spr.setRotation(this.aimAngle - A.angleOffset)
        spr.setDepth(p.y + 0.5)
      } else {
        // Nas costas: some atrás do corpo quando ele encara a câmera, e aparece
        // por cima quando ele está de costas.
        const lado = p.faceX >= 0 ? 1 : -1
        spr.setPosition(
          Math.round(p.x - A.carryOffsetX * lado),
          Math.round(p.y + A.carryOffsetY - this.playerLift),
        )
        spr.setRotation(A.carryAngle + lado * A.carryLean - A.angleOffset)
        spr.setDepth(p.y + (p.faceY < 0 ? 0.5 : -0.5))
      }
      return
    }

    spr.setPosition(Math.round(a.x), Math.round(a.y))
    spr.setRotation(a.angle - A.angleOffset)
    spr.setDepth(a.y + 0.2)
  }

  /**
   * Rastro e poeira. O rastro afina de trás para a frente e usa a cor da flecha
   * — em brasa ele vira faísca, rebatida ele vira o azul do feixe, que é o
   * aviso de que aquilo agora mata.
   */
  drawFx() {
    const t = this.trailGfx
    t.clear()
    const pts = this.trail.points
    const cor = this.arrow.burning
      ? COLOR.arrowBurning
      : this.arrow.bounces > 0
        ? COLOR.beamCold
        : COLOR.arrow
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i]
      const f = Math.max(0, p.t / JUICE.trailLife)
      t.lineStyle(Math.max(1, JUICE.trailWidth * (i / pts.length)), cor, 0.55 * f)
      t.lineBetween(pts[i - 1].x, pts[i - 1].y, p.x, p.y)
    }

    const d = this.dustGfx
    d.clear()
    for (const p of this.dust.parts) {
      const f = Math.max(0, p.t / p.max)
      d.fillStyle(p.color, 0.7 * f)
      const s = Math.max(1, Math.round(p.size * (0.45 + f)))
      d.fillRect(Math.round(p.x) - (s >> 1), Math.round(p.y) - (s >> 1), s, s)
    }
  }

  /** Chamas na flecha em brasa: línguas que tremem e sobem. */
  drawFlames(time) {
    const a = this.arrow
    const g = this.airGfx
    if (!a.burning) return
    const A = SPRITES.arrow
    const x = a.state === HELD ? this.arrowSprite.x : a.x
    const y = a.state === HELD ? this.arrowSprite.y : a.y
    // Halo primeiro: as línguas caem por cima.
    const pulso = 1 + 0.2 * Math.sin(time * A.flameSpeed)
    g.fillStyle(this.theme.lavaGlow, FX.bloomFlame * 0.35)
    g.fillCircle(Math.round(x), Math.round(y) - 2, 13 * pulso)
    g.fillStyle(this.theme.lavaGlow, FX.bloomFlame)
    g.fillCircle(Math.round(x), Math.round(y) - 2, 7 * pulso)
    for (let i = 0; i < A.flameCount; i++) {
      const f = time * A.flameSpeed + i * 1.7
      const dx = Math.sin(f) * A.flameSpread
      const dy = -Math.abs(Math.cos(f * 0.8)) * A.flameSpread - 1
      const t = (Math.sin(f * 1.3) + 1) / 2
      g.fillStyle(i === 0 ? COLOR.flameCore : t > 0.5 ? COLOR.flameMid : COLOR.flameEdge, 0.55 + 0.35 * t)
      const s = 2 + Math.round(t * 2)
      g.fillRect(Math.round(x + dx) - (s >> 1), Math.round(y + dy) - (s >> 1), s, s)
    }
  }

  /**
   * Chão, muralha e o mar de lava, no estilo das referências de fogo: pedra com
   * face de topo mais clara, marchetaria em anéis no chão e vinheta nas bordas.
   * Desenhado uma vez; nada aqui muda durante a luta.
   */
  /**
   * Chão e muralha, desenhados uma vez. A lava fica de fora: ela é animada, e
   * mora em `drawLava`. O vocabulário vem das referências de fogo: rocha estriada
   * na vertical, aresta superior acesa, faixa lavrada com treliça de losangos, e
   * um chão sóbrio com um losango grande no centro.
   */
  /** Chão e muralha: pintados uma vez, pelo tema da sala. A lava é animada. */
  drawRoom() {
    const g = this.add.graphics().setDepth(DEPTH.floor)
    paintFloor(g, this.room, this.theme)
    paintWalls(g, this.grid, this.theme)
  }


  /**
   * Mar de lava. Redesenhado a cada quadro: as bolhas quentes deslizam por senos
   * de frequências que não batem, e um halo derrama sobre a pedra vizinha — é o
   * que dá a leitura de brilho sem depender de shader.
   */
  drawLava(time) {
    paintLava(this.lavaGfx, this.grid, this.theme, time, FX.bloomLava)
  }


  /**
   * Reflexo nas muralhas, quando o tema diz que elas são espelho.
   *
   * Reflexão de verdade, só que rasa: cada corpo perto de uma parede é rebatido
   * para dentro dela — espelhado no eixo certo, escurecido, e some conforme se
   * afasta. Chega para a sala se ler como salão de espelhos sem custar um
   * segundo passe de render.
   *
   * ponytail: teto assumido — só jogador e flecha são reflexos de verdade
   * (sprite espelhado). O chefe entra como silhueta, porque ele é desenhado com
   * `Graphics` e não dá para virar do avesso. Quando algum chefe virar sprite,
   * ele entra aqui pelo mesmo caminho do jogador.
   */
  drawReflections() {
    const g = this.mirrorGfx
    g.clear()
    this.mirrorFog.clear()
    let usados = 0
    if (!this.theme.mirrorWalls) {
      for (const f of this.mirrorGhosts) f.setVisible(false)
      return
    }
    this.drawMirrorFog()

    const paredes = this.mirrorWalls()

    const ghost = () => {
      let f = this.mirrorGhosts[usados]
      if (!f) {
        f = this.add.image(0, 0, 'player').setDepth(DEPTH.decal - 0.05)
        this.mirrorGhosts[usados] = f
      }
      usados++
      return f
    }

    for (const p of paredes) {
      const dist = p.dist
      const espelha = p.espelha

      // Jogador e flecha viram sprite espelhado; o chefe, silhueta.
      for (const [spr, alvo] of [
        [this.playerSprite, this.player],
        [this.arrowSprite, this.arrow.state === HELD ? this.player : this.arrow],
      ]) {
        const d = dist(alvo)
        if (d < 0 || d > TERRAIN.mirrorDepth) continue
        const r = espelha({ x: spr.x, y: spr.y })
        const f = ghost()
        f.setVisible(true)
        f.setTexture(spr.texture.key, spr.frame.name)
        f.setScale(spr.scaleX * (p.eixo === 'x' ? -1 : 1), spr.scaleY * (p.eixo === 'y' ? -1 : 1))
        f.setOrigin(spr.originX, spr.originY)
        f.setRotation(p.eixo === 'y' ? -spr.rotation : Math.PI - spr.rotation)
        f.setPosition(Math.round(r.x), Math.round(r.y))
        f.setTint(TERRAIN.mirrorTint)
        // Força fixa: quem apaga com a profundidade é a névoa. Descontar aqui
        // também fazia os dois se somarem e o reflexo sumia perto do fundo.
        f.setAlpha(TERRAIN.mirrorAlpha)
      }

      const b = this.boss
      if (b.dead) continue
      const d = dist(b)
      if (d < 0 || d > TERRAIN.mirrorDepth) continue
      const r = espelha(b)
      const a = TERRAIN.mirrorAlpha
      g.fillStyle(TERRAIN.mirrorTint, a)
      g.fillEllipse(Math.round(r.x), Math.round(r.y), b.radius * 2, b.radius * 1.8)
      g.fillStyle(COLOR.shadow, a * 0.5)
      g.fillEllipse(Math.round(r.x), Math.round(r.y), b.radius * 1.2, b.radius * 1.1)
    }

    for (let i = usados; i < this.mirrorGhosts.length; i++) this.mirrorGhosts[i].setVisible(false)
  }

  /**
   * Névoa do espelho: faixas paralelas à muralha, engrossando para dentro dela.
   * Tudo que é refletido passa por baixo, então some no fundo por igual — sem
   * isso o reflexo acabava num corte seco na borda da faixa.
   */
  drawMirrorFog() {
    const g = this.mirrorFog
    const n = TERRAIN.mirrorFogSteps
    const fundo = TERRAIN.mirrorDepth
    const cor = this.theme.wall

    for (const p of this.mirrorWalls()) {
      for (let i = 0; i < n; i++) {
        const d0 = (i / n) * fundo
        const d1 = ((i + 1) / n) * fundo
        const a = TERRAIN.mirrorFogMax * Math.pow((i + 0.5) / n, TERRAIN.mirrorFogCurve)
        g.fillStyle(cor, a)
        // O lado da muralha é o oposto do chão, daí o sinal invertido.
        const q0 = p.em - p.sinal * d0
        const q1 = p.em - p.sinal * d1
        if (p.eixo === 'y') {
          g.fillRect(0, Math.min(q0, q1), this.room.width, Math.abs(q1 - q0) + 1)
        } else {
          g.fillRect(Math.min(q0, q1), 0, Math.abs(q1 - q0) + 1, this.room.height)
        }
      }
    }
  }

  /**
   * As quatro muralhas como espelhos: onde ficam, a que distância está um corpo
   * e para onde ele é rebatido. Uma fonte só, usada pelo reflexo dos corpos e
   * pelo do feixe.
   */
  mirrorWalls() {
    const f = this.room.floor
    const lados = [
      { eixo: 'y', em: f.y0, sinal: 1 },
      { eixo: 'y', em: f.y1, sinal: -1 },
      { eixo: 'x', em: f.x0, sinal: 1 },
      { eixo: 'x', em: f.x1, sinal: -1 },
    ]
    return lados.map((p) => ({
      ...p,
      dist: (o) => (p.eixo === 'y' ? (o.y - p.em) * p.sinal : (o.x - p.em) * p.sinal),
      espelha: (o) => (p.eixo === 'y' ? { x: o.x, y: 2 * p.em - o.y } : { x: 2 * p.em - o.x, y: o.y }),
    }))
  }

  /**
   * Espelha uma polilinha nas muralhas e desenha o pedaço que cabe dentro delas.
   * É como o feixe do chefe aparece continuando para dentro do espelho, em vez
   * de simplesmente virar na parede.
   *
   * Cada trecho é recortado na faixa `0..mirrorDepth` a partir da parede antes de
   * ser rebatido — sem isso o traçado inteiro seria espelhado e sairia do quadro.
   */
  mirrorPolyline(pts, largura, cor, alpha) {
    if (!this.theme.mirrorWalls || !pts || pts.length < 2) return
    const g = this.mirrorGfx
    const fundo = TERRAIN.mirrorDepth

    for (const p of this.mirrorWalls()) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const da = p.dist(a)
        const db = p.dist(b)
        // Faixa de t em que o trecho está dentro da profundidade do espelho.
        let t0 = 0
        let t1 = 1
        const corta = (v0, v1, min) => {
          const dv = v1 - v0
          if (Math.abs(dv) < 1e-6) return (min ? v0 >= 0 : v0 <= fundo) ? null : 'fora'
          const t = min ? -v0 / dv : (fundo - v0) / dv
          return t
        }
        for (const min of [true, false]) {
          const t = corta(da, db, min)
          if (t === 'fora') {
            t0 = 1
            t1 = 0
            break
          }
          if (t === null) continue
          const entrando = min ? db > da : db < da
          if (entrando) t0 = Math.max(t0, t)
          else t1 = Math.min(t1, t)
        }
        if (t1 <= t0) continue

        const em = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
        const r0 = p.espelha(em(t0))
        const r1 = p.espelha(em(t1))
        // Sem desconto por profundidade aqui: a névoa é que apaga, e ela apaga
        // ao longo do traçado em vez de dar um valor só para o trecho inteiro.
        g.lineStyle(largura, cor, alpha)
        g.lineBetween(r0.x, r0.y, r1.x, r1.y)
      }
    }
  }

  /**
   * Obelisco: pedra alta com a marca das almas subindo pelo corpo. Entra na
   * ordenação por y como qualquer entidade, então o jogador passa atrás dele.
   */
  drawObelisk() {
    const o = this.room.obelisk
    if (!o) return
    const g = this.airGfx
    const x = Math.round(o.x)
    const y = Math.round(o.y)
    const h = 54
    const w = 16

    g.fillStyle(COLOR.shadow, 0.45)
    g.fillEllipse(x, y, w * 2.1, w * 0.8)
    g.fillStyle(this.theme.wall, 1)
    g.fillPoints(
      [
        { x: x - w / 2, y },
        { x: x - w / 2 + 3, y: y - h },
        { x: x + w / 2 - 3, y: y - h },
        { x: x + w / 2, y },
      ],
      true,
    )
    g.fillStyle(this.theme.wallTop, 0.9)
    g.fillRect(x - w / 2 + 1, y - h, 3, h)
    g.lineStyle(1, this.theme.wallCap, 0.7)
    g.strokeRect(x - w / 2, y - h, w, h)

    // Uma marca por titã, acendendo de baixo para cima.
    for (let i = 0; i < BOSS_TOTAL; i++) {
      const cy = y - 10 - i * 13
      const tem = run.souls > i
      g.fillStyle(tem ? COLOR.core : this.theme.wallFoot, tem ? 0.95 : 0.7)
      g.fillPoints(
        [
          { x, y: cy - 4 },
          { x: x + 4, y: cy },
          { x, y: cy + 4 },
          { x: x - 4, y: cy },
        ],
        true,
      )
    }

    // Convite, só quando dá para usar.
    if (this.pertoDoObelisco && !this.aviso) {
      const pulso = 0.6 + 0.4 * Math.sin((this.lavaTime ?? 0) * 4)
      drawText(this.bossTopGfx, 'e  guardar', x, y - h - 16, {
        color: COLOR.uiInk,
        alpha: 0.5 + 0.4 * pulso,
        align: 'center',
      })
      this.bossTopGfx.setDepth(DEPTH.air + 1)
    }
  }

  /** Recado curto do obelisco, preso à tela. */
  drawAviso() {
    const g = this.avisoGfx
    g.clear()
    if (!this.aviso) return
    this.aviso.t -= this.game.loop.delta
    if (this.aviso.t <= 0) {
      this.aviso = null
      return
    }
    const f = Math.min(1, this.aviso.t / 400)
    drawText(g, this.aviso.txt, VIEW.w / 2, VIEW.h - 48, {
      scale: 2,
      color: COLOR.uiInk,
      alpha: f,
      align: 'center',
    })
  }

  /** Contornos de colisão. Liga e desliga com H, para conferir visual x hitbox. */
  drawHitboxes() {
    const g = this.hitGfx
    g.clear()
    if (!this.showHitboxes) return

    g.lineStyle(1, 0x00ff88, 0.9)
    g.strokeCircle(Math.round(this.player.x), Math.round(this.player.y), TUNING.playerRadius)
    g.lineStyle(1, 0x00ff88, 0.45)
    g.strokeRect(this.player.x - PLAYER_BOX.hw, this.player.y - PLAYER_BOX.hh, PLAYER_BOX.hw * 2, PLAYER_BOX.hh * 2)
    g.lineBetween(this.player.x - 3, this.player.handY, this.player.x + 3, this.player.handY)

    this.view.hitboxes(g, this.boss)

    if (this.arrow.state !== HELD) {
      g.lineStyle(1, 0x66ddff, 0.9)
      g.strokeCircle(Math.round(this.arrow.x), Math.round(this.arrow.y), TUNING.arrowRadius)
    }
  }
}

/** Para onde o jogador seguia ao entrar por cada lado. */
const RUMO = { norte: [0, 1], sul: [0, -1], oeste: [1, 0], leste: [-1, 0] }

/** Entrada de quem já morreu: o mundo roda, ele não. */
const MORTO = {
  dirX: 0,
  dirY: 0,
  aiming: false,
  shoot: false,
  rollPressed: false,
  recall: false,
  interactPressed: false,
  tetherPressed: false,
  anchorX: null,
  anchorY: null,
}

const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']

/** Vetor de direção para o nome de bússola mais próximo entre as 8 direções. */
function compass(x, y) {
  const i = Math.round(Math.atan2(y, x) / (Math.PI / 4))
  return DIRS[(i + 8) % 8]
}

/**
 * Monta as animações lendo o JSON do PixelLab em vez de fixar linhas no código:
 * direção que faltar cai na vizinha, e ao regerar a folha com ela a animação
 * entra sozinha. Foi assim que a folha v2 trouxe a corrida norte e as oito poses
 * de `slide` sem uma linha de código nova além do rolamento em si.
 */
function makePlayerAnims(scene) {
  const { columns, rows } = playerAtlas.spritesheet
  const byDir = {}
  const frames = (row, n) => Array.from({ length: n }, (_, i) => row * columns + i)

  for (const r of rows) {
    if (r.type === 'rotations') {
      r.directions.forEach((d, i) => ((byDir[d] ??= {}).idle = [r.row * columns + i]))
    } else if (r.direction) {
      ;(byDir[r.direction] ??= {})[r.animation.toLowerCase()] = frames(r.row, r.frame_count)
    }
  }

  /** A animação nesta direção, ou a da vizinha mais próxima que exista. */
  const perto = (dir, nome) => {
    let a = byDir[dir]?.[nome]
    const at = DIRS.indexOf(dir)
    for (let passo = 1; passo < 8 && !a; passo++) {
      a = byDir[DIRS[(at + passo) % 8]]?.[nome] ?? byDir[DIRS[(at - passo + 8) % 8]]?.[nome]
    }
    return a
  }

  for (const dir of DIRS) {
    const idle = byDir[dir]?.idle ?? byDir.south.idle
    if (scene.anims.exists(`player-idle-${dir}`)) continue
    scene.anims.create({
      key: `player-idle-${dir}`,
      frames: scene.anims.generateFrameNumbers('player', { frames: idle }),
    })

    scene.anims.create({
      key: `player-run-${dir}`,
      frames: scene.anims.generateFrameNumbers('player', { frames: perto(dir, 'running') ?? idle }),
      frameRate: SPRITES.player.runFps,
      repeat: -1,
    })

    // Rolamento: as poses de `slide` cobrem **exatamente** a duração do dash, e
    // a cadência sai dela — mexer em `rollDuration` reajusta a animação sozinho.
    // Sem repetir: o rolamento acaba, e a última pose é a de levantar.
    const slide = perto(dir, 'slide')
    scene.anims.create({
      key: `player-roll-${dir}`,
      frames: scene.anims.generateFrameNumbers('player', { frames: slide ?? perto(dir, 'running') ?? idle }),
      frameRate: (slide?.length ?? 1) / (TUNING.rollDuration / 1000),
    })
  }
}
