import * as fs from 'fs';
import * as path from 'path';
import { IDependencyInstaller, DependencyInstallResult } from '../types';
import { runCommand } from './run-command';

export class NpmInstaller implements IDependencyInstaller {
  readonly type = 'npm' as const;

  constructor(private readonly command: string = 'npm') {}

  detect(skillRoot: string): boolean {
    return fs.existsSync(path.join(skillRoot, 'package.json'));
  }

  async install(skillRoot: string, timeoutMs: number): Promise<DependencyInstallResult> {
    const result = await runCommand(this.command, ['install'], skillRoot, timeoutMs);
    return { type: this.type, ...result };
  }
}
