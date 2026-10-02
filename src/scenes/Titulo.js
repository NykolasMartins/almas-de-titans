import Phaser from 'phaser'
import arrowUrl from '../../assets/arrow.png'
import { VIEW, COLOR, UI, SPRITES, THEMES, TERRAIN } from '../tuning.js'
import { sinoRoom } from '../data/rooms.js'
import { drawText, textWidth } from '../ui/font.js'
import { paintBackdrop, paintVeil, hints, losango } from '../ui/chrome.js'
import { makeRng } from '../terrain.js'
import { toca, ambiente } from '../audio.js'

/**
 * Tela de título.
 *
 * Fiel à referência na estrutura — mundo do jogo escuro atrás, logo grande,
 * menu curto embaixo, dicas de botão no canto — e diferente no que é nosso:
 *
 * - o fundo é **a nossa câmara de cinza**, não uma floresta;
 * - as letras são **pedra rachada com brasa por dentro**, no lugar da vinha que
 *   cresce sobre o osso;
 * - e o cursor é **a flecha**, encostada no item pela corda. É o objeto que o
 *   jogo inteiro gira em volta; não faz sentido o menu usar outra coisa.
 *
 * ponytail: `CRÉDITOS` ainda não leva a lugar nenhum — é da fase 8.
 */
const ITENS = [
  { rotulo: 'começar', destino: 'Slots' },
  // Lançada por cima, não no lugar: o título continua desenhado atrás, e voltar
  // é resumir em vez de reconstruir a tela inteira.
  { rotulo: 'opções', sobrepor: { modo: 'opcoes', voltar: 'Titulo' } },
  { rotulo: 'créditos', destino: null },
]

export default class Titulo extends Phaser.Scene {
  constructor() {
    super('Titulo')
  }

  preload() {
    this.load.image('arrow', arrowUrl)
  }

  create() {
    this.escolha = 0
    this.t = 0
    this.recusa = 0 // pisca quando o item não leva a lugar nenhum
    // O fundo é a câmara de cinza; o som combina com o que está desenhado atrás.
    ambiente('cinza')

    const fundo = this.add.graphics().setDepth(0)
    paintBackdrop(fundo, sinoRoom, THEMES[sinoRoom.theme])
    paintVeil(this.add.graphics().setDepth(1))

    this.logoGfx = this.add.graphics().setDepth(2)
    this.gfx = this.add.graphics().setDepth(3)
    this.cursor = this.add
      .image(0, 0, 'arrow')
      .setScale(SPRITES.arrow.scale)
      .setOrigin(SPRITES.arrow.originX, SPRITES.arrow.originY)
      .setRotation(-SPRITES.arrow.angleOffset)
      .setDepth(4)

    this.drawLogo()

    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      upArrow: 'UP',
      downArrow: 'DOWN',
      ok: 'SPACE',
      enter: 'ENTER',
    })
  }

  update(_time, delta) {
    this.t += delta / 1000
    if (this.recusa > 0) this.recusa -= delta

    const k = this.keys
    const sobe = Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.upArrow)
    const desce = Phaser.Input.Keyboard.JustDown(k.down) || Phaser.Input.Keyboard.JustDown(k.downArrow)
    if (sobe) this.escolha = (this.escolha + ITENS.length - 1) % ITENS.length
    if (desce) this.escolha = (this.escolha + 1) % ITENS.length
    if (sobe || desce) toca('cursor')

    if (Phaser.Input.Keyboard.JustDown(k.ok) || Phaser.Input.Keyboard.JustDown(k.enter)) {
      const item = ITENS[this.escolha]
      toca(item.sobrepor || item.destino ? 'escolhe' : 'recusa')
      if (item.sobrepor) {
        this.scene.launch('Pausa', item.sobrepor)
        this.scene.pause()
      } else if (item.destino) this.scene.start(item.destino)
      else this.recusa = 320
    }

    this.draw()
  }

  /**
   * Logo. Pedra clara com fissuras escuras por cima e brasa vazando por baixo —
   * o mesmo vocabulário da pirâmide, que é onde o jogo começa.
   *
   * As fissuras saem de gerador determinístico: o logo não pode mudar de cara a
   * cada vez que a tela abre.
   */
  drawLogo() {
    const g = this.logoGfx
    const cx = VIEW.w / 2
    const topo = 96
    const rnd = makeRng(TERRAIN.seed)

    // Brasa atrás das letras.
    for (const [w, h, a] of [
      [420, 96, 0.06],
      [300, 62, 0.07],
      [190, 38, 0.08],
    ]) {
      g.fillStyle(COLOR.heat, a)
      g.fillEllipse(cx, topo + 44, w, h)
    }

    const linhas = [
      { txt: 'almas', escala: UI.titleScale, y: topo },
      { txt: 'de titans', escala: UI.subtitleScale, y: topo + UI.titleScale * 7 + 12 },
    ]
    for (const l of linhas) {
      // Sombra dura embaixo: separa as letras do fundo sem contorno.
      drawText(g, l.txt, cx + l.escala, l.y + l.escala, {
        scale: l.escala,
        color: COLOR.bg,
        alpha: 0.85,
        align: 'center',
      })
      drawText(g, l.txt, cx, l.y, { scale: l.escala, color: COLOR.uiInk, align: 'center' })

      // Fissuras: riscos curtos e quebrados por cima do miolo das letras. Cada
      // uma nasce dentro de uma letra sorteada, não em qualquer ponto da caixa —
      // solta no vão entre letras ela lia como sujeira, não como rachadura.
      const larg = textWidth(l.txt, l.escala)
      const alt = l.escala * 7
      const letras = [...l.txt].map((c, k) => (c === ' ' ? -1 : k)).filter((k) => k >= 0)
      for (let i = 0; i < 12; i++) {
        const k = letras[Math.floor(rnd() * letras.length)]
        let x = cx - larg / 2 + (k * 6 + 1 + rnd() * 3) * l.escala
        let y = l.y + (1 + rnd() * 4) * l.escala
        let ang = (rnd() - 0.5) * 2.4
        g.lineStyle(Math.max(1, Math.round(l.escala / 4)), COLOR.crack, 0.5 + rnd() * 0.3)
        g.beginPath()
        g.moveTo(x, y)
        for (let s = 0; s < 3; s++) {
          ang += (rnd() - 0.5) * 1.6
          x += Math.cos(ang) * l.escala * 1.1
          y += Math.sin(ang) * l.escala * 0.9
          g.lineTo(x, y)
        }
        g.strokePath()
      }
    }
  }

  draw() {
    const g = this.gfx
    g.clear()
    const cx = VIEW.w / 2
    const base = 300

    ITENS.forEach((item, i) => {
      const y = base + i * UI.menuStep
      const alvo = i === this.escolha
      const recusando = alvo && this.recusa > 0 && Math.floor(this.recusa / 80) % 2 === 0
      drawText(g, item.rotulo, cx, y, {
        scale: UI.menuScale,
        color: recusando ? COLOR.crack : alvo ? COLOR.uiInk : COLOR.uiDim,
        alpha: alvo ? 1 : 0.75,
        align: 'center',
      })
    })

    // Cursor: a flecha, encostada no item pela corda. O pulso é o mesmo tremor
    // do arco armado, de leve.
    const y = base + this.escolha * UI.menuStep + UI.menuScale * 3
    const larg = textWidth(ITENS[this.escolha].rotulo, UI.menuScale)
    const puxa = Math.sin(this.t * 4) * 1.5
    const px = cx - larg / 2 - UI.cursorGap + puxa
    this.cursor.setPosition(Math.round(px), Math.round(y))
    g.lineStyle(1, COLOR.cord, 0.5)
    g.lineBetween(Math.round(px) - 26, Math.round(y), Math.round(px), Math.round(y))
    losango(g, cx + larg / 2 + UI.cursorGap - puxa, y, 3, COLOR.uiFrame, 0.8)

    hints(g, [
      ['w s', 'mover'],
      ['espaço', 'escolher'],
    ])
  }
}
