/**
 * 基本面数据工具 - 获取PE/PB/ROE/市值等
 * 数据源：东方财富
 */

function getEastMoneySecId(code) {
  const codeStr = code.replace(/^(sh|sz|SH|SZ)/, '');
  if (codeStr.startsWith('6') || codeStr.startsWith('9')) {
    return `1.${codeStr}`;
  }
  return `0.${codeStr}`;
}

export async function getStockFundamental(code) {
  const secId = getEastMoneySecId(code);
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secId}&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f60,f116,f117,f162,f163,f167,f170,f171,f173,f183,f184,f185,f186,f187,f188,f190,f192`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.data) {
    throw new Error('获取基本面数据失败: 无数据');
  }

  const d = data.data;
  return {
    code: d.f57,
    name: d.f58,
    currentPrice: d.f43 / 100,
    high: d.f44 / 100,
    low: d.f45 / 100,
    open: d.f46 / 100,
    volume: d.f47,
    amount: d.f48,
    pe: d.f162 / 100,
    pb: d.f167 / 100,
    totalMarketValue: d.f116,
    circulatingMarketValue: d.f117,
  };
}

export default { getStockFundamental };

const isMain = process.argv[1]?.endsWith('fundamental.js');
if (isMain) {
  const args = process.argv[2];
  const params = JSON.parse(args || '{}');
  const result = await getStockFundamental(params.code);
  console.log(JSON.stringify(result, null, 2));
}
