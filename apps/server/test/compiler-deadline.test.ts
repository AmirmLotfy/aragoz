import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Compiler } from '../src/compiler.ts';
import { configFromEnv } from '../src/config.ts';
import { Store } from '../src/store.ts';
import type { Proposal } from '../../../packages/contracts/src/index.ts';

// All transports below are local synthetic mocks. No provider request is made.
const epoch = Date.parse('2026-10-27T12:00:00Z');
const input: Proposal = { id: 'synthetic-proposal', roomId: 'PRIVATE_ROOM', actId: 'PRIVATE_ACT', ballotGeneration: 1,
  authorId: 'PRIVATE_AUTHOR', displayName: 'PRIVATE_DISPLAY', raw: 'charge BUT cannot turn', receivedAt: epoch,
  sentAt: epoch, messageId: 'PRIVATE_MESSAGE', rejected: false, rejectionReason: null };
const moderation = () => new Response(JSON.stringify({ results: [{ flagged: false }] }));
const valid = () => new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ proposals: [
  { proposalId: input.id, status: 'supported', profileId: 'charge-deliberate', explanation: null },
] }) }] }] }));
const refusal = () => new Response(JSON.stringify({ output: [{ content: [{ type: 'refusal', refusal: 'SYNTHETIC_REFUSAL' }] }] }));
let store: Store;
function compiler(fetcher: typeof fetch, cap = 3) {
  return new Compiler({ ...configFromEnv({}), openaiApiKey: 'synthetic-key', modelDailyRequestLimit: cap }, store, fetcher, Date.now);
}
function pending<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function delay(value: Response, ms: number) { return new Promise<Response>(resolve => setTimeout(() => resolve(value), ms)); }
function usage() { return (store.db.prepare('SELECT count FROM model_usage').get() as { count: number } | undefined)?.count ?? 0; }
function expectFallback(c: Compiler, candidates: Awaited<ReturnType<Compiler['compile']>>) {
  expect(c.mode(candidates)).toBe('catalogue'); expect(candidates).toHaveLength(3);
  expect(candidates[0]).toMatchObject({ sourceProposalId: input.id, profileId: 'charge-deliberate', approved: false,
    credit: { source: 'viewer', authorId: input.authorId, hidden: true } });
  expect(candidates.filter(candidate => candidate.credit.source === 'house').every(candidate => candidate.credit.authorId === null)).toBe(true);
  expect(JSON.stringify(candidates)).not.toContain('SYNTHETIC_REFUSAL');
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(epoch); store = new Store(':memory:', ''); });
afterEach(() => { store.close(); vi.useRealTimers(); });

describe('synthetic compiler total deadline and refusal', () => {
  it('aborts pending moderation at exactly 12 seconds even when transport ignores the signal', async () => {
    const transport = pending<Response>(); const signals: AbortSignal[] = [];
    const c = compiler(async (_url, init) => { signals.push(init!.signal as AbortSignal); return transport.promise; });
    let settled = false; const result = c.compile([{ ...input }], [], true).then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(11999); expect(settled).toBe(false); expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(settled).toBe(true); expect(signals[0]?.aborted).toBe(true);
    expectFallback(c, await result); expect(usage()).toBe(1);
    transport.resolve(moderation()); await vi.advanceTimersByTimeAsync(0);
    expect(signals).toHaveLength(1); expect(usage()).toBe(1); expect(vi.getTimerCount()).toBe(0);
  });

  it('includes a stalled response body in the same deadline', async () => {
    const body = pending<unknown>(); let signal: AbortSignal | undefined;
    const c = compiler(async (_url, init) => { signal = init!.signal as AbortSignal; const response = moderation(); vi.spyOn(response, 'json').mockImplementation(() => body.promise); return response; });
    const proposal = { ...input }; const result = c.compile([proposal], [], true);
    await vi.advanceTimersByTimeAsync(12000); expectFallback(c, await result); expect(signal?.aborted).toBe(true);
    body.resolve({ results: [{ flagged: true }] }); await vi.advanceTimersByTimeAsync(0);
    expect(usage()).toBe(1); expect(proposal.rejected).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });

  it('shares 12 seconds across moderation, first mapping and pending repair', async () => {
    const signals: AbortSignal[] = [], starts: number[] = [];
    const repair = pending<Response>();
    const c = compiler(async (_url, init) => {
      signals.push(init!.signal as AbortSignal); starts.push(Date.now() - epoch);
      return starts.length === 1 ? delay(moderation(), 5000) : starts.length === 2 ? delay(refusal(), 4000) : repair.promise;
    });
    let settled = false; const result = c.compile([{ ...input }], [], true).then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(11999); expect(settled).toBe(false); expect(starts).toEqual([0, 5000, 9000]);
    expect(new Set(signals).size).toBe(1); expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expectFallback(c, await result); expect(Date.now() - epoch).toBe(12000);
    expect(signals.every(signal => signal.aborted)).toBe(true); expect(usage()).toBe(3);
    repair.resolve(valid()); await vi.advanceTimersByTimeAsync(0); expect(starts).toHaveLength(3); expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts a bounded repair inside the total budget and cancels its timer', async () => {
    let calls = 0; const signals: AbortSignal[] = [];
    const c = compiler(async (_url, init) => { signals.push(init!.signal as AbortSignal); calls++; return delay(calls === 1 ? moderation() : calls === 2 ? refusal() : valid(), calls === 1 ? 5000 : calls === 2 ? 4000 : 2999); });
    const result = c.compile([{ ...input }], [], true); await vi.advanceTimersByTimeAsync(11999);
    const candidates = await result; expect(c.mode(candidates)).toBe('model'); expect(candidates[0]?.approved).toBe(false);
    expect(calls).toBe(3); expect(usage()).toBe(3); expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1); expect(signals.every(signal => !signal.aborted)).toBe(true);
  });

  it.each([1, 2, 3])('falls back after refusal with daily cap %i and never includes identity metadata', async cap => {
    const requests: { endpoint: string; body: Record<string, unknown> }[] = [];
    const c = compiler(async (url, init) => { const endpoint = String(url).split('/').at(-1)!;
      requests.push({ endpoint, body: JSON.parse(String(init!.body)) }); return endpoint === 'moderations' ? moderation() : refusal(); }, cap);
    expectFallback(c, await c.compile([{ ...input }], [], true));
    expect(requests).toHaveLength(cap); expect(usage()).toBe(cap);
    expect(requests.map(request => request.endpoint)).toEqual(['moderations', 'responses', 'responses'].slice(0, cap));
    const serialized = JSON.stringify(requests);
    for (const secret of ['PRIVATE_AUTHOR', 'PRIVATE_DISPLAY', 'PRIVATE_ROOM', 'PRIVATE_ACT', 'PRIVATE_MESSAGE']) expect(serialized).not.toContain(secret);
    for (const request of requests.filter(request => request.endpoint === 'responses')) {
      expect(request.body.store).toBe(false); expect(request.body.tools).toBeUndefined();
      expect(request.body.reasoning).toEqual({ effort: 'none' });
      expect(request.body.text).toMatchObject({ format: { strict: true } });
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects an already aborted request before consuming budget or invoking transport', async () => {
    const fetcher = vi.fn<typeof fetch>(); const c = compiler(fetcher); const controller = new AbortController(); controller.abort();
    await expect(c.request('responses', {}, controller.signal)).rejects.toThrow();
    expect(usage()).toBe(0); expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses only labelled House choices for unsupported input after two model refusals', async () => {
    let calls = 0;
    const c = compiler(async url => { calls++; return String(url).endsWith('moderations') ? moderation() : refusal(); });
    const candidates = await c.compile([{ ...input, raw: 'teleports BUT is slow afterwards' }], [], true);
    expect(calls).toBe(3); expect(usage()).toBe(3); expect(c.mode(candidates)).toBe('house'); expect(candidates).toHaveLength(3);
    expect(candidates.every(candidate => candidate.credit.source === 'house' && candidate.credit.authorId === null
      && candidate.credit.displayName === 'House Suggestion' && candidate.sourceProposalId === null)).toBe(true);
    expect(JSON.stringify(candidates)).not.toContain('SYNTHETIC_REFUSAL'); expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps calls disabled at zero cap even with a configured fixture key', async () => {
    const fetcher = vi.fn<typeof fetch>(); const c = compiler(fetcher, 0);
    expectFallback(c, await c.compile([{ ...input }], [], true)); expect(fetcher).not.toHaveBeenCalled(); expect(usage()).toBe(0);
  });
});
