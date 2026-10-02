import { VIEW, COLOR, UI } from '../tuning.js'
import { drawText, textWidth } from './font.js'
import { paintFloor, paintWalls } from '../terrain.js'

/**
 * Moldura comum dos menus: fundo, réguas, placas e dicas de botão.
 *
 * A gramática vem das referências (`screenshots/tela*`): o mundo do jogo fica
 * atrás, escuro e sem foco; o texto é caixa alta pixelada; réguas finas com
 * losango nas pontas separam as seções; e as dicas de botão vivem no canto
 * inferior esquerdo.
 *
 * O que é nosso e não delas: a lavra é de **placas e elos**, não de vinha, e o
 * cursor é a **flecha**, encostada no item escolhido pela corda.
 */

/**
 * Sala de verdade ao fundo, escurecida. Pintada uma vez num `Graphics` — é o
 * mesmo `terrain.js` do jogo, então o menu mostra o mundo em vez de um papel de
 * parede que não existe em lugar nenhum.
 */
export function paintBackdrop(g, room, theme) {
  paintFloor(g, room, theme)
  paintWalls(g, room.grid, theme)
}

/** Escurecimento e vinheta por cima do fundo. Aqui ela cabe: não há lava na borda. */
export function paintVeil(g) {
  g.fillStyle(COLOR.bg, UI.veil)
  g.fillRect(0, 0, VIEW.w, VIEW.h)
  // Faixas encostadas: a espessura do traço é o próprio passo, senão sobra vão
  // entre uma e outra e a vinheta lê como degrau em vez de queda.
  const n = UI.vignetteSteps
  const passo = UI.vignetteDepth / n
  for (let i = 0; i < n; i++) {
    const t = i / n
    const m = t * UI.vignetteDepth + passo / 2
    g.lineStyle(passo + 1, COLOR.bg, UI.vignetteMax * Math.pow(1 - t, UI.vignetteCurve))
    g.strokeRect(m, m, VIEW.w - m * 2, VIEW.h - m * 2)
  }
}

/**
 * Régua ornamental: linha fina com um losango na ponta de fora. Duas delas
 * ladeando um título é a assinatura da tela de seleção da referência.
 */
export function rule(g, x, y, larg, dir, cor = COLOR.uiFrame, alpha = 0.7) {
  const fim = x + larg * dir
  g.lineStyle(1, cor, alpha)
  g.lineBetween(x, y, fim, y)
  losango(g, fim, y, 5, cor, alpha)
  losango(g, x, y, 2, cor, alpha * 0.8)
}

/** Losango cheio, o remate de tudo nesta interface. */
export function losango(g, x, y, r, cor = COLOR.uiFrame, alpha = 1) {
  g.fillStyle(cor, alpha)
  g.fillPoints(
    [
      { x, y: y - r },
      { x: x + r, y },
      { x, y: y + r },
      { x: x - r, y },
    ],
    true,
  )
}

/**
 * Placa chanfrada, para botões. As pontas cortadas em diagonal são o que separa
 * a nossa interface de uma caixa de HTML.
 */
export function plate(g, x, y, w, h, opts = {}) {
  const { corte = 8, fundo = COLOR.uiPlate, borda = COLOR.uiFrame, alpha = 1, aceso = false } = opts
  const pts = [
    { x: x + corte, y },
    { x: x + w - corte, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w - corte, y: y + h },
    { x: x + corte, y: y + h },
    { x, y: y + h / 2 },
  ]
  g.fillStyle(fundo, alpha * (aceso ? 0.9 : 0.55))
  g.fillPoints(pts, true)
  g.lineStyle(1, borda, alpha * (aceso ? 1 : 0.5))
  g.strokePoints(pts, true, true)
}

/**
 * Lavra lateral de um painel: elos empilhados, com um losango no meio. É a
 * versão nossa da faixa entalhada da referência — lá é vinha, aqui é corrente,
 * que é o que o jogo tem.
 */
/**
 * Moldura tracejada, com o risco correndo em volta. Serve para marcar o alvo de
 * uma ação que não tem volta — é o que separa "escolhido" de "prestes a sumir".
 *
 * `desloca` anda com o relógio da tela: parada, uma moldura tracejada lê como
 * enfeite; correndo, lê como aviso.
 */
export function dashedRect(g, x, y, w, h, cor, alpha, desloca = 0, risco = 5, vao = 4) {
  const passo = risco + vao
  const volta = 2 * (w + h)
  g.lineStyle(1, cor, alpha)
  // Um ponto do perímetro, no sentido horário a partir do canto de cima.
  const em = (d) => {
    const p = ((d % volta) + volta) % volta
    if (p < w) return { x: x + p, y }
    if (p < w + h) return { x: x + w, y: y + (p - w) }
    if (p < w + h + w) return { x: x + w - (p - w - h), y: y + h }
    return { x, y: y + h - (p - w - h - w) }
  }
  for (let d = desloca % passo; d < volta; d += passo) {
    const a = em(d)
    const b = em(Math.min(d + risco, volta))
    // Um traço não vira a esquina: partir no canto sai mais barato que curvar.
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) continue
    g.lineBetween(Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y))
  }
}

export function bracket(g, x, y, h, cor = COLOR.uiFrame, alpha = 0.6) {
  const passo = 7
  g.lineStyle(1, cor, alpha)
  g.strokeRect(x, y, 9, h)
  for (let i = y + 3; i < y + h - 3; i += passo) {
    g.lineBetween(x + 1, i, x + 8, i)
  }
  losango(g, x + 4.5, y + h / 2, 4, cor, alpha)
}

/**
 * Ícone de um chefe vencido, 9x9. São as almas que o jogador carrega, e cada
 * uma tem a silhueta do titã de onde veio.
 */
export function bossToken(g, tipo, x, y, cor, alpha) {
  g.fillStyle(cor, alpha)
  if (tipo === 'piramide') {
    g.fillPoints(
      [
        { x, y: y - 4 },
        { x: x + 4, y: y + 4 },
        { x: x - 4, y: y + 4 },
      ],
      true,
    )
  } else if (tipo === 'sino') {
    g.fillRect(x - 1, y - 5, 2, 2)
    g.fillPoints(
      [
        { x: x - 2, y: y - 3 },
        { x: x + 2, y: y - 3 },
        { x: x + 4, y: y + 3 },
        { x: x - 4, y: y + 3 },
      ],
      true,
    )
    g.fillRect(x - 4, y + 3, 9, 1)
  } else if (tipo === 'crisol') {
    // Crisol: tigela de boca larga, inclinada.
    g.fillPoints(
      [
        { x: x - 5, y: y - 3 },
        { x: x + 5, y: y - 3 },
        { x: x + 3, y: y + 4 },
        { x: x - 3, y: y + 4 },
      ],
      true,
    )
    g.fillStyle(COLOR.bg, alpha)
    g.fillRect(x - 4, y - 3, 9, 2)
  } else {
    // Sentinela: disco com a face reta virada para a frente.
    g.fillCircle(x, y, 4)
    g.fillStyle(COLOR.bg, alpha)
    g.fillRect(x - 4, y - 4, 9, 3)
  }
}

/** Dicas de botão, canto inferior esquerdo, como nas referências. */
export function hints(g, itens) {
  let y = VIEW.h - UI.hintBottom - (itens.length - 1) * UI.hintStep
  for (const [tecla, acao] of itens) {
    const w = textWidth(tecla, 1) + 6
    plate(g, UI.hintLeft, y - 2, w, 11, { corte: 3, alpha: 0.9, aceso: true })
    drawText(g, tecla, UI.hintLeft + 3, y, { color: COLOR.uiInk, alpha: 0.95 })
    drawText(g, acao, UI.hintLeft + w + 6, y, { color: COLOR.uiInk, alpha: 0.6 })
    y += UI.hintStep
  }
}
