import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SkillDownloader } from '../../src/finder/skill-downloader';

const mockZipBuffer = (() => {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  zip.addFile('test-skill/SKILL.md', Buffer.from('---\nname: test-skill\ndescription: Test\n---\n# Body', 'utf-8'));
  return zip.toBuffer();
})();

jest.mock('https', () => {
  return {
    get: jest.fn((url: string, opts: any, callback: any) => {
      const mockRes = {
        statusCode: 200,
        headers: {},
        on: jest.fn(),
        pipe: jest.fn(),
      };
      callback(mockRes);
      const mockReq = { on: jest.fn() };
      setTimeout(() => {
        mockRes.on('data', jest.fn());
        mockRes.on('end', jest.fn());
      }, 0);
      return mockReq;
    }),
  };
});

jest.mock('http', () => {
  return {
    get: jest.fn((url: string, opts: any, callback: any) => {
      const mockRes = {
        statusCode: 200,
        headers: {},
        on: jest.fn(),
        pipe: jest.fn(),
      };
      callback(mockRes);
      const mockReq = { on: jest.fn() };
      setTimeout(() => {
        mockRes.on('data', jest.fn());
        mockRes.on('end', jest.fn());
      }, 0);
      return mockReq;
    }),
  };
});

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    createWriteStream: jest.fn(() => ({
      on: jest.fn((event: string, cb: any) => {
        if (event === 'finish') {
          setTimeout(cb, 0);
        }
        return this;
      }),
      write: jest.fn(),
      end: jest.fn(),
      close: jest.fn(),
    })),
  };
});

describe('SkillDownloader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'downloader-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('parseSource', () => {
    it('parses owner/repo format', () => {
      const result = SkillDownloader.parseSource('owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('returns null for invalid format', () => {
      expect(SkillDownloader.parseSource('invalid')).toBeNull();
    });
  });

  describe('downloadFromGitHub', () => {
    it('creates a zip file in destDir', async () => {
      const downloader = new SkillDownloader({ destDir: tmpDir });
      const zipPath = await downloader.downloadFromGitHub('test-owner', 'test-repo');
      expect(zipPath).toContain('.zip');
    });
  });
});
