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
      expect(result).toEqual({ owner: 'vercel-labs', repo: 'agent-skills' });
    });

    it('parses owner/repo with branch', () => {
      const result = SkillFinder.parseSkillSource('owner/repo@branch');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('returns null for invalid format', () => {
      expect(SkillFinder.parseSkillSource('invalid')).toBeNull();
      expect(SkillFinder.parseSkillSource('')).toBeNull();
      expect(SkillFinder.parseSkillSource('/repo')).toBeNull();
      expect(SkillFinder.parseSkillSource('owner/')).toBeNull();
    });

    it('handles underscores and hyphens', () => {
      const result = SkillFinder.parseSkillSource('my-org/my_skill-name');
      expect(result).toEqual({ owner: 'my-org', repo: 'my_skill-name' });
    });
  });

  describe('search', () => {
    it('returns search results from GitHub', async () => {
      const results = await SkillFinder.search('test query');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        name: 'test-skill',
        description: 'A test skill',
        owner: 'test-owner',
        repo: 'test-skill',
        url: 'https://github.com/test-owner/test-skill',
      });
    });
  });
});
