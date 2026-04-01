import * as fs from 'fs';
import * as path from 'path';
import { IDependencyInstaller, DependencyInstallResult } from '../types';
import { runCommand } from './run-command';

export class PipInstaller implements IDependencyInstaller {
  readonly type = 'pip' as const;

  constructor(private readonly command: string = 'pip') {}

  detect(skillRoot: string): boolean {
    return fs.existsSync(path.join(skillRoot, 'requirements.txt'));
  }

  async install(skillRoot: string, timeoutMs: number): Promise<DependencyInstallResult> {
    const result = await runCommand(
      this.command,
      ['install', '-r', 'requirements.txt'],
      skillRoot,
      timeoutMs,
    );
    return { type: this.type, ...result };
  }
}
