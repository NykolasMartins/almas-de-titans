import Phaser from 'phaser'
import { VIEW, COLOR, UI, SPRITES } from '../tuning.js'
import { drawText, textWidth } from '../ui/font.js'
import { paintVeil, hints, losango, plate, rule, dashedRect } from '../ui/chrome.js'
import { opcoes, saveOptions, TREMOR, VOLUME_PASSO } from '../options.js'
import { toca } from '../audio.js'
import { run } from '../run.js'
import { BOSS_ROOMS } from '../data/rooms.js'

/**
 * Pausa e opções — a mesma tela, dois modos.
 *
 * Ela é **lançada por cima** de quem a chamou (`launch` + `pause`), nunca no
 * lugar dele: o mundo continua desenhado atrás, congelado, e é isso que faz a
 * pausa parecer uma pausa em vez de uma troca de tela. Como a cena de baixo fica
 * pausada de verdade, nada de lá corre — nem a simulação, nem o relógio da
 * partida, nem a poeira. Pausar não conta como tempo jogado.
 *
 * Um arquivo só para os dois modos porque o painel é o mesmo: título entre
 * réguas, itens, cursor de flecha. Dois arquivos seriam o mesmo desenho duas
 * vezes.
 *
 * As opções são as que **fazem alguma coisa hoje**. `OPÇÕES` no título levava a
 * lugar nenhum desde a fase 5, e a correção não é trocar isso por três botões
 * que também não fazem nada: volume entra quando houver som.
 */
const PAUSA = [
  { rotulo: 'continuar', acao: 'fechar' },
  { rotulo: 'opções', acao: 'opcoes' },
  { rotulo: 'abandonar', acao: 'sair', perigo: true },
]

const OPCOES = [
  {
    // Primeira da lista porque é a que o jogador vem procurar, e a única que dá
    // para conferir de ouvido: mexer nela toca o som do cursor no volume novo.
    rotulo: 'volume',
    valor: () => (opcoes.volume <= 0 ? 'mudo' : Math.round(opcoes.volume * 100) + '%'),
    mexer: (cena, passo) => {
      opcoes.volume = Math.min(1, Math.max(0, +(opcoes.volume + passo * VOLUME_PASSO).toFixed(2)))
      saveOptions()
      toca('cursor')
    },
  },
  {
    rotulo: 'tela cheia',
    // Lida do navegador, não de uma cópia nossa: tela cheia pode cair por fora
    // (F11, `esc`), e opção que mostra o que quer em vez do que é, mente.
    valor: (cena) => (cena.scale.isFullscreen ? 'sim' : 'não'),
    // Sem `mexer`: quem vira esta é o ouvinte nativo de `create`. Ver lá.
    nativo: true,
  },
  {
    // Rótulo curto: com "tremor da câmera" o valor encostava no texto, e painel
    // mais largo por causa de uma palavra é o rabo abanando o cachorro.
    rotulo: 'tremor',
    valor: () => TREMOR[opcoes.tremor].rotulo,
    mexer: (cena, passo) => {
      opcoes.tremor = (opcoes.tremor + passo + TREMOR.length) % TREMOR.length
      saveOptions()
    },
  },
  {
    // Mesma chave do `H` em jogo: um interruptor só, dois lugares de alcançar.
    rotulo: 'contornos',
    valor: () => (opcoes.contornos ? 'sim' : 'não'),
    mexer: () => {
      opcoes.contornos = !opcoes.contornos
      saveOptions()
    },
  },
  { rotulo: 'voltar', acao: 'voltar' },
]

const PAINEL = { w: 300, topo: 52, rodape: 26 }

/** A placa cresce com o que tem dentro: painel meio vazio lê como erro. */
function altura(cena) {
  return PAINEL.topo + cena.itens.length * UI.menuStep + PAINEL.rodape + (cena.temStatus ? 16 : 0)
}

export default class Pausa extends Phaser.Scene {
  constructor() {
    super('Pausa')
  }

  init(data) {
    this.voltarPara = data?.voltar ?? 'World'
    this.modo = data?.modo ?? 'pausa'
    this.temPausa = this.modo === 'pausa'
    this.escolha = 0
    this.confirmando = false
    this.t = 0
  }

  create() {
    paintVeil(this.add.graphics().setDepth(0))
    this.gfx = this.add.graphics().setDepth(1)
    this.cursor = this.add
      .image(0, 0, 'arrow')
      .setScale(SPRITES.arrow.scale)
      .setOrigin(SPRITES.arrow.originX, SPRITES.arrow.originY)
      .setRotation(-SPRITES.arrow.angleOffset)
      .setDepth(2)

    // **Tela cheia é pedida dentro do evento do navegador.** O laço do Phaser
    // roda depois dele, e de lá o pedido chega sem gesto do jogador e é
    // recusado em silêncio — a linha ficava em "não" para sempre. É a única
    // ação deste menu que não passa pelo `update`.
    this.aoTeclar = (e) => {
      if (this.modo !== 'opcoes' || !this.itens[this.escolha]?.nativo) return
      if (!['Space', 'Enter', 'ArrowRight', 'ArrowLeft', 'KeyD', 'KeyA'].includes(e.code)) return
      try {
        this.scale.toggleFullscreen()
      } catch {
        /* recusado pelo navegador: a linha continua mostrando o estado real */
      }
    }
    window.addEventListener('keydown', this.aoTeclar)
    this.events.once('shutdown', () => window.removeEventListener('keydown', this.aoTeclar))

    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      upArrow: 'UP',
      downArrow: 'DOWN',
      leftArrow: 'LEFT',
      rightArrow: 'RIGHT',
      ok: 'SPACE',
      enter: 'ENTER',
      voltar: 'ESC',
    })
  }

  get itens() {
    return this.modo === 'pausa' ? PAUSA : OPCOES
  }

  /** Partida solta (endereço direto de luta) não tem o que contar. */
  get temStatus() {
    return this.modo === 'pausa' && run.slot !== null
  }

  update(_time, delta) {
    this.t += delta / 1000
    const k = this.keys
    const J = Phaser.Input.Keyboard.JustDown
    const lista = this.itens

    const sobe = J(k.up) || J(k.upArrow)
    const desce = J(k.down) || J(k.downArrow)
    if (sobe || desce) {
      this.escolha = (this.escolha + (desce ? 1 : lista.length - 1)) % lista.length
      this.confirmando = false // sair de cima do item perigoso desarma
      toca('cursor')
    }

    // Seta para o lado mexe no valor sem "entrar" na linha: é como se lê uma
    // lista de opções, e evita que escolher tela cheia pareça confirmar algo.
    const passo = J(k.right) || J(k.rightArrow) ? 1 : J(k.left) || J(k.leftArrow) ? -1 : 0
    const item = lista[this.escolha]
    if (passo && item.mexer) item.mexer(this, passo)

    if (J(k.ok) || J(k.enter)) {
      toca(item.perigo && !this.confirmando ? 'recusa' : 'escolhe')
      this.escolher(item)
    }

    if (J(k.voltar)) {
      // No meio de uma ação sem volta, `esc` é desfazer — nunca sair.
      if (this.confirmando) this.confirmando = false
      else this.fechar()
    }

    this.draw()
  }

  escolher(item) {
    if (item.nativo) return // quem cuida é o ouvinte nativo, no evento da tecla
    if (item.mexer) {
      item.mexer(this, 1)
      return
    }
    if (item.acao === 'opcoes') {
      this.modo = 'opcoes'
      this.escolha = 0
      return
    }
    if (item.acao === 'voltar') {
      this.fechar()
      return
    }
    if (item.acao === 'sair') {
      // Duas etapas: o progresso só existe até o último obelisco, e sair joga
      // fora o que veio depois. O mesmo aviso do apagar vínculo.
      if (!this.confirmando) {
        this.confirmando = true
        return
      }
      this.scene.stop(this.voltarPara)
      this.scene.stop()
      this.scene.start('Titulo')
      return
    }
    this.fechar()
  }

  /** Volta para o modo anterior, ou devolve o controle a quem chamou. */
  fechar() {
    if (this.modo === 'opcoes' && this.temPausa) {
      this.modo = 'pausa'
      this.escolha = 1
      return
    }
    this.scene.resume(this.voltarPara)
    this.scene.stop()
  }

  draw() {
    const g = this.gfx
    g.clear()
    const cx = VIEW.w / 2
    const lista = this.itens
    const alt = altura(this)
    const topo = Math.round((VIEW.h - alt) / 2)
    const x0 = cx - PAINEL.w / 2

    plate(g, x0, topo, PAINEL.w, alt, { corte: 14, alpha: 0.95, aceso: true })

    const titulo = this.modo === 'pausa' ? 'pausa' : 'opções'
    const meia = textWidth(titulo, 2) / 2
    drawText(g, titulo, cx, topo + 18, { scale: 2, color: COLOR.uiInk, alpha: 0.9, align: 'center' })
    rule(g, cx - meia - 12, topo + 24, 84, -1)
    rule(g, cx + meia + 12, topo + 24, 84, 1)

    const base = topo + PAINEL.topo
    lista.forEach((item, i) => {
      const y = base + i * UI.menuStep
      const alvo = i === this.escolha
      const perigo = alvo && this.confirmando && item.perigo
      const rotulo = perigo ? 'perder o progresso?' : item.rotulo
      const esq = item.valor ? x0 + 26 : cx - textWidth(rotulo, UI.menuScale) / 2

      drawText(g, rotulo, esq, y, {
        scale: UI.menuScale,
        color: perigo ? COLOR.crack : alvo ? COLOR.uiInk : COLOR.uiDim,
        alpha: alvo ? 1 : 0.75,
      })
      if (item.valor) {
        const v = item.valor(this)
        drawText(g, v, x0 + PAINEL.w - 26 - textWidth(v, UI.menuScale), y, {
          scale: UI.menuScale,
          color: alvo ? COLOR.uiAccent : COLOR.uiDim,
          alpha: alvo ? 1 : 0.7,
        })
      }
      if (perigo) {
        const larg = textWidth(rotulo, UI.menuScale)
        dashedRect(g, esq - 6, y - 5, larg + 12, UI.menuScale * 7 + 10, COLOR.crack, 0.9, this.t * UI.dashSpeed)
      }
    })

    // O que a partida acumulou. Estava gravado em disco desde a fase 5 e não
    // aparecia em lugar nenhum; a pausa é onde alguém olha.
    if (this.temStatus) {
      const s = Math.floor(run.timeMs / 1000)
      const relogio = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
      drawText(g, `almas ${run.souls}/${BOSS_ROOMS.length}   mortes ${run.deaths}   ${relogio}`, cx, topo + alt - 20, {
        color: COLOR.uiDim,
        alpha: 0.8,
        align: 'center',
      })
    }

    // Cursor: a flecha, encostada no item pela corda — o mesmo do título.
    const item = lista[this.escolha]
    const rotulo = this.confirmando && item.perigo ? 'perder o progresso?' : item.rotulo
    const y = base + this.escolha * UI.menuStep + UI.menuScale * 3
    const px =
      (item.valor ? x0 + 26 : cx - textWidth(rotulo, UI.menuScale) / 2) - UI.cursorGap + Math.sin(this.t * 4) * 1.5
    this.cursor.setPosition(Math.round(px), Math.round(y))
    g.lineStyle(1, COLOR.cord, 0.5)
    g.lineBetween(Math.round(px) - 20, Math.round(y), Math.round(px), Math.round(y))
    losango(g, x0 + PAINEL.w - 12, y, 3, COLOR.uiFrame, 0.5)

    hints(g, [
      ['w s', 'mover'],
      ['a d', 'mudar'],
      ['espaço', 'escolher'],
      ['esc', 'voltar'],
    ])
  }
}
