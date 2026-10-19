import type { LabColor, RgbColor } from '@/domain/palette/types'

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace('#', '')

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Invalid six-digit hex color: ${hex}`)
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

export function rgbToLab({ r, g, b }: RgbColor): LabColor {
  const linearize = (value: number) => {
    const channel = value / 255
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4)
  }

  const lr = linearize(r)
  const lg = linearize(g)
  const lb = linearize(b)

  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883

  const pivot = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116

  const fx = pivot(x)
  const fy = pivot(y)
  const fz = pivot(z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const toDegrees = (radians: number) => (radians * 180) / Math.PI

export function deltaE2000(first: LabColor, second: LabColor): number {
  const averageLightness = (first.l + second.l) / 2
  const chroma1 = Math.hypot(first.a, first.b)
  const chroma2 = Math.hypot(second.a, second.b)
  const averageChroma = (chroma1 + chroma2) / 2
  const compensation =
    0.5 *
    (1 -
      Math.sqrt(
        Math.pow(averageChroma, 7) /
          (Math.pow(averageChroma, 7) + Math.pow(25, 7)),
      ))

  const adjustedA1 = (1 + compensation) * first.a
  const adjustedA2 = (1 + compensation) * second.a
  const adjustedChroma1 = Math.hypot(adjustedA1, first.b)
  const adjustedChroma2 = Math.hypot(adjustedA2, second.b)

  const hue = (a: number, bValue: number) => {
    if (a === 0 && bValue === 0) return 0
    const angle = toDegrees(Math.atan2(bValue, a))
    return angle >= 0 ? angle : angle + 360
  }

  const hue1 = hue(adjustedA1, first.b)
  const hue2 = hue(adjustedA2, second.b)
  const lightnessDelta = second.l - first.l
  const chromaDelta = adjustedChroma2 - adjustedChroma1

  let hueDeltaDegrees = 0
  if (adjustedChroma1 * adjustedChroma2 !== 0) {
    const rawHueDelta = hue2 - hue1
    hueDeltaDegrees =
      Math.abs(rawHueDelta) <= 180
        ? rawHueDelta
        : rawHueDelta > 180
          ? rawHueDelta - 360
          : rawHueDelta + 360
  }

  const hueDelta =
    2 *
    Math.sqrt(adjustedChroma1 * adjustedChroma2) *
    Math.sin(toRadians(hueDeltaDegrees / 2))
  const adjustedAverageChroma = (adjustedChroma1 + adjustedChroma2) / 2

  let averageHue = hue1 + hue2
  if (adjustedChroma1 * adjustedChroma2 !== 0) {
    const hueDifference = Math.abs(hue1 - hue2)
    averageHue =
      hueDifference <= 180
        ? (hue1 + hue2) / 2
        : hue1 + hue2 < 360
          ? (hue1 + hue2 + 360) / 2
          : (hue1 + hue2 - 360) / 2
  }

  const hueWeight =
    1 -
    0.17 * Math.cos(toRadians(averageHue - 30)) +
    0.24 * Math.cos(toRadians(2 * averageHue)) +
    0.32 * Math.cos(toRadians(3 * averageHue + 6)) -
    0.2 * Math.cos(toRadians(4 * averageHue - 63))
  const rotationAngle = 30 * Math.exp(-Math.pow((averageHue - 275) / 25, 2))
  const lightnessWeight =
    1 +
    (0.015 * Math.pow(averageLightness - 50, 2)) /
      Math.sqrt(20 + Math.pow(averageLightness - 50, 2))
  const chromaWeight = 1 + 0.045 * adjustedAverageChroma
  const hueScale = 1 + 0.015 * adjustedAverageChroma * hueWeight
  const rotation =
    -2 *
    Math.sqrt(
      Math.pow(adjustedAverageChroma, 7) /
        (Math.pow(adjustedAverageChroma, 7) + Math.pow(25, 7)),
    ) *
    Math.sin(toRadians(2 * rotationAngle))

  const lightnessTerm = lightnessDelta / lightnessWeight
  const chromaTerm = chromaDelta / chromaWeight
  const hueTerm = hueDelta / hueScale

  return Math.sqrt(
    lightnessTerm * lightnessTerm +
      chromaTerm * chromaTerm +
      hueTerm * hueTerm +
      rotation * chromaTerm * hueTerm,
  )
}
