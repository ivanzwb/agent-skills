# Stock Assistant API Guide

## 接口说明

### search(keyword)

根据关键词模糊匹配 A 股证券列表。

**参数：**
- `keyword` (string): 搜索关键词

**返回：** 匹配结果数组 `[{ code, name, market }]`

### get_summary(code)

获取指定股票代码的基本面摘要。

**参数：**
- `code` (string): 6 位股票代码

**返回：** `{ code, name, industry, pe, pb, marketCap, revenue, profit }`

### get_quotes(code, days?)

获取指定股票最近 N 天行情。

**参数：**
- `code` (string): 6 位股票代码
- `days` (number, 可选): 天数，默认 5

**返回：** `[{ date, open, close, high, low, volume }]`
