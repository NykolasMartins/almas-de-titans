// Utilidades comuns a quem desenha: camadas e mistura de cor.

/**
 * Camadas de desenho. A faixa 0..altura da sala é reservada para a ordenação
 * por `y` das entidades e do cenário alto — quem está mais embaixo na tela
 * desenha na frente —, então tudo que é sempre-por-cima fica bem acima dela.
 */
export const DEPTH = {
  floor: -1,
  lava: -0.5,
  decal: 0,
  air: 800,
  cord: 900,
  hit: 940,
  dim: 1000,
  soul: 1002,
  debug: 1003,
}

/** Mistura duas cores 0xRRGGBB. `t` de 0 a 1. */
export function mixColor(a, b, t) {
  const f = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  return (((ar + (br - ar) * f) | 0) << 16) | (((ag + (bg - ag) * f) | 0) << 8) | ((ab + (bb - ab) * f) | 0)
}

/**
 * Cinza de mesma luminância. Serve para apagar a cor de um corpo sem apagar o
 * contraste dele: um titã adormecido tem que continuar legível como silhueta, e
 * puxar tudo para um cinza só o transformava numa mancha.
 */
export function grayColor(hex) {
  const l = Math.round(0.3 * ((hex >> 16) & 255) + 0.59 * ((hex >> 8) & 255) + 0.11 * (hex & 255))
  return (l << 16) | (l << 8) | l
}

/**
 * A cor como ela fica adormecida: dessaturada **e mais escura**, por `1 - rise`.
 * Só tirar a cor não basta — um corpo claro dessaturado continua parecendo aceso.
 */
export function sleepColor(hex, rise) {
  return mixColor(hex, mixColor(grayColor(hex), 0x000000, 0.38), 1 - rise)
}

/**
 * Caixa de cada quadro de uma folha em grade, medida pelos pixels opacos, e as
 * âncoras que saem dela: `ox`/`oy` no centro e `oyBase` no pé.
 *
 * Existe porque sprite gerado por IA varia de quadro para quadro — na pirâmide a
 * base oscilava 16 px entre os oito, e com uma origem só ela subia, descia e
 * deslizava enquanto girava, lendo como se flutuasse.
 */
export function frameBoxes(scene, key, cell, cols, frames) {
  const src = scene.textures.get(key).getSourceImage()
  const { width: W, height: H } = src
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(src, 0, 0)
  const px = ctx.getImageData(0, 0, W, H).data

  const caixas = Array.from({ length: frames }, () => ({ x0: 1e9, y0: 1e9, x1: -1, y1: -1 }))
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 20) continue
    const p = (i - 3) / 4
    const gx = p % W
    const gy = (p / W) | 0
    const f = Math.floor(gx / cell) + Math.floor(gy / cell) * cols
    if (f >= frames) continue
    const cx = gx % cell
    const cy = gy % cell
    const b = caixas[f]
    if (cx < b.x0) b.x0 = cx
    if (cx > b.x1) b.x1 = cx
    if (cy < b.y0) b.y0 = cy
    if (cy > b.y1) b.y1 = cy
  }

  return caixas.map((b) => ({
    ...b,
    ox: (b.x0 + b.x1) / 2 / cell,
    oy: (b.y0 + b.y1) / 2 / cell,
    oyBase: (b.y1 + 1) / cell,
  }))
}
