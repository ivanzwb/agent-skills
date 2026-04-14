/**
 * 板块成分股工具入口（供 agent-skills runScript 调用）
 */
import { getSectorStocks } from './sectors.js';

const isMain = process.argv[1]?.endsWith('sector-stocks.js');
if (isMain) {
  const args = process.argv[2];
  const params = JSON.parse(args || '{}');
  const result = await getSectorStocks(params.sectorCode, params.limit || 20);
  console.log(JSON.stringify(result, null, 2));
}
