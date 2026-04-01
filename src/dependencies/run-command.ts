import { spawn } from 'child_process';

export function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];

    const child = spawn(command, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));

    child.on('close', (code) => {
      const output = Buffer.concat(chunks).toString('utf-8');
      resolve({ success: code === 0, output });
    });

    child.on('error', (err) => {
      resolve({ success: false, output: err.message });
    });
  });
}
