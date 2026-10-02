import { SENTINELA as S, OUTRO, COLOR } from '../tuning.js'
import { mixColor, sleepColor } from '../draw.js'
import { CHARGE, FIRE, BLIND } from './sentinela.js'

/**
 * Desenho da Sentinela.
 *
 * ponytail: teto assumido — sem arte ainda, tudo em `Graphics`. O contrato
 * quando a folha existir é o de sempre: objeto rígido, 8 guinadas de 45°, e
 * dessa vez a silhueta precisa de **frente e costas óbvias**, porque saber para
 * onde ela encara é a informação da luta inteira.
 *
 * Três coisas têm que se ler sem HUD: **para onde ela encara** (a face clara),
 * **quando vai atirar** (o caminho do feixe aparece inteiro antes de sair) e
 * **quando ela está cega** (o espelho embaça e ela para de virar).
 */
export default {
  preload() {},
  create() {},

  draw(scene, b, time) {
    const g = scene.bossGfx
    g.setDepth(b.y - 0.02)
    const { rise, roar } = scene.wake
    const x = Math.round(b.x)
    // Adormecida ela está **caída no chão**: desce um pouco e se achata, e o
    // despertar é ela se endireitar.
    const y = Math.round(b.y) + Math.round((1 - rise) * 7)
    const R = S.bodyRadius

    g.fillStyle(COLOR.shadow, 0.45)
    g.fillEllipse(x, y + R * 0.2, R * 2.1, R * 0.9)

    // A prévia só aparece na carga. Fora dela a sala fica limpa: o jogador
    // aprende o ângulo vendo para onde o tiro anterior foi, não com uma linha
    // ligada o tempo todo.
    if (b.state === CHARGE) drawAim(scene, g, b, time)
    if (b.state === FIRE && b.beam) drawBeam(scene, g, b)

    drawBody(g, b, x, y, time, rise)
    if (b.shell) drawShell(g, b, x, y, time, rise)
    else drawCore(scene, b, time, rise)

    // O grito dela é de luz: a face espelhada estoura em branco e joga anéis
    // frios para fora, uma vez só.
    if (roar > 0) {
      g.fillStyle(COLOR.beamHot, 0.75 * roar)
      g.fillCircle(x, y, R * (0.6 + 0.5 * roar))
      for (let i = 0; i < 3; i++) {
        const p = Math.min(1, roar + i * 0.25)
        g.lineStyle(2, COLOR.beamCold, (1 - p) * 0.9 * roar)
        g.strokeCircle(x, y, R * (1 + p * 2.8))
      }
    }
  },

  hitboxes(g, b) {
    if (b.dead) return
    const x = Math.round(b.x)
    const y = Math.round(b.y)
    // Corpo, e a linha que separa espelho de costas: de um lado a flecha volta,
    // do outro ela crava.
    g.lineStyle(1, 0xff4488, 0.9)
    g.strokeCircle(x, y, S.bodyRadius)
    g.lineStyle(1, 0x00ffff, 0.8)
    g.lineBetween(
      x - b.ny * S.bodyRadius,
      y + b.nx * S.bodyRadius,
      x + b.ny * S.bodyRadius,
      y - b.nx * S.bodyRadius,
    )
    const c = b.corePos()
    g.lineStyle(1, 0xffcc00, 0.9)
    g.strokeCircle(Math.round(c.x), Math.round(c.y), S.coreRadius)

    if (b.beam) {
      g.lineStyle(1, 0xffffff, 0.5)
      for (let i = 1; i < b.beam.length; i++) {
        const a = b.beam[i - 1]
        const d = b.beam[i]
        g.lineBetween(a.x, a.y, d.x, d.y)
      }
    }
  },

  status(b) {
    return `sentinela:${b.state}  ${b.shell ? 'carapaça' : 'núcleo'}  ciclos:${b.rounds}  tiro:${Math.round(b.fireEvery)}ms  cega:${Math.round(b.blindTime)}ms`
  },
}

/**
 * Corpo: disco de pedra com a metade da frente espelhada. A face clara é a
 * informação principal da tela, então ela é o que tem mais contraste.
 */
function drawBody(g, b, x, y, time, rise = 1) {
  const R = S.bodyRadius
  const cega = b.state === BLIND
  // Dormindo ela perde a cor, não o contraste: cada tom vai para o cinza de
  // mesma luminância, e a silhueta continua legível.
  const cor = (c) => sleepColor(c, rise)

  // Pedra: o disco inteiro.
  g.fillStyle(cor(COLOR.sentinelStone), 1)
  g.fillCircle(x, y, R)

  // Espelho: meio-disco na direção que ela encara. Embaçado enquanto cega.
  const face = Math.atan2(b.ny, b.nx)
  const pts = []
  const n = 18
  for (let i = 0; i <= n; i++) {
    const a = face - Math.PI / 2 + (Math.PI * i) / n
    pts.push({ x: x + Math.cos(a) * R, y: y + Math.sin(a) * R })
  }
  pts.push({ x: x - b.ny * R * 0.1, y: y + b.nx * R * 0.1 })
  g.fillStyle(cor(cega ? COLOR.mirrorDim : COLOR.mirror), 1)
  g.fillPoints(pts, true)

  // Um risco de brilho atravessando o espelho: dá a leitura de superfície polida
  // e some quando ela embaça. Pedra adormecida não reflete nada.
  if (!cega && rise > 0.5) {
    const t = 0.35 + 0.25 * Math.sin(time * 1.6)
    g.lineStyle(2, COLOR.beamHot, 0.5 * rise)
    g.lineBetween(
      x + Math.cos(face - Math.PI / 2) * R * (0.2 + t),
      y + Math.sin(face - Math.PI / 2) * R * (0.2 + t),
      x + Math.cos(face + Math.PI / 2) * R * (0.2 + t) + b.nx * R * 0.5,
      y + Math.sin(face + Math.PI / 2) * R * (0.2 + t) + b.ny * R * 0.5,
    )
  } else {
    // Embaçada: névoa girando devagar por cima do espelho.
    for (let i = 0; i < 5; i++) {
      const a = time * 0.8 + (i * Math.PI * 2) / 5
      g.fillStyle(COLOR.mirror, 0.12)
      g.fillCircle(x + b.nx * 6 + Math.cos(a) * R * 0.4, y + b.ny * 6 + Math.sin(a) * R * 0.35, R * 0.35)
    }
  }

  // Aresta acesa contornando o disco.
  g.lineStyle(1, cor(COLOR.sentinelEdge), 0.8)
  g.strokeCircle(x, y, R)
}

/** Núcleo nas costas: único ponto quente da sala, e o alvo do recall. */
function drawCore(scene, b, time, rise = 1) {
  const c = b.corePos()
  const cx = Math.round(c.x)
  const cy = Math.round(c.y)
  const st = scene.outro.stage
  const vivo = b.dead ? (st === 'soul' ? 1 - Math.min(1, scene.outro.t / OUTRO.soulTime) : st ? 1 : 0) : 1

  const g = scene.bossTopGfx
  g.setDepth(b.y + 0.02)
  if (vivo > 0.02 && rise > 0.02) {
    const pulso = 0.75 + 0.25 * Math.sin(time * 5) * rise
    g.fillStyle(COLOR.core, 0.2 * vivo * pulso * rise)
    g.fillCircle(cx, cy, S.coreRadius * 3.2)
    g.fillStyle(COLOR.core, 0.4 * vivo * pulso * rise)
    g.fillCircle(cx, cy, S.coreRadius * 1.8)
  }
  g.fillStyle(mixColor(COLOR.coreDead, COLOR.core, vivo * rise), 1)
  g.fillCircle(cx, cy, S.coreRadius * 0.85)
}

/**
 * Prévia do feixe durante a carga. O traçado é o mesmo que vai sair, quiques
 * inclusive — sem isso o ricochete seria loteria em vez de leitura.
 */
function drawAim(scene, g, b, time) {
  const tiro = b.traceBeam(scene.grid)
  const pontos = tiro.points
  const c = Math.min(1, b.t / b.chargeTime)
  const pisca = 0.35 + 0.4 * Math.abs(Math.sin(time * 9))

  g.lineStyle(2, COLOR.beamCold, (0.45 + 0.45 * c) * pisca)
  for (let i = 1; i < pontos.length; i++) {
    g.lineBetween(pontos[i - 1].x, pontos[i - 1].y, pontos[i].x, pontos[i].y)
  }
  // Marca cada quique: é onde o jogador precisa olhar para prever o desvio.
  for (let i = 1; i < pontos.length - 1; i++) {
    g.fillStyle(COLOR.beamHot, 0.4 + 0.4 * c)
    g.fillCircle(Math.round(pontos[i].x), Math.round(pontos[i].y), 2 + 2 * c)
  }

  // **Achou.** O traçado volta nas próprias costas dela: é o único aviso de que
  // aquele ângulo abre a carapaça, e sem ele o acerto seria sorte.
  if (tiro.absorbed && b.shell) {
    const p = pontos[pontos.length - 1]
    const pulso = 0.6 + 0.4 * Math.sin(time * 11)
    g.lineStyle(2, COLOR.core, 0.55 + 0.45 * pulso)
    for (let i = 1; i < pontos.length; i++) {
      g.lineBetween(pontos[i - 1].x, pontos[i - 1].y, pontos[i].x, pontos[i].y)
    }
    g.fillStyle(COLOR.core, 0.5 + 0.5 * pulso)
    g.fillCircle(Math.round(p.x), Math.round(p.y), 4 + 3 * pulso)
  }

  g.fillStyle(COLOR.beamCold, 0.2 + 0.5 * c)
  g.fillCircle(
    Math.round(b.x + b.nx * S.bodyRadius),
    Math.round(b.y + b.ny * S.bodyRadius),
    S.bodyRadius * (0.25 + 0.4 * c),
  )
}

/**
 * Carapaça: placas cobrindo as costas, com uma fresta de luz escapando. A fresta
 * é o que diz que existe alguma coisa embaixo — sem ela a fase 1 não tem alvo.
 */
function drawShell(g, b, x, y, time, rise = 1) {
  const R = S.bodyRadius
  const cor = (c) => sleepColor(c, rise)
  const face = Math.atan2(b.ny, b.nx)
  const pts = []
  const n = 16
  for (let i = 0; i <= n; i++) {
    const a = face + Math.PI / 2 + (Math.PI * i) / n
    pts.push({ x: x + Math.cos(a) * R * 1.08, y: y + Math.sin(a) * R * 1.08 })
  }
  g.fillStyle(cor(COLOR.shellPlate), 1)
  g.fillPoints(pts, true)

  // Placas: três riscos cruzando as costas.
  for (let i = -1; i <= 1; i++) {
    const a = face + Math.PI + (i * Math.PI) / 5
    g.lineStyle(2, cor(COLOR.shellSeam), 0.9)
    g.lineBetween(
      x + Math.cos(a) * R * 0.25,
      y + Math.sin(a) * R * 0.25,
      x + Math.cos(a) * R * 1.06,
      y + Math.sin(a) * R * 1.06,
    )
  }

  // Fresta acesa: o núcleo respirando por baixo.
  // A fresta só respira depois que ela acorda.
  const pulso = (0.5 + 0.5 * Math.sin(time * 3.4)) * rise
  const c = b.corePos()
  g.fillStyle(COLOR.core, (0.1 + 0.14 * pulso) * rise)
  g.fillCircle(Math.round(c.x), Math.round(c.y), R * 0.55)
  g.fillStyle(COLOR.core, (0.25 + 0.25 * pulso) * rise)
  g.fillCircle(Math.round(c.x), Math.round(c.y), R * 0.2)
}

/** Feixe disparado: a mesma polilinha, agora grossa e acesa. */
function drawBeam(scene, g, b) {
  // O salão é de espelhos: o feixe continua para dentro da parede em vez de
  // simplesmente virar nela. Quem sabe onde ficam os espelhos é a cena.
  const fade = 1 - Math.min(1, b.t / b.beamTime)
  scene.mirrorPolyline(b.beam, S.beamWidth, COLOR.beamCold, 0.75 * fade)
  scene.mirrorPolyline(b.beam, Math.max(2, S.beamWidth / 3), COLOR.beamHot, 0.85 * fade)
  const f = 1 - Math.min(1, b.t / b.beamTime)
  const w = S.beamWidth
  const linha = (larg, cor, alpha) => {
    g.lineStyle(larg, cor, alpha)
    for (let i = 1; i < b.beam.length; i++) {
      g.lineBetween(b.beam[i - 1].x, b.beam[i - 1].y, b.beam[i].x, b.beam[i].y)
    }
  }
  linha(w * 2.2, COLOR.beamCold, 0.22 * f)
  linha(w, COLOR.beamCold, 0.9 * f)
  linha(Math.max(2, w / 3), COLOR.beamHot, f)

  // Estouro em cada quique, para o desvio se ler no calor do momento.
  for (let i = 1; i < b.beam.length - 1; i++) {
    g.fillStyle(COLOR.beamHot, 0.7 * f)
    g.fillCircle(Math.round(b.beam[i].x), Math.round(b.beam[i].y), w * (0.5 + 0.6 * (1 - f)))
  }
}
