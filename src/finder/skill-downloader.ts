import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { SkillFinder, SkillSearchResult } from './skill-finder';

export interface DownloadOptions {
  destDir: string;
  branch?: string;
}

export function downloadFile(urlString: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(destPath);

    const req = client.get(url, { headers: { 'Accept': 'application/zip', 'User-Agent': 'agent-skills' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve, reject);
        return;
      }

      if (res.statusCode !== 200) {
        file.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    req.on('error', (err) => {
      file.destroy();
      fs.unlink(destPath, () => {});
      reject(err);
    });

    file.on('error', (err) => {
      file.destroy();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

export class SkillDownloader {
  constructor(private readonly options: DownloadOptions) {}

  static parseSource(source: string): { owner: string; repo: string } | null {
    const parsed = SkillFinder.parseSkillSource(source);
    if (parsed && parsed.type === 'github') {
      return { owner: parsed.owner, repo: parsed.repo };
    }
    return null;
  }

  async downloadFromGitHub(owner: string, repo: string): Promise<string> {
    const branch = this.options.branch || 'main';
    const githubDownload = SkillFinder.getMirror().githubDownload;
    const downloadUrl = `${githubDownload}/${owner}/${repo}/archive/refs/heads/${branch}.zip`;

    const safeRepo = repo.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempZip = path.join(this.options.destDir, `${safeRepo}-${Date.now()}.zip`);

    try {
      await downloadFile(downloadUrl, tempZip);
    } catch (e) {
      const fallbackUrl = `${githubDownload}/${owner}/${repo}/archive/refs/heads/master.zip`;
      await downloadFile(fallbackUrl, tempZip);
    }

    return tempZip;
  }

  async downloadFromResult(result: SkillSearchResult): Promise<string> {
    const match = result.repo.match(/^([^@]+)(?:@(.+))?$/);
    const repoName = match ? match[1] : result.repo;
    return this.downloadFromGitHub(result.owner, repoName);
  }
}
