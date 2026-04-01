---
name: stock-assistant
description: 查询与简析 A 股公开信息；用户提到股票、代码、财报时使用。
license: MIT
compatibility: 需要出站 HTTPS；建议在 Node 18+ 环境运行托管脚本。
metadata:
  author: acme
  version: "1.0.0"
---

# Stock Assistant

帮助用户查询与分析 A 股市场公开信息的技能。

## 能力

- 按关键词搜索证券简称或代码
- 查询个股基本面摘要
- 获取最近交易数据

## 使用步骤

1. 用户提到股票相关话题时激活本技能
2. 使用 `search` 工具查找股票代码
3. 使用 `get_summary` 获取公司与财务基本面
4. 使用 `get_quotes` 获取最近行情

## 注意事项

- 数据来源为公开接口，可能有延迟
- 不构成投资建议
- 详细 API 文档见 [references/api-guide.md](references/api-guide.md)
