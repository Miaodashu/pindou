# 拼豆图纸工作室

一个本地优先的 Vue 3 拼豆图纸编辑器。默认内置 Mard 221 基础色，支持带 X/Y 坐标的手工绘制、取色、矩形/套索选区填充、撤销/重做、镜像翻转、批量换色、图片自由裁切与转换、豆仓、临摹垫图和项目自动保存。

图片转换提供“均衡推荐 / 最接近原图 / 最少颜色”三种确定性策略，可保留透明区域或移除边缘近纯色背景。完成后可以继续逐格修改，并切换色块图、色号施工图和带中孔的拼豆成品预览；支持导出 PNG、库存用量 CSV 和自包含项目 JSON。

## 技术方案

- Vue 3、TypeScript、Vite、Pinia、Vue Router
- 原生 Canvas 2D 绘制密集网格，交互数据与渲染层解耦
- OpenCV.js / WebAssembly 在 Web Worker 中按需加载，避免阻塞主线程和首屏
- CIE Lab + CIEDE2000 色差进行色卡匹配，并提供色差与低置信度提示
- 边缘连通洪水填充去背，只移除和画布边缘相连的近纯色区域
- 可导入官方、实测或数字参考色卡；项目文件携带色卡快照，保证色号映射可复现
- IndexedDB 本地自动保存，Zod 校验版本化项目文件
- Vitest 单元测试与 Playwright Chromium/WebKit 端到端测试

内置 Mard 221 色号及屏幕 HEX 来自数字参考色卡，不是品牌官方实物测色。批次、光线、材料效果和显示设备都会造成差异，正式备料或商业销售前仍应使用实体色卡复核。

## 本地开发

```bash
nvm use
npm ci
npm run dev
```

浏览器访问 Vite 输出的地址。Node.js 版本记录在 `.nvmrc`。

## 质量检查

```bash
npm run check
npm run e2e
```

首次执行端到端测试前安装浏览器：

```bash
npx playwright install chromium webkit
```

更多命令和工程约束见 `AGENTS.md`，图片转换的设计与质量口径见 `docs/architecture/image-conversion.md`，色卡 JSON 说明见 `docs/palette-format.md`。

## 数据与隐私

图片转换和编辑默认全部在浏览器本地完成，图片不会上传。图纸自动保存在当前浏览器的 IndexedDB 中；项目 JSON 可用于备份和迁移。
