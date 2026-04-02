/**
 * 板块工具 - 获取行业/概念板块及其成分股
 * 数据源：东方财富
 */

export async function getAllSectors() {
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14,f128,f136,f140`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.data || !data.data.diff) {
    throw new Error('获取行业板块失败: 无数据');
  }

  return data.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    changePercent: item.f3,
    price: item.f2,
  }));
}

export async function getConceptSectors() {
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=200&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:3&fields=f2,f3,f4,f12,f14,f128,f136,f140`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.data || !data.data.diff) {
    throw new Error('获取概念板块失败: 无数据');
  }

  return data.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    changePercent: item.f3,
    price: item.f2,
  }));
}

export async function getSectorStocks(sectorCode, limit = 20) {
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${limit}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=b:${sectorCode}&fields=f2,f3,f4,f12,f14`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.data || !data.data.diff) {
    throw new Error('获取板块股票失败: 无数据');
  }

  return data.data.diff.map(item => ({
    code: item.f12,
    name: item.f14,
    price: item.f2,
    changePercent: item.f3,
  }));
}

export default { getAllSectors, getConceptSectors, getSectorStocks };

const isMain = process.argv[1]?.endsWith('sectors.js');
if (isMain) {
  const args = process.argv[2];
  const params = JSON.parse(args || '{}');
  let result;
  if (params.sectorCode) {
    result = await getSectorStocks(params.sectorCode, params.limit || 20);
  } else if (params.action === 'concepts') {
    result = await getConceptSectors();
  } else {
    result = await getAllSectors();
  }
  console.log(JSON.stringify(result, null, 2));
}
