/** Dependency types and installer interface */

/** Built-in dependency types. Extendable via string for custom installers. */
export type DependencyType = 'npm' | 'pip' | (string & {});

export interface DependencyInstallResult {
  type: DependencyType;
  success: boolean;
  output: string;
}

/** Abstract interface for a language-specific dependency installer. */
export interface IDependencyInstaller {
  /** Unique identifier for this installer type, e.g. 'npm', 'pip', 'cargo' */
  readonly type: DependencyType;

  /**
   * Detect whether this installer is applicable for the given skill root.
   * E.g. check if package.json / requirements.txt / Cargo.toml exists.
   */
  detect(skillRoot: string): boolean;

  /**
   * Execute dependency installation in the given skill root directory.
   * @param skillRoot Absolute path to the skill package root.
   * @param timeoutMs Maximum time in milliseconds for the install process.
   */
  install(skillRoot: string, timeoutMs: number): Promise<DependencyInstallResult>;
}
