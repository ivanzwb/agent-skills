import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SkillRegistry } from '../src/registry/skill-registry';
import { SkillRegistryEntry, SkillStatus, SkillNotFoundError } from '../src/types';

function makeEntry(name: string): SkillRegistryEntry {
  return {
    name,
    status: SkillStatus.Installed,
    rootPath: '/fake/' + name,
    frontmatter: { name, description: 'test' },
    tools: [],
    installedAt: new Date().toISOString(),
  };
}

describe('SkillRegistry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('starts empty when no registry file exists', () => {
    const reg = new SkillRegistry(tmpDir);
    expect(reg.listAll()).toEqual([]);
    expect(reg.has('anything')).toBe(false);
  });

  it('registers and persists a skill', () => {
    const reg = new SkillRegistry(tmpDir);
    const entry = makeEntry('skill-a');
    reg.register(entry);

    expect(reg.has('skill-a')).toBe(true);
    expect(reg.get('skill-a').name).toBe('skill-a');

    // Reload from disk
    const reg2 = new SkillRegistry(tmpDir);
    expect(reg2.has('skill-a')).toBe(true);
  });

  it('unregisters a skill', () => {
    const reg = new SkillRegistry(tmpDir);
    reg.register(makeEntry('skill-a'));
    reg.unregister('skill-a');
    expect(reg.has('skill-a')).toBe(false);
  });

  it('throws SkillNotFoundError when unregistering unknown skill', () => {
    const reg = new SkillRegistry(tmpDir);
    expect(() => reg.unregister('ghost')).toThrow(SkillNotFoundError);
  });

  it('throws SkillNotFoundError when getting unknown skill', () => {
    const reg = new SkillRegistry(tmpDir);
    expect(() => reg.get('ghost')).toThrow(SkillNotFoundError);
  });

  it('lists all entries', () => {
    const reg = new SkillRegistry(tmpDir);
    reg.register(makeEntry('a'));
    reg.register(makeEntry('b'));
    expect(reg.listAll()).toHaveLength(2);
  });

  it('updates status', () => {
    const reg = new SkillRegistry(tmpDir);
    reg.register(makeEntry('skill-a'));
    reg.updateStatus('skill-a', SkillStatus.Error);
    expect(reg.get('skill-a').status).toBe(SkillStatus.Error);
  });

  it('handles corrupted registry file gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, 'registry.json'), 'invalid-json', 'utf-8');
    const reg = new SkillRegistry(tmpDir);
    expect(reg.listAll()).toEqual([]);
  });

  it('overwrites an existing entry on register', () => {
    const reg = new SkillRegistry(tmpDir);
    const e1 = makeEntry('skill-a');
    e1.status = SkillStatus.Loading;
    reg.register(e1);

    const e2 = makeEntry('skill-a');
    e2.status = SkillStatus.Installed;
    reg.register(e2);

    expect(reg.get('skill-a').status).toBe(SkillStatus.Installed);
    expect(reg.listAll()).toHaveLength(1);
  });
});
