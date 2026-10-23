# Handoff: 自适应图片转拼豆管线 V2

- Change ID: `adaptive-conversion-v2`
- Current status: implemented and verified
- Last updated: 2026-10-23

## Completed

- 新增原图尺度 Sobel/透明边界检测和 7×7 自适应区域采样。
- OpenCV Worker 在采样前执行低强度双边滤波，并按生成策略调整滤波强度。
- 平坦区域在线性 RGB 空间平均，高变化区域选择带中心细节保护的主导源颜色。
- 限色调色板在贪心选色后增加最多两轮确定性交换优化。
- 新增按生成策略配置、受强边缘保护的小连通区域清理。
- 转换报告显示“自适应采样 V2”和已清理孤立格数量。
- 保留 V1 经典缩放为内部回退，并让报告展示实际运行版本。
- OpenCV 与降级路径共用透明感知滤波，避免透明 PNG 隐藏 RGB 形成彩边。

## Current implementation state

V2 直接替换新转换任务的采样阶段，最终输出仍是原有色卡索引数组，因此编辑器、自动保存和历史图纸无需迁移。OpenCV 不可用时使用相同自适应采样器和 TypeScript 边缘检测。

## Verification performed

- `npm run check`：通过，包含类型检查、Lint、13 个测试文件共 36 个单元测试和生产构建。
- Playwright 图片转换专项：Chromium 与 WebKit 各 1 个场景通过，实际使用 OpenCV.js/WASM Worker。
- 双轴代码复审：Standards 与 Spec 首轮问题均已修正，Standards 复审无剩余问题。

## Remaining work

- 建立固定的照片、插画、透明 PNG、文字与细线基准图集，记录 V1/V2 人工偏好和边缘保留率。
- 根据真实图片基准校准中心细节权重、清理色差阈值和三种策略预设。
- 后续可增加复杂度检测与推荐最小图纸尺寸，但不自动修改用户设置。

## Known issues and risks

- 复杂照片在很小的目标网格上仍受信息容量限制。
- 双边滤波和 7×7 采样提高 Worker 计算量，需要用 300×300 上限场景做性能回归。
- Mard 屏幕参考色仍不能替代实物色卡。

## Important files and decisions

- `src/core/adaptiveSampling.ts`：高分辨率边缘分析和目标格采样。
- `src/core/spatialCleanup.ts`：受边缘约束的连通区域清理与最终色差统计。
- `src/core/quantize.ts`：限定色板交换优化。
- `src/features/converter/imageProcessor.worker.ts`：V2 管线编排和降级路径。

## Recommended next action

运行完整检查与 Chromium/WebKit 图片转换回归，再用至少 20 张真实输入建立可重复的视觉基准。
