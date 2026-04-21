import { SPINNER_FRAMES, createSpinnerProgress } from '../progress';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('createSpinnerProgress', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Mock implementation
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('exports SPINNER_FRAMES array', () => {
    expect(SPINNER_FRAMES).toHaveLength(10);
    expect(SPINNER_FRAMES[0]).toBe('⠋');
  });

  it('shows spinner on start', () => {
    const { onProgress } = createSpinnerProgress();
    onProgress('Building', 'start');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Building...'));
  });

  it('rotates spinner frames on interval', () => {
    const { onProgress } = createSpinnerProgress();
    onProgress('Building', 'start');
    vi.advanceTimersByTime(80);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining(SPINNER_FRAMES[1]!));
  });

  it('prints checkmark on success', () => {
    const { onProgress } = createSpinnerProgress();
    onProgress('Building', 'start');
    onProgress('Building', 'success');
    expect(logSpy).toHaveBeenCalledWith('✓ Building');
  });

  it('prints cross on error', () => {
    const { onProgress } = createSpinnerProgress();
    onProgress('Building', 'start');
    onProgress('Building', 'error');
    expect(logSpy).toHaveBeenCalledWith('✗ Building');
  });

  it('cleanup clears active spinner', () => {
    const { onProgress, cleanup } = createSpinnerProgress();
    onProgress('Building', 'start');
    cleanup();
    expect(writeSpy).toHaveBeenCalledWith('\r\x1b[K');
  });

  it('handles sequential steps', () => {
    const { onProgress } = createSpinnerProgress();
    onProgress('Step 1', 'start');
    onProgress('Step 1', 'success');
    onProgress('Step 2', 'start');
    onProgress('Step 2', 'success');
    expect(logSpy).toHaveBeenCalledWith('✓ Step 1');
    expect(logSpy).toHaveBeenCalledWith('✓ Step 2');
  });
});
