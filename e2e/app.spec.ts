import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'

async function openFullEditor(page: Page) {
  await page.getByRole('button', { name: '编辑当前图纸' }).click()
  await expect(page.getByLabel('拼豆图纸画布')).toBeVisible()
}

async function chooseColor(page: Page, name: string) {
  await page.locator('.current-color').click()
  await page.getByRole('button', { name }).click()
}

test('opens the editor from the home page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '开始生成图纸' }).click()

  await expect(page).toHaveURL(/\/editor$/)
  await expect(
    page.getByRole('heading', { name: '选择一张图片，从裁切开始' }),
  ).toBeVisible()
  await openFullEditor(page)
  await expect(page.getByLabel('拼豆图纸画布')).toBeVisible()
  await expect(page.getByLabel('X 坐标')).toBeVisible()
  await expect(page.getByLabel('Y 坐标')).toBeVisible()
  await expect(page.getByText('色号用量')).toBeVisible()
})

test('supports blank drawing and tracing in the dedicated creation board', async ({
  page,
}) => {
  await page.goto('/draw')

  await expect(page.getByRole('heading', { name: '创作画板' })).toBeVisible()
  await expect(page.locator('.draw-page')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByLabel('拼豆图纸画布')).toBeVisible()

  await page.getByLabel('新图纸宽度').fill('12')
  await page.getByLabel('新图纸高度').fill('13')
  await expect(page.getByLabel('新图纸宽度')).toHaveValue('12')
  await expect(page.getByLabel('新图纸高度')).toHaveValue('13')
  await page.getByRole('button', { name: '新建空白画布' }).click()
  await expect(page.locator('.canvas-options > span')).toHaveText('12 × 13')

  await page.getByRole('button', { name: '临摹创作' }).click()
  await page.getByLabel('上传临摹图片').setInputFiles({
    name: 'drawing-trace.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#ef4444"/></svg>',
    ),
  })
  await expect(page.getByText('drawing-trace.svg')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '显示临摹图' }),
  ).toHaveAttribute('aria-pressed', 'true')

  const horizontalGridSize = page.getByLabel('临摹图横向网格大小')
  const verticalGridSize = page.getByLabel('临摹图纵向网格大小')
  await horizontalGridSize.fill('125')
  await expect(horizontalGridSize).toHaveValue('125')
  await expect(verticalGridSize).toHaveValue('125')
  await page.getByLabel('宽高联动').uncheck()
  await verticalGridSize.fill('110')
  await expect(horizontalGridSize).toHaveValue('125')
  await expect(verticalGridSize).toHaveValue('110')
  await page.getByRole('button', { name: '复位网格大小' }).click()
  await expect(horizontalGridSize).toHaveValue('100')
  await expect(verticalGridSize).toHaveValue('100')

  const dragTracing = page.getByRole('button', {
    name: '拖拽调整临摹图位置',
  })
  await expect(dragTracing).toHaveAttribute('aria-pressed', 'true')
  const traceCanvas = page.getByLabel('拼豆图纸画布')
  const traceBounds = await traceCanvas.boundingBox()
  expect(traceBounds).not.toBeNull()
  await page.mouse.move(traceBounds!.x + 80, traceBounds!.y + 80)
  await page.mouse.down()
  await page.mouse.move(traceBounds!.x + 120, traceBounds!.y + 100, {
    steps: 5,
  })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: /复位 ·/ })).toContainText(
    '2，1',
  )

  await page.getByRole('button', { name: '画笔 P' }).click()
  await expect(dragTracing).toHaveAttribute('aria-pressed', 'false')
  await page.getByLabel('拼豆图纸画布').click({ position: { x: 10, y: 10 } })
  await page.getByRole('tab', { name: '色号用量' }).click()
  await expect(page.locator('.usage-summary')).toContainText('1')
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
  const cropDialog = page.getByRole('dialog', {
    name: '裁切图片并设置生成策略',
  })
  await expect(cropDialog.getByText(/7\.5 ×\s+7\.5 cm/)).toBeVisible()
  const strategy = cropDialog.getByLabel('生成策略')
  const maxColors = cropDialog.getByLabel('颜色上限')
  await strategy.selectOption('closest')
  await expect(maxColors).toBeDisabled()
  await strategy.selectOption('balanced')
  await expect(maxColors).toBeEnabled()
  await cropDialog.getByLabel('背景处理').selectOption('remove-edge')
  await cropDialog.getByRole('button', { name: '自由裁切' }).click()
  await expect(
    cropDialog.getByRole('button', { name: '自由裁切' }),
  ).toHaveAttribute('aria-pressed', 'true')
  const convertButton = cropDialog.getByRole('button', { name: '生成图纸' })
  await expect(convertButton).toBeEnabled({ timeout: 5_000 })
  await convertButton.click()

  await page.getByText('转换详情', { exact: true }).click()
  await expect(page.getByText(/OpenCV\.js \/ WASM ·/)).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByLabel('重新上传原图')).toBeVisible()
  const preview = page.getByLabel('生成图纸预览')
  await preview.hover({ position: { x: 12, y: 12 } })
  await expect(page.getByText(/格同色区域/)).toBeVisible()
})

test('imports a measured palette without exposing project export', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.getByRole('button', { name: '导出项目' })).toHaveCount(0)
  await openFullEditor(page)
  await page.locator('.current-color').click()
  await page
    .locator('input[type="file"][accept="application/json,.json"]')
    .setInputFiles('public/examples/palette-template.json')

  await expect(
    page.getByRole('heading', { name: '示例实测色卡' }),
  ).toBeVisible()
  await expect(page.getByText('来源：实物测色')).toBeVisible()
})

test('persists a drawn bead across reloads', async ({ page }) => {
  await page.goto('/editor')
  await openFullEditor(page)
  await page.getByRole('button', { name: '画笔 P' }).click()
  const canvas = page.getByLabel('拼豆图纸画布')
  await canvas.click({ position: { x: 12, y: 12 } })

  await expect(page.locator('.summary-panel h2')).toContainText('1 颗')
  await expect(
    page.getByRole('dialog', { name: '全屏图纸精修' }).getByText('已自动保存'),
  ).toBeVisible()

  await page.reload()
  await openFullEditor(page)
  await expect(page.locator('.summary-panel h2')).toContainText('1 颗')
})

test('upgrades a v4 database and migrates the legacy derived link', async ({
  page,
}) => {
  await page.goto('/examples/palette-template.json')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('pindou-studio', 4)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        const database = request.result
        const patterns = database.createObjectStore('patterns', {
          keyPath: 'id',
        })
        patterns.createIndex('by-updated-at', 'updatedAt')
        database.createObjectStore('palettes', { keyPath: 'id' })
        database.createObjectStore('inventories', { keyPath: 'paletteId' })
        database.createObjectStore('tracingAssets', { keyPath: 'patternId' })
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('patterns', 'readwrite')
        const store = transaction.objectStore('patterns')
        store.put({
          version: 1,
          id: 'legacy-source',
          title: '旧版大图原稿',
          paletteId: 'mard-221-reference-v1',
          width: 2,
          height: 2,
          cells: [1, 1, 1, 1],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
        store.put({
          version: 1,
          id: 'legacy-derived',
          title: '旧版小图副本',
          paletteId: 'mard-221-reference-v1',
          width: 1,
          height: 1,
          cells: [1],
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        })
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })
    localStorage.setItem(
      'pindou-derived-pattern-link-v1',
      JSON.stringify({
        derivedPatternId: 'legacy-derived',
        sourcePatternId: 'legacy-source',
      }),
    )
  })

  await page.goto('/editor')
  await expect(page.locator('.editor-page')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await expect(page.getByLabel('图纸名称')).toHaveValue('旧版小图副本')
  await openFullEditor(page)
  await expect(page.locator('.restore-large-pattern')).toHaveCount(1)

  const migrated = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pindou-studio')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction(
      ['patterns', 'derivedPatternLinks'],
      'readonly',
    )
    const patternRequest = transaction
      .objectStore('patterns')
      .get('legacy-source')
    const linkRequest = transaction
      .objectStore('derivedPatternLinks')
      .get('legacy-derived')
    const result = await new Promise<{
      version: number
      sourceTitle?: string
      linkVersion?: number
      legacyValue: string | null
    }>((resolve, reject) => {
      transaction.oncomplete = () =>
        resolve({
          version: database.version,
          sourceTitle: patternRequest.result?.title,
          linkVersion: linkRequest.result?.version,
          legacyValue: localStorage.getItem('pindou-derived-pattern-link-v1'),
        })
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    return result
  })
  expect(migrated).toEqual({
    version: 5,
    sourceTitle: '旧版大图原稿',
    linkVersion: 1,
    legacyValue: null,
  })
})

test('switches render modes, picks colors, and exports both views', async ({
  page,
}) => {
  await page.goto('/editor')
  await openFullEditor(page)
  const canvas = page.getByLabel('拼豆图纸画布')

  await chooseColor(page, 'C5 蓝青系 C5')
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
  expect(constructionPixel).toEqual(colorBlockPixel)

  await chooseColor(page, 'F3 红色系 F3')
  await page.getByRole('button', { name: '取色 I' }).click()
  await canvas.click({ position: { x: 12, y: 12 } })
  await expect(page.locator('.current-color strong')).toHaveText('C5')
  await expect(page.getByRole('button', { name: '画笔 P' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await chooseColor(page, 'F3 红色系 F3')
  await canvas.click({ position: { x: 12, y: 12 }, modifiers: ['Alt'] })
  await expect(page.locator('.current-color strong')).toHaveText('C5')

  await page.getByRole('button', { name: '色块图', exact: true }).click()
  const gridButton = page.getByRole('button', { name: '网格' })
  await expect(gridButton).toHaveAttribute('aria-pressed', 'true')
  await gridButton.click()
  await expect(gridButton).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: '完成' }).click()
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
  await openFullEditor(page)
  const canvas = page.getByLabel('拼豆图纸画布')

  await page.locator('.current-color').click()
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
  await page.getByRole('button', { name: '替换 C5' }).click()
  const replaceDialog = page.getByRole('dialog', { name: '替换颜色' })
  await replaceDialog.getByRole('button', { name: '全部色卡' }).click()
  await replaceDialog.getByPlaceholder('搜索色号、名称或 HEX').fill('F3')
  await replaceDialog.getByRole('button', { name: /F3/ }).click()
  await replaceDialog.getByRole('button', { name: '替换全部 1 格' }).click()
  await expect(page.getByText('已将 C5 替换为 F3 · 可撤销')).toBeVisible()
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const target = element as HTMLCanvasElement
        const scale = target.width / target.clientWidth
        return Array.from(
          target
            .getContext('2d')
            ?.getImageData(Math.round(4 * scale), Math.round(4 * scale), 1, 1)
            .data ?? [],
        ).slice(0, 3)
      }),
    )
    .toEqual([247, 73, 65])

  const guideButton = page.getByRole('button', { name: '参考线' })
  await guideButton.click()
  await expect(guideButton).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '水平翻转' }).click()
  await expect(page.getByText('图纸已水平翻转')).toBeVisible()
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const target = element as HTMLCanvasElement
        const scale = target.width / target.clientWidth
        return Array.from(
          target
            .getContext('2d')
            ?.getImageData(Math.round(704 * scale), Math.round(4 * scale), 1, 1)
            .data ?? [],
        ).slice(0, 3)
      }),
    )
    .toEqual([247, 73, 65])
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.locator('.summary-panel h2')).toContainText('1 颗')
})

test('exports an inventory-aware CSV', async ({ page }) => {
  await page.goto('/inventory')
  await page.getByLabel('C5 库存数量').fill('7')
  await page.getByLabel('C5 库存数量').press('Tab')
  await page.getByRole('link', { name: '图纸编辑器', exact: true }).click()
  await openFullEditor(page)
  const canvas = page.getByLabel('拼豆图纸画布')
  await chooseColor(page, 'C5 蓝青系 C5')
  await canvas.click({ position: { x: 12, y: 12 } })

  await page.getByRole('button', { name: '完成' }).click()
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
  await openFullEditor(page)
  const canvas = page.getByLabel('拼豆图纸画布')
  await page.getByRole('button', { name: '选区 S' }).click()

  const fillSelection = page.getByRole('button', { name: /填充选区/ })
  await expect(fillSelection).toBeDisabled()
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.move(bounds!.x + 4, bounds!.y + 4)
  await page.mouse.down()
  await page.mouse.move(bounds!.x + 54, bounds!.y + 54, { steps: 5 })
  await page.mouse.up()

  await expect(page.getByText('已选择 9 格')).toBeVisible()
  await expect(fillSelection).toBeEnabled()
  await chooseColor(page, 'C5 蓝青系 C5')
  await fillSelection.click()
  await expect(page.locator('.summary-panel h2')).toContainText('9 颗')
  await expect(page.getByText('已用 C5 填充 9 格')).toBeVisible()

  await page.getByRole('button', { name: '取消选区' }).click()
  await page.getByRole('button', { name: '选区 S' }).click()
  await expect(page.getByText('在画布上拖动创建选区')).toBeVisible()
  await page.getByRole('button', { name: '套索' }).click()
  await page.mouse.move(bounds!.x + 4, bounds!.y + 4)
  await page.mouse.down()
  await page.mouse.move(bounds!.x + 79, bounds!.y + 4, { steps: 3 })
  await page.mouse.move(bounds!.x + 79, bounds!.y + 79, { steps: 3 })
  await page.mouse.move(bounds!.x + 4, bounds!.y + 79, { steps: 3 })
  await page.mouse.move(bounds!.x + 4, bounds!.y + 4, { steps: 3 })
  await page.mouse.up()
  await expect(page.getByText(/已选择 \d+ 格/)).toBeVisible()
  await expect(fillSelection).toBeEnabled()
})

test('uses Mard by default and tracks warehouse stock against live usage', async ({
  page,
}) => {
  await page.goto('/inventory')
  await expect(
    page.getByRole('heading', { name: 'Mard 221 色卡' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Mard · 221 色 · 2026\.10-reference\.2/),
  ).toBeVisible()

  await page.getByLabel('C5 库存数量').fill('5')
  await page.getByLabel('C5 库存数量').press('Tab')

  await page.getByRole('link', { name: /回到图纸编辑器/ }).click()
  await openFullEditor(page)
  await chooseColor(page, 'C5 蓝青系 C5')
  await page.getByLabel('拼豆图纸画布').click({ position: { x: 12, y: 12 } })
  await page
    .getByRole('dialog', { name: '全屏图纸精修' })
    .getByRole('link', { name: '豆仓', exact: true })
    .click()

  const warehouse = page.locator('.inventory-workspace')
  const c5Row = warehouse.getByRole('row', { name: /^C5 / })
  await expect(c5Row).toContainText('1')
  await expect(c5Row).toContainText('余 4')
  await expect(warehouse.getByText('缺豆数量')).toBeVisible()
  await expect(page.getByRole('button', { name: '本图使用' })).toBeVisible()
})

test('keeps bean inventory on its own route outside the editor', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('.inventory-workspace')).toHaveCount(0)
  await openFullEditor(page)
  await page
    .getByRole('dialog', { name: '全屏图纸精修' })
    .getByRole('link', { name: '豆仓', exact: true })
    .click()

  await expect(page).toHaveURL(/\/inventory$/)
  await expect(
    page.getByRole('heading', { name: '独立豆仓，清楚掌握每一个色号' }),
  ).toBeVisible()
  await expect(page.getByPlaceholder('搜索色号、名称或 HEX')).toBeVisible()
})

test('reconstructs a blurry chart into a real SVG and opens it in the editor', async ({
  page,
}) => {
  await page.goto('/reconstruct')
  await page
    .locator('input[type="file"][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles({
      name: 'blurry-chart.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0s8AAAAASUVORK5CYII=',
        'base64',
      ),
    })
  const calibrationWidth = await page
    .getByRole('group', { name: '网格校准预览' })
    .evaluate((element) => element.clientWidth)
  expect(calibrationWidth).toBeGreaterThan(600)
  const calibrationPreview = page.getByRole('group', {
    name: '网格校准预览',
  })
  await calibrationPreview.scrollIntoViewIfNeeded()
  const dockBox = await page.locator('.calibration-dock').boundingBox()
  expect(dockBox).not.toBeNull()
  expect(dockBox!.y).toBeGreaterThanOrEqual(70)
  expect(dockBox!.y).toBeLessThan(120)
  const calibrationBox = await calibrationPreview.boundingBox()
  expect(calibrationBox).not.toBeNull()
  const initialLeft = Number(await page.getByLabel('左边界').inputValue())
  await page.mouse.move(
    calibrationBox!.x + calibrationBox!.width * 0.015,
    calibrationBox!.y + calibrationBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    calibrationBox!.x + calibrationBox!.width * 0.08,
    calibrationBox!.y + calibrationBox!.height / 2,
  )
  await page.mouse.up()
  expect(Number(await page.getByLabel('左边界').inputValue())).toBeGreaterThan(
    initialLeft,
  )
  await page.getByLabel('列数').fill('1')
  await page.getByLabel('行数').fill('1')
  await page.getByRole('button', { name: '开始高清重建' }).click()

  await expect(page.getByLabel('高清重建图纸')).toBeVisible()
  await expect(
    page.locator('.result-summary').getByText('1 × 1', { exact: true }),
  ).toBeVisible()

  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 SVG' }).click()
  const svgPath = await (await svgDownload).path()
  expect(svgPath).not.toBeNull()
  const svg = await readFile(svgPath!, 'utf8')
  expect(svg).toContain('<svg')
  expect(svg).not.toContain('<image')

  await page.getByRole('button', { name: /进入编辑器继续修改/ }).click()
  await expect(page).toHaveURL(/\/editor$/)
  await openFullEditor(page)
  await expect(page.getByLabel('拼豆图纸画布')).toBeVisible()
})

test('uploads and persists a non-exported tracing image with alignment controls', async ({
  page,
}) => {
  await page.goto('/editor')
  await expect(page.locator('.editor-page')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await openFullEditor(page)
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
  await openFullEditor(page)
  await expect(page.getByText('trace.svg')).toBeVisible()
  await expect(page.getByText('偏移：1，1')).toBeVisible()
  await expect(page.getByText('64%')).toBeVisible()
  await expect(visibility).toBeChecked()
})
