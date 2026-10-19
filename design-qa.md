# Design QA: 选区与选区填充

- Source visual truth: `docs/changes/pindou-core/selection-reference.png`
- Implementation screenshot: `docs/changes/pindou-core/selection-implementation.png`
- Source pixels: 848 × 456
- Implementation pixels: 3024 × 1964 macOS desktop capture at Retina density; the editor is the right-hand in-app browser pane.
- State: selection tool expanded, lasso selected, a valid selection visible, and fill/cancel actions enabled.
- Comparison date: 2026-10-19

## Full-view comparison evidence

The source is a focused crop of an editing-tools panel, while the implementation screenshot includes the full desktop and existing editor layout. Pixel-for-pixel page comparison is therefore not meaningful. The relevant interaction hierarchy was normalized conceptually: primary tools first, selection-mode controls revealed only after activating selection, guidance/status next, and fill/cancel actions gated by selection validity.

The implementation intentionally retains the product's existing compact coral-and-cream design system rather than copying the reference's larger blue card controls. This keeps the new feature consistent with the surrounding editor.

## Focused region comparison evidence

The editing toolbar region was checked against the reference:

- The selection tool has a distinct active state.
- Rectangle and lasso are presented as mutually exclusive modes.
- The empty state communicates “拖动框选”.
- A completed selection displays the selected cell count.
- “填充选区” and “取消” are disabled without a selection and enabled after one is formed.
- The selected cells have a translucent blue overlay and a clearly visible dashed boundary on the board.

No separate image assets were required. The reference icons were not reproduced because the established application toolbar is text-based; adding a new icon library for one control would introduce a visible inconsistency.

## Required fidelity surfaces

- Fonts and typography: existing application font, weights, shortcut labels, and compact hierarchy are preserved; labels remain legible in the narrow editor pane.
- Spacing and layout rhythm: selection controls form a bordered sub-group directly below the primary tools and wrap without covering persistent controls.
- Colors and visual tokens: active controls use the existing coral accent; the blue canvas selection overlay is reserved for spatial selection feedback and has sufficient contrast over filled and empty cells.
- Image quality and asset fidelity: no raster or decorative assets are used by this feature; the Canvas overlay remains sharp at the current device pixel ratio.
- Copy and content: “选区”, “矩形”, “套索”, “拖动框选”, “已选 N 格”, “填充选区”, and “取消” make the workflow explicit.

## Primary interactions tested

- Rectangle drag creates the expected inclusive cell set.
- Lasso drag creates a polygonal cell set.
- Fill is unavailable before a valid selection exists.
- Fill changes only selected cells and remains undoable.
- Cancel and Escape clear the selection and disable fill again.
- Chromium and WebKit end-to-end coverage passes.
- Browser console: no warnings or errors.

## Findings

No actionable P0, P1, or P2 visual or interaction differences remain. The denser toolbar presentation is an intentional adaptation to the existing editor rather than an unresolved mismatch.

## Comparison history

- Initial implementation: fill was correctly gated, but the enabled fill action had the same visual weight as secondary actions.
- Fix: enabled “填充选区” now uses the product accent as the primary action.
- Post-fix evidence: the saved implementation screenshot shows the selected-cell count, emphasized fill action, cancel action, and selected Canvas region together.

## Follow-up polish

- P3: add selection union/subtract modifiers in a later editing-tools iteration if advanced selection workflows become necessary.

final result: passed

## 2026-10-19：Mard、豆仓、垫图与生成体验优化

- Product reference: `https://archmays.github.io/mard-bead-generator/#top`
- Tracing reference: `docs/changes/pindou-core/mard-inventory-tracing-reference.png`
- Implementation screenshot: `docs/changes/pindou-core/mard-inventory-tracing-implementation.png`
- Implementation pixels: 1512 × 768 Chrome desktop viewport.

### 对比结论

参考生成器的优势集中在生成前参数与制作交付：三种生成策略、透明/纯色背景处理、物理尺寸预估、拼豆效果和多格式导出。当前产品的优势是生成后仍可逐格编辑，并具备撤销、选区、豆仓和临摹闭环。本轮选择互补而非照搬页面结构：补齐生成策略、边缘去背、尺寸预估、真实豆体预览和 CSV，同时保留现有三栏编辑器与默认完整色块图。

### 视觉与交互验收

- 顶部同时容纳施工图、色块图、成品预览及三种导出操作，没有遮挡主画布。
- 生成参数在 270px 左侧栏保持双列对齐，策略说明与隐私说明清晰可读。
- 221 色色卡增加 A–H/M 色系筛选、当前颜色摘要和 430px 内部滚动，不再把整个编辑页拉成长页面。
- 成品预览的豆体包含圆形实体、中孔、边缘描线、顶部高光和轻阴影；色块图仍是默认模式。
- 豆仓在右栏直接显示库存、当前用量、剩余和缺口；用量 CSV 与界面口径一致。
- 临摹垫图保留参考中的显示开关、独立上传、52% 默认透明度、四向格级偏移和复位逻辑，且明确不会导出。

### QA 结果

- Chromium 与 WebKit 全部 20 个端到端场景通过。
- WebKit 垫图 ArrayBuffer 持久化专项连续 3 次通过。
- 9 个单元测试文件共 23 个测试通过，覆盖边缘纯色去背与完整色板匹配策略。
- 未发现 P0、P1 或 P2 视觉问题；参考站的 A4 分页 PDF/多底板打印保留为后续独立交付能力。

final result: passed
