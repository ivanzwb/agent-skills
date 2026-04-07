/**
 * Test the spawn error handler in runCommand using module-level jest.mock.
 * Separated because child_process properties are non-configurable
 * and cannot be spied on with jest.spyOn.
 */
import { EventEmitter } from 'events';

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: mockSpawn,
}));

import { runCommand } from '../../src/dependencies/run-command';

describe('runCommand – spawn error event', () => {
  afterEach(() => {
    mockSpawn.mockReset();
  });

  it('resolves with failure when spawn emits error', async () => {
    const fakeChild = new EventEmitter();
    (fakeChild as any).stdout = new EventEmitter();
    (fakeChild as any).stderr = new EventEmitter();
    mockSpawn.mockReturnValueOnce(fakeChild);

    const promise = runCommand('anything', [], '.', 5000);
    fakeChild.emit('error', new Error('spawn ENOENT'));

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.output).toContain('spawn ENOENT');
  });
});
