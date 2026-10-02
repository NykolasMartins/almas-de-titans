import Phaser from 'phaser'
// Importados como módulo para o Vite empacotar no build; `assets/` não é publicDir.
import pyramidUrl from '../../assets/piramide.png'
import heartUrl from '../../assets/coracao.png'
import frag1Url from '../../assets/fragmentos_piramide/1.png'
import frag2Url from '../../assets/fragmentos_piramide/2.png'
import frag3Url from '../../assets/fragmentos_piramide/3.png'
import frag4Url from '../../assets/fragmentos_piramide/4.png'
import { MONOLITO, MONOLITO_ART as ART, OUTRO, FX, COLOR, TUNING } from '../tuning.js'
import { DEPTH, mixColor } from '../draw.js'
import { PHASE } from './monolito.js'

/**
 * Tudo que é desenho do Monólito. A cena cuida do jogador, da flecha e da
 * câmera; daqui para baixo é só a pirâmide, o coração, os gêiseres, os jatos e
 * os cacos. Cada chefe tem uma view assim, e é o que impede a cena de crescer
 * um chefe por vez.
 */
export default {
  preload(scene) {
    scene.load.image('pyramidRaw', pyramidUrl)
    scene.load.spritesheet('heart', heartUrl, { frameWidth: ART.cell, frameHeight: ART.cell })
    ;[frag1Url, frag2Url, frag3Url, frag4Url].forEach((u, i) => scene.load.image(`frag${i}`, u))
  },

  create(scene) {
    makePyramidTextures(scene)
    // Corpo da pirâmide, uma camada por rachadura, e o coração.
    const pyramid = (key) => scene.add.image(0, 0, key).setScale(ART.pyramidScale).setVisible(false)
    scene.pyramidBody = pyramid('pyramidBody')
    scene.pyramidCracks = ART.markers.map((_, i) => pyramid(`pyramidCrack${i}`))
    // Cópia maior e aditiva das mesmas máscaras: é o brilho das rachaduras quentes.
    scene.crackGlow = ART.markers.map((_, i) =>
      pyramid(`pyramidCrack${i}`).setBlendMode(Phaser.BlendModes.ADD).setScale(ART.pyramidScale * FX.bloomCrackSpread),
    )
    // A mesma pirâmide em pedra adormecida, cruzada por cima da acordada.
    scene.pyramidSleep = pyramid('pyramidSleep')
    scene.heartSprite = scene.add.image(0, 0, 'heart').setScale(ART.heartScale).setVisible(false)
    scene.heartGlow = scene.add
      .image(0, 0, 'heart')
      .setScale(ART.heartScale * FX.bloomHeartSpread)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false)
    scene.debrisSprites = [] // pilha reaproveitada: o número de cacos varia muito
  },

  draw: drawBoss,
  hitboxes: drawHitboxes,

  status(b) {
    return `fase:${b.phase}/${b.state}  rachaduras:${b.cracks}/${MONOLITO.crackSlams}  calor:${Math.round(b.heat * 100)}%  cacos:${b.debris.length}`
  },
}

/** Placeholders do chefe e da arena. A arte entra trocando isto por sprites. */
function drawBoss(scene, b, time) {
  const M = MONOLITO
  const { rise, roar } = scene.wake
  // Todas as rachaduras acesas de uma vez: é o grito de abertura, não dano. Elas
  // voltam ao que eram quando o grito passa.
  const cracks = roar > 0 ? ART.markers.length : b.cracks
  const calor = Math.max(b.heat, roar)

  for (const gy of b.geysers) drawVent(scene, scene.decalGfx, gy, b.geyserState(gy), time)

  for (const j of b.jets) drawJet(scene, scene.airGfx, j, time)

  // Colunas de lava: acima do chão, então saem na camada aérea, depois dos jatos.
  for (const gy of b.geysers) {
    if (b.geyserState(gy) === 'erupt') drawPlume(scene, scene.airGfx, gy, time)
  }
  // Cacos como sprites, de uma pilha reaproveitada.
  b.debris.forEach((d, i) => {
    let spr = scene.debrisSprites[i]
    if (!spr) {
      spr = scene.add.image(0, 0, 'frag0')
      scene.debrisSprites[i] = spr
    }
    const parado = d.landed && !d.pulled
    const corta = !parado && d.age >= M.debrisArmTime
    spr.setVisible(true)
    // Apagado enquanto não machuca: entulho e caco recém-lançado são pedra fria.
    spr.setTint(corta ? 0xffffff : MONOLITO.debrisInertTint)
    spr.setTexture(`frag${d.art}`)
    spr.setPosition(Math.round(d.x), Math.round(d.y))
    spr.setRotation(d.rot)
    spr.setScale(d.size * M.debrisArtScale)
    // Parado é entulho no chão, e some sob quem passa; voando fica por cima.
    spr.setDepth(parado ? DEPTH.decal + 0.1 : DEPTH.air)
  })
  for (let i = b.debris.length; i < scene.debrisSprites.length; i++) {
    scene.debrisSprites[i].setVisible(false)
  }

  scene.bossGfx.setDepth(b.y)

  // 8 quadros de rotação a `spinFps`: uma volta por segundo. Adormecida ela não
  // gira — o giro é o primeiro sinal de que a pedra está viva.
  const frame = rise < 1 ? 0 : Math.floor(time * MONOLITO.spinFps) % ART.frames
  const mostraPiramide = !b.dead && b.phase !== PHASE.CORE
  scene.pyramidBody.setVisible(mostraPiramide)
  scene.pyramidCracks.forEach((c, i) => c.setVisible(mostraPiramide && i < cracks))
  scene.crackGlow.forEach((c, i) => c.setVisible(mostraPiramide && i < cracks && calor > 0.02))
  scene.pyramidSleep.setVisible(mostraPiramide && rise < 1)
  scene.heartSprite.setVisible(b.dead || b.phase === PHASE.CORE)
  scene.heartGlow.setVisible(!b.dead && b.phase === PHASE.CORE)

  // O coração fica na arena depois da luta, apagando conforme a alma sai.
  if (scene.heartSprite.visible) {
    const st = scene.outro.stage
    const vivo = b.dead ? (st === 'soul' ? 1 - Math.min(1, scene.outro.t / OUTRO.soulTime) : st ? 1 : 0) : 1
    scene.heartSprite.setPosition(Math.round(b.x), Math.round(b.y)).setDepth(b.y).setFrame(frame)
    scene.heartSprite.setTint(mixColor(COLOR.coreDead, 0xffffff, vivo))
  }
  if (scene.heartGlow.visible) {
    // O núcleo é o único ponto saturado do jogo: ele pulsa e sangra luz.
    const pulso = 0.75 + 0.25 * Math.sin((time) * 5)
    scene.heartGlow.setPosition(Math.round(b.x), Math.round(b.y)).setDepth(b.y - 0.01).setFrame(frame)
    scene.heartGlow.setTint(COLOR.core).setAlpha(FX.bloomHeart * pulso)
  }
  if (b.dead) return

  // No ar ela é desenhada erguida, com a sombra marcando onde vai cair. Dormindo
  // ela está pousada: a subida é o próprio despertar.
  const lifted = (b.grounded ? 0 : 26) * rise
  scene.bossGfx.fillStyle(COLOR.shadow, 0.45)
  // Pelo raio atual, não pelo da carapaça: na fase do núcleo a pirâmide deixava
  // a sombra dela inteira debaixo de um coração de raio 7.
  scene.bossGfx.fillEllipse(Math.round(b.x), Math.round(b.y), b.radius * 1.9, b.radius * 0.6)
  if (b.state === 'telegraph') {
    scene.bossGfx.lineStyle(1, COLOR.core, 0.8)
    scene.bossGfx.strokeCircle(Math.round(b.lockX), Math.round(b.lockY), M.bodyRadius)
  }

  if (!mostraPiramide) return
  // Todas as rachaduras na mesma cor, esquentando junto até virar lava.
  const cor = mixColor(COLOR.crack, COLOR.heat, calor)
  const px = Math.round(b.x)
  // Afunda um pouco além do ponto de colisão: alinhada exatamente nele, a base
  // ficava acima da sombra e ela lia como se ainda estivesse flutuando.
  const py = Math.round(b.y) + ART.groundSink - lifted
  const o = scene.pyramidOrigins[frame]
  scene.pyramidBody.setPosition(px, py).setDepth(b.y).setFrame(frame).setOrigin(o.x, o.y)
  if (scene.pyramidSleep.visible) {
    scene.pyramidSleep.setPosition(px, py).setDepth(b.y + 0.001).setFrame(frame).setOrigin(o.x, o.y)
    scene.pyramidSleep.setAlpha(1 - rise)
  }
  scene.pyramidCracks.forEach((c, i) => {
    if (i >= cracks) return
    c.setPosition(px, py).setDepth(b.y + 0.01 * (i + 1)).setFrame(frame).setOrigin(o.x, o.y).setTint(cor)
  })
  // O brilho segue o calor: frio não acende, quente sangra luz para fora.
  scene.crackGlow.forEach((c, i) => {
    if (i >= cracks || !c.visible) return
    c.setPosition(px, py).setDepth(b.y + 0.005).setFrame(frame).setOrigin(o.x, o.y).setTint(COLOR.heat)
    c.setAlpha(FX.bloomCrack * calor)
  })
}

/**
 * Boca do tubo no chão. Apagada é cratera de pedra; avisando, o fundo acende e
 * solta fagulhas; irrompendo, vira poça brilhante na base da coluna.
 */
function drawVent(scene, g, gy, estado, time) {
  const M = MONOLITO
  const R = M.geyserRadius
  const x = Math.round(gy.x)
  const y = Math.round(gy.y)

  g.fillStyle(scene.theme.wallTrim, 1)
  g.fillEllipse(x, y, R * 2.3, R * 1.5)
  g.fillStyle(scene.theme.floorCrack, 1)
  g.fillEllipse(x, y, R * 1.7, R * 1.05)

  if (estado === 'dormant') {
    g.fillStyle(COLOR.geyserDormant, 0.8)
    g.fillEllipse(x, y, R * 1.1, R * 0.65)
    return
  }

  const pulso = 0.5 + 0.5 * Math.sin(time * M.geyserWaveSpeed * 0.5)
  if (estado === 'warn') {
    // Fundo aquecendo e fagulhas curtas: é o aviso, e ele precisa se ler de longe.
    g.fillStyle(COLOR.geyserWarn, 0.55 + 0.35 * pulso)
    g.fillEllipse(x, y, R * 1.2, R * 0.7)
    for (let i = 0; i < 3; i++) {
      const f = time * M.geyserWaveSpeed + i * 2.1
      g.fillStyle(COLOR.geyserErupt, 0.5 + 0.4 * Math.sin(f))
      g.fillRect(x + Math.round(Math.sin(f) * R * 0.6) - 1, y - 4 - Math.round(((f * 9) % 14)), 2, 2)
    }
    return
  }

  // Irrompendo: poça clara na boca, com halo derramando na pedra.
  g.fillStyle(scene.theme.lavaGlow, 0.18 + 0.08 * pulso)
  g.fillEllipse(x, y, R * 3.4, R * 2.1)
  g.fillStyle(COLOR.geyserErupt, 1)
  g.fillEllipse(x, y, R * 1.7, R * 1.05)
  g.fillStyle(scene.theme.lavaOuterHot, 0.85)
  g.fillEllipse(x, y - 1, R * 0.9, R * 0.55)
}

/**
 * Jato de parede: a mesma linguagem da coluna do gêiser, sem boca — ele
 * irrompe da pedra. Afina e ondula da saída para a ponta, mas o desenho nunca
 * fica mais estreito que a faixa letal, então nada mata fora do que se vê.
 */
function drawJet(scene, g, j, time) {
  const M = MONOLITO
  const t = TUNING.tileSize
  const W = scene.room.width
  const H = scene.room.height
  const ativo = j.t >= M.jetWarn
  const fase = time * M.geyserWaveSpeed * 0.8 + j.pos * 0.04

  // Eixo do jato: de onde sai e para onde vai.
  const vertical = j.side === 'top'
  const ini = vertical ? t : j.side === 'left' ? t : W - t
  const fim = vertical ? H - t : j.side === 'left' ? W - t : t

  if (!ativo) {
    // Aviso: fio fino pulsando, com fagulhas correndo no sentido do jato.
    const a = 0.45 + 0.35 * Math.sin(time * M.geyserWaveSpeed)
    g.fillStyle(COLOR.jetWarn, a)
    if (vertical) g.fillRect(Math.round(j.pos) - 1, ini, 2, fim - ini)
    else g.fillRect(Math.min(ini, fim), Math.round(j.pos) - 1, Math.abs(fim - ini), 2)
    for (let i = 0; i < 4; i++) {
      const p = ((time * 220 + i * 90) % Math.abs(fim - ini)) * Math.sign(fim - ini) + ini
      g.fillStyle(COLOR.geyserErupt, 0.7)
      if (vertical) g.fillRect(Math.round(j.pos) - 1, Math.round(p), 2, 3)
      else g.fillRect(Math.round(p), Math.round(j.pos) - 1, 3, 2)
    }
    return
  }

  // Halo ao longo do jato inteiro, por baixo das fatias.
  for (let i = 0; i < M.jetSegments; i++) {
    const f = i / (M.jetSegments - 1)
    const larg = M.jetWidth * (M.jetWideAtSource + (M.jetWideAtTip - M.jetWideAtSource) * f) + 14 * (1 - f * 0.6)
    const ao = ini + (fim - ini) * f
    const passo = Math.abs(fim - ini) / M.jetSegments + 2
    g.fillStyle(scene.theme.lavaGlow, FX.bloomPlume * (1 - f * 0.5))
    if (vertical) g.fillRect(Math.round(j.pos - larg / 2), Math.round(ao), Math.round(larg), passo)
    else g.fillRect(Math.round(ao), Math.round(j.pos - larg / 2), passo, Math.round(larg))
  }

  for (let i = 0; i < M.jetSegments; i++) {
    const f = i / (M.jetSegments - 1)
    const larg = M.jetWidth * (M.jetWideAtSource + (M.jetWideAtTip - M.jetWideAtSource) * f) * (1 + 0.1 * Math.sin(fase + f * 6))
    const desvio = Math.sin(fase * 1.1 + f * 5) * M.jetWobble * f
    const ao = ini + (fim - ini) * f
    const passo = Math.abs(fim - ini) / M.jetSegments + 2
    const cor = f < 0.25 ? scene.theme.lavaOuterHot : f < 0.65 ? COLOR.geyserErupt : COLOR.flameEdge
    g.fillStyle(cor, 0.95 - 0.25 * f)
    if (vertical) g.fillRect(Math.round(j.pos + desvio - larg / 2), Math.round(ao), Math.round(larg), passo)
    else g.fillRect(Math.round(ao), Math.round(j.pos + desvio - larg / 2), passo, Math.round(larg))
  }
  // Miolo claro perto da saída, onde o jato ainda tem pressão.
  for (let i = 0; i < 6; i++) {
    const f = i / 14
    const ao = ini + (fim - ini) * f
    const passo = Math.abs(fim - ini) / M.jetSegments + 2
    g.fillStyle(COLOR.flameCore, 0.7 - f * 3)
    if (vertical) g.fillRect(Math.round(j.pos) - 3, Math.round(ao), 6, passo)
    else g.fillRect(Math.round(ao), Math.round(j.pos) - 3, passo, 6)
  }
}

/**
 * Coluna de lava subindo do tubo. Fatiada em retângulos que afinam e ondulam
 * mais quanto mais alto — jato, não bolha.
 */
function drawPlume(scene, g, gy, time) {
  const M = MONOLITO
  const R = M.geyserRadius
  const x = gy.x
  const base = gy.y
  const fase = time * M.geyserWaveSpeed + gy.x * 0.05 + gy.y * 0.03
  const altura = M.geyserPlume * (0.86 + 0.14 * Math.sin(fase * 0.6))

  // Halo primeiro, para as fatias caírem por cima dele.
  for (let i = 0; i < M.geyserSegments; i++) {
    const t = i / (M.geyserSegments - 1)
    const larg = R * 1.5 * (1 - t * 0.72) + 10 * (1 - t * 0.5)
    const dx = Math.sin(fase * 1.2 + t * 4.5) * 4 * t
    g.fillStyle(scene.theme.lavaGlow, FX.bloomPlume * (1 - t * 0.7))
    g.fillRect(Math.round(x + dx - larg / 2), Math.round(base - t * altura) - 3, Math.round(larg), 6)
  }

  for (let i = 0; i < M.geyserSegments; i++) {
    const t = i / (M.geyserSegments - 1)
    // Afina para cima e balança mais no topo, como jato perdendo pressão.
    const larg = R * 1.5 * (1 - t * 0.72) * (1 + 0.16 * Math.sin(fase + t * 5.5))
    const dx = Math.sin(fase * 1.2 + t * 4.5) * 4 * t
    const y = base - t * altura
    const alpha = 0.95 - 0.45 * t * t
    g.fillStyle(t < 0.22 ? scene.theme.lavaOuterHot : t < 0.6 ? COLOR.geyserErupt : COLOR.flameEdge, alpha)
    g.fillRect(Math.round(x + dx - larg / 2), Math.round(y) - 2, Math.max(2, Math.round(larg)), 4)
  }
  // Miolo claro só na parte de baixo, onde o jato ainda tem força.
  for (let i = 0; i < 5; i++) {
    const t = i / 8
    const dx = Math.sin(fase * 1.2 + t * 4.5) * 4 * t
    g.fillStyle(COLOR.flameCore, 0.75 - t)
    g.fillRect(Math.round(x + dx) - 2, Math.round(base - t * altura) - 2, 4, 4)
  }
}

/** Contornos de colisão do chefe: carapaça ou núcleo, gêiseres e cacos armados. */
function drawHitboxes(g, b) {
  const M = MONOLITO
  if (!b.dead) {
    g.lineStyle(1, 0xff4488, 0.9)
    if (b.phase === PHASE.CORE) {
      g.strokeCircle(Math.round(b.x), Math.round(b.y), b.radius)
    } else {
      // Meio-disco: só a metade de cima, mais a aresta reta na base.
      g.beginPath()
      g.arc(Math.round(b.x), Math.round(b.y), b.radius, Math.PI, 0)
      g.strokePath()
      g.lineBetween(b.x - b.radius, b.y, b.x + b.radius, b.y)
    }
  }
  g.lineStyle(1, 0x00ffff, 0.9) // ciano: laranja sobre lava laranja não se vê
  for (const gy of b.geysers) {
    if (gy.state === 'dormant') continue
    g.strokeCircle(Math.round(gy.x), Math.round(gy.y), M.geyserRadius)
  }
  g.lineStyle(1, 0xffffff, 0.6)
  for (const d of b.debris) {
    if (d.landed || d.age < M.debrisArmTime) continue
    g.strokeCircle(Math.round(d.x), Math.round(d.y), M.debrisRadius)
  }
}

/**
 * A folha da pirâmide vem com as rachaduras desenhadas em quatro cores só para
 * separá-las. Aqui elas saem do corpo e viram quatro máscuras brancas, uma por
 * camada, que o jogo acende de baixo para cima e colore por tint. Assim todas
 * ficam na mesma cor e podem esquentar juntas.
 */
function makePyramidTextures(scene) {
  const src = scene.textures.get('pyramidRaw').getSourceImage()
  const { width: W, height: H } = src
  const read = document.createElement('canvas')
  read.width = W
  read.height = H
  const rctx = read.getContext('2d', { willReadFrequently: true })
  rctx.drawImage(src, 0, 0)
  const px = rctx.getImageData(0, 0, W, H).data

  // Cada quadro de rotação tem a pirâmide numa posição diferente dentro da
  // célula: a base varia 16 px e o centro 14 px. Com uma origem só, ela sobe,
  // desce e desliza enquanto gira — lê como se estivesse flutuando. Então a
  // origem é medida por quadro.
  const caixas = Array.from({ length: ART.frames }, () => ({ x0: 1e9, y0: 1e9, x1: -1, y1: -1 }))

  const matiz = (r, gg, b) => {
    const mx = Math.max(r, gg, b)
    const c = mx - Math.min(r, gg, b)
    if (!c) return -1
    let h = mx === r ? ((gg - b) / c) % 6 : mx === gg ? (b - r) / c + 2 : (r - gg) / c + 4
    h *= 60
    return h < 0 ? h + 360 : h
  }
  const matizDosMarcadores = ART.markers.map((m) => matiz((m >> 16) & 255, (m >> 8) & 255, m & 255))

  // Corpo, uma máscara por rachadura, e o corpo adormecido.
  const canvases = [
    document.createElement('canvas'),
    ...ART.markers.map(() => document.createElement('canvas')),
    document.createElement('canvas'),
  ]
  const imgs = canvases.map((c) => {
    c.width = W
    c.height = H
    return c.getContext('2d').createImageData(W, H)
  })

  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3]
    if (a < 20) continue
    const p = i / 4
    const gx = p % W
    const gy = (p / W) | 0
    const f = Math.floor(gx / ART.cell) + Math.floor(gy / ART.cell) * ART.cols
    if (f < ART.frames) {
      const cx = gx % ART.cell
      const cy = gy % ART.cell
      const b = caixas[f]
      if (cx < b.x0) b.x0 = cx
      if (cx > b.x1) b.x1 = cx
      if (cy < b.y0) b.y0 = cy
      if (cy > b.y1) b.y1 = cy
    }
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    let camada = -1
    if (Math.max(r, g, b) - Math.min(r, g, b) >= ART.markerMinSat) {
      const h = matiz(r, g, b)
      let melhor = 1e9
      matizDosMarcadores.forEach((hm, k) => {
        const d = Math.min(Math.abs(h - hm), 360 - Math.abs(h - hm))
        if (d < melhor) {
          melhor = d
          camada = k
        }
      })
    }
    if (camada < 0) {
      const d = imgs[0].data // corpo, sem as marcações
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = a
    } else {
      // Máscara branca: o tint depois pinta da cor que o jogo quiser.
      const d = imgs[camada + 1].data
      d[i] = 255
      d[i + 1] = 255
      d[i + 2] = 255
      d[i + 3] = a
      // E o corpo recebe pedra no lugar da marcação, não transparência: sem isso
      // a pirâmide fica vazada onde a rachadura ainda não acendeu.
      const rocha = (gx * 7 + gy * 13) % 5 === 0 ? ART.rockLight : ART.rockDark
      const c0 = imgs[0].data
      c0[i] = (rocha >> 16) & 255
      c0[i + 1] = (rocha >> 8) & 255
      c0[i + 2] = rocha & 255
      c0[i + 3] = a
    }

    // O mesmo pixel em pedra adormecida: sem cor e com o escuro levantado, para
    // a forma continuar legível antes de ela acordar.
    const corpo = imgs[0].data
    const lum = 0.3 * corpo[i] + 0.59 * corpo[i + 1] + 0.11 * corpo[i + 2]
    const cinza = Math.min(255, ART.sleepFloor + lum * ART.sleepGain)
    const sono = imgs[imgs.length - 1].data
    sono[i] = cinza
    sono[i + 1] = cinza
    sono[i + 2] = Math.min(255, cinza * ART.sleepCool)
    sono[i + 3] = a
  }

  // Âncora no centro horizontal e na base de cada quadro.
  scene.pyramidOrigins = caixas.map((b) => ({
    x: (b.x0 + b.x1) / 2 / ART.cell,
    y: (b.y1 + 1) / ART.cell,
  }))

  const keys = ['pyramidBody', ...ART.markers.map((_, i) => `pyramidCrack${i}`), 'pyramidSleep']
  canvases.forEach((c, i) => {
    c.getContext('2d').putImageData(imgs[i], 0, 0)
    // `create` roda de novo num restart de cena, e `addCanvas` devolve null se a
    // chave já existe. Remover primeiro deixa o recarregamento idempotente.
    if (scene.textures.exists(keys[i])) scene.textures.remove(keys[i])
    const tex = scene.textures.addCanvas(keys[i], c)
    for (let f = 0; f < ART.frames; f++) {
      tex.add(f, 0, (f % ART.cols) * ART.cell, Math.floor(f / ART.cols) * ART.cell, ART.cell, ART.cell)
    }
  })
}
