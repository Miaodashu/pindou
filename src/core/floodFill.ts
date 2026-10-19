export function findFloodFillIndexes(
  cells: readonly number[],
  width: number,
  height: number,
  startIndex: number,
): number[] {
  const source = cells[startIndex]
  if (source === undefined) return []

  const result: number[] = []
  const visited = new Uint8Array(cells.length)
  const stack = [startIndex]

  while (stack.length > 0) {
    const index = stack.pop()
    if (
      index === undefined ||
      visited[index] === 1 ||
      cells[index] !== source
    ) {
      continue
    }

    visited[index] = 1
    result.push(index)

    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) stack.push(index - 1)
    if (x < width - 1) stack.push(index + 1)
    if (y > 0) stack.push(index - width)
    if (y < height - 1) stack.push(index + width)
  }

  return result
}
