import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface SkillSearchResult {
  name: string;
  description: string;
  owner: string;
  repo: string;
  url: string;
}

function fetchJson<T>(urlString: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson<T>(res.headers.location).then(resolve, reject);
        return;
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as T);
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${(e as Error).message}`));
        }
      });
    });

    req.on('error', reject);
  });
}

export class SkillFinder {
  private static readonly SEARCH_API = 'https://api.github.com/search/repositories';
  private static readonly SKILLS_INDEX_URL = 'https://raw.githubusercontent.com/ivanzwb/agent-skills/main/skills/index.json';

  static async search(query: string): Promise<SkillSearchResult[]> {
    const searchUrl = `${this.SEARCH_API}?q=${encodeURIComponent(query)}+topic:agent-skill+in:name&sort=stars&order=desc`;
    
    interface GitHubSearchResponse {
      items: Array<{
        name: string;
        description: string;
        owner: { login: string };
        html_url: string;
      }>;
    }

    const response = await fetchJson<GitHubSearchResponse>(searchUrl);

    return response.items.map((item) => ({
      name: item.name,
      description: item.description || '',
      owner: item.owner.login,
      repo: item.name,
      url: item.html_url,
    }));
  }

  static async fetchSkillsIndex(): Promise<SkillSearchResult[]> {
    try {
      interface SkillsIndex {
        skills: Array<{
          name: string;
          description: string;
          owner: string;
          repo: string;
          url: string;
        }>;
      }
      const index = await fetchJson<SkillsIndex>(this.SKILLS_INDEX_URL);
      return index.skills;
    } catch {
      return [];
    }
  }

  static parseSkillSource(source: string): { owner: string; repo: string; subPath?: string } | null {
    const gitHubPattern = /^([a-zA-Z0-9_-]+)\/([^@]+)(?:@(.+))?$/;
    const match = source.match(gitHubPattern);
    
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
      };
    }

    return null;
  }
}
