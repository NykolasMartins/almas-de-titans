import Phaser from 'phaser'
import { VIEW, COLOR, UI, THEMES } from '../tuning.js'
import { sinoRoom } from '../data/rooms.js'
import { drawText, textWidth } from '../ui/font.js'
import { toca } from '../audio.js'
import { paintBackdrop, paintVeil, hints, rule, plate, bracket, bossToken, losango, dashedRect } from '../ui/chrome.js'
import { loadSlots, eraseSlot, run } from '../run.js'
import { BOSS_ROOMS } from '../data/rooms.js'

/**
 * Escolha de vínculo — a nossa tela de save.
 *
 * Fiel à referência na estrutura: título entre duas réguas, quatro painéis
 * empilhados com número grande à esquerda e estado no meio, lavra nas laterais,
 * botão de apagar embaixo, dicas no canto.
 *
 * Diferente no que conta:
 * - eles chamam de *save slot*; aqui é **vínculo**, que é a mecânica do jogo — o
 *   arqueiro está preso a uma corda, e cada partida é uma corda diferente;
 * - a lavra lateral é de **elos de corrente**, não de vinha;
 * - e no lugar de miniaturas do mapa, cada vínculo mostra **as almas que
 *   carrega**, uma silhueta por titã derrubado.
 *
 * Os dados vêm do `localStorage` por `run.js`. Vínculo sem save aparece como
 * novo; escolher um vínculo carrega a partida e entra na sala onde ela parou.
 *
 * **Apagar tem duas etapas.** O botão não apaga nada: ele liga o modo de apagar,
 * o cursor volta para a lista e o vínculo mirado ganha uma **moldura tracejada
 * vermelha**. Aí escolher um vínculo apaga aquele, e o botão lá embaixo — que
 * agora diz `cancelar` — desfaz. Apagar era imediato e no último vínculo em que
 * o cursor tinha estado, que é o jeito mais fácil de perder uma partida sem
 * querer.
 */
const APAGAR = 4 // índice do botão de apagar

/** ms para mm:ss, que é o formato que a referência usa. */
function relogio(ms) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default class Slots extends Phaser.Scene {
  constructor() {
    super('Slots')
  }

  create() {
    this.escolha = 0
    this.t = 0
    this.apagando = false
    this.vinculos = loadSlots()

    const fundo = this.add.graphics().setDepth(0)
    paintBackdrop(fundo, sinoRoom, THEMES[sinoRoom.theme])
    paintVeil(this.add.graphics().setDepth(1))
    this.gfx = this.add.graphics().setDepth(2)

    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      upArrow: 'UP',
      downArrow: 'DOWN',
      ok: 'SPACE',
      enter: 'ENTER',
      voltar: 'ESC',
    })
  }

  update(_time, delta) {
    this.t += delta / 1000
    const k = this.keys
    const sobe = Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.upArrow)
    const desce = Phaser.Input.Keyboard.JustDown(k.down) || Phaser.Input.Keyboard.JustDown(k.downArrow)
    if (sobe) this.escolha = (this.escolha + APAGAR) % (APAGAR + 1)
    if (desce) this.escolha = (this.escolha + 1) % (APAGAR + 1)
    if (sobe || desce) toca('cursor')

    // No modo de apagar, voltar é desfazer: sair da tela no meio de uma ação
    // perigosa é o caminho errado para o `esc`.
    if (Phaser.Input.Keyboard.JustDown(k.voltar)) {
      if (this.apagando) this.apagando = false
      else this.scene.start('Titulo')
    }

    if (Phaser.Input.Keyboard.JustDown(k.ok) || Phaser.Input.Keyboard.JustDown(k.enter)) {
      // Apagar soa como recusa: é a única ação desta tela que tira alguma coisa.
      toca(this.apagando && this.escolha !== APAGAR ? 'recusa' : 'escolhe')
      if (this.escolha === APAGAR) {
        // O botão liga e desliga o modo; quem apaga é a escolha do vínculo.
        this.apagando = !this.apagando
        if (this.apagando) this.escolha = this.ultimo ?? 0
      } else if (this.apagando) {
        eraseSlot(this.escolha)
        this.vinculos = loadSlots()
        this.apagando = false
      } else {
        run.start(this.escolha)
        this.scene.start('World', { room: run.room, entrandoPor: null })
      }
    }
    if (this.escolha !== APAGAR) this.ultimo = this.escolha

    this.draw()
  }

  draw() {
    const g = this.gfx
    g.clear()
    const cx = VIEW.w / 2

    // Cabeçalho entre duas réguas, como na referência.
    const titulo = 'escolha um vínculo'
    const meia = textWidth(titulo, 2) / 2
    drawText(g, titulo, cx, 38, { scale: 2, color: COLOR.uiInk, alpha: 0.9, align: 'center' })
    rule(g, cx - meia - 18, 45, 130, -1)
    rule(g, cx + meia + 18, 45, 130, 1)

    const topo = 84
    this.vinculos.forEach((v, i) => this.drawSlot(g, v, i, cx, topo + i * UI.slotStep))

    // A placa chanfrada: ela liga o modo de apagar, e no modo ela desfaz.
    const rotulo = this.apagando ? 'cancelar' : 'apagar'
    const alvo = this.escolha === APAGAR
    const w = textWidth(rotulo, 1) + 34
    plate(g, cx - w / 2, VIEW.h - 62, w, 16, { aceso: alvo })
    drawText(g, rotulo, cx, VIEW.h - 58, {
      color: alvo ? COLOR.uiInk : COLOR.uiDim,
      alpha: alvo ? 1 : 0.7,
      align: 'center',
    })

    hints(g, [
      ['w s', 'mover'],
      ['espaço', this.apagando ? 'apagar' : 'escolher'],
      ['esc', this.apagando ? 'cancelar' : 'voltar'],
    ])
  }

  drawSlot(g, v, i, cx, y) {
    const alvo = this.escolha === i
    const x = cx - UI.slotW / 2
    const h = UI.slotH
    const a = alvo ? 1 : 0.45

    // Moldura: só o escolhido fecha o quadro inteiro, como na referência.
    g.fillStyle(COLOR.uiPlate, alvo ? 0.5 : 0.25)
    g.fillRect(x, y, UI.slotW, h)
    g.lineStyle(1, COLOR.uiFrame, a * (alvo ? 0.9 : 0.35))
    if (alvo) g.strokeRect(x, y, UI.slotW, h)
    else {
      g.lineBetween(x, y, x + UI.slotW, y)
      g.lineBetween(x, y + h, x + UI.slotW, y + h)
    }

    bracket(g, x - 14, y + 4, h - 8, COLOR.uiFrame, a * 0.7)
    bracket(g, x + UI.slotW + 5, y + 4, h - 8, COLOR.uiFrame, a * 0.7)

    // Prestes a sumir: moldura tracejada correndo em volta, na cor de aviso.
    if (this.apagando && alvo) {
      dashedRect(g, x - 3, y - 3, UI.slotW + 6, h + 6, COLOR.crack, 0.95, this.t * UI.dashSpeed)
    }

    // Número grande, apagado: é marca d'água, não informação.
    drawText(g, String(i + 1), x + 18, y + 12, {
      scale: UI.slotNumScale,
      color: COLOR.uiInk,
      alpha: a * (alvo ? 0.45 : 0.25),
    })

    const usado = v !== null
    drawText(g, usado ? 'continuar' : 'novo vínculo', x + 74, y + 18, {
      scale: 2,
      color: usado ? COLOR.uiInk : COLOR.uiDim,
      alpha: a,
    })
    if (usado) {
      drawText(g, `${v.deaths} mortes · ${relogio(v.timeMs)}`, x + 74, y + 38, {
        color: COLOR.uiInk,
        alpha: a * 0.6,
      })
    }

    // As almas que este vínculo carrega, uma silhueta por titã derrubado.
    BOSS_ROOMS.forEach((t, k) => {
      const tem = Boolean(usado && v.bosses.includes(t))
      const tx = x + UI.slotW - 30 - (BOSS_ROOMS.length - 1 - k) * 22
      const ty = y + h / 2
      losango(g, tx, ty, 9, COLOR.uiFrame, a * (tem ? 0.35 : 0.12))
      bossToken(g, t, tx, ty, tem ? COLOR.uiInk : COLOR.uiDim, a * (tem ? 0.95 : 0.2))
    })
  }
}
