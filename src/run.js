import { ROOM_INICIAL, BOSS_ROOMS } from './data/rooms.js'

/**
 * A partida em andamento, e como ela é guardada.
 *
 * O jogo troca de sala reiniciando a cena, então nada que precise sobreviver à
 * troca pode morar nela. É o que este módulo é: almas ganhas, mortes, tempo e
 * onde o jogador está.
 *
 * Guardar é explícito — só no obelisco, como manda a seção 8 do DESIGN. Morrer
 * não guarda, e é isso que faz o obelisco valer alguma coisa.
 */
const CHAVE = 'almas-de-titans'
const SLOTS = 4

const vazio = () => ({ bosses: [], deaths: 0, timeMs: 0, room: ROOM_INICIAL })

/** Os quatro vínculos como estão no disco. Slot sem save vira `null`. */
export function loadSlots() {
  let bruto = null
  try {
    bruto = JSON.parse(localStorage.getItem(CHAVE) || 'null')
  } catch {
    bruto = null // storage bloqueado ou lixo dentro: começa limpo
  }
  const lista = Array.isArray(bruto) ? bruto : []
  return Array.from({ length: SLOTS }, (_, i) => normaliza(lista[i]))
}

function normaliza(s) {
  if (!s || typeof s !== 'object') return null
  const bosses = Array.isArray(s.bosses) ? s.bosses.filter((b) => BOSS_ROOMS.includes(b)) : []
  return {
    bosses,
    deaths: Number(s.deaths) || 0,
    timeMs: Number(s.timeMs) || 0,
    room: typeof s.room === 'string' ? s.room : ROOM_INICIAL,
  }
}

function grava(lista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
    return true
  } catch {
    return false // aba privada, cota estourada: o jogo continua, só não guarda
  }
}

/** Apaga um vínculo. */
export function eraseSlot(i) {
  const lista = loadSlots()
  lista[i] = null
  grava(lista)
}

/**
 * A partida viva. Fica em módulo porque a cena reinicia a cada sala, e o que o
 * jogador conquistou não pode reiniciar junto.
 */
export const run = {
  slot: null, // null = partida solta, de endereço direto de luta; não guarda
  bosses: [],
  deaths: 0,
  timeMs: 0,
  room: ROOM_INICIAL,
  entrandoPor: null, // por qual lado o jogador entrou na sala atual
  entrandoEm: 0, // desvio lateral na porta, para a travessia não puxar de lado
  // Onde a partida recomeça quando o jogador é derrotado: o último obelisco em
  // que ele guardou. Morrer não devolve à sala da morte.
  checkpoint: ROOM_INICIAL,

  /** Começa (ou continua) a partida de um vínculo. */
  start(slot) {
    const s = loadSlots()[slot] ?? vazio()
    this.slot = slot
    this.bosses = [...s.bosses]
    this.deaths = s.deaths
    this.timeMs = s.timeMs
    this.room = s.room
    this.entrandoPor = null
    this.entrandoEm = 0
    this.checkpoint = s.room
  },

  /** Partida solta, para os endereços diretos de luta. Não guarda nada. */
  scratch(room) {
    this.slot = null
    this.bosses = []
    this.deaths = 0
    this.timeMs = 0
    this.room = room
    this.entrandoPor = null
    this.entrandoEm = 0
    // Partida solta não tem obelisco: morrer devolve à própria sala da luta.
    this.checkpoint = room
  },

  get souls() {
    return this.bosses.length
  },

  killed(bossId) {
    return this.bosses.includes(bossId)
  },

  /** Um titã a menos. Não guarda em disco: isso é trabalho do obelisco. */
  addSoul(bossId) {
    if (bossId && !this.bosses.includes(bossId)) this.bosses.push(bossId)
  },

  /**
   * Guarda **só a estatística**: mortes e tempo. É o que a morte grava.
   *
   * Contagem de morte que some ao fechar a aba não conta nada — e ela é o placar
   * do jogo. Progresso (almas e sala) continua sendo coisa de obelisco: gravar
   * isso aqui transformaria cada morte num checkpoint de graça e apagaria a
   * única aposta que o jogo pede.
   *
   * Vínculo que ainda não foi guardado nenhuma vez nasce aqui com o que tinha ao
   * começar — nenhuma alma, e a sala do checkpoint.
   */
  saveDeaths() {
    if (this.slot === null) return false
    const lista = loadSlots()
    const antes = lista[this.slot] ?? { bosses: [], deaths: 0, timeMs: 0, room: this.checkpoint }
    lista[this.slot] = { ...antes, deaths: this.deaths, timeMs: this.timeMs }
    return grava(lista)
  },

  /** Guarda no vínculo. Devolve false se não havia onde guardar. */
  save() {
    if (this.slot === null) return false
    const lista = loadSlots()
    lista[this.slot] = {
      bosses: [...this.bosses],
      deaths: this.deaths,
      timeMs: this.timeMs,
      room: this.room,
    }
    this.checkpoint = this.room
    return grava(lista)
  },
}
