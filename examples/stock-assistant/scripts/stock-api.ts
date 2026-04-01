/**
 * Stock Assistant - Example skill scripts
 * These are placeholder implementations for demonstration.
 */

interface SearchResult {
  code: string;
  name: string;
  market: string;
}

// Placeholder: in production, this would call an actual API
export async function search(keyword: string): Promise<SearchResult[]> {
  console.log(`Searching for: ${keyword}`);
  return [
    { code: '600519', name: '贵州茅台', market: 'SH' },
    { code: '000858', name: '五粮液', market: 'SZ' },
  ];
}

export async function getSummary(code: string) {
  console.log(`Getting summary for: ${code}`);
  return {
    code,
    name: '贵州茅台',
    industry: '白酒',
    pe: 35.2,
    pb: 10.1,
    marketCap: '2.1万亿',
    revenue: '1275亿',
    profit: '627亿',
  };
}

export async function getQuotes(code: string, days: number = 5) {
  console.log(`Getting quotes for ${code}, last ${days} days`);
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-03-${28 - i}`,
    open: 1800 + Math.random() * 50,
    close: 1800 + Math.random() * 50,
    high: 1850 + Math.random() * 30,
    low: 1780 + Math.random() * 30,
    volume: Math.floor(10000 + Math.random() * 5000),
  }));
}
