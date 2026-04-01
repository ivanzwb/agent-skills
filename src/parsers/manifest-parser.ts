import * as fs from 'fs';
import * as path from 'path';
import { ToolDeclaration, SkillValidationError } from '../types';

/**
 * Parse manifest.json from a skill package root.
 * Returns an empty array if the file doesn't exist.
 */
export function parseManifest(skillRoot: string): ToolDeclaration[] {
  const manifestPath = path.join(skillRoot, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  const raw = fs.readFileSync(manifestPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new SkillValidationError(
      `Failed to parse manifest.json: ${(e as Error).message}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new SkillValidationError('manifest.json must be a JSON array of tool declarations');
  }

  return parsed.map((entry, index) => validateToolDeclaration(entry, index));
}

function validateToolDeclaration(entry: unknown, index: number): ToolDeclaration {
  if (typeof entry !== 'object' || entry === null) {
    throw new SkillValidationError(`manifest.json[${index}] must be an object`);
  }

  const obj = entry as Record<string, unknown>;

  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new SkillValidationError(`manifest.json[${index}].name is required`);
  }

  if (typeof obj.description !== 'string' || obj.description.length === 0) {
    throw new SkillValidationError(`manifest.json[${index}].description is required`);
  }

  if (typeof obj.parameters !== 'object' || obj.parameters === null) {
    throw new SkillValidationError(`manifest.json[${index}].parameters must be an object`);
  }

  const params = obj.parameters as Record<string, unknown>;
  if (params.type !== 'object') {
    throw new SkillValidationError(`manifest.json[${index}].parameters.type must be "object"`);
  }

  if (typeof params.properties !== 'object' || params.properties === null) {
    throw new SkillValidationError(
      `manifest.json[${index}].parameters.properties must be an object`,
    );
  }

  return {
    name: obj.name,
    description: obj.description,
    parameters: obj.parameters as ToolDeclaration['parameters'],
  };
}
