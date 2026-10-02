/**
 * As opções do jogador.
 *
 * Não é estado de partida: não pertence a um vínculo, não se perde ao morrer e
 * não some ao trocar de sala. Por isso mora fora de `run.js` e num endereço
 * próprio no disco — apagar um vínculo não pode desligar o tremor de ninguém.
 *
 * **Toda opção daqui faz alguma coisa hoje.** Item de menu que não muda nada foi
 * exatamente o que esta tela veio consertar — foi por isso que volume só entrou
 * junto com o som, e não antes dele.
 *
 * Tela cheia não está aqui de propósito: o navegador só concede em cima de um
 * gesto do jogador, então guardar a intenção daria uma opção que mente ao abrir
 * o jogo. Ela é lida do próprio `scale.isFullscreen` na hora de desenhar.
 */
const CHAVE = 'almas-de-titans:opcoes'

/**
 * Os degraus do tremor de câmera. A luta inteira sacode — grito, jorro, tombo,
 * flecha na muralha —, e para quem passa mal com isso o jogo fica injogável sem
 * um degrau intermediário.
 */
export const TREMOR = [
  { rotulo: 'cheio', valor: 1 },
  { rotulo: 'metade', valor: 0.5 },
  { rotulo: 'desligado', valor: 0 },
]

const padrao = () => ({ tremor: 0, contornos: false, volume: 0.7 })

function ler() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || 'null')
    if (!bruto || typeof bruto !== 'object') return {}
    return {
      tremor: Math.min(TREMOR.length - 1, Math.max(0, Number(bruto.tremor) || 0)),
      contornos: Boolean(bruto.contornos),
      volume: Math.min(1, Math.max(0, Number(bruto.volume ?? 0.7))),
    }
  } catch {
    return {} // storage bloqueado ou lixo dentro: vale o padrão
  }
}

export const opcoes = { ...padrao(), ...ler() }

/** Grava. Aba privada ou cota estourada não derruba o jogo: só não guarda. */
export function saveOptions() {
  try {
    localStorage.setItem(
      CHAVE,
      JSON.stringify({ tremor: opcoes.tremor, contornos: opcoes.contornos, volume: opcoes.volume }),
    )
    return true
  } catch {
    return false
  }
}

/** Passo do volume no menu: dez degraus é o que cabe numa linha de texto. */
export const VOLUME_PASSO = 0.1

/** O multiplicador de tremor escolhido. Todo `shake` do jogo passa por aqui. */
export function tremor() {
  return TREMOR[opcoes.tremor]?.valor ?? 1
}
