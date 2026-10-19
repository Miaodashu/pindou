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

## 2026-10-19：第三版 Soft UI Crafted Gallery

- Source visual truth: `docs/changes/pindou-core/soft-ui-crafted-gallery-reference.png`
- Implementation screenshot: `docs/changes/pindou-core/soft-ui-crafted-gallery-implementation.png`
- Comparison viewport: 1536 × 1024 CSS pixels at DPR 1.
- Responsive validation: 375 × 812、768 × 900、1024 × 900、1536 × 1024。

### 视觉对照

- 首屏采用与参考稿一致的“横幅摄影 + 左侧叠字 + 右侧能力轨”结构；柴犬拼豆成品、图纸卡与材料场景均使用真实位图素材，没有用 CSS 图形替代。
- 根据最终反馈移除了文案后方的独立白色面板。摄影素材现在贯穿文案与作品区域，左侧只使用由暖白逐渐透明的轻遮罩保证文字可读性，不再出现硬切背景。
- Cormorant Garamond 用于展示标题，Montserrat 用于正文与控制；主色 `#E8B4B8`、鼠尾草绿 `#A8D5BA`、金色 `#D4AF37` 和暖白 `#FFF5F5` 均映射为全局设计令牌。
- CTA 使用金色底与炭灰文字，避免白字在金色上的低对比；焦点环、键盘语义、图片替代文本与 `prefers-reduced-motion` 均已实现。
- 图标统一来自 Lucide Vue。撤销、重做、绘制、橡皮、取色、选区、缩放及临摹方向均不再使用字符或表情符号充当图标。

### 响应式与交互

- 1536 / 1024：横幅叠字保持两行标题，能力轨固定在右侧；1024 下横幅缩短并加强自然遮罩，文字与成品主体均清晰。
- 768 / 375：文案与摄影素材改为上下排列，避免窄屏上文字覆盖作品；所有断点 `document.scrollWidth === innerWidth`，无页面级横向溢出。
- 手机编辑器优先展示画布与工具栏，命令按钮自动换行，画布在自身容器内滚动。
- 首页主 CTA 已在应用内浏览器实际点击，成功进入 `/editor`；路由切换会回到页面顶部。
- 为原生 Canvas 增加滚动边距，修复用户从长色卡跳回画布时粘性命令栏可能遮住画布点击点的问题。

### 修复记录

- P1：初版把文案和横幅拆成两个独立色块，素材过渡生硬。已改为文字直接叠在同一张摄影素材上，并以轻透明遮罩自然过渡。
- P1：访问深层色卡后回到画布，粘性顶部栏可能拦截画布顶部操作。已通过 Canvas 滚动边距修复，并用独立 Chromium 用例复验通过。
- P2：1024 宽度标题曾出现孤字换行。已固定为两行展示，并在 375 宽度单独缩放字号。
- P2：路由切换继承长页面滚动位置。已增加路由顶部复位。

未发现剩余 P0、P1 或 P2 视觉、可访问性或交互问题。

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
