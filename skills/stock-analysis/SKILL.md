---
name: stock-analysis
description: A股股票数据分析工具，提供股票搜索、K线数据、基本面数据、板块信息、新闻等。当用户要求分析某只股票、查询股票行情、了解个股基本面、查看K线走势、获取板块信息或相关新闻时，必须使用本技能。
license: MIT
---

# 股票分析工具

**适用场景（凡涉及以下需求，均应使用本技能）：**
- 分析/研究某只股票（如"帮我分析一下茅台"、"分析股票600519"、"xxx值得买吗"）
- 查询股票行情、价格、涨跌幅
- 查看PE/PB/ROE、市值等基本面指标
- 查看K线图、技术指标（MA/MACD/RSI/KDJ等）
- 查询行业板块或概念板块及其成分股
- 获取个股最新新闻、公告

提供A股股票数据查询功能，包括股票搜索、K线走势、基本面数据、行业板块、市场新闻等。

## 工具列表

| 工具名 | 说明 |
|--------|------|
| search | 根据关键词搜索A股股票代码（输入股票名称或代码片段均可） |
| kline | 获取股票K线数据和技术指标 |
| fundamental | 获取股票基本面数据(PE/PB/ROE等) |
| sectors | 获取行业板块列表 |
| concepts | 获取概念板块列表 |
| sector-stocks | 获取板块成分股 |
| news | 获取股票最新新闻 |

## 重要：如何处理"分析股票xxx"请求

当用户给出股票名称（如"茅台"、"比亚迪"）而非6位代码时，**必须先用 `search` 工具查找代码**，再进行后续分析。**不要**以"不知道股票代码"为由拒绝分析。

其它 Agent 集成此技能时，可直接执行技能包 `scripts/` 目录下对应工具脚本，参数使用 JSON 字符串传入，例如：`node scripts/search.js '{"keyword":"茅台"}'`

### 完整分析工作流

**第一步：获取股票代码（仅名称未知时）**
```
node scripts/search.js '{"keyword":"茅台"}'
# -> 得到 code: "600519"
```

**第二步：并行获取多维度数据**
```
node scripts/fundamental.js '{"code":"600519"}'
node scripts/kline.js '{"code":"600519","period":"daily","limit":60}'
node scripts/news.js '{"code":"600519","limit":5}'
```

**第三步：综合分析**
汇总基本面（估值、盈利能力）、技术面（趋势、支撑阻力）、近期新闻，给出结构化分析结论。

## 使用示例

```
# 搜索股票（输入名称或代码均可）
node scripts/search.js '{"keyword":"茅台"}'
node scripts/search.js '{"keyword":"600519"}'

# 获取K线数据
node scripts/kline.js '{"code":"600519","period":"daily"}'

# 获取基本面数据
node scripts/fundamental.js '{"code":"600519"}'

# 获取最新新闻
node scripts/news.js '{"code":"600519"}'
```
