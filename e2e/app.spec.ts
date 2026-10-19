import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('opens the editor from the home page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '开始生成图纸' }).click()

  await expect(page).toHaveURL(/\/editor$/)
  await expect(page.getByLabel('拼豆图纸画布')).toBeVisible()
  await expect(page.getByLabel('X 坐标')).toBeVisible()
  await expect(page.getByLabel('Y 坐标')).toBeVisible()
  await expect(page.getByText('材料清单')).toBeVisible()
})

test('converts an imported image with OpenCV WebAssembly', async ({ page }) => {
  await page.goto('/editor')
  const fileInput = page.locator('input[type="file"][accept*="image/png"]')
  await expect(fileInput).toHaveCount(1)
  await fileInput.setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0s8AAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(page.getByLabel('图片裁切预览')).toBeVisible()
  await expect(page.getByText('预计成品 14.5 × 14.5 cm')).toBeVisible()
  const strategy = page.getByLabel('生成策略')
  const maxColors = page.getByLabel('颜色上限')
  await strategy.selectOption('closest')
  await expect(maxColors).toBeDisabled()
  await strategy.selectOption('balanced')
  await expect(maxColors).toBeEnabled()
  await page.getByLabel('背景处理').selectOption('remove-edge')
  const cropZoom = page.getByLabel('裁切缩放')
  await cropZoom.fill('1.5')
  await expect(cropZoom).toHaveValue('1.5')
  const convertButton = page.getByRole('button', { name: '转换为当前图纸' })
  await expect(convertButton).toBeEnabled({ timeout: 5_000 })
  await convertButton.click()

  await expect(page.getByText('OpenCV.js / WASM')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText('实际颜色')).toBeVisible()
})

test('imports a measured palette and exports it with the project', async ({
  page,
}) => {
  await page.goto('/editor')
  await page
    .locator('input[type="file"][accept="application/json,.json"]')
    .setInputFiles('public/examples/palette-template.json')

  await expect(
    page.getByRole('heading', { name: '示例实测色卡' }),
  ).toBeVisible()
  await expect(page.getByText('来源：实物测色')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出项目' }).click()
  const path = await (await downloadPromise).path()
  expect(path).not.toBeNull()

  const project = JSON.parse(await readFile(path!, 'utf8')) as {
    kind: string
    palette: { id: string; colors: unknown[] }
  }
  expect(project.kind).toBe('pindou-project')
  expect(project.palette.id).toBe('example-measured-v1')
  expect(project.palette.colors).toHaveLength(2)
})

test('persists a drawn bead across reloads', async ({ page }) => {
  await page.goto('/editor')
  const canvas = page.getByLabel('拼豆图纸画布')
  await canvas.click({ position: { x: 12, y: 12 } })

  await expect(page.locator('.summary-panel strong').first()).toHaveText('1')
  await expect(page.getByText('已自动保存')).toBeVisible()

  await page.reload()
  await expect(page.locator('.summary-panel strong').first()).toHaveText('1')
})

test('switches render modes, picks colors, and exports both views', async ({
  page,
}) => {
  await page.goto('/editor')
  const canvas = page.getByLabel('拼豆图纸画布')

  await page.getByRole('button', { name: 'C5 蓝青系 C5' }).click()
  await canvas.click({ position: { x: 12, y: 12 } })
  await page.getByRole('button', { name: '色块图', exact: true }).click()

  const colorBlockPixel = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement
    const scale = target.width / target.clientWidth
    const context = target.getContext('2d')
    return Array.from(
      context?.getImageData(Math.round(4 * scale), Math.round(4 * scale), 1, 1)
        .data ?? [],
    ).slice(0, 3)
  })
  expect(colorBlockPixel).toEqual([1, 172, 235])

  await page.getByRole('button', { name: '施工图', exact: true }).click()
  const constructionPixel = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement
    const scale = target.width / target.clientWidth
    const context = target.getContext('2d')
    return Array.from(
      context?.getImageData(Math.round(4 * scale), Math.round(4 * scale), 1, 1)
        .data ?? [],
    ).slice(0, 3)
  })
  expect(constructionPixel).not.toEqual(colorBlockPixel)

  await page.getByRole('button', { name: 'F3 红色系 F3' }).click()
  await page.getByRole('button', { name: /取色/ }).click()
  await canvas.click({ position: { x: 12, y: 12 } })
  await expect(page.locator('.help-panel strong')).toHaveText('C5')
  await expect(page.getByRole('button', { name: /画笔/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByRole('button', { name: 'F3 红色系 F3' }).click()
  await canvas.click({ position: { x: 12, y: 12 }, modifiers: ['Alt'] })
  await expect(page.locator('.help-panel strong')).toHaveText('C5')

  await page.getByRole('button', { name: '色块图', exact: true }).click()
  const gridButton = page.getByRole('button', { name: '网格' })
  await expect(gridButton).toHaveAttribute('aria-pressed', 'true')
  await gridButton.click()
  await expect(gridButton).toHaveAttribute('aria-pressed', 'false')

  const constructionDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出施工图' }).click()
  expect((await constructionDownload).suggestedFilename()).toContain(
    '施工图.png',
  )

  const colorBlockDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出色块图' }).click()
  expect((await colorBlockDownload).suggestedFilename()).toContain('色块图.png')
})

test('searches colors and applies production editing helpers', async ({
  page,
}) => {
  await page.goto('/editor')
  const canvas = page.getByLabel('拼豆图纸画布')

  const search = page.getByPlaceholder('搜索色号、名称或 HEX')
  await page.getByRole('button', { name: 'B 色系' }).click()
  await expect(page.getByRole('button', { name: 'C5 蓝青系 C5' })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: 'C 色系' }).click()
  await expect(page.getByRole('button', { name: 'C5 蓝青系 C5' })).toBeVisible()
  await page.getByRole('button', { name: '全部色系' }).click()
  await search.fill('C5')
  await expect(page.getByRole('button', { name: 'C5 蓝青系 C5' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'F3 红色系 F3' })).toHaveCount(
    0,
  )
  await search.fill('')

  await page.getByRole('button', { name: 'C5 蓝青系 C5' }).click()
  await canvas.click({ position: { x: 12, y: 12 } })
  await page.getByRole('button', { name: 'F3 红色系 F3' }).click()
  await page.getByRole('button', { name: '将 C5 全部替换为当前颜色' }).click()
  await expect(page.getByText('已将 C5 全部替换为 F3')).toBeVisible()
  await expect(page.getByText('F3', { exact: true }).last()).toBeVisible()
  const replacedPixel = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement
    const scale = target.width / target.clientWidth
    return Array.from(
      target
        .getContext('2d')
        ?.getImageData(Math.round(4 * scale), Math.round(4 * scale), 1, 1)
        .data ?? [],
    ).slice(0, 3)
  })
  expect(replacedPixel).toEqual([247, 73, 65])

  const guideButton = page.getByRole('button', { name: '参考线' })
  await guideButton.click()
  await expect(guideButton).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '水平翻转' }).click()
  await expect(page.getByText('图纸已水平翻转')).toBeVisible()
  const mirroredPixel = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement
    const scale = target.width / target.clientWidth
    return Array.from(
      target
        .getContext('2d')
        ?.getImageData(Math.round(704 * scale), Math.round(4 * scale), 1, 1)
        .data ?? [],
    ).slice(0, 3)
  })
  expect(mirroredPixel).toEqual([247, 73, 65])
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('.summary-panel strong').first()).toHaveText('1')
})

test('renders a realistic bead preview and exports an inventory-aware CSV', async ({
  page,
}) => {
  await page.goto('/editor')
  const canvas = page.getByLabel('拼豆图纸画布')
  await page.getByRole('button', { name: 'C5 蓝青系 C5' }).click()
  await page.getByLabel('C5 库存数量').fill('7')
  await canvas.click({ position: { x: 12, y: 12 } })

  await page.getByRole('button', { name: '成品预览', exact: true }).click()
  const previewPixels = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement
    const scale = target.width / target.clientWidth
    const context = target.getContext('2d')
    const read = (x: number, y: number) =>
      Array.from(
        context?.getImageData(
          Math.round(x * scale),
          Math.round(y * scale),
          1,
          1,
        ).data ?? [],
      ).slice(0, 3)
    return { bead: read(6, 12), hole: read(12, 12) }
  })
  expect(previewPixels.bead).toEqual([1, 172, 235])
  expect(previewPixels.hole).toEqual([255, 253, 249])

  const previewDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出成品预览' }).click()
  expect((await previewDownload).suggestedFilename()).toContain('成品预览.png')

  const csvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出用量 CSV' }).click()
  const csvPath = await (await csvDownload).path()
  expect(csvPath).not.toBeNull()
  const csv = await readFile(csvPath!, 'utf8')
  expect(csv).toContain('色号,名称,HEX,使用,库存,剩余,缺少')
  expect(csv).toContain('C5')
  expect(csv).toContain(',1,7,6,0')
})

test('requires a rectangle or lasso selection before filling', async ({
  page,
}) => {
  await page.goto('/editor')
  const canvas = page.getByLabel('拼豆图纸画布')
  await page.getByRole('button', { name: /选区/ }).click()

  const fillSelection = page.getByRole('button', { name: /填充选区/ })
  await expect(fillSelection).toBeDisabled()
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.move(bounds!.x + 4, bounds!.y + 4)
  await page.mouse.down()
  await page.mouse.move(bounds!.x + 54, bounds!.y + 54, { steps: 5 })
  await page.mouse.up()

  await expect(page.getByText('已选 9 格')).toBeVisible()
  await expect(fillSelection).toBeEnabled()
  await page.getByRole('button', { name: 'C5 蓝青系 C5' }).click()
  await fillSelection.click()
  await expect(page.locator('.summary-panel strong').first()).toHaveText('9')
  await expect(page.getByText('已用 C5 填充 9 格')).toBeVisible()

  await page.getByRole('button', { name: '取消' }).click()
  await expect(fillSelection).toBeDisabled()
  await page.getByRole('button', { name: '套索' }).click()
  await page.mouse.move(bounds!.x + 4, bounds!.y + 4)
  await page.mouse.down()
  await page.mouse.move(bounds!.x + 79, bounds!.y + 4, { steps: 3 })
  await page.mouse.move(bounds!.x + 79, bounds!.y + 79, { steps: 3 })
  await page.mouse.move(bounds!.x + 4, bounds!.y + 79, { steps: 3 })
  await page.mouse.move(bounds!.x + 4, bounds!.y + 4, { steps: 3 })
  await page.mouse.up()
  await expect(page.getByText(/已选 \d+ 格/)).toBeVisible()
  await expect(fillSelection).toBeEnabled()
})

test('uses Mard by default and tracks warehouse stock against live usage', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(
    page.getByRole('heading', { name: 'Mard 221 色卡' }),
  ).toBeVisible()
  await expect(page.getByText('Mard · v2026.10-reference.2')).toBeVisible()

  await page.getByRole('button', { name: 'C5 蓝青系 C5' }).click()
  await page.getByLabel('C5 库存数量').fill('5')
  await page.getByLabel('C5 库存数量').press('Enter')
  await page.getByLabel('拼豆图纸画布').click({ position: { x: 12, y: 12 } })

  const warehouse = page.locator('.inventory-panel')
  await expect(warehouse.getByText('用 1')).toBeVisible()
  await expect(warehouse.getByText('余 4')).toBeVisible()
  await expect(warehouse.getByText('缺豆')).toBeVisible()
})

test('uploads and persists a non-exported tracing image with alignment controls', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('.editor-page')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await page.getByLabel('上传临摹垫图').setInputFiles({
    name: 'trace.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#ef4444"/></svg>',
    ),
  })

  await expect(page.getByText('trace.svg')).toBeVisible()
  const visibility = page.getByRole('checkbox', { name: /显示临摹垫图/ })
  await expect(visibility).toBeChecked()
  await page.getByRole('button', { name: '垫图右移一格' }).click()
  await page.getByRole('button', { name: '垫图下移一格' }).click()
  await expect(page.getByText('偏移：1，1')).toBeVisible()
  await page.getByLabel('垫图透明度').fill('64')
  await expect(page.getByText('64%')).toBeVisible()

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const request = indexedDB.open('pindou-studio')
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          const transaction = database.transaction('tracingAssets', 'readonly')
          const recordsRequest = transaction
            .objectStore('tracingAssets')
            .getAll()
          const records = await new Promise<
            Array<{
              fileName: string
              offsetX: number
              offsetY: number
              opacity: number
            }>
          >((resolve, reject) => {
            recordsRequest.onsuccess = () => resolve(recordsRequest.result)
            recordsRequest.onerror = () => reject(recordsRequest.error)
          })
          database.close()
          return records.map(({ fileName, offsetX, offsetY, opacity }) => ({
            fileName,
            offsetX,
            offsetY,
            opacity,
          }))
        }),
      { timeout: 5_000 },
    )
    .toEqual([{ fileName: 'trace.svg', offsetX: 1, offsetY: 1, opacity: 0.64 }])
  await page.reload()
  await expect(page.getByText('trace.svg')).toBeVisible()
  await expect(page.getByText('偏移：1，1')).toBeVisible()
  await expect(page.getByText('64%')).toBeVisible()
  await expect(visibility).toBeChecked()
})
