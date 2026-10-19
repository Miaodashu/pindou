import type { BeadPalette } from '@/domain/palette/types'

export interface BeanInventoryRecord {
  paletteId: string
  quantities: Record<string, number>
  updatedAt: string
}

export interface ColorUsageEntry {
  colorIndex: number
  count: number
}

export function normalizeStock(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(999_999, Math.floor(parsed)))
}

export function calculateInventory(
  palette: BeadPalette,
  quantities: Record<string, number>,
  usage: ColorUsageEntry[],
) {
  const usageByIndex = new Map(
    usage.map((entry) => [entry.colorIndex, entry.count]),
  )
  const rows = palette.colors.map((color, index) => {
    const stock = normalizeStock(quantities[color.id])
    const used = usageByIndex.get(index + 1) ?? 0
    return {
      colorIndex: index + 1,
      color,
      stock,
      used,
      remaining: Math.max(stock - used, 0),
      shortage: Math.max(used - stock, 0),
    }
  })

  return {
    rows,
    totalStock: rows.reduce((sum, row) => sum + row.stock, 0),
    totalUsed: rows.reduce((sum, row) => sum + row.used, 0),
    totalRemaining: rows.reduce((sum, row) => sum + row.remaining, 0),
    totalShortage: rows.reduce((sum, row) => sum + row.shortage, 0),
  }
}
