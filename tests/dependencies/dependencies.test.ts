import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NpmInstaller } from '../../src/dependencies/npm-installer';
import { PipInstaller } from '../../src/dependencies/pip-installer';
import { DependencyManager } from '../../src/dependencies/dependency-manager';
import { IDependencyInstaller, DependencyInstallResult } from '../../src/types';
import * as runCommandModule from '../../src/dependencies/run-command';

describe('NpmInstaller', () => {
  let tmpDir: string;
  const installer = new NpmInstaller();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    expect(installer.detect(tmpDir)).toBe(true);
  });

  it('does not detect without package.json', () => {
    expect(installer.detect(tmpDir)).toBe(false);
  });

  it('has type "npm"', () => {
    expect(installer.type).toBe('npm');
  });

  it('runs npm install successfully', async () => {
    const spy = jest.spyOn(runCommandModule, 'runCommand').mockResolvedValueOnce({
      success: true,
      output: 'ok',
    });

    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test","version":"1.0.0"}');

    const result = await installer.install(tmpDir, 30000);

    expect(result.type).toBe('npm');
    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

describe('PipInstaller', () => {
  let tmpDir: string;
  const installer = new PipInstaller();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects requirements.txt', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), '');
    expect(installer.detect(tmpDir)).toBe(true);
  });

  it('does not detect without requirements.txt', () => {
    expect(installer.detect(tmpDir)).toBe(false);
  });

  it('has type "pip"', () => {
    expect(installer.type).toBe('pip');
  });

  it('attempts pip install (covers install method)', async () => {
    jest.spyOn(runCommandModule, 'runCommand').mockResolvedValueOnce({ success: true, output: 'ok' });
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), '# empty\n');
    const result = await installer.install(tmpDir, 5000);
    expect(result.type).toBe('pip');
    expect(result.success).toBe(true);
    jest.restoreAllMocks();
  });
});

describe('DependencyManager', () => {
  it('has built-in npm and pip installers', () => {
    const manager = new DependencyManager();
    expect(manager.listTypes()).toContain('npm');
    expect(manager.listTypes()).toContain('pip');
  });

  it('registers a custom installer', () => {
    const manager = new DependencyManager();
    const custom: IDependencyInstaller = {
      type: 'cargo',
      detect: () => false,
      install: async () => ({ type: 'cargo', success: true, output: '' }),
    };
    manager.register(custom);
    expect(manager.listTypes()).toContain('cargo');
  });

  it('replaces existing installer of the same type', () => {
    const manager = new DependencyManager();
    const customNpm: IDependencyInstaller = {
      type: 'npm',
      detect: () => true,
      install: async () => ({ type: 'npm', success: true, output: 'custom' }),
    };
    manager.register(customNpm);
    expect(manager.listTypes().filter((t) => t === 'npm')).toHaveLength(1);
  });

  it('unregisters an installer', () => {
    const manager = new DependencyManager();
    manager.unregister('pip');
    expect(manager.listTypes()).not.toContain('pip');
  });

  it('installAll runs applicable installers', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-test-'));
    try {
      const results: string[] = [];
      const custom: IDependencyInstaller = {
        type: 'test',
        detect: () => true,
        install: async () => {
          results.push('ran');
          return { type: 'test', success: true, output: 'ok' };
        },
      };
      const manager = new DependencyManager();
      manager.unregister('npm');
      manager.unregister('pip');
      manager.register(custom);

      const installResults = await manager.installAll(tmpDir);
      expect(installResults).toHaveLength(1);
      expect(results).toEqual(['ran']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('installAll skips non-applicable installers', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-test-'));
    try {
      const manager = new DependencyManager();
      manager.unregister('npm');
      manager.unregister('pip');
      const custom: IDependencyInstaller = {
        type: 'test',
        detect: () => false,
        install: async () => ({ type: 'test', success: true, output: '' }),
      };
      manager.register(custom);

      const results = await manager.installAll(tmpDir);
      expect(results).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
