/**
 * 概念板块工具入口（供 agent-skills runScript 调用）
 */
import { getConceptSectors } from './sectors.js';

const isMain = process.argv[1]?.endsWith('concepts.js');
if (isMain) {
  const result = await getConceptSectors();
  console.log(JSON.stringify(result, null, 2));
}
