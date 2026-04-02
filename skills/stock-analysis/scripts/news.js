/**
 * 股票新闻搜索工具
 * 数据源：东方财富
 */

export async function getStockNews({ code, limit = 10 }) {
  const secId = code.startsWith('6') || code.startsWith('9') 
    ? `1.${code}` 
    : `0.${code}`;
  
  const url = `https://np-anotice-stock.eastmoney.com/api-manager/notice-api/query?page=1&pageSize=${limit}&secids=${secId}&fields=title,publish_time,url`;
  
  const response = await fetch(url);
  const text = await response.text();
  
  if (!text || text.trim() === '') {
    throw new Error('获取股票新闻失败: 返回数据为空');
  }
  
  const data = JSON.parse(text);

  if (!data.data || !data.data.list) {
    throw new Error('获取股票新闻失败: 无数据');
  }

  return data.data.list.map(item => ({
    title: item.title || '',
    publishTime: item.publish_time || '',
    url: item.url || '',
  }));
}

export default { getStockNews };

const isMain = process.argv[1]?.endsWith('news.js');
if (isMain) {
  const args = process.argv[2];
  const params = JSON.parse(args || '{}');
  const result = await getStockNews(params);
  console.log(JSON.stringify(result, null, 2));
}
