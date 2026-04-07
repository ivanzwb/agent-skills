import * as fs from 'fs';
import * as path from 'path';
import {
  SkillL1,
  SkillReference,
  SkillListResult,
  SkillPreview,
  SkillValidationError,
  SkillFrameworkError,
  ToolDeclaration,
  SkillRegistryEntry,
  IDependencyInstaller,
} from './types';
import { SkillRegistry } from './registry/skill-registry';
import { SkillInstaller, SkillInstallerConfig } from './installer/skill-installer';
import { SkillFrameworkTools } from './tools/skill-framework-tools';
import { parseSkillMd } from './parsers/skill-parser';
import { parseManifest } from './parsers/manifest-parser';
import { SkillFinder, SkillSearchResult } from './finder/skill-finder';
import { SkillDownloader } from './finder/skill-downloader';

export interface SkillFrameworkOptions {
  /** Custom dependency installers. Defaults to built-in npm + pip. */
  dependencyInstallers?: IDependencyInstaller[];
}

/**
 * Unified entry point for the SKILL framework.
 *
 * Usage:
 * ```ts
 * const skillFramework = SkillFramework.init('./skills-storage');
 *
 * // List installed skills (L0)
 * const skills = skillFramework.listSkills();
 *
 * // Install a skill from directory or zip
 * await skillFramework.install('./my-skill');
 *
 * // Uninstall a skill
 * await skillFramework.uninstall('my-skill');
 *
 * // Load skill main content (L0→L1)
 * const main = skillFramework.loadMain('my-skill');
 *
 * // Load a reference file (L1→L2)
 * const ref = skillFramework.loadReference('my-skill', 'references/guide.md');
 *
 * // List tools declared by a skill
 * const tools = skillFramework.listTools('my-skill');
 *
 * // Get all tool declarations for model prompting
 * const frameworkDecls = skillFramework.getFrameworkToolDeclarations();
 * const businessDecls = skillFramework.getAllSkillToolDeclarations();
 *
 * // Extend with custom language installers:
 * const sf = SkillFramework.init('./skills', {
 *   dependencyInstallers: [new MyCargoInstaller()],
 * });
 * ```
 */
export class SkillFramework {
  private readonly registry: SkillRegistry;
  private readonly installer: SkillInstaller;

  private readonly _tools: SkillFrameworkTools;

  private constructor(
    private readonly storageDir: string,
    options?: SkillFrameworkOptions,
  ) {
    this.registry = new SkillRegistry(storageDir);

    const installerConfig: SkillInstallerConfig = {
      skillsDir: storageDir,
      dependencyInstallers: options?.dependencyInstallers,
    };

    this.installer = new SkillInstaller(installerConfig, this.registry);
    this._tools = new SkillFrameworkTools(this.registry, this.installer);
  }

  /**
   * Initialize the framework with the given skills storage directory.
   * Creates the directory if it doesn't exist.
   */
  static init(skillsFolder: string, options?: SkillFrameworkOptions): SkillFramework {
    const resolved = path.resolve(skillsFolder);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Skills directory does not exist: ${resolved}`);
    }
    return new SkillFramework(resolved, options);
  }

  // ─── Skill Lifecycle ────────────────────────────────────────────

  /** Install a skill from a source path (directory or .zip file). */
  async install(source: string): Promise<SkillRegistryEntry> {
    return this.installer.install(source);
  }

  /** Uninstall a skill by name. */
  async uninstall(name: string): Promise<void> {
    return this.installer.uninstall(name);
  }

  // ─── Querying ───────────────────────────────────────────────────

  /** List all installed skills as L0 summaries. */
  listSkills(): SkillListResult {
    return this._tools.skillList();
  }

  /** Check if a skill is installed. */
  hasSkill(name: string): boolean {
    return this.registry.has(name);
  }

  /** Get full registry entry for a skill. */
  getSkill(name: string): SkillRegistryEntry {
    return this.registry.get(name);
  }

  // ─── Loading (L0 → L1 → L2) ────────────────────────────────────

  /** Load the full SKILL.md content for a skill (L0→L1). */
  loadMain(name: string): SkillL1 {
    return this._tools.skillLoadMain({ name });
  }

  /** Load a reference file from a skill package (L1→L2). */
  loadReference(name: string, referencePath: string): SkillReference {
    return this._tools.skillLoadReference({ name, referencePath });
  }

  // ─── Preview (pre-install) ──────────────────────────────────────

  /**
   * Preview a skill package before installation.
   * Copies/extracts the source to a temp directory under the skills storage,
   * parses SKILL.md and manifest.json, and returns L0 summary + tool list + tempDir.
   * Use `installPreviewed(tempDir)` to finalize or `cancelPreview(tempDir)` to discard.
   */
  previewSkill(source: string): SkillPreview {
    const tempDir = this.installer.stageToTemp(source);

    try {
      const skillMdPath = path.join(tempDir, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) {
        throw new SkillValidationError(`SKILL.md not found in staged directory`);
      }

      const raw = fs.readFileSync(skillMdPath, 'utf-8');
      const doc = parseSkillMd(raw);
      const tools = parseManifest(tempDir);

      return {
        name: doc.frontmatter.name,
        description: doc.frontmatter.description,
        license: doc.frontmatter.license,
        compatibility: doc.frontmatter.compatibility,
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
        tempDir,
      };
    } catch (e) {
      this.installer.cleanupTemp(tempDir);
      throw e;
    }
  }

  /**
   * Install a previously previewed skill from its temp directory.
   * Renames the temp dir to the final skill directory, installs deps, and registers.
   */
  async installPreviewed(tempDir: string): Promise<SkillRegistryEntry> {
    return this.installer.installFromStaged(tempDir);
  }

  /**
   * Cancel a preview and clean up the temp directory.
   */
  cancelPreview(tempDir: string): void {
    this.installer.cleanupTemp(tempDir);
  }

  // ─── Tool Declarations ─────────────────────────────────────────

  /** List tools declared by a specific skill. */
  listTools(name: string): ToolDeclaration[] {
    return this._tools.skillListTools({ name }).tools;
  }

  /** Get framework-level tool declarations for model prompting. */
  getFrameworkToolDeclarations(): ToolDeclaration[] {
    return this._tools.getFrameworkToolDeclarations();
  }

  /** Get namespaced business tool declarations for a specific skill. */
  getSkillToolDeclarations(skillName: string): ToolDeclaration[] {
    return this._tools.getSkillToolDeclarations(skillName);
  }

  /** Get all namespaced business tool declarations across all skills. */
  getAllSkillToolDeclarations(): ToolDeclaration[] {
    return this._tools.getAllSkillToolDeclarations();
  }

  // ─── Tool Execution ──────────────────────────────────────────────

  /** Execute a skill tool script. */
  async runScript(params: {
    name: string;
    toolName: string;
    args?: string;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return this._tools.runScript({
      name: params.name,
      toolName: params.toolName,
      args: params.args,
    });
  }

  // ─── Network Operations ───────────────────────────────────────────

  /** Search for skills from the network. */
  static async searchSkills(query: string): Promise<SkillSearchResult[]> {
    return SkillFinder.search(query);
  }

    /**
   * Preview a skill from a GitHub repository before installation.
   */
  async previewSkillFromNetwork(source: string): Promise<SkillPreview> {
    const parsed = SkillFinder.parseSkillSource(source);
    if (!parsed) {
      throw new SkillFrameworkError(
        `Invalid source format. Use owner/repo format (e.g., vercel-labs/agent-skills)`,
        'INVALID_SOURCE',
      );
    }

    const downloader = new SkillDownloader({
      destDir: this.storageDir,
    });

    const zipPath = await downloader.downloadFromGitHub(parsed.owner, parsed.repo);

    try {
      return this.previewSkill(zipPath);
    } finally {
      if (fs.existsSync(zipPath)) {
        fs.rmSync(zipPath);
      }
    }
  }

  /** Install a skill from a GitHub repository (owner/repo format). */
  async installFromNetwork(source: string): Promise<SkillRegistryEntry> {
    const parsed = SkillFinder.parseSkillSource(source);
    if (!parsed) {
      throw new SkillFrameworkError(
        `Invalid source format. Use owner/repo format (e.g., vercel-labs/agent-skills)`,
        'INVALID_SOURCE',
      );
    }

    const downloader = new SkillDownloader({
      destDir: this.storageDir,
    });

    const zipPath = await downloader.downloadFromGitHub(parsed.owner, parsed.repo);

    try {
      const entry = await this.installer.install(zipPath);
      return entry;
    } finally {
      if (fs.existsSync(zipPath)) {
        fs.rmSync(zipPath);
      }
    }
  }

}

export * from './types';
