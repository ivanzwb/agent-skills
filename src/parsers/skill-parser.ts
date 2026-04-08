import * as yaml from 'js-yaml';
import {
  SkillDocument,
  SkillFrontmatter,
  SkillValidationError,
} from '../types';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

const NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const NAME_MAX_LEN = 64;
const DESCRIPTION_MAX_LEN = 1024;
const COMPATIBILITY_MAX_LEN = 500;

export interface ParseSkillMdOptions {
  /**
   * Optional fallback name to use when frontmatter "name" is missing or empty.
   * Validation rules (length/character set) still apply to the fallback.
   */
  fallbackName?: string;
  /** Optional warning sink; defaults to console.warn when available. */
  warn?: (message: string) => void;
}

/**
 * Parse raw SKILL.md content into a SkillDocument.
 */
export function parseSkillMd(raw: string, options?: ParseSkillMdOptions): SkillDocument {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new SkillValidationError(
      'SKILL.md must start with a YAML frontmatter block delimited by ---',
    );
  }

  const [, yamlStr, body] = match;

  let parsed: unknown;
  try {
    parsed = yaml.load(yamlStr);
  } catch (e) {
    throw new SkillValidationError(
      `Failed to parse YAML frontmatter: ${(e as Error).message}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new SkillValidationError('YAML frontmatter must be an object');
  }

  const obj = parsed as Record<string, unknown>;
  const frontmatter = validateFrontmatter(obj, options);

  return { frontmatter, body: body.trim() };
}

/**
 * Validate and coerce a parsed YAML object into a SkillFrontmatter.
 */
function validateFrontmatter(obj: Record<string, unknown>, options?: ParseSkillMdOptions): SkillFrontmatter {
  const warn = options?.warn || (typeof console !== 'undefined' && console.warn
    ? (msg: string) => console.warn(msg)
    : undefined);

  // name (required, but may fall back to a provided value)
  let name: string;
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    if (options?.fallbackName) {
      name = options.fallbackName;
      if (warn) {
        warn(`SKILL: frontmatter "name" is missing or empty; using fallback name "${name}"`);
      }
    } else {
      throw new SkillValidationError('frontmatter "name" is required and must be a non-empty string');
    }
  } else {
    name = obj.name;
  }
  if (name.length > NAME_MAX_LEN) {
    throw new SkillValidationError(`"name" must be ≤${NAME_MAX_LEN} characters`);
  }
  if (!NAME_REGEX.test(name)) {
    throw new SkillValidationError(
      '"name" must be lowercase a-z0-9 with hyphens, no leading/trailing dash, no double dash',
    );
  }
  if (name.includes('--')) {
    throw new SkillValidationError('"name" must not contain consecutive hyphens (--)');
  }

  // description (required)
  if (typeof obj.description !== 'string' || obj.description.length === 0) {
    throw new SkillValidationError(
      'frontmatter "description" is required and must be a non-empty string',
    );
  }
  const description = obj.description;
  if (description.length > DESCRIPTION_MAX_LEN) {
    throw new SkillValidationError(`"description" must be ≤${DESCRIPTION_MAX_LEN} characters`);
  }

  // license (optional)
  let license: string | undefined;
  if (obj.license !== undefined) {
    if (typeof obj.license !== 'string') {
      throw new SkillValidationError('"license" must be a string');
    }
    license = obj.license;
  }

  // compatibility (optional)
  let compatibility: string | undefined;
  if (obj.compatibility !== undefined) {
    if (typeof obj.compatibility !== 'string') {
      throw new SkillValidationError('"compatibility" must be a string');
    }
    if (obj.compatibility.length > COMPATIBILITY_MAX_LEN) {
      throw new SkillValidationError(
        `"compatibility" must be ≤${COMPATIBILITY_MAX_LEN} characters`,
      );
    }
    compatibility = obj.compatibility;
  }

  // metadata (optional)
  let metadata: Record<string, string> | undefined;
  if (obj.metadata !== undefined) {
    if (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata)) {
      throw new SkillValidationError('"metadata" must be an object with string key-value pairs');
    }
    metadata = {};
    for (const [k, v] of Object.entries(obj.metadata as Record<string, unknown>)) {
      if (typeof v !== 'string') {
        throw new SkillValidationError(`metadata.${k} must be a string, got ${typeof v}`);
      }
      metadata[k] = v;
    }
  }

  return { name, description, license, compatibility, metadata };
}
