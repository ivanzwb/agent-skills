import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import {
  SkillRegistryEntry,
  SkillStatus,
  SkillFrameworkError,
  SkillValidationError,
  SkillSecurityError,
  IDependencyInstaller,
} from '../types';
import { SkillRegistry } from '../registry/skill-registry';
import { parseSkillMd } from '../parsers/skill-parser';
import { parseManifest } from '../parsers/manifest-parser';
import { DependencyManager } from '../dependencies/dependency-manager';

function assertPathWithinRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(root, candidate);
  if (!resolvedCandidate.startsWith(resolvedRoot + path.sep) && resolvedCandidate !== resolvedRoot) {
    throw new SkillSecurityError(`Path traversal detected: "${candidate}" escapes root "${root}"`);
  }
  return resolvedCandidate;
}

function sanitizeArchiveEntry(targetDir: string, entryName: string): string {
  if (path.isAbsolute(entryName)) {
    throw new SkillSecurityError(`Archive entry has absolute path: "${entryName}"`);
  }
  return assertPathWithinRoot(targetDir, entryName);
}

function assertNameMatchesDir(skillName: string, dirPath: string): void {
  const dirName = path.basename(dirPath);
  if (dirName !== skillName) {
    throw new SkillSecurityError(`Skill name "${skillName}" does not match directory name "${dirName}"`);
  }
}

export interface SkillInstallerConfig {
  /** Directory where installed skill packages are stored */
  skillsDir: string;
  /** Custom dependency installers (defaults to built-in npm + pip) */
  dependencyInstallers?: IDependencyInstaller[];
}

/**
 * Handles the full lifecycle of skill installation and uninstallation.
 *
 * Install flow (§8.1):
 *  1. Ingest artifact → validate path safety → extract to isolated directory
 *  2. Locate package root (contains SKILL.md)
 *  3. Validate frontmatter
 *  4. Validate name matches directory name
 *  5. Install dependencies (npm/pip)
 *  6. Parse manifest.json tools
 *  7. Write to registry and register tools
 *
 * Uninstall flow (§8.2):
 *  1. Unregister tools → stop related runtime
 *  2. Delete package directory and artifacts
 *  3. Update registry
 */
export class SkillInstaller {
  private readonly dependencyManager: DependencyManager;

  constructor(
    private readonly config: SkillInstallerConfig,
    private readonly registry: SkillRegistry,
  ) {
    this.dependencyManager = new DependencyManager();
    if (config.dependencyInstallers) {
      for (const installer of config.dependencyInstallers) {
        this.dependencyManager.register(installer);
      }
    }
  }

  /**
   * Install a skill from a source path (directory or zip archive).
   */
  async install(source: string): Promise<SkillRegistryEntry> {
    const resolvedSource = path.resolve(source);

    if (!fs.existsSync(resolvedSource)) {
      throw new SkillFrameworkError(`Source not found: ${source}`, 'SOURCE_NOT_FOUND');
    }

    const stat = fs.statSync(resolvedSource);
    let skillRoot: string;

    if (stat.isDirectory()) {
      skillRoot = await this.installFromDirectory(resolvedSource);
    } else if (resolvedSource.endsWith('.zip')) {
      skillRoot = await this.installFromZip(resolvedSource);
    } else {
      throw new SkillFrameworkError(
        'Source must be a directory or .zip file',
        'INVALID_SOURCE',
      );
    }

    try {
      const skillMdPath = path.join(skillRoot, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) {
        throw new SkillValidationError(
          `SKILL.md not found in package root: ${skillRoot}`,
        );
      }

      const raw = fs.readFileSync(skillMdPath, 'utf-8');
      const doc = parseSkillMd(raw);

      assertNameMatchesDir(doc.frontmatter.name, skillRoot);

      await this.dependencyManager.installAll(skillRoot);

      const tools = parseManifest(skillRoot);

      const entry: SkillRegistryEntry = {
        name: doc.frontmatter.name,
        status: SkillStatus.Installed,
        rootPath: skillRoot,
        frontmatter: doc.frontmatter,
        tools,
        installedAt: new Date().toISOString(),
      };

      this.registry.register(entry);
      return entry;
    } catch (e) {
      this.cleanupDir(skillRoot);
      throw e;
    }
  }

  /**
   * Uninstall a skill by name.
   */
  async uninstall(name: string): Promise<void> {
    const entry = this.registry.get(name);
    this.registry.unregister(name);
    this.cleanupDir(entry.rootPath);
  }

  /**
   * Stage a skill source (directory or zip) into a temporary directory
   * under the skills storage for preview/inspection.
   */
  stageToTemp(source: string): string {
    const resolvedSource = path.resolve(source);
    if (!fs.existsSync(resolvedSource)) {
      throw new SkillFrameworkError(`Source not found: ${source}`, 'SOURCE_NOT_FOUND');
    }

    const stat = fs.statSync(resolvedSource);
    const tempName = `.preview-${Date.now()}`;
    const tempDir = path.join(this.config.skillsDir, tempName);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      if (stat.isDirectory()) {
        fs.cpSync(resolvedSource, tempDir, { recursive: true });
      } else if (resolvedSource.endsWith('.zip')) {
        const zip = new AdmZip(resolvedSource);
        const entries = zip.getEntries();
        if (entries.length === 0) {
          throw new SkillValidationError('Zip archive is empty');
        }
        for (const entry of entries) {
          sanitizeArchiveEntry(tempDir, entry.entryName);
        }
        zip.extractAllTo(tempDir, true);
      } else {
        throw new SkillFrameworkError('Source must be a directory or .zip file', 'INVALID_SOURCE');
      }
    } catch (e) {
      this.cleanupDir(tempDir);
      throw e;
    }

    return tempDir;
  }

  /**
   * Install a skill from a previously staged temp directory.
   * Renames the temp dir to the final skill name directory.
   */
  async installFromStaged(tempDir: string): Promise<SkillRegistryEntry> {
    const resolvedTemp = path.resolve(tempDir);
    if (!fs.existsSync(resolvedTemp)) {
      throw new SkillFrameworkError(`Staged directory not found: ${tempDir}`, 'SOURCE_NOT_FOUND');
    }

    const skillMdPath = path.join(resolvedTemp, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      throw new SkillValidationError(`SKILL.md not found in: ${resolvedTemp}`);
    }

    const raw = fs.readFileSync(skillMdPath, 'utf-8');
    const doc = parseSkillMd(raw);
    const skillName = doc.frontmatter.name;

    const finalDir = path.join(this.config.skillsDir, skillName);
    if (fs.existsSync(finalDir)) {
      throw new SkillFrameworkError(
        `Skill directory already exists: ${skillName}. Uninstall first.`,
        'ALREADY_EXISTS',
      );
    }

    fs.renameSync(resolvedTemp, finalDir);

    try {
      assertNameMatchesDir(skillName, finalDir);
      await this.dependencyManager.installAll(finalDir);
      const tools = parseManifest(finalDir);

      const entry: SkillRegistryEntry = {
        name: skillName,
        status: SkillStatus.Installed,
        rootPath: finalDir,
        frontmatter: doc.frontmatter,
        tools,
        installedAt: new Date().toISOString(),
      };

      this.registry.register(entry);
      return entry;
    } catch (e) {
      this.cleanupDir(finalDir);
      throw e;
    }
  }

  /**
   * Clean up a staged temp directory (e.g. user decides not to install).
   */
  cleanupTemp(tempDir: string): void {
    this.cleanupDir(path.resolve(tempDir));
  }

  /** Copy a directory-based skill into the skills storage */
  private async installFromDirectory(sourceDir: string): Promise<string> {
    const dirName = path.basename(sourceDir);
    const targetDir = path.join(this.config.skillsDir, dirName);

    if (sourceDir === targetDir) {
      return targetDir;
    }

    if (fs.existsSync(targetDir)) {
      throw new SkillFrameworkError(
        `Skill directory already exists: ${dirName}. Uninstall first.`,
        'ALREADY_EXISTS',
      );
    }

    fs.cpSync(sourceDir, targetDir, { recursive: true });
    return targetDir;
  }

  /** Extract a zip-based skill into the skills storage */
  private async installFromZip(zipPath: string): Promise<string> {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      throw new SkillValidationError('Zip archive is empty');
    }

    const firstEntry = entries[0].entryName;
    const topDir = firstEntry.split('/')[0];

    if (!topDir) {
      throw new SkillValidationError('Cannot determine skill directory from zip');
    }

    const targetDir = path.join(this.config.skillsDir, topDir);

    if (fs.existsSync(targetDir)) {
      throw new SkillFrameworkError(
        `Skill directory already exists: ${topDir}. Uninstall first.`,
        'ALREADY_EXISTS',
      );
    }

    for (const entry of entries) {
      sanitizeArchiveEntry(this.config.skillsDir, entry.entryName);
    }

    zip.extractAllTo(this.config.skillsDir, false);

    return targetDir;
  }

  /** Remove a directory tree */
  private cleanupDir(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
}
