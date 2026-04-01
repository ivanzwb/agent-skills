import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SkillFrameworkTools } from '../src/tools/skill-framework-tools';
import { SkillRegistry } from '../src/registry/skill-registry';
import { SkillInstaller, SkillInstallerConfig } from '../src/installer/skill-installer';
import {
  SkillRegistryEntry,
  SkillStatus,
  SkillNotFoundError,
  SkillSecurityError,
  ToolDeclaration,
} from '../src/types';

function makeEntry(name: string, rootPath: string, tools: ToolDeclaration[] = []): SkillRegistryEntry {
  return {
    name,
    status: SkillStatus.Installed,
    rootPath,
    frontmatter: { name, description: `${name} skill`, license: 'MIT', compatibility: 'node' },
    tools,
    installedAt: new Date().toISOString(),
  };
}

describe('SkillFrameworkTools', () => {
  let tmpDir: string;
  let skillsDir: string;
  let registry: SkillRegistry;
  let installer: SkillInstaller;
  let tools: SkillFrameworkTools;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-test-'));
    skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    registry = new SkillRegistry(tmpDir);

    const config: SkillInstallerConfig = { skillsDir };
    installer = new SkillInstaller(config, registry);
    tools = new SkillFrameworkTools(registry, installer);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('skillList', () => {
    it('returns empty list when no skills installed', () => {
      const result = tools.skillList();
      expect(result.skills).toEqual([]);
    });

    it('returns L0 summaries of all installed skills', () => {
      const skillRoot = path.join(skillsDir, 'my-skill');
      fs.mkdirSync(skillRoot, { recursive: true });
      registry.register(makeEntry('my-skill', skillRoot));

      const result = tools.skillList();
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('my-skill');
      expect(result.skills[0].description).toBe('my-skill skill');
      expect(result.skills[0].license).toBe('MIT');
      expect(result.skills[0].compatibility).toBe('node');
    });
  });

  describe('skillInstall', () => {
    it('installs a skill and returns name + tool names', async () => {
      const skillDir = path.join(tmpDir, 'installable');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: installable\ndescription: Test\n---\n# Body',
        'utf-8',
      );
      fs.writeFileSync(
        path.join(skillDir, 'manifest.json'),
        JSON.stringify([{ name: 'tool-a', description: 'A tool', parameters: { type: 'object', properties: {}, required: [] } }]),
        'utf-8',
      );

      const result = await tools.skillInstall({ source: skillDir });
      expect(result.name).toBe('installable');
      expect(result.tools).toContain('tool-a');
    });
  });

  describe('skillUninstall', () => {
    it('uninstalls a skill', async () => {
      const skillDir = path.join(tmpDir, 'removable');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: removable\ndescription: Test\n---\n# Body',
        'utf-8',
      );
      await tools.skillInstall({ source: skillDir });
      expect(registry.has('removable')).toBe(true);

      const result = await tools.skillUninstall({ name: 'removable' });
      expect(result.success).toBe(true);
      expect(registry.has('removable')).toBe(false);
    });
  });

  describe('skillLoadMain', () => {
    it('loads full SKILL.md content (L1)', () => {
      const skillRoot = path.join(skillsDir, 'loadable');
      fs.mkdirSync(skillRoot, { recursive: true });
      fs.writeFileSync(
        path.join(skillRoot, 'SKILL.md'),
        '---\nname: loadable\ndescription: Loadable skill\nlicense: MIT\ncompatibility: node\nmetadata:\n  author: test\n---\n# Main content',
        'utf-8',
      );
      registry.register(makeEntry('loadable', skillRoot));

      const l1 = tools.skillLoadMain({ name: 'loadable' });
      expect(l1.name).toBe('loadable');
      expect(l1.description).toBe('Loadable skill');
      expect(l1.body).toBe('# Main content');
      expect(l1.license).toBe('MIT');
      expect(l1.compatibility).toBe('node');
      expect(l1.metadata).toEqual({ author: 'test' });
    });
  });

  describe('skillLoadReference', () => {
    let skillRoot: string;

    beforeEach(() => {
      skillRoot = path.join(skillsDir, 'ref-skill');
      fs.mkdirSync(path.join(skillRoot, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(skillRoot, 'SKILL.md'),
        '---\nname: ref-skill\ndescription: Test\n---\n# Body', 'utf-8');
      fs.writeFileSync(path.join(skillRoot, 'docs', 'guide.md'), '# Guide', 'utf-8');
      registry.register(makeEntry('ref-skill', skillRoot));
    });

    it('loads a valid reference file', () => {
      const ref = tools.skillLoadReference({ name: 'ref-skill', referencePath: 'docs/guide.md' });
      expect(ref.skillName).toBe('ref-skill');
      expect(ref.content).toBe('# Guide');
      expect(ref.referencePath).toBe('docs/guide.md');
    });

    it('throws on absolute reference path', () => {
      expect(() =>
        tools.skillLoadReference({ name: 'ref-skill', referencePath: '/etc/passwd' }),
      ).toThrow(SkillSecurityError);
    });

    it('throws on path traversal', () => {
      expect(() =>
        tools.skillLoadReference({ name: 'ref-skill', referencePath: '../../../etc/passwd' }),
      ).toThrow(SkillSecurityError);
    });

    it('throws when reference file does not exist', () => {
      expect(() =>
        tools.skillLoadReference({ name: 'ref-skill', referencePath: 'docs/missing.md' }),
      ).toThrow(SkillNotFoundError);
    });

    it('throws when reference is a directory, not a file', () => {
      expect(() =>
        tools.skillLoadReference({ name: 'ref-skill', referencePath: 'docs' }),
      ).toThrow(SkillNotFoundError);
    });
  });

  describe('skillListTools', () => {
    it('lists tools for a skill', () => {
      const skillRoot = path.join(skillsDir, 'with-tools');
      fs.mkdirSync(skillRoot, { recursive: true });
      const toolDecl: ToolDeclaration = {
        name: 'my-tool',
        description: 'Does stuff',
        parameters: { type: 'object', properties: {}, required: [] },
      };
      registry.register(makeEntry('with-tools', skillRoot, [toolDecl]));

      const result = tools.skillListTools({ name: 'with-tools' });
      expect(result.skillName).toBe('with-tools');
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('my-tool');
    });
  });

  describe('getFrameworkToolDeclarations', () => {
    it('returns 6 framework tool declarations', () => {
      const decls = tools.getFrameworkToolDeclarations();
      expect(decls).toHaveLength(6);
      const names = decls.map((d) => d.name);
      expect(names).toContain('skill_list');
      expect(names).toContain('skill_install');
      expect(names).toContain('skill_uninstall');
      expect(names).toContain('skill_load_main');
      expect(names).toContain('skill_load_reference');
      expect(names).toContain('skill_list_tools');
    });
  });

  describe('getSkillToolDeclarations', () => {
    it('returns namespaced tool declarations for a skill', () => {
      const skillRoot = path.join(skillsDir, 'ns-skill');
      fs.mkdirSync(skillRoot, { recursive: true });
      const toolDecl: ToolDeclaration = {
        name: 'do-thing',
        description: 'Does a thing',
        parameters: { type: 'object', properties: {}, required: [] },
      };
      registry.register(makeEntry('ns-skill', skillRoot, [toolDecl]));

      const decls = tools.getSkillToolDeclarations('ns-skill');
      expect(decls).toHaveLength(1);
      expect(decls[0].name).toBe('skill.ns-skill.do-thing');
    });
  });

  describe('getAllSkillToolDeclarations', () => {
    it('returns all namespaced tool declarations across all skills', () => {
      const root1 = path.join(skillsDir, 'skill-a');
      const root2 = path.join(skillsDir, 'skill-b');
      fs.mkdirSync(root1, { recursive: true });
      fs.mkdirSync(root2, { recursive: true });

      const tool1: ToolDeclaration = { name: 'tool-a', description: 'A', parameters: { type: 'object', properties: {}, required: [] } };
      const tool2: ToolDeclaration = { name: 'tool-b', description: 'B', parameters: { type: 'object', properties: {}, required: [] } };

      registry.register(makeEntry('skill-a', root1, [tool1]));
      registry.register(makeEntry('skill-b', root2, [tool2]));

      const decls = tools.getAllSkillToolDeclarations();
      expect(decls).toHaveLength(2);
      const names = decls.map((d) => d.name);
      expect(names).toContain('skill.skill-a.tool-a');
      expect(names).toContain('skill.skill-b.tool-b');
    });

    it('returns empty array when no skills installed', () => {
      const decls = tools.getAllSkillToolDeclarations();
      expect(decls).toEqual([]);
    });
  });
});
