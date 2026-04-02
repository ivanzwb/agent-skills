/**
 * 股票搜索工具 - 按名称搜索股票代码
 * 数据源：东方财富
 */

export async function searchStock({ keyword }) {
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.QuotationCodeTable || !data.QuotationCodeTable.Data) {
    throw new Error('搜索股票失败: 未找到结果');
  }

  return data.QuotationCodeTable.Data
    .filter(item => item.SecurityTypeName === '沪A' || item.SecurityTypeName === '深A')
    .map(item => ({
      code: item.Code,
      name: item.Name,
      market: item.SecurityTypeName,
      fullCode: item.QuoteID,
    }));
}

export default { searchStock };

const isMain = process.argv[1]?.endsWith('search.js');
if (isMain) {
  const args = process.argv[2];
  const params = JSON.parse(args || '{}');
  const result = await searchStock(params);
  console.log(JSON.stringify(result, null, 2));
}
