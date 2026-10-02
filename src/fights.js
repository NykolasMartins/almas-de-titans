import Monolito from './bosses/monolito.js'
import Sino from './bosses/sino.js'
import Sentinela from './bosses/sentinela.js'
import Crisol from './bosses/crisol.js'
import monolitoView from './bosses/monolitoView.js'
import sinoView from './bosses/sinoView.js'
import sentinelaView from './bosses/sentinelaView.js'
import crisolView from './bosses/crisolView.js'
import { ROOMS } from './data/rooms.js'

/**
 * Registro dos chefes: máquina de estados e view, por id. A sala não vem daqui —
 * ela vem do grafo em `data/rooms.js`, e é a sala que diz qual chefe vive nela.
 *
 * Os endereços diretos continuam existindo para cair num chefe sem atravessar o
 * mundo: `/piramide`, `/crisol`, `/sino`, `/sentinela`. Eles abrem uma partida solta, que
 * não guarda nada.
 */
export const FIGHTS = {
  piramide: { Boss: Monolito, view: monolitoView },
  sino: { Boss: Sino, view: sinoView },
  sentinela: { Boss: Sentinela, view: sentinelaView },
  crisol: { Boss: Crisol, view: crisolView },
}

const slugDe = (path) =>
  String(path || '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()

/** O chefe que vive numa sala. Sala de passagem devolve o chefe vazio. */
export function fightOf(room, jaMorto = false) {
  return room.boss && !jaMorto ? FIGHTS[room.boss] : SEM_CHEFE
}

/**
 * O endereço aponta para uma luta? `/` e qualquer outro caminho abrem o título —
 * é o caminho normal do jogo.
 */
export function isFight(path) {
  const slug = slugDe(path)
  return Boolean(FIGHTS[slug] && ROOMS[slug])
}

/** A sala de um endereço de luta. */
export function roomFrom(path) {
  return slugDe(path)
}

/**
 * Sala sem chefe. Um objeto que responde a tudo e não faz nada sai muito mais
 * barato que um `if (this.boss)` espalhado pela cena — e é o que a regra 5 do
 * CLAUDE.md pede: `World.js` não ganha ramo por chefe.
 */
export const SEM_CHEFE = {
  Boss: class {
    constructor() {
      this.x = -9999
      this.y = -9999
      this.dead = true
      this.radius = 0
    }
    reset() {}
    update() {}
    hitTest() {
      return null
    }
    onArrowHit() {}
  },
  view: {
    preload() {},
    create() {},
    draw() {},
    hitboxes() {},
    status() {
      return 'sala vazia'
    },
  },
}
