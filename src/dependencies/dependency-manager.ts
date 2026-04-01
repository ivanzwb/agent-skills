import { IDependencyInstaller, DependencyInstallResult } from '../types';
import { NpmInstaller } from './npm-installer';
import { PipInstaller } from './pip-installer';

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Manages a pluggable set of dependency installers.
 * Built-in: npm and pip. Register custom installers for additional languages.
 */
export class DependencyManager {
  private installers: IDependencyInstaller[] = [];

  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.register(new NpmInstaller());
    this.register(new PipInstaller());
  }

  /** Register a custom dependency installer. */
  register(installer: IDependencyInstaller): void {
    this.installers = this.installers.filter((i) => i.type !== installer.type);
    this.installers.push(installer);
  }

  /** Unregister an installer by type. */
  unregister(type: string): void {
    this.installers = this.installers.filter((i) => i.type !== type);
  }

  /** List registered installer types. */
  listTypes(): string[] {
    return this.installers.map((i) => i.type);
  }

  /**
   * Detect and run all applicable installers for the given skill root.
   * Returns results only for installers that detected applicable files.
   */
  async installAll(skillRoot: string): Promise<DependencyInstallResult[]> {
    const results: DependencyInstallResult[] = [];

    for (const installer of this.installers) {
      if (installer.detect(skillRoot)) {
        const result = await installer.install(skillRoot, this.timeoutMs);
        results.push(result);
      }
    }

    return results;
  }
}

export { NpmInstaller } from './npm-installer';
export { PipInstaller } from './pip-installer';
export { runCommand } from './run-command';
