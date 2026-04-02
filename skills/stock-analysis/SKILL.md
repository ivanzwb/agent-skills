---
name: stock-analysis
description: A股股票数据分析工具，提供股票搜索、K线数据、基本面数据、板块信息、新闻等
license: MIT
---

# 股票分析工具

提供A股股票数据查询功能，包括股票搜索、K线走势、基本面数据、行业板块、市场新闻等。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| search | 根据关键词搜索A股股票代码 |
| kline | 获取股票K线数据和技术指标 |
| fundamental | 获取股票基本面数据(PE/PB/ROE等) |
| sectors | 获取行业板块列表 |
| concepts | 获取概念板块列表 |
| sector-stocks | 获取板块成分股 |
| news | 获取股票最新新闻 |

## 使用示例

```
# 搜索股票
skill run stock-analysis search '{"keyword":"茅台"}'

# 获取K线数据
skill run stock-analysis kline '{"code":"600519","period":"daily"}'

# 获取基本面数据
skill run stock-analysis fundamental '{"code":"600519"}'
```
