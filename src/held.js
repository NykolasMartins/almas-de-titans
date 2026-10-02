/**
 * O que está fisicamente apertado agora, do lado do navegador.
 *
 * O Phaser cria objetos de tecla novos a cada `scene.restart`, e eles nascem
 * soltos: atravessar uma porta com a tecla apertada parava o jogador seco do
 * outro lado. O estado do teclado não reinicia junto com a cena — este módulo é
 * onde ele mora.
 *
 * O mouse não precisa disto: o ponteiro do Phaser é global e sobrevive à troca
 * de cena com os botões corretos em `pointer.buttons`.
 */
const apertadas = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => apertadas.add(e.keyCode))
  window.addEventListener('keyup', (e) => apertadas.delete(e.keyCode))
  // Sair da aba solta tudo: sem isso a tecla fica presa até o próximo keyup, que
  // nunca chega porque aconteceu fora da janela.
  window.addEventListener('blur', () => apertadas.clear())
}

/** Reaplica o estado real do teclado num conjunto de teclas recém-criadas. */
export function restoreKeys(keys) {
  for (const k of Object.values(keys)) {
    // Só `isDown`: `JustDown` lê outro campo, então nenhuma ação de apertar
    // dispara sozinha ao entrar na sala.
    if (apertadas.has(k.keyCode)) k.isDown = true
  }
}
