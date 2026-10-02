import Phaser from 'phaser'
import { VIEW, COLOR } from './tuning.js'
import { isFight } from './fights.js'
import World from './scenes/World.js'
import Titulo from './scenes/Titulo.js'
import Slots from './scenes/Slots.js'
import Pausa from './scenes/Pausa.js'
import * as audio from './audio.js'

// Escala inteira à mão: qualquer fator quebrado deixa pixel de tamanho desigual.
const integerZoom = () =>
  Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW.w, window.innerHeight / VIEW.h)))

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: VIEW.w,
  height: VIEW.h,
  pixelArt: true,
  roundPixels: true, // v4 nasce com false; sem isso o sprite treme em sub-pixel
  backgroundColor: COLOR.bg,
  // **Quem centraliza é o CSS** (`place-items: center` no `index.html`), e só
  // ele. Com `autoCenter` ligado aqui também, o Phaser punha margem no canvas e
  // o grid centralizava o canvas **mais a margem**: o jogo ia parar à direita e
  // embaixo, e quanto maior a tela, mais torto — no painel pequeno de teste a
  // margem era quase zero e o defeito não aparecia.
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: integerZoom(),
  },
  input: { gamepad: true },
  // O Phaser abre a primeira da lista. Endereço de luta entra direto no chefe;
  // qualquer outro abre o título.
  // `Pausa` é sempre a última: ela é lançada por cima de quem chamou, e a ordem
  // da lista é a ordem de desenho.
  scene: isFight(typeof location === 'undefined' ? '' : location.pathname)
    ? [World, Titulo, Slots, Pausa]
    : [Titulo, Slots, World, Pausa],
})

window.addEventListener('resize', () => game.scale.setZoom(integerZoom()))

// O navegador só concede áudio depois de um gesto do jogador. A espera pelo
// primeiro toque mora aqui, e não numa cena: endereço direto de luta não passa
// pelo título, e o jogo ficava mudo a partida inteira.
audio.ouvirPrimeiroGesto()

// Só no dev server: dá para inspecionar o estado pelo console do navegador.
// O áudio entra junto porque `import()` no console devolve **outra instância**
// do módulo — o contexto que o jogo abriu não aparece nela, e a conferência
// mediria silêncio de um módulo que ninguém usa.
if (import.meta.env.DEV) {
  window.game = game
  window.audio = audio
}
