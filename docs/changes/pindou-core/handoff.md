# Handoff: 拼豆图纸编辑与图片转换核心

- Change ID: `pindou-core`
- Current status: implemented and verified
- Last updated: 2026-10-20

## Completed

- 初始化 Vue 3 / TypeScript / Vite 工程、Git 远程和 AI 开发工作流。
- 完成 Canvas 图纸编辑器、材料清单与 IndexedDB 自动保存；产品界面不再提供项目文件导入导出。
- 完成“大图裁切 → 原图/图纸左右对比 → 全屏精修”的生成工作台；原图可点击重新上传，裁切支持自由比例与跟随图纸比例切换。
- 完成生成图纸悬停同色区域高亮、顶部当前颜色与快速色盘、取色后自动切回画笔、移动画布工具。
- 完成全屏编辑器、矩形/套索选区填充与清空，以及在用颜色逐色替换（支持全图或选区）。
- 完成施工图/色块图双视图、独立 PNG 导出、可切换网格与中心参考线。
- 完成画板 X/Y 数字坐标轴，以及与目标图纸同宽高比的拖动、缩放图片裁切预览。
- 完成矩形/套索选区、选区边界可视化和仅在有效选区形成后启用的选区填充。
- 完成独立取色工具与 Alt 临时取色、色号搜索、批量换色和水平/垂直翻转。
- 完成 OpenCV.js/WASM Worker 转换、Canvas 降级和 CIEDE2000 色卡量化。
- 完成色卡 JSON 导入、校验、持久化和项目内色卡快照。
- 默认接入 2026 修订版数字参考 Mard 221 基础色卡，并保留旧通用色卡项目的可恢复性。
- 完成均衡推荐、最接近原图、最少颜色三种生成策略，透明留空与边缘纯色去背，以及 5.0/2.6 mm 成品尺寸预估。
- 完成带中孔、阴影和高光的拼豆成品预览与独立 PNG 导出。
- 完成 Mard 色系筛选、当前颜色摘要和限高滚动色板，避免 221 色导致页面过长。
- 完成豆仓库存、使用、剩余、缺豆统计与 UTF-8 BOM 用量 CSV 导出。
- 完成临摹垫图上传、显示、透明度、格级偏移与 IndexedDB 持久化；用 ArrayBuffer 规避 WebKit Blob 存储失败。
- 完成第三版 Crafted Gallery 首页：横幅摄影自然贯穿文案与作品区，文字直接叠图，右侧能力轨、项目介绍和编辑器预览均已落地。
- 完成 Soft UI 设计令牌、Cormorant Garamond / Montserrat 本地字体、Lucide 图标、键盘焦点与 reduced-motion 支持。
- 完成 375 / 768 / 1024 / 1536 响应式验收，并修复路由滚动复位与粘性命令栏遮挡 Canvas 顶部操作的问题。

## Current implementation state

核心本地创作闭环可用。Mard 221 色号与屏幕色值属于数字参考，正式制作仍应以实物色卡复核。当前以 IndexedDB 自动保存和恢复为主，不向用户暴露项目文件导入导出流程。

## Verification performed

- `npm run check`：通过，11 个测试文件共 26 个测试，并完成生产构建。
- `npm run e2e`：通过，Chromium/WebKit 共 24 个场景。
- WebKit 垫图持久化专项回归：连续 3 次通过。
- 浏览器手工验收：Mard 默认色卡、三种生成策略、尺寸预估、色块图/施工图/成品预览、豆仓和工具栏布局正常。
- 应用内浏览器视觉验收：首屏参考稿与 1536 × 1024 实现截图同屏对照；375 / 768 / 1024 / 1536 无页面级横向溢出。

## Remaining work

- 增加 Mard P/Q/R/T/Y/ZG 特殊材质系列；材料效果无法仅靠单一 HEX 表达，默认不应参与普通自动匹配。
- 增加多方案并排预览、局部锁色和低置信度逐格复核。
- 增加 A4 分页打印/PDF 与多底板施工图；按业务范围规划云端能力。

## Known issues and risks

- OpenCV Worker 生产 chunk 约 15 MB，已延迟加载；上线前应配置长期缓存与压缩传输。
- 构建器会提示 OpenCV 包引用的 Node `fs`/`crypto` 被浏览器 externalize；Chromium/WebKit 实测路径正常。
- 色号准确性受输入色卡质量约束，显示器 HEX 不能替代实物测色。

## Important files and decisions

- `src/core/quantize.ts`：有界颜色分桶、颜色选择和感知色差量化。
- `src/features/converter/imageProcessor.worker.ts`：OpenCV/WASM、色卡量化与降级路径。
- `src/features/editor/PatternCanvas.vue`：原生 Canvas 网格渲染和编辑。
- `docs/adr/0001-project-files-carry-palette-snapshots.md`：项目携带色卡快照的决策。

## Recommended next action

建立一套含照片、插画、透明 PNG、纯色背景和高细节边缘的固定基准图集，对三种生成策略记录色差、用色数与人工可铺性评分。
