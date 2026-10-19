export interface GridPoint {
  x: number
  y: number
}

export type SelectionMode = 'rectangle' | 'lasso'

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function rectangleSelection(
  width: number,
  height: number,
  start: GridPoint,
  end: GridPoint,
) {
  const startX = clamp(Math.floor(Math.min(start.x, end.x)), 0, width - 1)
  const endX = clamp(Math.floor(Math.max(start.x, end.x)), 0, width - 1)
  const startY = clamp(Math.floor(Math.min(start.y, end.y)), 0, height - 1)
  const endY = clamp(Math.floor(Math.max(start.y, end.y)), 0, height - 1)
  const indexes: number[] = []

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      indexes.push(y * width + x)
    }
  }
  return indexes
}

function isPointInPolygon(point: GridPoint, polygon: GridPoint[]) {
  let inside = false
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    if (!currentPoint || !previousPoint) continue
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x
    if (crosses) inside = !inside
  }
  return inside
}

export function lassoSelection(
  width: number,
  height: number,
  points: GridPoint[],
) {
  if (points.length < 3) return []
  const minimumX = clamp(
    Math.floor(Math.min(...points.map((point) => point.x))),
    0,
    width - 1,
  )
  const maximumX = clamp(
    Math.ceil(Math.max(...points.map((point) => point.x))),
    0,
    width - 1,
  )
  const minimumY = clamp(
    Math.floor(Math.min(...points.map((point) => point.y))),
    0,
    height - 1,
  )
  const maximumY = clamp(
    Math.ceil(Math.max(...points.map((point) => point.y))),
    0,
    height - 1,
  )
  const indexes: number[] = []

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      if (isPointInPolygon({ x: x + 0.5, y: y + 0.5 }, points)) {
        indexes.push(y * width + x)
      }
    }
  }
  return indexes
}
