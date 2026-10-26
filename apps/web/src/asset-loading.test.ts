import { afterEach, expect, it, vi } from 'vitest';
import { AssetLoadBudget, STAGE_ASSET_DEADLINE_MS } from './asset-loading';

afterEach(() => vi.useRealTimers());

it('bounds an unresponsive manifest so the stage can use shipped fallback geometry', async () => {
  vi.useFakeTimers();
  const budget = new AssetLoadBudget();
  const result = budget.wait(new Promise(() => {}));
  const rejection = expect(result).rejects.toThrow('deadline');
  await vi.advanceTimersByTimeAsync(STAGE_ASSET_DEADLINE_MS);
  await rejection;
  expect(budget.signal.aborted).toBe(true);
  budget.close();
});

it('shares the original deadline across the manifest and multiple asset loads', async () => {
  vi.useFakeTimers();
  const budget = new AssetLoadBudget();
  await vi.advanceTimersByTimeAsync(6000);
  await expect(budget.wait(Promise.resolve('manifest'))).resolves.toBe('manifest');
  const pending = Promise.allSettled([budget.wait(new Promise(() => {})), budget.wait(new Promise(() => {}))]);
  await vi.advanceTimersByTimeAsync(2000);
  expect((await pending).map(result => result.status)).toEqual(['rejected', 'rejected']);
  budget.close();
});

it('disposes a late decoded container without making it available for scene replacement', async () => {
  vi.useFakeTimers();
  const budget = new AssetLoadBudget();
  let finish!: (value: { dispose: () => void }) => void;
  const dispose = vi.fn(), attach = vi.fn();
  const loaded = budget.wait(new Promise<{ dispose: () => void }>(resolve => { finish = resolve; }), resource => resource.dispose());
  const continuation = loaded.then(attach).catch(() => {});
  await vi.advanceTimersByTimeAsync(STAGE_ASSET_DEADLINE_MS);
  finish({ dispose });
  await continuation;
  await Promise.resolve();
  expect(attach).not.toHaveBeenCalled();
  expect(dispose).toHaveBeenCalledExactlyOnceWith();
  budget.close();
});

it('cancels pending work when its stage is disposed and observes later loader failures', async () => {
  const budget = new AssetLoadBudget();
  let fail!: (error: Error) => void;
  const result = budget.wait(new Promise((_, reject) => { fail = reject; }));
  const rejection = expect(result).rejects.toThrow('closed');
  budget.close();
  await rejection;
  fail(new Error('Loader failed after disposal'));
  await Promise.resolve();
});

it('retains containers accepted before the deadline', async () => {
  vi.useFakeTimers();
  const budget = new AssetLoadBudget(), discard = vi.fn();
  const resource = { name: 'approved-hero' };
  await expect(budget.wait(Promise.resolve(resource), discard)).resolves.toBe(resource);
  budget.close();
  await vi.advanceTimersByTimeAsync(STAGE_ASSET_DEADLINE_MS);
  expect(discard).not.toHaveBeenCalled();
});
