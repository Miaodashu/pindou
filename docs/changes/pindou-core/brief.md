# Brief: 拼豆图纸编辑与图片转换核心

- Change ID: `pindou-core`
- Status: implemented
- Owner: project team
- Last updated: 2026-10-20

## Problem

从空白 Web 项目建立可持续开发的拼豆图纸工具。核心难点是把图片转换成有限、明确色号的可制作网格，同时保留轮廓并允许人工编辑，不能只展示一张像素化预览图。

## Desired outcome

用户可以创建网格图纸、手工绘制、导入图片并自由裁切、对比原图与转换结果、核对材料清单、使用真实色卡数据，并在浏览器本地可靠自动保存。

## In scope

- Vue 3 / TypeScript 工程与 AI 开发工作流
- Canvas 2D 网格编辑、移动、填充、撤销/重做和色块/带色号施工 PNG 导出
- OpenCV.js/WASM Worker 图片处理与 Canvas 降级路径
- CIEDE2000 色卡量化、颜色限制、边缘权重和质量提示
- IndexedDB 自动保存、独立豆仓与临摹垫图
- Chromium/WebKit 自动化验证

## Out of scope

- 未经授权的品牌官方色卡数据
- 账号、云同步、支付、订单和部署
- 分页打印/PDF 与底板施工图

## Acceptance criteria

- [x] 图片转换不会阻塞主线程，实际浏览器中使用 OpenCV.js/WASM
- [x] 转换结果使用确定色卡索引，并展示色号与用量
- [x] 可导入经校验的色卡 JSON，并支持在用颜色逐色替换
- [x] 图纸可继续编辑、撤销、重做、自动保存和恢复
- [x] 原图可一键重新上传，自由/比例裁切可切换，转换后可左右对比
- [x] 悬停生成图纸时可高亮当前格对应的全部同色区域
- [x] 类型、Lint、单元测试、生产构建和 Chromium/WebKit E2E 通过
