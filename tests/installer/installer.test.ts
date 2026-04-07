import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { SkillInstaller, SkillInstallerConfig } from '../../src/installer/skill-installer';
import { SkillRegistry } from '../../src/registry/skill-registry';
import {
  SkillFrameworkError,
  SkillValidationError,
  SkillSecurityError,
  IDependencyInstaller,
} from '../../src/types';

jest.mock('adm-zip', () => {
  const Actual = jest.requireActual('adm-zip');
  return {
    __esModule: true,
    default: jest.fn((...args: any[]) => new Actual(...args)),
  };
});

const MockAdmZip = AdmZip as unknown as jest.Mock;

function createSkillDir(parentDir: string, name: string, opts?: { noSkillMd?: boolean; noManifest?: boolean; extraManifest?: object[] }): string {
  const skillDir = path.join(parentDir, name);
  fs.mkdirSync(skillDir, { recursive: true });

  if (!opts?.noSkillMd) {
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill\n---\n# Body`,
      'utf-8',
    );
  }

  if (!opts?.noManifest && opts?.extraManifest) {
    fs.writeFileSync(
      path.join(skillDir, 'manifest.json'),
      JSON.stringify(opts.extraManifest),
      'utf-8',
    );
  }

  return skillDir;
}

function createSkillZip(parentDir: string, name: string): string {
  const zip = new AdmZip();
  const skillMd = `---\nname: ${name}\ndescription: Test skill\n---\n# Body`;
  zip.addFile(`${name}/SKILL.md`, Buffer.from(skillMd, 'utf-8'));
  const zipPath = path.join(parentDir, `${name}.zip`);
  zip.writeZip(zipPath);
  return zipPath;
}

const noopInstaller: IDependencyInstaller = {
  type: 'noop',
  detect: () => false,
  install: async () => ({ type: 'noop', success: true, output: '' }),
};

describe('SkillInstaller', () => {
  let tmpDir: string;
  let skillsDir: string;
  let registry: SkillRegistry;
  let installer: SkillInstaller;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-test-'));
    skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    registry = new SkillRegistry(tmpDir);

    const config: SkillInstallerConfig = {
      skillsDir,
      dependencyInstallers: [noopInstaller],
    };
    installer = new SkillInstaller(config, registry);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('install from directory', () => {
    it('installs a valid skill from directory', async () => {
      const sourceDir = path.join(tmpDir, 'source');
      createSkillDir(tmpDir, 'source');
      // rename source dir to match skill name
      const skillDir = path.join(tmpDir, 'my-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'),
        '---\nname: my-skill\ndescription: Test\n---\n# Body', 'utf-8');

      const entry = await installer.install(skillDir);
      expect(entry.name).toBe('my-skill');
      expect(entry.status).toBe('installed');
      expect(registry.has('my-skill')).toBe(true);
    });

    it('throws on non-existent source', async () => {
      await expect(installer.install('/nonexistent/path')).rejects.toThrow(SkillFrameworkError);
    });

    it('throws on non-directory non-zip file', async () => {
      const filePath = path.join(tmpDir, 'readme.txt');
      fs.writeFileSync(filePath, 'hello');
      await expect(installer.install(filePath)).rejects.toThrow('must be a directory or .zip');
    });

    it('throws when skill directory already exists in target', async () => {
      const skillDir = createSkillDir(tmpDir, 'dup-skill');
      // First install
      await installer.install(skillDir);
      // Create a new source with same name
      const skillDir2 = createSkillDir(path.join(tmpDir, 'other'), 'dup-skill');
      await expect(installer.install(skillDir2)).rejects.toThrow('already exists');
    });

    it('throws when SKILL.md is missing after copy', async () => {
      const skillDir = path.join(tmpDir, 'no-md');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'readme.txt'), 'hi');
      await expect(installer.install(skillDir)).rejects.toThrow('SKILL.md not found');
    });

    it('renames directory when name does not match', async () => {
      const skillDir = path.join(tmpDir, 'wrong-dir');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: correct-name\ndescription: Test\n---\n# Body',
        'utf-8',
      );
      const entry = await installer.install(skillDir);
      expect(entry.name).toBe('correct-name');
      expect(fs.existsSync(path.join(skillsDir, 'correct-name', 'SKILL.md'))).toBe(true);
    });

    it('cleans up renamed dir on failure', async () => {
      const skillDir = path.join(tmpDir, 'bad-name');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: other-name\ndescription: Test\n---\n# Body',
        'utf-8',
      );
      // Install succeeds now (rename instead of throw), so install and then verify
      const entry = await installer.install(skillDir);
      expect(entry.name).toBe('other-name');
      expect(fs.existsSync(path.join(skillsDir, 'other-name'))).toBe(true);
      // Original wrong-named dir in skillsDir should not exist
      expect(fs.existsSync(path.join(skillsDir, 'bad-name'))).toBe(false);
    });
  });

  describe('install from zip', () => {
    it('installs a valid skill from zip', async () => {
      const zipPath = createSkillZip(tmpDir, 'zip-skill');
      const entry = await installer.install(zipPath);
      expect(entry.name).toBe('zip-skill');
      expect(registry.has('zip-skill')).toBe(true);
    });

    it('throws on empty zip', async () => {
      const zip = new AdmZip();
      const zipPath = path.join(tmpDir, 'empty.zip');
      zip.writeZip(zipPath);
      await expect(installer.install(zipPath)).rejects.toThrow('empty');
    });

    it('throws when zip target already exists', async () => {
      const zipPath = createSkillZip(tmpDir, 'dup-zip');
      await installer.install(zipPath);
      const zipPath2 = createSkillZip(tmpDir, 'dup-zip');
      await expect(installer.install(zipPath2)).rejects.toThrow('already exists');
    });

    it('rejects zip-slip attack (path traversal)', async () => {
      // Create a valid zip first so the .zip file exists on disk
      const zip = new AdmZip();
      zip.addFile('dummy/file.txt', Buffer.from('x'));
      const zipPath = path.join(tmpDir, 'evil-traversal.zip');
      zip.writeZip(zipPath);

      // Override next AdmZip construction (inside source code) to return malicious entries
      MockAdmZip.mockImplementationOnce(() => ({
        getEntries: () => [
          { entryName: 'skill-x/../../etc/evil', isDirectory: false },
        ],
        extractAllTo: jest.fn(),
      }));

      await expect(installer.install(zipPath)).rejects.toThrow(SkillSecurityError);
    });

    it('throws when cannot determine skill directory from zip', async () => {
      const zip = new AdmZip();
      // Entry with leading / stripped by AdmZip ends up as '' top dir
      zip.addFile('SKILL.md', Buffer.from('---\nname: x\ndescription: y\n---\n# z'));
      const zipPath = path.join(tmpDir, 'notop.zip');
      zip.writeZip(zipPath);
      // The first entry has no directory prefix, so topDir should be 'SKILL.md'
      // This will try to extract - let's just verify it doesn't crash silently
      // Actually the code splits by '/', first entry 'SKILL.md' → topDir = 'SKILL.md'
      // That creates skills/SKILL.md dir. This is allowed by the code but name mismatch will fail
      await expect(installer.install(zipPath)).rejects.toThrow(SkillValidationError);
    });
  });

  describe('uninstall', () => {
    it('uninstalls a skill', async () => {
      const skillDir = createSkillDir(tmpDir, 'to-remove');
      await installer.install(skillDir);
      expect(registry.has('to-remove')).toBe(true);

      await installer.uninstall('to-remove');
      expect(registry.has('to-remove')).toBe(false);
    });
  });

  describe('stageToTemp', () => {
    it('stages a directory to temp', () => {
      const skillDir = createSkillDir(tmpDir, 'stage-me');
      const tempDir = installer.stageToTemp(skillDir);
      expect(fs.existsSync(path.join(tempDir, 'SKILL.md'))).toBe(true);
      expect(path.basename(tempDir)).toMatch(/^\.preview-/);
    });

    it('stages a zip to temp', () => {
      const zipPath = createSkillZip(tmpDir, 'stage-zip');
      const tempDir = installer.stageToTemp(zipPath);
      // Zip contents are extracted into the temp dir
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('throws on non-existent source', () => {
      expect(() => installer.stageToTemp('/nonexistent')).toThrow(SkillFrameworkError);
    });

    it('throws on unsupported file type', () => {
      const filePath = path.join(tmpDir, 'file.tar');
      fs.writeFileSync(filePath, '');
      expect(() => installer.stageToTemp(filePath)).toThrow('must be a directory or .zip');
    });

    it('throws and cleans up on empty zip', () => {
      const zip = new AdmZip();
      const zipPath = path.join(tmpDir, 'empty-stage.zip');
      zip.writeZip(zipPath);
      expect(() => installer.stageToTemp(zipPath)).toThrow('empty');
    });

    it('rejects zip-slip in staging (path traversal)', () => {
      const zip = new AdmZip();
      zip.addFile('dummy/file.txt', Buffer.from('x'));
      const zipPath = path.join(tmpDir, 'evil-stage.zip');
      zip.writeZip(zipPath);

      MockAdmZip.mockImplementationOnce(() => ({
        getEntries: () => [
          { entryName: 'skill-x/../../etc/evil', isDirectory: false },
        ],
        extractAllTo: jest.fn(),
      }));

      expect(() => installer.stageToTemp(zipPath)).toThrow(SkillSecurityError);
    });
  });

  describe('installFromStaged', () => {
    it('installs from a staged directory', async () => {
      const skillDir = createSkillDir(tmpDir, 'staged-skill');
      const tempDir = installer.stageToTemp(skillDir);
      // Write a valid SKILL.md matching the expected final dir name
      fs.writeFileSync(
        path.join(tempDir, 'SKILL.md'),
        '---\nname: staged-skill\ndescription: Test\n---\n# Body',
        'utf-8',
      );
      const entry = await installer.installFromStaged(tempDir);
      expect(entry.name).toBe('staged-skill');
    });

    it('throws when staged dir does not exist', async () => {
      await expect(installer.installFromStaged('/nonexistent')).rejects.toThrow('Staged directory not found');
    });

    it('throws when SKILL.md is missing in staged dir', async () => {
      const emptyDir = path.join(tmpDir, 'empty-staged');
      fs.mkdirSync(emptyDir, { recursive: true });
      await expect(installer.installFromStaged(emptyDir)).rejects.toThrow('SKILL.md not found');
    });

    it('throws when final directory already exists', async () => {
      // Install first
      const skillDir = createSkillDir(tmpDir, 'conflict');
      await installer.install(skillDir);

      // Stage another with same name
      const stageDir = path.join(tmpDir, '.stage-tmp');
      fs.mkdirSync(stageDir, { recursive: true });
      fs.writeFileSync(
        path.join(stageDir, 'SKILL.md'),
        '---\nname: conflict\ndescription: Test\n---\n# Body',
        'utf-8',
      );
      await expect(installer.installFromStaged(stageDir)).rejects.toThrow('already exists');
    });

    it('cleans up final dir when post-rename step fails', async () => {
      // Use a dependency installer that always throws
      const failing: IDependencyInstaller = {
        type: 'fail',
        detect: () => true,
        install: async () => { throw new Error('dep install boom'); },
      };
      const config: SkillInstallerConfig = { skillsDir, dependencyInstallers: [failing] };
      const failInstaller = new SkillInstaller(config, registry);

      const stageDir = path.join(skillsDir, '.preview-fail');
      fs.mkdirSync(stageDir, { recursive: true });
      fs.writeFileSync(
        path.join(stageDir, 'SKILL.md'),
        '---\nname: fail-skill\ndescription: Test\n---\n# Body',
        'utf-8',
      );
      await expect(failInstaller.installFromStaged(stageDir)).rejects.toThrow('dep install boom');
      // Final dir should have been cleaned up
      expect(fs.existsSync(path.join(skillsDir, 'fail-skill'))).toBe(false);
    });
  });

  describe('cleanupTemp', () => {
    it('removes a temp directory', () => {
      const tempDir = path.join(tmpDir, '.temp-clean');
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'x');
      installer.cleanupTemp(tempDir);
      expect(fs.existsSync(tempDir)).toBe(false);
    });

    it('does not throw when dir does not exist', () => {
      expect(() => installer.cleanupTemp('/nonexistent-dir-xyz')).not.toThrow();
    });
  });

  describe('with custom dependency installers', () => {
    it('works with no custom installers (default)', async () => {
      const config: SkillInstallerConfig = { skillsDir };
      const defaultInstaller = new SkillInstaller(config, registry);
      // Just verify it constructs without error
      const skillDir = createSkillDir(tmpDir, 'default-inst');
      const entry = await defaultInstaller.install(skillDir);
      expect(entry.name).toBe('default-inst');
    });

    it('passes custom installers to DependencyManager', async () => {
      const installCalled: string[] = [];
      const custom: IDependencyInstaller = {
        type: 'custom',
        detect: () => true,
        install: async (root: string) => {
          installCalled.push(root);
          return { type: 'custom', success: true, output: '' };
        },
      };

      const config: SkillInstallerConfig = {
        skillsDir,
        dependencyInstallers: [custom],
      };
      const customInstaller = new SkillInstaller(config, registry);

      const skillDir = createSkillDir(tmpDir, 'with-custom');
      await customInstaller.install(skillDir);
      expect(installCalled.length).toBeGreaterThan(0);
    });
  });
});
