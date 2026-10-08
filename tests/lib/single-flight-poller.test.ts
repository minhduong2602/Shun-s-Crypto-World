import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSingleFlightPoller } from '@/lib/async/single-flight-poller';

describe('createSingleFlightPoller', () => {
  afterEach(() => vi.useRealTimers());

  it('skips scheduled refreshes while the previous refresh is still running', async () => {
    vi.useFakeTimers();
    let finishFirst: () => void = () => {};
    const refresh = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValue(undefined);
    const poller = createSingleFlightPoller(refresh, 1_000);

    poller.start();
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    finishFirst();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('runs immediately and stops scheduling after cleanup', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const poller = createSingleFlightPoller(refresh, 1_000);

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    poller.stop();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
