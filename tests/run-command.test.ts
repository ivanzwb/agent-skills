import { runCommand } from '../src/dependencies/run-command';

describe('runCommand', () => {
  it('returns success for echo', async () => {
    const result = await runCommand('echo', ['hello'], process.cwd(), 10000);
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
  });

  it('returns failure for a non-zero exit code', async () => {
    const result = await runCommand('node', ['-e', 'process.exit(1)'], process.cwd(), 10000);
    expect(result.success).toBe(false);
  });

  it('returns failure for a non-existent command', async () => {
    const result = await runCommand('nonexistent-cmd-xyz-12345', [], process.cwd(), 10000);
    expect(result.success).toBe(false);
    expect(result.output.length).toBeGreaterThan(0);
  });
});
