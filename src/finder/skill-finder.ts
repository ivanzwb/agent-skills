import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface SkillSearchResult {
  name: string;
  description: string;
  owner: string;
  repo: string;
  source: 'github' | 'clawhub';
  url?: string;
  slug?: string;
  version?: string;
  downloads?: number;
  stars?: number;
  /** Normalized relevance score (higher = more popular/relevant). */
  popularity?: number;
}

function fetchJson<T>(urlString: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'agent-skills' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson<T>(res.headers.location).then(resolve, reject);
        return;
      }

      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${body}`)));
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

export interface MirrorConfig {
  /** GitHub API base URL (default: https://api.github.com) */
  githubApi?: string;
  /** GitHub download base URL (default: https://github.com) */
  githubDownload?: string;
  /** ClawHub API base URL (default: https://clawhub.ai/api/v1) */
  clawHubApi?: string;
}

const DEFAULT_GITHUB_API = 'https://api.github.com';
const DEFAULT_GITHUB_DOWNLOAD = 'https://github.com';
const DEFAULT_CLAWHUB_API = 'https://clawhub.ai/api/v1';

function resolveMirror(config?: MirrorConfig): Required<MirrorConfig> {
  return {
    githubApi: config?.githubApi || process.env.SKILL_GITHUB_API || DEFAULT_GITHUB_API,
    githubDownload: config?.githubDownload || process.env.SKILL_GITHUB_DOWNLOAD || DEFAULT_GITHUB_DOWNLOAD,
    clawHubApi: config?.clawHubApi || process.env.SKILL_CLAWHUB_API || DEFAULT_CLAWHUB_API,
  };
}

export class SkillFinder {
  private static mirror: Required<MirrorConfig> = resolveMirror();

  /** Configure mirror URLs for GitHub and ClawHub. */
  static configureMirror(config: MirrorConfig): void {
    this.mirror = resolveMirror(config);
  }

  /** Get the current mirror configuration. */
  static getMirror(): Required<MirrorConfig> {
    return { ...this.mirror };
  }

  private static async searchClawHub(query: string): Promise<SkillSearchResult[]> {
    try {
      interface ClawHubSearchResponse {
        results: Array<{
          slug: string;
          displayName: string;
          summary: string;
          version: string | null;
          updatedAt: number;
          score: number;
        }>;
      }

      const url = `${this.mirror.clawHubApi}/search?q=${encodeURIComponent(query)}`;
      const response = await fetchJson<ClawHubSearchResponse>(url);

      return response.results.map((item) => ({
        slug: item.slug,
        name: item.displayName || item.slug,
        description: item.summary || '',
        owner: '',
        repo: item.slug,
        source: 'clawhub' as const,
        version: item.version || undefined,
        popularity: item.score || 0,
      }));
    } catch {
      return [];
    }
  }

  private static async searchGitHub(query: string): Promise<SkillSearchResult[]> {
    const searchUrl = `${this.mirror.githubApi}/search/repositories?q=${encodeURIComponent(query)}+topic:agent-skill+in:name&sort=stars&order=desc`;

    interface GitHubSearchResponse {
      items: Array<{
        name: string;
        description: string;
        owner: { login: string };
        html_url: string;
        stargazers_count: number;
      }>;
    }

    const response = await fetchJson<GitHubSearchResponse>(searchUrl);

    return response.items.map((item) => ({
      name: item.name,
      description: item.description || '',
      owner: item.owner.login,
      repo: item.name,
      source: 'github' as const,
      url: item.html_url,
      stars: item.stargazers_count || 0,
      popularity: item.stargazers_count || 0,
    }));
  }

  static async search(query: string): Promise<SkillSearchResult[]> {
    const [clawHubResults, gitHubResults] = await Promise.all([
      this.searchClawHub(query),
      this.searchGitHub(query),
    ]);
    const combined = [...clawHubResults, ...gitHubResults];
    combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return combined;
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
      const indexUrl = `${this.mirror.githubDownload.replace('github.com', 'raw.githubusercontent.com')}/ivanzwb/agent-skills/main/skills/index.json`;
      const index = await fetchJson<SkillsIndex>(indexUrl);
      return index.skills.map(s => ({ ...s, source: 'github' as const }));
    } catch {
      return [];
    }
  }

  static parseSkillSource(source: string): { type: 'github'; owner: string; repo: string } | { type: 'clawhub'; slug: string } | null {
    const gitHubPattern = /^([a-zA-Z0-9_-]+)\/([^@]+)(?:@(.+))?$/;
    const match = source.match(gitHubPattern);

    if (match) {
      return {
        type: 'github',
        owner: match[1],
        repo: match[2],
      };
    }

    // Treat non-empty strings without '/' as ClawHub slugs
    if (source.length > 0) {
      return {
        type: 'clawhub',
        slug: source,
      };
    }

    return null;
  }
}
