import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { SkillFramework } from '../src/index';
import {
  SkillValidationError,
  SkillNotFoundError,
} from '../src/types';

describe('SkillFramework', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('initializes with an existing directory', () => {
      const sf = SkillFramework.init(tmpDir);
      expect(sf).toBeDefined();
    });

    it('throws when directory does not exist', () => {
      expect(() => SkillFramework.init('/nonexistent/dir')).toThrow('does not exist');
    });

    it('accepts custom dependency installers', () => {
      const sf = SkillFramework.init(tmpDir, {
        dependencyInstallers: [{
          type: 'custom',
          detect: () => false,
          install: async () => ({ type: 'custom', success: true, output: '' }),
        }],
      });
      expect(sf).toBeDefined();
    });
  });

  describe('install & uninstall lifecycle', () => {
    let sf: SkillFramework;

    beforeEach(() => {
      sf = SkillFramework.init(tmpDir);
    });

    it('installs and uninstalls a skill from directory', async () => {
      const skillDir = path.join(tmpDir, 'my-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: my-skill\ndescription: Test skill\n---\n# Body',
        'utf-8',
      );
      // Point install to a separate source directory
      const sourceDir = path.join(os.tmpdir(), `sf-source-${Date.now()}`);
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, 'SKILL.md'),
        '---\nname: sf-source\ndescription: Test\n---\n# Body',
        'utf-8',
      );
      // Rename source dir to match the skill name
      const namedSource = path.join(path.dirname(sourceDir), 'sf-source');
      if (sourceDir !== namedSource) {
        fs.renameSync(sourceDir, namedSource);
      }

      const entry = await sf.install(namedSource);
      expect(entry.name).toBe('sf-source');
      expect(sf.hasSkill('sf-source')).toBe(true);

      await sf.uninstall('sf-source');
      expect(sf.hasSkill('sf-source')).toBe(false);

      // cleanup source
      if (fs.existsSync(namedSource)) fs.rmSync(namedSource, { recursive: true, force: true });
    });
  });

  describe('querying', () => {
    let sf: SkillFramework;
    let skillName: string;

    beforeEach(async () => {
      sf = SkillFramework.init(tmpDir);
      skillName = 'query-skill';
      const srcDir = path.join(os.tmpdir(), skillName + '-' + Date.now());
      const namedDir = path.join(path.dirname(srcDir), skillName);
      fs.mkdirSync(namedDir, { recursive: true });
      fs.writeFileSync(
        path.join(namedDir, 'SKILL.md'),
        `---\nname: ${skillName}\ndescription: Query test\nlicense: MIT\n---\n# Query body`,
        'utf-8',
      );
      await sf.install(namedDir);
      if (fs.existsSync(namedDir)) fs.rmSync(namedDir, { recursive: true, force: true });
    });

    it('listSkills returns L0 summaries', () => {
      const result = sf.listSkills();
      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe(skillName);
    });

    it('hasSkill returns true for installed skill', () => {
      expect(sf.hasSkill(skillName)).toBe(true);
    });

    it('hasSkill returns false for missing skill', () => {
      expect(sf.hasSkill('nope')).toBe(false);
    });

    it('getSkill returns full registry entry', () => {
      const entry = sf.getSkill(skillName);
      expect(entry.name).toBe(skillName);
      expect(entry.status).toBe('installed');
    });
  });

  describe('loading', () => {
    let sf: SkillFramework;
    const skillName = 'load-skill';

    beforeEach(async () => {
      sf = SkillFramework.init(tmpDir);
      const namedDir = path.join(os.tmpdir(), skillName);
      if (fs.existsSync(namedDir)) fs.rmSync(namedDir, { recursive: true, force: true });
      fs.mkdirSync(path.join(namedDir, 'refs'), { recursive: true });
      fs.writeFileSync(
        path.join(namedDir, 'SKILL.md'),
        `---\nname: ${skillName}\ndescription: Load test\nlicense: Apache-2.0\ncompatibility: node\nmetadata:\n  version: "1.0"\n---\n# Loading body`,
        'utf-8',
      );
      fs.writeFileSync(path.join(namedDir, 'refs', 'api.md'), '# API docs', 'utf-8');
      await sf.install(namedDir);
      if (fs.existsSync(namedDir)) fs.rmSync(namedDir, { recursive: true, force: true });
    });

    it('loadMain returns L1 content', () => {
      const l1 = sf.loadMain(skillName);
      expect(l1.name).toBe(skillName);
      expect(l1.body).toBe('# Loading body');
      expect(l1.metadata).toEqual({ version: '1.0' });
    });

    it('loadReference returns reference file content', () => {
      const ref = sf.loadReference(skillName, 'refs/api.md');
      expect(ref.content).toBe('# API docs');
      expect(ref.skillName).toBe(skillName);
    });
  });

  describe('preview', () => {
    let sf: SkillFramework;

    beforeEach(() => {
      sf = SkillFramework.init(tmpDir);
    });

    it('previewSkill returns preview info and allows install', async () => {
      const srcDir = path.join(os.tmpdir(), 'preview-skill');
      if (fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true });
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'SKILL.md'),
        '---\nname: preview-skill\ndescription: Preview test\n---\n# Preview body',
        'utf-8',
      );
      fs.writeFileSync(
        path.join(srcDir, 'manifest.json'),
        JSON.stringify([{ name: 'prev-tool', description: 'A tool', parameters: { type: 'object', properties: {}, required: [] } }]),
        'utf-8',
      );

      const preview = sf.previewSkill(srcDir);
      expect(preview.name).toBe('preview-skill');
      expect(preview.tools).toHaveLength(1);
      expect(preview.tools[0].name).toBe('prev-tool');
      expect(preview.tempDir).toBeTruthy();

      const entry = await sf.installPreviewed(preview.tempDir);
      expect(entry.name).toBe('preview-skill');
      expect(sf.hasSkill('preview-skill')).toBe(true);

      // cleanup
      if (fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true });
    });

    it('cancelPreview removes temp directory', () => {
      const srcDir = path.join(os.tmpdir(), 'cancel-skill');
      if (fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true });
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'SKILL.md'),
        '---\nname: cancel-skill\ndescription: Cancel test\n---\n# Body',
        'utf-8',
      );

      const preview = sf.previewSkill(srcDir);
      expect(fs.existsSync(preview.tempDir)).toBe(true);

      sf.cancelPreview(preview.tempDir);
      expect(fs.existsSync(preview.tempDir)).toBe(false);

      if (fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true });
    });

    it('previewSkill cleans up temp on error (no SKILL.md)', () => {
      const srcDir = path.join(os.tmpdir(), 'bad-preview');
      if (fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true });
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'readme.txt'), 'no skill md');

      expect(() => sf.previewSkill(srcDir)).toThrow(SkillValidationError);
      // All .preview-* dirs should have been cleaned up
      const remaining = fs.readdirSync(tmpDir).filter((n) => n.startsWith('.preview-'));
      expect(remaining).toHaveLength(0);

      if (fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true });
    });
  });

  describe('tool declarations', () => {
    let sf: SkillFramework;
    const skillName = 'tool-skill';

    beforeEach(async () => {
      sf = SkillFramework.init(tmpDir);
      const namedDir = path.join(os.tmpdir(), skillName);
      if (fs.existsSync(namedDir)) fs.rmSync(namedDir, { recursive: true, force: true });
      fs.mkdirSync(namedDir, { recursive: true });
      fs.writeFileSync(
        path.join(namedDir, 'SKILL.md'),
        `---\nname: ${skillName}\ndescription: Tool test\n---\n# Body`,
        'utf-8',
      );
      fs.writeFileSync(
        path.join(namedDir, 'manifest.json'),
        JSON.stringify([{ name: 'biz-tool', description: 'Business tool', parameters: { type: 'object', properties: {}, required: [] } }]),
        'utf-8',
      );
      await sf.install(namedDir);
      if (fs.existsSync(namedDir)) fs.rmSync(namedDir, { recursive: true, force: true });
    });

    it('listTools returns tools for a skill', () => {
      const toolList = sf.listTools(skillName);
      expect(toolList).toHaveLength(1);
      expect(toolList[0].name).toBe('biz-tool');
    });

    it('getFrameworkToolDeclarations returns framework tools', () => {
      const decls = sf.getFrameworkToolDeclarations();
      expect(decls.length).toBe(10);
    });

    it('getSkillToolDeclarations returns namespaced tools', () => {
      const decls = sf.getSkillToolDeclarations(skillName);
      expect(decls).toHaveLength(1);
      expect(decls[0].name).toBe(`skill.${skillName}.biz-tool`);
    });

    it('getAllSkillToolDeclarations returns all namespaced tools', () => {
      const decls = sf.getAllSkillToolDeclarations();
      expect(decls).toHaveLength(1);
      expect(decls[0].name).toBe(`skill.${skillName}.biz-tool`);
    });
  });

  describe('network operations', () => {
    let sf: SkillFramework;

    beforeEach(() => {
      sf = SkillFramework.init(tmpDir);
    });

    it('installFromNetwork throws on invalid source format', async () => {
      await expect(sf.installFromNetwork('')).rejects.toThrow('Invalid source format');
    });

    it('previewSkillFromNetwork throws on invalid source format', async () => {
      await expect(sf.previewSkillFromNetwork('')).rejects.toThrow('Invalid source format');
    });
  });
});
