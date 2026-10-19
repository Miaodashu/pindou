# 色卡文件格式

色卡使用 UTF-8 JSON。可在编辑器色卡面板下载模板；导入时会校验标识、版本、数据来源、重复色号和颜色值。

```json
{
  "id": "brand-series-v1",
  "brand": "品牌名称",
  "name": "系列名称",
  "version": "1.0.0",
  "source": "measured",
  "disclaimer": "可选的数据说明",
  "colors": [
    {
      "code": "A01",
      "name": "纯白",
      "hex": "#F7F5EF",
      "symbol": "1"
    }
  ]
}
```

`source` 只能是以下值之一：

- `official`：品牌官方发布且确认可以使用的数据
- `measured`：对实物拼豆在明确条件下测量得到的数据
- `digital-reference`：仅用于屏幕预览或算法验证的数据

`id` 与 `version` 应在色卡内容变化时同步更新。`code` 是制作和采购使用的色号，必须在同一色卡内唯一；`hex` 只作为显示和匹配输入，不应被称为色号。
