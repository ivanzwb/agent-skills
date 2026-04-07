/**
 * Test the defense-in-depth resolve check in validateReferencePath (line 27)
 * that is unreachable after the normalize/startsWith('..') check.
 * Uses module-level jest.mock for 'path' to bypass the earlier check.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as realPath from 'path';
import { SkillSecurityError, SkillStatus, SkillRegistryEntry, ToolDeclaration } from '../../src/types';

const actualPath = realPath;

jest.mock('path', () => {
  const actual = jest.requireActual('path') as typeof import('path');
  return {
    ...actual,
    normalize: jest.fn((...args: any[]) => (actual.normalize as any)(...args)),
  };
});

import * as pathMock from 'path';
import { SkillRegistry } from '../../src/registry/skill-registry';
import { SkillInstaller, SkillInstallerConfig } from '../../src/installer/skill-installer';
import { SkillFrameworkTools } from '../../src/tools/skill-framework-tools';

function makeEntry(name: string, rootPath: string): SkillRegistryEntry {
  return {
    name,
    status: SkillStatus.Installed,
    rootPath,
    frontmatter: { name, description: 'test' },
    tools: [],
    installedAt: new Date().toISOString(),
  };
}

describe('validateReferencePath – defense-in-depth resolve check', () => {
  let tmpDir: string;
  let skillsDir: string;
  let tools: SkillFrameworkTools;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(actualPath.join(os.tmpdir(), 'validate-ref-'));
    skillsDir = actualPath.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    const skillRoot = actualPath.join(skillsDir, 'test-skill');
    fs.mkdirSync(skillRoot, { recursive: true });
    fs.writeFileSync(actualPath.join(skillRoot, 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test\n---\n# Body', 'utf-8');

    const registry = new SkillRegistry(tmpDir);
    registry.register(makeEntry('test-skill', skillRoot));

    const config: SkillInstallerConfig = { skillsDir };
    const installer = new SkillInstaller(config, registry);
    tools = new SkillFrameworkTools(registry, installer);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('throws SkillSecurityError when resolve check catches traversal missed by normalize check', () => {
    // Temporarily make normalize return a benign-looking string
    // so that the startsWith('..') check passes, but resolve detects the real traversal
    (pathMock.normalize as jest.Mock).mockReturnValueOnce('safe-looking');

    expect(() =>
      tools.skillLoadReference({ name: 'test-skill', referencePath: '../../../etc/passwd' }),
    ).toThrow(SkillSecurityError);
  });
});
