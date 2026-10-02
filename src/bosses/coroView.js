import { CORO as C, SINO as S, SINO_ART as ART, OUTRO, COLOR } from '../tuning.js'
import { mixColor } from '../draw.js'
import { ESCAPE, AIM, BEAM } from './coro.js'

/**
 * Desenho do Coro.
 *
 * Reaproveita os sete sinos que já enfeitavam a câmara: eles **são** o chefe
 * agora, então os mesmos sprites passam a se mexer. As correntes, que eram
 * cenário fixo, passam a ser desenhadas por quadro — elas acompanham o corpo
 * quando ele troca de lugar.
 *
 * Três coisas precisam se ler sem HUD: **de onde vem a onda** (o sino
 * chacoalhando antes de tocar), **qual deles carrega o coração** (o único que
 * se inclina) e **para onde o feixe vai sair** (a linha travada, visível
 * durante a inclinação inteira).
 */
export default {
  create(scene) {
    // A folha do sino caído serve de sino inclinado: os oito quadros são
    // guinadas de 45°, e a tabela do badalo já diz onde o coração aparece em
    // cada uma. Um sprite só — só um se inclina por vez.
    scene.coroTilt = scene.add.image(0, 0, 'bellDownStone').setScale(C.scale).setVisible(false)
  },

  draw(scene, c, time) {
    const g = scene.bossGfx
    const chao = scene.decalGfx

    drawWaves(chao, c, time)

    const acordado = c.awake
    c.bells.forEach((b, i) => {
      const spr = scene.deadBells?.[i]
      if (!spr) return
      const tremor = b.shake > 0 ? Math.round(Math.sin(time * 44) * C.ringShakePx) : 0
      const x = Math.round(b.x) + tremor
      const y = Math.round(b.y)
      const inclinando = i === c.heart && c.tilt > 0.01

      drawChain(g, x, y, acordado)
      g.fillStyle(COLOR.shadow, 0.28)
      g.fillEllipse(x, y + 6, 44 * C.scale * 5, 14 * C.scale * 5)

      spr.setVisible(true)
      spr.setPosition(x, y)
      spr.setDepth(b.y)
      spr.setAlpha(inclinando ? 1 - c.tilt : 1)
      // Acordando, a cor volta: eles eram pedra apagada até o coração entrar.
      spr.setTint(mixColor(COLOR.bellDead, ART.stone, acordado))

      // Prestes a tocar: a boca acende por baixo, que é o aviso da onda.
      if (b.ring > 0) {
        const p = 1 - b.ring / C.ringWarn
        g.fillStyle(COLOR.core, 0.1 + 0.3 * p)
        g.fillEllipse(x, y - 1, 60 * C.scale * (1 + p), 24 * C.scale * (1 + p))
      }
    })

    drawTilted(scene, c, time)
    drawBeam(scene, g, c, time)
    drawCore(scene, c, time)
  },

  hitboxes(g, c) {
    for (const w of c.waves) {
      g.lineStyle(1, 0xff4488, 0.8)
      g.strokeCircle(Math.round(w.x), Math.round(w.y), Math.max(1, Math.round(w.r)))
    }
    if (c.exposed) {
      const p = c.corePos()
      g.lineStyle(1, 0xffcc00, 0.9)
      g.strokeCircle(Math.round(p.x), Math.round(p.y), C.coreRadius)
    }
    if (c.beam) {
      g.lineStyle(1, 0xffffff, 0.5)
      for (let i = 1; i < c.beam.length; i++) {
        g.lineBetween(c.beam[i - 1].x, c.beam[i - 1].y, c.beam[i].x, c.beam[i].y)
      }
    }
  },

  status(c) {
    return `coro:${c.state}  badaladas:${c.ringsLeft}  ondas:${c.waves.length}  rodada:${c.round}`
  },
}

/** Corrente saindo de fora do quadro. Acompanha o corpo, que agora anda. */
function drawChain(g, x, y, acordado) {
  const topo = y - 44 * C.scale * 4
  g.lineStyle(2, COLOR.chain, 0.35 + 0.3 * acordado)
  g.lineBetween(x, S.chainAnchorY, x, topo)
  for (let i = 1; i < 6; i++) {
    const t = i / 6
    g.fillStyle(COLOR.bellDark, 0.5)
    g.fillRect(x - 2, Math.round(S.chainAnchorY + (topo - S.chainAnchorY) * t) - 1, 4, 3)
  }
}

/**
 * Onda de som. Só a frente mata, então é ela que é desenhada forte: o rastro
 * atrás é eco, e serve para a direção se ler de longe.
 */
function drawWaves(g, c, time) {
  for (const w of c.waves) {
    // Cheia enquanto mata, apagando depois: o que se vê é o que machuca.
    const f = w.r <= C.waveFade ? 1 : 1 - (w.r - C.waveFade) / (C.waveRange - C.waveFade)
    const x = Math.round(w.x)
    const y = Math.round(w.y)
    g.lineStyle(C.waveThick * f, COLOR.core, 0.16 * f)
    g.strokeEllipse(x, y, w.r * 2, w.r * 2)
    g.lineStyle(Math.max(1, 2 * f), COLOR.flameCore, 0.9 * f * f)
    g.strokeEllipse(x, y, w.r * 2, w.r * 2)
    // Dois ecos atrás da frente, mais fracos: dão o sentido do movimento.
    for (const atras of [26, 54]) {
      const r = w.r - atras
      if (r <= 0) continue
      g.lineStyle(1, COLOR.core, 0.22 * f * f)
      g.strokeEllipse(x, y, r * 2, r * 2)
    }
  }
}

/** O sino do coração, inclinado. A boca vira para onde o feixe vai sair. */
function drawTilted(scene, c, time) {
  const spr = scene.coroTilt
  if (!spr) return
  if (c.tilt <= 0.01) {
    spr.setVisible(false)
    return
  }
  const b = c.bells[c.heart]
  const frame = ART.fallenFrame[c.sector]
  const box = scene.bellDownBoxes[frame]
  spr.setVisible(true)
  spr.setFrame(frame)
  spr.setOrigin(box.ox, box.oy)
  spr.setPosition(Math.round(b.x), Math.round(b.y))
  spr.setDepth(b.y + 0.01)
  spr.setAlpha(c.tilt)
  spr.setTint(ART.stone)
}

/**
 * O feixe. Durante a inclinação ele aparece como linha travada — é o aviso, e
 * é o que torna a direção antiga uma promessa e não uma surpresa.
 */
function drawBeam(scene, g, c, time) {
  if (c.state === AIM) {
    const pontos = c.traceBeam(scene.grid)
    const p = Math.min(1, c.t / c.aimTime)
    const pulso = 0.4 + 0.4 * Math.abs(Math.sin(time * 9))
    g.lineStyle(1 + 2 * p, COLOR.core, (0.25 + 0.5 * p) * pulso)
    for (let i = 1; i < pontos.length; i++) {
      g.lineBetween(pontos[i - 1].x, pontos[i - 1].y, pontos[i].x, pontos[i].y)
    }
    return
  }
  if (c.state !== BEAM || !c.beam) return

  const f = 1 - Math.min(1, c.t / C.beamTime)
  const linha = (larg, cor, alpha) => {
    g.lineStyle(larg, cor, alpha)
    for (let i = 1; i < c.beam.length; i++) {
      g.lineBetween(c.beam[i - 1].x, c.beam[i - 1].y, c.beam[i].x, c.beam[i].y)
    }
  }
  linha(C.beamWidth * 2, COLOR.core, 0.25 * f)
  linha(C.beamWidth, COLOR.core, 0.9 * f)
  linha(Math.max(2, C.beamWidth / 3), COLOR.flameCore, f)
}

/**
 * O badalo. Enquanto foge é um ponto de luz atravessando a câmara; depois é o
 * alvo, na camada de cima para não sumir atrás do bronze.
 */
function drawCore(scene, c, time) {
  const top = scene.bossTopGfx
  const fugindo = c.state === ESCAPE
  if (!fugindo && !c.exposed && !c.dead) return

  const p = fugindo ? c.escapePos() : c.corePos()
  const st = scene.outro.stage
  const vivo = c.dead ? (st === 'soul' ? 1 - Math.min(1, scene.outro.t / OUTRO.soulTime) : st ? 1 : 0) : 1
  // Saindo da boca ele cresce: fechado, mal se vê.
  const forca = fugindo ? 1 : Math.min(1, c.tilt * 1.6)
  const x = Math.round(p.x)
  const y = Math.round(p.y)

  top.setDepth(c.y + 0.02)
  if (vivo > 0.02) {
    const pulso = 0.75 + 0.25 * Math.sin(time * 5)
    top.fillStyle(COLOR.core, 0.2 * vivo * pulso * forca)
    top.fillCircle(x, y, C.coreRadius * 3.4)
    top.fillStyle(COLOR.core, 0.38 * vivo * pulso * forca)
    top.fillCircle(x, y, C.coreRadius * 1.9)
  }
  top.fillStyle(mixColor(COLOR.coreDead, COLOR.core, vivo), forca)
  top.fillCircle(x, y, C.coreRadius * 0.85)
}
