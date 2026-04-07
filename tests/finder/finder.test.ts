import { SkillFinder, SkillSearchResult } from '../../src/finder/skill-finder';

jest.mock('https', () => {
  return {
    get: jest.fn((url: string, opts: any, callback: any) => {
      const mockRes = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler(JSON.stringify({
              items: [
                {
                  name: 'test-skill',
                  description: 'A test skill',
                  owner: { login: 'test-owner' },
                  html_url: 'https://github.com/test-owner/test-skill',
                },
              ],
            }));
          }
          if (event === 'end') {
            handler();
          }
        }),
      };
      callback(mockRes);
      return { on: jest.fn() };
    }),
  };
});

jest.mock('http', () => {
  return {
    get: jest.fn((url: string, opts: any, callback: any) => {
      const mockRes = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler(JSON.stringify({
              items: [
                {
                  name: 'test-skill',
                  description: 'A test skill',
                  owner: { login: 'test-owner' },
                  html_url: 'https://github.com/test-owner/test-skill',
                },
              ],
            }));
          }
          if (event === 'end') {
            handler();
          }
        }),
      };
      callback(mockRes);
      return { on: jest.fn() };
    }),
  };
});

describe('SkillFinder', () => {
  describe('parseSkillSource', () => {
    it('parses owner/repo format', () => {
      const result = SkillFinder.parseSkillSource('vercel-labs/agent-skills');
      expect(result).toEqual({ type: 'github', owner: 'vercel-labs', repo: 'agent-skills' });
    });

    it('parses owner/repo with branch', () => {
      const result = SkillFinder.parseSkillSource('owner/repo@branch');
      expect(result).toEqual({ type: 'github', owner: 'owner', repo: 'repo' });
    });

    it('returns null for empty string', () => {
      expect(SkillFinder.parseSkillSource('')).toBeNull();
    });

    it('treats slug without / as clawhub source', () => {
      const result = SkillFinder.parseSkillSource('my-skill');
      expect(result).toEqual({ type: 'clawhub', slug: 'my-skill' });
    });

    it('handles underscores and hyphens', () => {
      const result = SkillFinder.parseSkillSource('my-org/my_skill-name');
      expect(result).toEqual({ type: 'github', owner: 'my-org', repo: 'my_skill-name' });
    });
  });

  describe('search', () => {
    it('returns search results from GitHub', async () => {
      const results = await SkillFinder.search('test query');
      expect(results.length).toBeGreaterThanOrEqual(1);
      const githubResult = results.find(r => r.source === 'github');
      expect(githubResult).toEqual({
        name: 'test-skill',
        description: 'A test skill',
        owner: 'test-owner',
        repo: 'test-skill',
        source: 'github',
        url: 'https://github.com/test-owner/test-skill',
        stars: 0,
        popularity: 0,
      });
    });
  });
});
