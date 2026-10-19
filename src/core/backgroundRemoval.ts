export interface BackgroundRemovalOptions {
  tolerance?: number
  alphaThreshold?: number
}

function colorDistance(
  data: Uint8ClampedArray,
  offset: number,
  reference: readonly [number, number, number],
) {
  const red = (data[offset] ?? 0) - reference[0]
  const green = (data[offset + 1] ?? 0) - reference[1]
  const blue = (data[offset + 2] ?? 0) - reference[2]
  return Math.sqrt(red * red + green * green + blue * blue)
}

/**
 * Removes only edge-connected pixels similar to the dominant corner color.
 * Interior areas with the same color are preserved because the flood fill
 * never crosses a contrasting outline.
 */
export function removeEdgeBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: BackgroundRemovalOptions = {},
) {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) {
    return pixels
  }

  const tolerance = options.tolerance ?? 34
  const alphaThreshold = options.alphaThreshold ?? 16
  const corners = [0, width - 1, (height - 1) * width, width * height - 1]
  const referenceSamples = corners
    .map((index) => index * 4)
    .filter((offset) => (pixels[offset + 3] ?? 0) >= alphaThreshold)

  if (referenceSamples.length === 0) return pixels

  const reference = [0, 1, 2].map((channel) => {
    const values = referenceSamples
      .map((offset) => pixels[offset + channel] ?? 0)
      .sort((first, second) => first - second)
    return values[Math.floor(values.length / 2)] ?? 0
  }) as [number, number, number]

  const result = new Uint8ClampedArray(pixels)
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  const enqueue = (index: number) => {
    if (visited[index]) return
    visited[index] = 1
    queue[tail] = index
    tail += 1
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width)
    enqueue(y * width + width - 1)
  }

  while (head < tail) {
    const index = queue[head]
    head += 1
    if (index === undefined) continue
    const offset = index * 4
    const alpha = result[offset + 3] ?? 0
    const removable =
      alpha < alphaThreshold ||
      colorDistance(result, offset, reference) <= tolerance
    if (!removable) continue

    result[offset + 3] = 0
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) enqueue(index - 1)
    if (x < width - 1) enqueue(index + 1)
    if (y > 0) enqueue(index - width)
    if (y < height - 1) enqueue(index + width)
  }

  return result
}
