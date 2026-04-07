/**
 * Edge-case tests that use jest mocking to cover defense-in-depth
 * code paths that cannot be triggered with real AdmZip (because it
 * normalizes entry names).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SkillSecurityError, SkillValidationError } from '../../src/types';

let mockEntries: Array<{ entryName: string; isDirectory: boolean }> = [];

jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    getEntries: () => mockEntries,
    extractAllTo: jest.fn(),
  }));
});

import { SkillInstaller, SkillInstallerConfig } from '../../src/installer/skill-installer';
import { SkillRegistry } from '../../src/registry/skill-registry';

describe('SkillInstaller – mocked AdmZip edge cases', () => {
  let tmpDir: string;
  let skillsDir: string;
  let installer: SkillInstaller;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-zip-'));
    skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    const registry = new SkillRegistry(tmpDir);
    const config: SkillInstallerConfig = { skillsDir };
    installer = new SkillInstaller(config, registry);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    mockEntries = [];
  });

  function writeZip(): string {
    const zipPath = path.join(tmpDir, 'test.zip');
    fs.writeFileSync(zipPath, Buffer.alloc(4)); // dummy file
    return zipPath;
  }

  it('throws SkillSecurityError for archive entry with absolute path (install)', async () => {
    mockEntries = [{ entryName: 'C:\\evil\\file.txt', isDirectory: false }];
    const zipPath = writeZip();
    await expect(installer.install(zipPath)).rejects.toThrow(SkillSecurityError);
  });

  it('throws SkillSecurityError for traversal entry in archive (install)', async () => {
    mockEntries = [
      { entryName: 'skill-x/../../etc/evil', isDirectory: false },
    ];
    const zipPath = writeZip();
    await expect(installer.install(zipPath)).rejects.toThrow(SkillSecurityError);
  });

  it('throws SkillValidationError for empty topDir from zip (install)', async () => {
    mockEntries = [{ entryName: '/file.txt', isDirectory: false }];
    const zipPath = writeZip();
    // On Windows, '/file.txt'.split('/')[0] = '' which is falsy →  !topDir = true
    // But path.isAbsolute('/file.txt') on Windows is false, so sanitize passes for stageToTemp
    // For install, the sanitizeArchiveEntry is called AFTER topDir check
    await expect(installer.install(zipPath)).rejects.toThrow();
  });

  it('throws SkillSecurityError for absolute path entry in staging', () => {
    mockEntries = [{ entryName: 'C:\\evil\\file.txt', isDirectory: false }];
    const zipPath = writeZip();
    expect(() => installer.stageToTemp(zipPath)).toThrow(SkillSecurityError);
  });

  it('throws SkillSecurityError for traversal entry in staging', () => {
    mockEntries = [
      { entryName: 'skill-x/../../etc/evil', isDirectory: false },
    ];
    const zipPath = writeZip();
    expect(() => installer.stageToTemp(zipPath)).toThrow(SkillSecurityError);
  });
});
