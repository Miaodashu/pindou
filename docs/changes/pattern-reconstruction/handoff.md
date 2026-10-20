# Handoff: 模糊图纸高清重建

- Change ID: `pattern-reconstruction`
- Current status: implemented and verified
- Last updated: 2026-10-20

## Implemented

- 新增 `/reconstruct` 独立工作区和首页、主导航入口。
- 新增图片导入、网格行列预设与四边界叠加校准。
- 将第二步校准区移入右侧主工作区；桌面端预览宽度保持在 600px 以上，四边控制栏位于画布上方并在滚动长图时吸顶保持可见。
- 四条蓝色外框均支持鼠标或触控直接拖动，并保留滑块作为精细调整和键盘操作入口。
- 新增避开格子中心文字的上下色带中位数采样算法。
- 新增 Worker 内 CIEDE2000 色卡匹配、置信度与待确认格计算。
- 新增原图图例色号约束，避免压缩偏色引入原图未使用的近似色号。
- 新增带坐标、色号、主网格线的清晰 Canvas 预览和单格校正。
- 新增真正矢量化的 SVG 输出、高清 PNG 输出和编辑器导入。

## Verification

- `npm run check`：通过（11 个测试文件、26 个单元测试，并通过类型检查、Lint 与生产构建）。
- `npm run e2e`：通过（Chromium / WebKit 共 24 个端到端场景）。
- 端到端测试覆盖校准预览宽度、滚动后的控制栏位置，以及直接拖动左边界后同步更新滑块数值。
- 使用真实的 78 × 99 规则模糊图纸校准外框并重建：识别 4,720 个非空格；加入原图图例色号约束后，待确认格由 2,871 降至 800。
- 已确认待确认格可点击修改，结果可送入编辑器继续编辑。
- 已下载 SVG 并检查输出仅由矢量色块、文字、坐标和网格线组成，不嵌入原位图。
- 实际重建截图保存在 `docs/changes/pattern-reconstruction/reference-result.png`。

## Known limits

- 网格行列数需要用户确认，避免自动算法在装饰边框或水印区域静默识别错误。
- 第一版不处理明显透视、纸张弯曲和被遮挡的格子。
- 屏幕参考色仍不能替代实物色卡；待确认格应由用户复核。

## Rollback

删除 `/reconstruct` 路由及 `src/features/reconstruction/`、`src/core/patternReconstruction.ts`、`src/core/reconstructionSvg.ts` 即可回滚；现有图纸和 IndexedDB 数据结构未迁移。
