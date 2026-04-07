import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseManifest } from '../../src/parsers/manifest-parser';
import { SkillValidationError } from '../../src/types';

describe('parseManifest', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeManifest(content: string): void {
    fs.writeFileSync(path.join(tmpDir, 'manifest.json'), content, 'utf-8');
  }

  const validTool = {
    name: 'search',
    description: 'Search things',
    parameters: {
      type: 'object',
      properties: { keyword: { type: 'string' } },
      required: ['keyword'],
    },
  };

  it('returns empty array when manifest.json does not exist', () => {
    expect(parseManifest(tmpDir)).toEqual([]);
  });

  it('parses valid manifest.json', () => {
    writeManifest(JSON.stringify([validTool]));
    const tools = parseManifest(tmpDir);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search');
    expect(tools[0].description).toBe('Search things');
  });

  it('throws on invalid JSON', () => {
    writeManifest('not-json');
    expect(() => parseManifest(tmpDir)).toThrow('Failed to parse manifest.json');
  });

  it('throws when manifest is not an array', () => {
    writeManifest('{}');
    expect(() => parseManifest(tmpDir)).toThrow('must be a JSON array');
  });

  it('throws when entry is not an object', () => {
    writeManifest('["string"]');
    expect(() => parseManifest(tmpDir)).toThrow('manifest.json[0] must be an object');
  });

  it('throws when entry is null', () => {
    writeManifest('[null]');
    expect(() => parseManifest(tmpDir)).toThrow('manifest.json[0] must be an object');
  });

  it('throws when entry name is missing', () => {
    writeManifest(JSON.stringify([{ description: 'x', parameters: { type: 'object', properties: {} } }]));
    expect(() => parseManifest(tmpDir)).toThrow('manifest.json[0].name is required');
  });

  it('throws when entry name is empty', () => {
    writeManifest(JSON.stringify([{ name: '', description: 'x', parameters: { type: 'object', properties: {} } }]));
    expect(() => parseManifest(tmpDir)).toThrow('manifest.json[0].name is required');
  });

  it('throws when entry description is missing', () => {
    writeManifest(JSON.stringify([{ name: 'x', parameters: { type: 'object', properties: {} } }]));
    expect(() => parseManifest(tmpDir)).toThrow('manifest.json[0].description is required');
  });

  it('throws when entry description is empty', () => {
    writeManifest(JSON.stringify([{ name: 'x', description: '', parameters: { type: 'object', properties: {} } }]));
    expect(() => parseManifest(tmpDir)).toThrow('manifest.json[0].description is required');
  });

  it('throws when parameters is not an object', () => {
    writeManifest(JSON.stringify([{ name: 'x', description: 'x', parameters: 'bad' }]));
    expect(() => parseManifest(tmpDir)).toThrow('parameters must be an object');
  });

  it('throws when parameters is null', () => {
    writeManifest(JSON.stringify([{ name: 'x', description: 'x', parameters: null }]));
    expect(() => parseManifest(tmpDir)).toThrow('parameters must be an object');
  });

  it('throws when parameters.type is not "object"', () => {
    writeManifest(JSON.stringify([{ name: 'x', description: 'x', parameters: { type: 'array', properties: {} } }]));
    expect(() => parseManifest(tmpDir)).toThrow('parameters.type must be "object"');
  });

  it('throws when parameters.properties is missing', () => {
    writeManifest(JSON.stringify([{ name: 'x', description: 'x', parameters: { type: 'object' } }]));
    expect(() => parseManifest(tmpDir)).toThrow('parameters.properties must be an object');
  });

  it('throws when parameters.properties is null', () => {
    writeManifest(JSON.stringify([{ name: 'x', description: 'x', parameters: { type: 'object', properties: null } }]));
    expect(() => parseManifest(tmpDir)).toThrow('parameters.properties must be an object');
  });
});
