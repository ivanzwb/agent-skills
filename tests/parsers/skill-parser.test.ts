import { parseSkillMd } from '../../src/parsers/skill-parser';
import { SkillValidationError } from '../../src/types';

describe('parseSkillMd', () => {
  const validMd = [
    '---',
    'name: my-skill',
    'description: A test skill',
    '---',
    '# Body content',
  ].join('\n');

  it('parses valid SKILL.md', () => {
    const doc = parseSkillMd(validMd);
    expect(doc.frontmatter.name).toBe('my-skill');
    expect(doc.frontmatter.description).toBe('A test skill');
    expect(doc.body).toBe('# Body content');
  });

  it('parses all optional fields', () => {
    const md = [
      '---',
      'name: my-skill',
      'description: A test skill',
      'license: MIT',
      'compatibility: Node 18+',
      'metadata:',
      '  author: acme',
      '  version: "1.0.0"',
      '---',
      'Body',
    ].join('\n');
    const doc = parseSkillMd(md);
    expect(doc.frontmatter.license).toBe('MIT');
    expect(doc.frontmatter.compatibility).toBe('Node 18+');
    expect(doc.frontmatter.metadata).toEqual({ author: 'acme', version: '1.0.0' });
  });

  it('throws on missing frontmatter delimiters', () => {
    expect(() => parseSkillMd('no frontmatter here')).toThrow(SkillValidationError);
    expect(() => parseSkillMd('no frontmatter here')).toThrow('delimited by ---');
  });

  it('throws on invalid YAML', () => {
    const md = '---\n: invalid: yaml:\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('Failed to parse YAML');
  });

  it('throws when frontmatter is not an object', () => {
    const md = '---\njust a string\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('must be an object');
  });

  it('throws when name is missing', () => {
    const md = '---\ndescription: test\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('"name" is required');
  });

  it('throws when name is empty string', () => {
    const md = '---\nname: ""\ndescription: test\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('"name" is required');
  });

  it('throws when name exceeds max length', () => {
    const longName = 'a'.repeat(65);
    const md = `---\nname: ${longName}\ndescription: test\n---\nBody`;
    expect(() => parseSkillMd(md)).toThrow('≤64');
  });

  it('throws on invalid name format (uppercase)', () => {
    const md = '---\nname: MySkill\ndescription: test\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('lowercase');
  });

  it('throws on name with leading dash', () => {
    const md = '---\nname: -skill\ndescription: test\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('lowercase');
  });

  it('throws on name with consecutive hyphens', () => {
    const md = '---\nname: my--skill\ndescription: test\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('consecutive hyphens');
  });

  it('throws when description is missing', () => {
    const md = '---\nname: my-skill\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('"description" is required');
  });

  it('throws when description is empty', () => {
    const md = '---\nname: my-skill\ndescription: ""\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('"description" is required');
  });

  it('throws when description exceeds max length', () => {
    const longDesc = 'a'.repeat(1025);
    const md = `---\nname: my-skill\ndescription: "${longDesc}"\n---\nBody`;
    expect(() => parseSkillMd(md)).toThrow('≤1024');
  });

  it('throws when license is not a string', () => {
    const md = '---\nname: my-skill\ndescription: test\nlicense: 123\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('"license" must be a string');
  });

  it('throws when compatibility is not a string', () => {
    const md = '---\nname: my-skill\ndescription: test\ncompatibility: 123\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('"compatibility" must be a string');
  });

  it('throws when compatibility exceeds max length', () => {
    const longCompat = 'a'.repeat(501);
    const md = `---\nname: my-skill\ndescription: test\ncompatibility: "${longCompat}"\n---\nBody`;
    expect(() => parseSkillMd(md)).toThrow('≤500');
  });

  it('throws when metadata is not an object', () => {
    const md = '---\nname: my-skill\ndescription: test\nmetadata: not-object\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('"metadata" must be an object');
  });

  it('throws when metadata is an array', () => {
    const md = '---\nname: my-skill\ndescription: test\nmetadata:\n  - a\n  - b\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('"metadata" must be an object');
  });

  it('throws when metadata value is not a string', () => {
    const md = '---\nname: my-skill\ndescription: test\nmetadata:\n  count: 42\n---\nBody';
    expect(() => parseSkillMd(md)).toThrow('metadata.count must be a string');
  });

  it('trims body whitespace', () => {
    const md = '---\nname: my-skill\ndescription: test\n---\n\n  Body  \n\n';
    const doc = parseSkillMd(md);
    expect(doc.body).toBe('Body');
  });
});
