// Importados como módulo para o Vite empacotar no build; `assets/` não é publicDir.
import bellUrl from '../../assets/sino.png'
import bellDownUrl from '../../assets/sino-caido.png'
import { SINO as S, SINO_ART as ART, CORO as C, OUTRO, WAKE, COLOR } from '../tuning.js'
import { mixColor, frameBoxes } from '../draw.js'
import { DEPTH } from '../draw.js'
import { TOPPLED, SWING, STRAIN, DOWN } from './sino.js'
import coroView from './coroView.js'

/**
 * Desenho do Sino.
 *
 * A leitura da luta depende de três coisas ficarem óbvias: **onde ele está**
 * (a sombra no chão), **quando está parado no alto** (o anel que fecha) e
 * **que há um núcleo ali dentro** (a luz vazando por baixo da saia). De pé o
 * badalo não aparece, então sem essa luz nada na tela diz o que se procura.
 */
export default {
  preload(scene) {
    const c = { frameWidth: ART.cell, frameHeight: ART.cell }
    scene.load.spritesheet('bell', bellUrl, c)
    scene.load.spritesheet('bellDown', bellDownUrl, c)
  },

  create(scene) {
    // Âncora medida por quadro, como na pirâmide: de pé ela vai na base (ele
    // pousa no chão), caído no centro da caixa (ele deita em volta do ponto).
    scene.bellBoxes = frameBoxes(scene, 'bell', ART.cell, ART.cols, ART.frames)
    scene.bellDownBoxes = frameBoxes(scene, 'bellDown', ART.cell, ART.cols, ART.frames)
    makeStone(scene, 'bell', 'bellStone')
    makeStone(scene, 'bellDown', 'bellDownStone')
    scene.bellSprite = scene.add.image(0, 0, 'bellStone').setScale(ART.upScale).setVisible(false)
    scene.bellDownSprite = scene.add.image(0, 0, 'bellDownStone').setScale(ART.fallenScale).setVisible(false)
    hangDeadBells(scene)
    coroView.create(scene)
  },

  draw(scene, b, time) {
    const g = scene.bossGfx
    g.setDepth(b.y - 0.02) // sombra e luz por baixo do bronze
    // O badalo fugiu: o corpo do sino grande fica onde caiu, oco, e a luta passa
    // a ser dos sete filhos.
    if (b.coro) {
      drawHusk(scene, b)
      coroView.draw(scene, b.coro, time)
      drawAsh(scene, time)
      return
    }
    const { rise, roar } = scene.wake
    const x = Math.round(b.x)
    const y = Math.round(b.y)
    // Adormecido ele está **no chão**, com a corrente frouxa: levantar até a
    // altura do arco é o despertar, e a corrente aparece ao esticar.
    const lift = Math.round(b.lift * rise)
    const caido = b.state === TOPPLED || b.dead

    // A corrente só arrebenta no terceiro puxão: até lá ela acompanha o corpo
    // aonde ele for, e **cede a barriga** quando ele está no chão, que é o que
    // diz que ela parou de segurar o peso.
    if (!caido) {
      const l = leanOf(b)
      drawChain(g, b, x + l.x, y - lift + l.y, rise, b.state === DOWN ? S.chainSag : 0)
    }

    // Sombra: é o desenho da pegada, então segue o centro dela e cobre o
    // meio-disco inteiro. A pegada é levantada — ver `footRise`.
    const R = S.bellRadius
    const k = 1 - (lift / S.liftMax) * 0.3
    const fy = caido ? y : Math.round(b.footY + R * 0.35)
    g.fillStyle(COLOR.shadow, 0.45)
    g.fillEllipse(x, fy, R * 2 * k, R * 1.4 * k)

    // Levantado o contato não mata, mas quem estiver aqui leva o feixe. A pegada
    // vira alvo aceso: sem isso a morte vinha sem nada na tela para explicá-la.
    // Só depois de acordado: dormindo ele está no chão e a pegada não é aviso
    // de nada.
    if (!caido && !b.grounded && rise >= 1) {
      const p = 0.55 + 0.45 * Math.sin(time * 6)
      g.lineStyle(1, COLOR.core, 0.35 + 0.3 * p)
      g.strokeEllipse(x, fy, R * 2 * k, R * 1.4 * k)
      g.fillStyle(COLOR.core, 0.08 + 0.07 * p)
      g.fillEllipse(x, fy, R * 2 * k, R * 1.4 * k)
    }

    scene.bellSprite.setVisible(!caido)
    scene.bellDownSprite.setVisible(caido)

    if (caido) drawToppled(scene, b, x, y, time)
    else drawUpright(scene, g, b, x, y, lift, time, rise, roar)

    // Na camada de baixo: no topo o feixe cruzava a frente do sino, e ele sai
    // é de debaixo da saia.
    if (b.laser) drawLaser(g, b, b.laser)
    drawAsh(scene, time)
  },

  hitboxes(g, b) {
    if (b.coro) return coroView.hitboxes(g, b.coro)
    const x = Math.round(b.x)
    const y = Math.round(b.y)
    if (b.state !== TOPPLED && !b.dead) {
      // Barriga para baixo e levantada: cobre a boca, não o chão vazio à frente.
      // Rosa quando o contato mata, ciano quando ele está no alto e ali só cai o
      // feixe.
      const fy = Math.round(b.footY)
      g.lineStyle(1, b.grounded ? 0xff4488 : 0x00ffff, 0.9)
      g.beginPath()
      g.arc(x, fy, S.bellRadius, 0, Math.PI)
      g.strokePath()
      g.lineBetween(x - S.bellRadius, fy, x + S.bellRadius, fy)
      g.strokeRect(x - S.bodyBoxW / 2, fy - S.bodyBoxH, S.bodyBoxW, S.bodyBoxH)
    }
    if (b.state === TOPPLED) {
      const c = b.corePos()
      g.lineStyle(1, 0xffcc00, 0.9)
      g.strokeCircle(Math.round(c.x), Math.round(c.y), S.coreRadius)
    }
  },

  status(b) {
    if (b.coro) return coroView.status(b.coro)
    return `sino:${b.state}${b.light ? '/leve' : ''}  puxões:${b.hits}/${S.toppleHits}  balanço:${Math.round(b.period)}ms`
  },
}

/** Corrente saindo de fora do quadro, com elos marcados ao longo dela. */
function drawChain(g, b, x, y, rise = 1, sag = 0) {
  if (rise <= 0.02) return
  const px = b.pivot.x
  const py = S.chainAnchorY
  const topo = y - S.bellRadius * 2.1
  // Barriga no meio do vão: corrente esticada é reta, corrente frouxa cai.
  const em = (t) => ({
    x: px + (x - px) * t,
    y: py + (topo - py) * t + Math.sin(t * Math.PI) * sag,
  })
  const n = 7
  g.lineStyle(2, COLOR.chain, 0.75 * rise)
  for (let i = 1; i <= n; i++) {
    const a = em((i - 1) / n)
    const c = em(i / n)
    g.lineBetween(a.x, a.y, c.x, c.y)
  }
  for (let i = 1; i < n; i++) {
    const e = em(i / n)
    g.fillStyle(COLOR.bellDark, 0.9 * rise)
    g.fillRect(Math.round(e.x) - 2, Math.round(e.y) - 1, 4, 3)
  }
}

/**
 * O quanto o corpo inclina enquanto resiste ao puxão. Ele **não anda** nesse
 * tempo: a corrente estica e ele pende na direção da corda. É o que dá o peso
 * antes de ele ceder.
 */
function leanOf(b) {
  if (b.state !== STRAIN) return { x: 0, y: 0 }
  const p = Math.min(1, b.t / S.strainTime)
  return { x: b.lean.x * S.strainLean * p, y: b.lean.y * S.strainLean * p }
}

/**
 * De pé. Os oito quadros da folha são guinadas de um objeto quase simétrico,
 * então valem como giro lento, não como direção — um sino pendurado gira devagar
 * na corrente.
 */
function drawUpright(scene, g, b, x, y, lift, time, rise = 1, roar = 0) {
  // Parado enquanto dorme: um sino no chão não gira na corrente.
  const frame = rise < 1 ? 0 : Math.floor(time * ART.spinFps) % ART.frames
  const spr = scene.bellSprite
  const box = scene.bellBoxes[frame]
  const R = S.bellRadius

  // O grito dele é uma badalada: anéis abrindo a partir da boca, e a luz de
  // dentro estourando junto.
  if (roar > 0) {
    for (let i = 0; i < 3; i++) {
      const p = Math.min(1, roar + i * 0.22)
      g.lineStyle(2, COLOR.core, (1 - p) * 0.8 * roar)
      g.strokeEllipse(x, y - 1 - lift * 0.5, R * (1 + p * 3.6), R * (0.45 + p * 1.5))
    }
  }

  // A luz do badalo escapa pela saia. Vaza mais no alto do arco, onde ele
  // descola do chão — o que também reforça a janela do puxão. A poça larga fica
  // no chão; o miolo aceso acompanha a boca, que sobe junto com ele.
  const pulso = 0.78 + 0.22 * Math.sin(time * 4.2)
  // Apagado no sono: a luz do badalo é a primeira coisa que volta, e no grito
  // ela estoura.
  const forca = S.underGlow * pulso * (1 + (lift / S.liftMax) * S.underGlowLift) * (rise + roar * 2.5)
  for (const [w, h, a, sobe] of [
    [3.8, 1.6, 0.28, 0],
    [2.5, 1.05, 0.45, 0.5],
    [1.75, 0.6, 0.75, 1],
  ]) {
    // Perto da boca, não da pegada: é luz escapando pela saia, e a pegada fica
    // mais atrás — ali o próprio sino tapa o brilho.
    g.fillStyle(COLOR.core, forca * a)
    g.fillEllipse(x, y - 1 - lift * sobe, R * w, R * h)
  }

  const l = leanOf(b)
  spr.setFrame(frame)
  spr.setOrigin(box.ox, box.oyBase)
  spr.setPosition(Math.round(x + l.x), Math.round(y + ART.groundSink - lift + l.y))
  spr.setDepth(b.y)
  // A folha já é pedra clara, então aqui a tinta escurece e esfria: dormindo ele
  // é pedra morta, e a cor volta com ele.
  spr.setTint(mixColor(WAKE.stone, 0xffffff, rise))

  // Sem indicador da janela do puxão: o que a anuncia é ele **parar** no alto do
  // arco, e a luz que vaza mais forte quando descola do chão. Um anel contando o
  // tempo por cima disso entregava demais.
}

/**
 * Feixe da boca ao chão. Curto por natureza — o sino sobe pouco —, então quem
 * conta a história é a largura e o estouro, não o comprimento.
 *
 * Duas metades: **formando**, com um anel se fechando no chão e o feixe
 * engrossando de um fio até a largura cheia; e **disparado**, o clarão abrindo
 * enquanto apaga. A carga é o aviso, e precisa se ler de longe.
 */
function drawLaser(g, b, l) {
  const R = S.bellRadius
  const w = S.laserWidth
  // Reto embaixo da boca, acompanhando o sino. Entortar em direção a um ponto
  // travado lia como se ele estivesse perseguindo o jogador, que não é o caso.
  const x = Math.round(b.x)
  const boca = Math.round(b.y + ART.groundSink - b.lift)
  const chao = Math.round(b.footY + R * 0.35)
  const faixa = (larg, cor, alpha) => {
    g.fillStyle(cor, alpha)
    g.fillRect(Math.round(x - larg / 2), boca, Math.max(1, Math.round(larg)), chao - boca)
  }

  if (!l.fired) {
    const c = Math.min(1, l.t / S.laserCharge)
    // Anel fechando no chão: diz onde vai cair e quanto falta.
    g.lineStyle(2, COLOR.core, 0.35 + 0.5 * c)
    g.strokeEllipse(x, chao, S.laserHit * (3.4 - 2.2 * c), S.laserHit * (1.5 - 1.0 * c))
    // Luz juntando na boca.
    g.fillStyle(COLOR.core, 0.2 + 0.4 * c)
    g.fillEllipse(x, boca, R * (0.7 + 0.8 * c), R * (0.3 + 0.34 * c))
    // O feixe engrossa de um fio até a largura cheia, tudo no fim da carga.
    faixa(Math.max(1, w * c * c * c), COLOR.core, 0.3 + 0.5 * c)
    faixa(2, COLOR.flameCore, 0.5 + 0.5 * c)
    return
  }

  const f = 1 - Math.min(1, (l.t - S.laserCharge) / S.laserShow)
  faixa(w * 2, COLOR.core, 0.3 * f)
  faixa(w, COLOR.core, 0.95 * f)
  faixa(w / 2, COLOR.flameCore, f)

  // Estouro no chão, abrindo enquanto apaga. Nunca menor que o raio que mata.
  const r = S.laserHit * (1.15 + 0.9 * (1 - f))
  g.fillStyle(COLOR.core, 0.4 * f)
  g.fillEllipse(x, chao, r * 2.2, r * 1.0)
  g.fillStyle(COLOR.flameCore, 0.85 * f)
  g.fillEllipse(x, chao, r * 0.95, r * 0.42)
}

/** Caído: o quadro é escolhido pela direção da boca, em setores de 45°. */
function drawToppled(scene, b, x, y, time) {
  const frame = ART.fallenFrame[b.mouthSector]
  const spr = scene.bellDownSprite
  const box = scene.bellDownBoxes[frame]
  spr.setFrame(frame)
  spr.setOrigin(box.ox, box.oy)
  spr.setPosition(x, y)
  spr.setDepth(b.y)

  // Badalo: único ponto saturado do jogo, e apaga conforme a alma sai. Vai na
  // camada de cima porque ele é o alvo — não pode sumir atrás do bronze.
  const c = b.corePos()
  const st = scene.outro.stage
  const vivo = b.dead ? (st === 'soul' ? 1 - Math.min(1, scene.outro.t / OUTRO.soulTime) : st ? 1 : 0) : 1
  const cx = Math.round(c.x)
  const cy = Math.round(c.y)
  const top = scene.bossTopGfx
  top.setDepth(b.y + 0.02)
  if (vivo > 0.02) {
    const pulso = 0.75 + 0.25 * Math.sin(time * 5)
    top.fillStyle(COLOR.core, 0.2 * vivo * pulso)
    top.fillCircle(cx, cy, S.coreRadius * 3.4)
    top.fillStyle(COLOR.core, 0.38 * vivo * pulso)
    top.fillCircle(cx, cy, S.coreRadius * 1.9)
  }
  top.fillStyle(mixColor(COLOR.coreDead, COLOR.core, vivo), 1)
  top.fillCircle(cx, cy, S.coreRadius * 0.8)
}

/**
 * As duas folhas em pedra acinzentada. A de pé vem fosca e a caída em bronze
 * polido — o que separa as duas não é o matiz (a cor média é quase a mesma) e
 * sim o **teto de brilho**: 240 contra 196. Então cada uma vai a luminância,
 * é normalizada para o mesmo teto e repintada na cor de pedra. Metal polido
 * vira pedra ao perder o especular, não ao mudar de cor.
 */
function makeStone(scene, srcKey, dstKey) {
  const src = scene.textures.get(srcKey).getSourceImage()
  const { width: W, height: H } = src
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, W, H)
  const px = img.data

  let lumMax = 1
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 20) continue
    const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    if (l > lumMax) lumMax = l
  }
  const escala = ART.stoneMax / lumMax
  const kr = ((ART.stone >> 16) & 255) / 255
  const kg = ((ART.stone >> 8) & 255) / 255
  const kb = (ART.stone & 255) / 255

  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 20) continue
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * escala
    px[i] = Math.min(255, l * kr)
    px[i + 1] = Math.min(255, l * kg)
    px[i + 2] = Math.min(255, l * kb)
  }
  ctx.putImageData(img, 0, 0)

  // `create` roda de novo num restart, e `addCanvas` devolve null se a chave já
  // existe. Remover antes deixa o recarregamento idempotente.
  if (scene.textures.exists(dstKey)) scene.textures.remove(dstKey)
  const tex = scene.textures.addCanvas(dstKey, c)
  for (let f = 0; f < ART.frames; f++) {
    tex.add(f, 0, (f % ART.cols) * ART.cell, Math.floor(f / ART.cols) * ART.cell, ART.cell, ART.cell)
  }
}

/**
 * Os outros sinos da câmara: apagados, menores, pendurados perto das muralhas e
 * fora da linha de varredura. Estáticos, então nascem uma vez e ficam — e como
 * estão no ar, o jogador passa por baixo sem esbarrar em nada.
 *
 * Contam de onde o chefe saiu sem uma linha de texto, e são o que separa esta
 * câmara de qualquer outra sala do jogo.
 */
/**
 * Os sete sinos apagados da câmara. Eles são cenário até o badalo fugir para
 * dentro de um deles — a partir daí **são o chefe**, e por isso os sprites
 * ficam guardados em `scene.deadBells` em vez de serem esquecidos. As correntes
 * e sombras ficam numa camada à parte, que o coro apaga quando eles começam a
 * andar pelo céu.
 */
function hangDeadBells(scene) {
  const lista = scene.room.hangingBells
  scene.deadBells = []
  if (!lista) return
  const g = scene.add.graphics().setDepth(DEPTH.decal + 0.5)
  scene.deadBellsGfx = g
  const escala = C.scale
  for (const [x, y] of lista) {
    const box = scene.bellBoxes[0]
    const alt = (box.y1 - box.y0 + 1) * escala
    const topo = y - alt

    // Corrente saindo de fora do quadro, como a do chefe.
    g.lineStyle(2, COLOR.chain, 0.5)
    g.lineBetween(x, S.chainAnchorY, x, topo - 4)
    for (let i = 1; i < 6; i++) {
      const t = i / 6
      g.fillStyle(COLOR.bellDark, 0.55)
      g.fillRect(x - 2, Math.round(S.chainAnchorY + (topo - 4 - S.chainAnchorY) * t) - 1, 4, 3)
    }
    // Sombra no chão, bem fraca: eles pendem alto.
    g.fillStyle(COLOR.shadow, 0.28)
    g.fillEllipse(x, y + 6, alt * 0.9, alt * 0.3)

    scene.deadBells.push(
      scene.add
        .image(x, y, 'bellStone')
        .setFrame(0)
        .setOrigin(box.ox, box.oyBase)
        .setScale(escala)
        .setTint(COLOR.bellDead)
        .setDepth(y),
    )
  }
}

/**
 * O corpo do sino grande depois que o badalo foge: mesma pose do tombo, sem
 * badalo nenhum. Ele fica na arena como marca de que aquilo já foi um chefe.
 */
function drawHusk(scene, b) {
  if (!b.husk) return
  const frame = ART.fallenFrame[b.husk.sector]
  const spr = scene.bellDownSprite
  const box = scene.bellDownBoxes[frame]
  spr.setVisible(true)
  spr.setFrame(frame)
  spr.setOrigin(box.ox, box.oy)
  spr.setPosition(Math.round(b.husk.x), Math.round(b.husk.y))
  spr.setDepth(b.husk.y)
  spr.setTint(COLOR.bellDead)
  scene.bellSprite.setVisible(false)
  // As correntes paradas saem de cena: daqui em diante elas acompanham os corpos.
  if (scene.deadBellsGfx) scene.deadBellsGfx.setVisible(false)

  const g = scene.bossGfx
  g.fillStyle(COLOR.shadow, 0.45)
  g.fillEllipse(Math.round(b.husk.x), Math.round(b.husk.y), S.bellRadius * 2, S.bellRadius * 1.4)
}

/**
 * Cinza caindo. Sai de um hash em vez de partícula guardada: são motes sem
 * estado, e a posição é função do tempo — some no rodapé e reaparece no topo
 * sozinha, sem lista para manter.
 */
function drawAsh(scene, time) {
  const g = scene.airGfx
  const H = scene.room.height
  const W = scene.room.width
  for (let i = 0; i < S.ashCount; i++) {
    const h = (i * 73856093) ^ (i * 19349663)
    const x = (h >>> 7) % W
    const fase = ((h >>> 3) % 628) / 100
    const y = (((h >>> 11) % H) + time * S.ashFall) % H
    const dx = Math.sin(time * 0.6 + fase) * S.ashSway
    g.fillStyle(COLOR.ash, 0.1 + 0.14 * (0.5 + 0.5 * Math.sin(fase + time * 0.9)))
    g.fillRect(Math.round(x + dx), Math.round(y), 1, i % 7 === 0 ? 2 : 1)
  }
}
