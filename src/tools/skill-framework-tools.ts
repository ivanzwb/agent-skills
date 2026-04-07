import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  SkillL0,
  SkillL1,
  SkillReference,
  SkillListResult,
  ToolDeclaration,
  ToolParameterProperty,
  SkillNotFoundError,
  SkillSecurityError,
  ToolNotFoundError,
  ScriptExecutionError,
} from '../types';
import { SkillRegistry } from '../registry/skill-registry';
import { SkillInstaller } from '../installer/skill-installer';
import { parseSkillMd } from '../parsers/skill-parser';

function validateReferencePath(skillRoot: string, referencePath: string): string {
  if (path.isAbsolute(referencePath)) {
    throw new SkillSecurityError(`Reference path must be relative, got: "${referencePath}"`);
  }
  const normalized = path.normalize(referencePath);
  if (normalized.startsWith('..') || normalized.includes(`${path.sep}..`)) {
    throw new SkillSecurityError(`Reference path contains traversal: "${referencePath}"`);
  }
  const resolvedRoot = path.resolve(skillRoot);
  const resolvedCandidate = path.resolve(skillRoot, referencePath);
  if (!resolvedCandidate.startsWith(resolvedRoot + path.sep) && resolvedCandidate !== resolvedRoot) {
    throw new SkillSecurityError(`Path traversal detected: "${referencePath}" escapes root "${skillRoot}"`);
  }
  return resolvedCandidate;
}

/**
 * Framework-level tools exposed to the model (§9).
 *
 * These provide structured JSON-parameterized operations for:
 * - skill_list: L0 listing of all installed skills
 * - skill_install / skill_uninstall: lifecycle management
 * - skill_load_main: L0→L1, returns full SKILL.md body
 * - skill_load_reference: L1→L2, loads a reference file
 * - skill_list_tools: lists tools declared by a skill
 */
export class SkillFrameworkTools {
  constructor(
    private readonly registry: SkillRegistry,
    private readonly installer: SkillInstaller,
  ) {}

  /** Returns L0 summaries for all installed skills. */
  skillList(): SkillListResult {
    const entries = this.registry.listAll();
    const skills: SkillL0[] = entries.map((e) => ({
      name: e.frontmatter.name,
      description: e.frontmatter.description,
      license: e.frontmatter.license,
      compatibility: e.frontmatter.compatibility,
    }));
    return { skills };
  }

  /** Install a skill from a source path. */
  async skillInstall(params: { source: string }): Promise<{ name: string; tools: string[] }> {
    const entry = await this.installer.install(params.source);
    return {
      name: entry.name,
      tools: entry.tools.map((t) => t.name),
    };
  }

  /** Uninstall a skill by name. */
  async skillUninstall(params: { name: string }): Promise<{ success: boolean }> {
    await this.installer.uninstall(params.name);
    return { success: true };
  }

  /** Load full SKILL.md content for a skill (L0 → L1 transition). */
  skillLoadMain(params: { name: string }): SkillL1 {
    const entry = this.registry.get(params.name);
    const skillMdPath = path.join(entry.rootPath, 'SKILL.md');
    const raw = fs.readFileSync(skillMdPath, 'utf-8');
    const doc = parseSkillMd(raw);

    return {
      name: doc.frontmatter.name,
      description: doc.frontmatter.description,
      license: doc.frontmatter.license,
      compatibility: doc.frontmatter.compatibility,
      body: doc.body,
      metadata: doc.frontmatter.metadata,
    };
  }

  /** Load a reference file from a skill package. */
  skillLoadReference(params: { name: string; referencePath: string }): SkillReference {
    const entry = this.registry.get(params.name);
    const resolvedPath = validateReferencePath(entry.rootPath, params.referencePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new SkillNotFoundError(
        `Reference not found: ${params.referencePath} in skill ${params.name}`,
      );
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new SkillNotFoundError(
        `Reference is not a file: ${params.referencePath}`,
      );
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');

    return {
      skillName: params.name,
      referencePath: params.referencePath,
      content,
    };
  }

  /** List all tools declared by a skill (from manifest.json). */
  skillListTools(params: { name: string }): { skillName: string; tools: ToolDeclaration[] } {
    const entry = this.registry.get(params.name);
    return { skillName: entry.name, tools: entry.tools };
  }

  /** Returns the framework tools as structured tool declarations for model prompting. */
  getFrameworkToolDeclarations(): ToolDeclaration[] {
    return [
      {
        name: 'skill_list',
        description: 'List L0 summaries (name + description) of all installed skills',
        parameters: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'skill_install',
        description: 'Install a skill package (directory or zip). Sensitive operation, requires confirmation.',
        parameters: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Path to the skill package (directory or .zip file)' },
          },
          required: ['source'],
        },
      },
      {
        name: 'skill_uninstall',
        description: 'Uninstall an installed skill. Sensitive operation, requires confirmation.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'skill_load_main',
        description: 'Load the full SKILL.md body of a skill (L0 to L1 progressive loading)',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'skill_load_reference',
        description: 'Load a reference document from a skill by relative path (L1 to L2 progressive loading)',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name' },
            referencePath: { type: 'string', description: 'Relative path of the reference file' },
          },
          required: ['name', 'referencePath'],
        },
      },
      {
        name: 'skill_list_tools',
        description: 'List all tools declared by a skill (name, description, parameters)',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name' },
          },
          required: ['name'],
        },
      },
      // {name: 'skill_run_script',  arguments: {name: skill, toolName: search, args: '--key=abc'}
      {
        name: 'skill_run_script',
        description: 'Execute a skill tool script. Returns stdout/stderr as JSON strings.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name' },
            toolName: { type: 'string', description: 'Tool name declared in manifest.json' },
            args: { type: 'string', description: 'Tool arguments as json string' },
          },
          required: ['name', 'toolName'],
        },
      },
      {
        name: 'skill_search',
        description: 'Search for skills across all sources (GitHub and ClawHub). Returns a list sorted by popularity.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query string' },
          },
          required: ['query'],
        },
      },
      {
        name: 'skill_install_from_network',
        description: 'Install a skill from the network. Accepts GitHub owner/repo (e.g. "owner/repo") or a ClawHub slug (e.g. "my-skill"). Sensitive operation, requires confirmation.',
        parameters: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'GitHub owner/repo or ClawHub slug' },
          },
          required: ['source'],
        },
      },
      {
        name: 'skill_preview_from_network',
        description: 'Preview a skill from the network before installation. Accepts GitHub owner/repo or ClawHub slug.',
        parameters: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'GitHub owner/repo or ClawHub slug' },
          },
          required: ['source'],
        },
      },
    ];
  }

  /** Get namespaced business tool declarations for a specific skill. */
  getSkillToolDeclarations(skillName: string): ToolDeclaration[] {
    const entry = this.registry.get(skillName);
    return entry.tools.map((tool) => ({
      ...tool,
      name: `skill.${entry.name}.${tool.name}`,
    }));
  }

  /** Get all business tool declarations across all installed skills. */
  getAllSkillToolDeclarations(): ToolDeclaration[] {
    const entries = this.registry.listAll();
    const declarations: ToolDeclaration[] = [];
    for (const entry of entries) {
      for (const tool of entry.tools) {
        declarations.push({
          ...tool,
          name: `skill.${entry.name}.${tool.name}`,
        });
      }
    }
    return declarations;
  }

  /**
   * Execute a skill tool script.
   * Parses CLI args from ToolDeclaration.parameters and validates against JSON Schema.
   */
  async runScript(params: {
    name: string;
    toolName: string;
    args?: string;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const entry = this.registry.get(params.name);
    const tool = entry.tools.find((t) => t.name === params.toolName);
    if (!tool) {
      throw new ToolNotFoundError(params.toolName, params.name);
    }

    let providedArgs: Record<string, unknown> = {};
    try {
      providedArgs = JSON.parse(params.args || '{}');
    } catch {
      throw new ScriptExecutionError('Invalid JSON in args parameter');
    }

    const validationResult = this.validateArgs(tool, providedArgs);
    if (!validationResult.valid) {
      throw new ScriptExecutionError(`Parameter validation failed: ${validationResult.errors.join(', ')}`);
    }

    const fullScriptPath = path.join(entry.rootPath, 'scripts', `${params.toolName}.js`);

    if (!fs.existsSync(fullScriptPath)) {
      throw new ScriptExecutionError(`Script not found: ${fullScriptPath}`);
    }

    const child = spawn('node', [fullScriptPath, params.args || '{}'], {
      cwd: entry.rootPath,
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    return new Promise((resolve) => {
      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });
      child.on('error', (error) => {
        resolve({ stdout, stderr, exitCode: 1 });
      });
    });
  }

  private validateArgs(
    tool: ToolDeclaration,
    args: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const properties = tool.parameters.properties || {};
    const required = tool.parameters.required || [];

    for (const key of required) {
      if (args[key] === undefined || args[key] === null) {
        errors.push(`Missing required parameter: ${key}`);
      }
    }

    for (const [key, value] of Object.entries(args)) {
      const prop = properties[key];
      if (!prop) {
        errors.push(`Unknown parameter: ${key}`);
        continue;
      }

      if (value !== undefined && value !== null) {
        const typeValid = this.validateType(value, prop);
        if (!typeValid) {
          errors.push(`Invalid type for ${key}: expected ${prop.type}, got ${typeof value}`);
        }

        if (prop.enum && !prop.enum.includes(String(value))) {
          errors.push(`Invalid value for ${key}: must be one of ${prop.enum.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateType(value: unknown, prop: ToolParameterProperty): boolean {
    const type = prop.type;
    if (type === 'string') return typeof value === 'string';
    if (type === 'integer' || type === 'number') return typeof value === 'number';
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'object') return typeof value === 'object' && value !== null;
    if (type === 'array') return Array.isArray(value);
    return true;
  }
}
