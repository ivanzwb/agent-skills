/**
 * 股票新闻搜索工具
 * 数据源：东方财富
 */

export async function getStockNews({ code, limit = 10 }) {
  const pureCode = String(code || '').replace(/^(sh|sz|SH|SZ)/, '');
  const pageSize = Number.isFinite(limit) ? Math.max(1, Math.min(50, limit)) : 10;
  const url = `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=${pageSize}&page_index=1&ann_type=A&stock_list=${pureCode}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取股票新闻失败: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const list = data?.data?.list;
  if (!Array.isArray(list)) {
    throw new Error('获取股票新闻失败: 无数据');
  }

  return list.map((item) => {
    const title = item.title_ch || item.title || '';
    const publishTime = item.display_time || item.notice_date || '';
    const artCode = item.art_code || '';
    const detailUrl = artCode
      ? `https://data.eastmoney.com/notices/detail/${pureCode}/${artCode}.html`
      : '';
    return {
      title,
      publishTime,
      url: detailUrl,
      artCode,
    };
  });
}

export default { getStockNews };

const isMain = process.argv[1]?.endsWith('news.js');
if (isMain) {
  const args = process.argv[2];
  const params = JSON.parse(args || '{}');
  const result = await getStockNews(params);
  console.log(JSON.stringify(result, null, 2));
}
