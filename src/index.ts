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
import { SkillFinder, SkillSearchResult, MirrorConfig } from './finder/skill-finder';
import { SkillDownloader } from './finder/skill-downloader';

export interface SkillFrameworkOptions {
  /** Custom dependency installers. Defaults to built-in npm + pip. */
  dependencyInstallers?: IDependencyInstaller[];
  /** Mirror URLs for GitHub and ClawHub APIs. Also configurable via env vars SKILL_GITHUB_API, SKILL_GITHUB_DOWNLOAD, SKILL_CLAWHUB_API. */
  mirror?: MirrorConfig;
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

    if (options?.mirror) {
      SkillFinder.configureMirror(options.mirror);
    }
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

  /** Configure mirror URLs for GitHub and ClawHub APIs. */
  static configureMirror(config: MirrorConfig): void {
    SkillFinder.configureMirror(config);
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
      let skillMdPath = path.join(tempDir, 'SKILL.md');

      if (!fs.existsSync(skillMdPath)) {
        const findSkillMd = (dir: string): string | null => {
          for (const entry of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, entry);
            if (entry === 'SKILL.md') {
              return fullPath;
            }
            if (fs.statSync(fullPath).isDirectory()) {
              const found = findSkillMd(fullPath);
              if (found) return found;
            }
          }
          return null;
        };

        const foundPath = findSkillMd(tempDir);
        if (foundPath) {
          const foundDir = path.dirname(foundPath);
          if (foundDir !== tempDir) {
            const nestedContent = fs.readdirSync(foundDir);
            for (const item of nestedContent) {
              fs.renameSync(path.join(foundDir, item), path.join(tempDir, item));
            }
            fs.rmSync(foundDir, { recursive: true, force: true });
          }
        } else {
          throw new SkillValidationError(`SKILL.md not found in staged directory`);
        }
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
    const entry = await this.installer.installFromStaged(tempDir);
    this.cleanupPreviewDirs();
    return entry;
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

  /** Search for skills from all sources (GitHub + ClawHub). */
  static async searchSkills(query: string): Promise<SkillSearchResult[]> {
    return SkillFinder.search(query);
  }

  /** Download a skill zip from the given source (GitHub or ClawHub). Returns the temp zip path. */
  private async downloadSkillZip(source: string): Promise<string> {
    const parsed = SkillFinder.parseSkillSource(source);
    if (!parsed) {
      throw new SkillFrameworkError(
        `Invalid source format. Use owner/repo for GitHub or a slug for ClawHub.`,
        'INVALID_SOURCE',
      );
    }

    const downloadDir = path.join(this.storageDir, '.download');
    fs.mkdirSync(downloadDir, { recursive: true });

    if (parsed.type === 'clawhub') {
      const clawHubApi = SkillFinder.getMirror().clawHubDownloadApi;
      const downloadUrl = `${clawHubApi}?slug=${encodeURIComponent(parsed.slug)}`;
      const tempZip = path.join(downloadDir, `${parsed.slug}-${Date.now()}.zip`);
      const { downloadFile } = await import('./finder/skill-downloader');
      await downloadFile(downloadUrl, tempZip);
      return tempZip;
    }

    const downloader = new SkillDownloader({ destDir: downloadDir });
    return downloader.downloadFromGitHub(parsed.owner, parsed.repo);
  }

  /** Preview a skill from the network (GitHub owner/repo or ClawHub slug). */
  async previewSkillFromNetwork(source: string): Promise<SkillPreview> {
    const zipPath = await this.downloadSkillZip(source);

    try {
      return this.previewSkill(zipPath);
    } finally {
      if (fs.existsSync(zipPath)) {
        fs.rmSync(zipPath);
      }
      this.cleanupDownloadDir();
    }
  }

  /** Install a skill from the network (GitHub owner/repo or ClawHub slug). */
  async installFromNetwork(source: string): Promise<SkillRegistryEntry> {
    const zipPath = await this.downloadSkillZip(source);

    try {
      // For network installs, stage the zip to a temp directory first,
      // then install from the staged directory so that SKILL.md can
      // be located even if the archive layout is unconventional.
      const tempDir = this.installer.stageToTemp(zipPath);

      // Derive a reasonable fallback skill name from the source
      // (ClawHub slug or GitHub repo name) for SKILL.md files
      // that omit the frontmatter "name" field.
      let fallbackName: string | undefined;
      const parsed = SkillFinder.parseSkillSource(source);
      if (parsed) {
        if (parsed.type === 'clawhub') {
          fallbackName = parsed.slug;
        } else if (parsed.type === 'github') {
          const rawRepo = parsed.repo;
          const normalized = rawRepo
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
          if (normalized) {
            fallbackName = normalized;
          }
        }
      }

      const entry = await this.installer.installFromStaged(tempDir, { fallbackName });
      return entry;
    } finally {
      if (fs.existsSync(zipPath)) {
        fs.rmSync(zipPath);
      }
      this.cleanupDownloadDir();
    }
  }

  /** Remove the .download temp directory if it's empty. */
  private cleanupDownloadDir(): void {
    const downloadDir = path.join(this.storageDir, '.download');
    try {
      if (fs.existsSync(downloadDir)) {
        const remaining = fs.readdirSync(downloadDir);
        if (remaining.length === 0) {
          fs.rmSync(downloadDir, { recursive: true, force: true });
        }
      }
    } catch {
      // best-effort cleanup
    }
  }

  /** Remove any leftover .preview-* directories. */
  private cleanupPreviewDirs(): void {
    try {
      for (const entry of fs.readdirSync(this.storageDir)) {
        if (entry.startsWith('.preview-')) {
          fs.rmSync(path.join(this.storageDir, entry), { recursive: true, force: true });
        }
      }
    } catch {
      // best-effort cleanup
    }
  }

}

export * from './types';
export type { MirrorConfig, SkillSearchResult } from './finder/skill-finder';
