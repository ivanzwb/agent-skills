/**
 * K线数据工具 - 获取日K线数据
 * 数据源：东方财富
 */

function getEastMoneySecId(code) {
  const codeStr = code.replace(/^(sh|sz|SH|SZ)/, '');
  if (codeStr.startsWith('6') || codeStr.startsWith('9')) {
    return `1.${codeStr}`;
  }
  return `0.${codeStr}`;
}

export async function getStockKline(code, period = 'daily', limit = 60) {
  const secId = getEastMoneySecId(code);
  const kltMap = { daily: '101', weekly: '102', monthly: '103' };
  const klt = kltMap[period] || '101';

  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secId}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${klt}&fqt=1&end=20500101&lmt=${limit}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.data || !data.data.klines) {
    return [];
  }

  return data.data.klines.map(line => {
    const parts = line.split(',');
    return {
      date: parts[0],
      open: parseFloat(parts[1]),
      close: parseFloat(parts[2]),
      high: parseFloat(parts[3]),
      low: parseFloat(parts[4]),
      volume: parseInt(parts[5]),
      amount: parseFloat(parts[6]),
    };
  });
}

export default { getStockKline };

const isMain = process.argv[1]?.endsWith('kline.js');
if (isMain) {
  const args = process.argv[2];
  const params = JSON.parse(args || '{}');
  const klines = await getStockKline(
    params.code,
    params.period || 'daily',
    params.limit || 60
  );
  console.log(JSON.stringify({ klines: klines.slice(-20) }, null, 2));
}
