import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { Compiler, houseCandidates, rank, selectBatch } from '../src/compiler.ts';
import { configFromEnv } from '../src/config.ts';
import { Engine } from '../src/engine.ts';
import type { ChatMessage } from '../src/engine.ts';
import { Store } from '../src/store.ts';
import type { Proposal, RoomState, ShowAction } from '../../../packages/contracts/src/index.ts';

// This is synthetic in-process traffic, not genuine Twitch/provider/load acceptance.
let clock: number, store: Store, compiler: Compiler, engine: Engine;
const noFetch: typeof fetch = async () => { throw new Error('Synthetic load must not access providers'); };
const receipt: { load?: Record<string, unknown>; responsiveness?: Record<string, unknown> } = {};
afterAll(() => {
  const output = process.env.ARAGOZ_LOAD_RECEIPT_PATH;
  if (output) writeFileSync(output, JSON.stringify({ schemaVersion: 1, evidence: 'synthetic local fixtures only; no provider/network/browser/human acceptance',
    complete: Boolean(receipt.load && receipt.responsiveness), ...receipt }, null, 2) + '\n');
});
async function action(room: RoomState, value: ShowAction) { const fresh = engine.get(room.roomId); return engine.action(fresh.roomId, fresh.revision, value); }
function rooms() { return ['synthetic-alpha', 'synthetic-bravo', 'synthetic-charlie'].map(id => {
  const channel = { id, login: id, displayName: `SYNTHETIC ${id}` }; store.putChannel(channel); return engine.create(channel, true);
}); }
beforeEach(() => {
  clock = Date.parse('2026-10-27T12:00:00Z'); store = new Store(':memory:', '');
  compiler = new Compiler({ ...configFromEnv({}), openaiApiKey: '', modelDailyRequestLimit: 0 }, store, noFetch, () => clock);
  engine = new Engine(store, compiler, () => clock, () => {});
});
afterEach(() => { store.close(); });

describe('bounded synthetic audience traffic across three channels', () => {
  it('bounds proposals, samples twelve and isolates replacement, delivery, vote and cutoff rules', async () => {
    const started = performance.now(), completionMs: number[] = [], counts: Record<string, number> = {};
    let nextId = 0, peakStoredProposals = 0;
    // Observe every persisted proposal mutation, including admissions and evictions.
    engine.changed = room => { if (room.phase === 'proposals') {
      const count = store.proposals(room).length; peakStoredProposals = Math.max(peakStoredProposals, count); expect(count).toBeLessThanOrEqual(128);
    } };
    async function send(room: RoomState, category: string, fields: Partial<ChatMessage> = {}) {
      counts[category] = (counts[category] ?? 0) + 1; const id = `synthetic-${++nextId}`; const began = performance.now();
      await engine.chat({ deliveryId: id, messageId: id, channelId: room.channel.id, authorId: 'synthetic-outsider',
        displayName: 'SYNTHETIC fixture', text: `!make ${room.roundCode} charge BUT cannot turn`, sentAt: clock, ...fields });
      completionMs.push(performance.now() - began);
    }
    let shows = await Promise.all(rooms().map(room => action(room, { type: 'start-proposals' })));
    await engine.tick(); shows = shows.map(room => engine.get(room.roomId));
    expect(shows.every(room => room.phase === 'proposals')).toBe(true);
    const texts = ['charge BUT cannot turn', 'steam BUT overheats', 'echo BUT blocked'];
    const authors = Array.from({ length: 256 }, (_, index) => `synthetic-author-${String(index).padStart(3, '0')}`);
    await Promise.all(shows.flatMap((room, channel) => authors.map(authorId => send(room, 'initialProposal', {
      authorId, deliveryId: `${room.channel.id}:${authorId}:initial`, messageId: `${authorId}:initial`,
      text: `!make ${room.roundCode} ${texts[channel]}`,
    }))));
    const retained = shows.map(room => {
      const proposals = store.proposals(room); peakStoredProposals = Math.max(peakStoredProposals, proposals.length);
      expect(proposals).toHaveLength(128); expect(new Set(proposals.map(proposal => proposal.authorId)).size).toBe(128);
      const expected = authors.toSorted((a, b) => rank(room.roundCode!, a).localeCompare(rank(room.roundCode!, b))).slice(0, 128).sort();
      expect(proposals.map(proposal => proposal.authorId).sort()).toEqual(expected);
      return proposals.toSorted((a, b) => a.authorId.localeCompare(b.authorId));
    });
    for (const [channel, room] of shows.entries()) {
      for (const proposal of retained[channel]!.slice(0, 16)) {
        await send(room, 'duplicateProposalDelivery', { authorId: proposal.authorId, deliveryId: `${room.channel.id}:${proposal.authorId}:initial`, messageId: `${proposal.authorId}:initial` });
        await send(room, 'replacementProposal', { authorId: proposal.authorId, messageId: 'z-newest', sentAt: clock + 2, text: `!make ${room.roundCode} steam BUT overheats` });
        await send(room, 'reorderedProposal', { authorId: proposal.authorId, messageId: 'old', sentAt: clock + 1, text: `!make ${room.roundCode} echo BUT blocked` });
        await send(room, 'tieOlderProposal', { authorId: proposal.authorId, messageId: 'a-older', sentAt: clock + 2, text: `!make ${room.roundCode} echo BUT blocked` });
        await send(room, 'overAuthorLimitProposal', { authorId: proposal.authorId, messageId: 'zz-fifth', sentAt: clock + 3, text: `!make ${room.roundCode} charge BUT cannot turn` });
      }
      const wrong = room.roundCode === 'FFFFFF' ? '000000' : 'FFFFFF';
      await send(room, 'wrongProposalCode', { text: `!make ${wrong} echo BUT blocked` });
      const other = shows[(channel + 1) % 3]!;
      // Use a valid code on an unrelated channel: it cannot enter the issuing room.
      const beforeOther = store.proposals(other);
      await send(room, 'crossChannelProposal', { text: `!make ${other.roundCode} echo BUT blocked`, authorId: 'synthetic-cross-channel' });
      expect(store.proposals(other)).toEqual(beforeOther);
      expect(store.proposals(room).some(proposal => proposal.authorId === 'synthetic-cross-channel')).toBe(false);
      await send(room, 'beforeProposalOpen', { sentAt: room.opensAt! - 1 });
      await send(room, 'afterProposalSentCutoff', { sentAt: room.deadline! + 1 });
      const current = store.proposals(room);
      expect(current).toHaveLength(128);
      for (const proposal of retained[channel]!.slice(0, 16)) expect(current.find(item => item.authorId === proposal.authorId)).toMatchObject({ raw: 'steam BUT overheats', messageId: 'z-newest', sentAt: clock + 2 });
      const sample = selectBatch(current, `${room.actId}:${room.ballotGeneration}`, new Set());
      expect(sample).toHaveLength(12); expect(new Set(sample.map(item => item.authorId)).size).toBe(12);
      expect(selectBatch(current.toReversed(), `${room.actId}:${room.ballotGeneration}`, new Set()).map(item => item.id)).toEqual(sample.map(item => item.id));
      const recent = new Set(sample.map(item => item.authorId));
      expect(selectBatch(current, 'recent-author-test', recent).every(item => !recent.has(item.authorId))).toBe(true);
    }
    clock = shows[0]!.deadline!;
    for (const [channel, room] of shows.entries()) {
      const boundary = retained[channel]![16]!;
      await send(room, 'exactProposalCutoff', { authorId: boundary.authorId, text: `!make ${room.roundCode} echo BUT blocked` });
      expect(store.proposals(room).find(item => item.authorId === boundary.authorId)?.sentAt).toBe(clock);
    }
    clock++;
    for (const room of shows) {
      const snapshot = store.proposals(room);
      await send(room, 'expiredProposalArrival', { sentAt: room.deadline!, authorId: snapshot[0]!.authorId });
      expect(store.proposals(room)).toEqual(snapshot);
    }
    const batchSizes: number[] = []; const compile = compiler.compile.bind(compiler);
    vi.spyOn(compiler, 'compile').mockImplementation((proposals, excluded, hidden) => { batchSizes.push(proposals.length); return compile(proposals, excluded, hidden); });
    await engine.tick(); expect(batchSizes).toEqual([12, 12, 12]);
    shows = shows.map(room => engine.get(room.roomId));
    for (let index = 0; index < shows.length; index++) {
      let room = shows[index]!; expect(room.phase).toBe('review'); expect(room.candidates).toHaveLength(3);
      const ids = new Set(store.proposals(room).map(item => item.id));
      expect(room.candidates.filter(item => item.credit.source === 'viewer').every(item => ids.has(item.sourceProposalId!))).toBe(true);
      room = await action(room, { type: 'approve-candidates', candidateIds: room.candidates.map(item => item.id) });
      shows[index] = await action(room, { type: 'open-vote' });
    }
    await engine.tick(); shows = shows.map(room => engine.get(room.roomId));
    // Reusing the same synthetic account IDs across channels proves channel-local voting.
    const voters = Array.from({ length: 200 }, (_, index) => `synthetic-voter-${index}`);
    await Promise.all(shows.flatMap((room, channel) => voters.map(authorId => send(room, 'initialVote', {
      authorId, deliveryId: `${room.channel.id}:${authorId}:vote`, messageId: `${authorId}:vote`, text: `!vote ${room.roundCode} ${'ABC'[channel]}`,
    }))));
    for (const [channel, room] of shows.entries()) {
      const expected = [0, 0, 0]; expected[channel] = 200; expect(engine.get(room.roomId).votes).toEqual(expected);
      for (const authorId of voters.slice(0, 20)) {
        await send(room, 'duplicateVoteDelivery', { authorId, deliveryId: `${room.channel.id}:${authorId}:vote`, text: `!vote ${room.roundCode} C` });
        await send(room, 'replacementVote', { authorId, messageId: 'z-latest', sentAt: clock + 2, text: `!vote ${room.roundCode} ${'ABC'[(channel + 1) % 3]}` });
        await send(room, 'reorderedVote', { authorId, messageId: 'old', sentAt: clock + 1, text: `!vote ${room.roundCode} ${'ABC'[channel]}` });
        await send(room, 'tieOlderVote', { authorId, messageId: 'a-older', sentAt: clock + 2, text: `!vote ${room.roundCode} ${'ABC'[channel]}` });
      }
      expected[channel] = 180; expected[(channel + 1) % 3] = 20;
      expect(engine.get(room.roomId).votes).toEqual(expected); expect(store.votes(room)).toHaveLength(200);
      const before = store.votes(room), wrong = room.roundCode === 'FFFFFF' ? '000000' : 'FFFFFF';
      await send(room, 'wrongVoteCode', { text: `!vote ${wrong} A` });
      await send(room, 'crossChannelVote', { text: `!vote ${shows[(channel + 1) % 3]!.roundCode} A` });
      await send(room, 'beforeVoteOpen', { sentAt: room.opensAt! - 1, text: `!vote ${room.roundCode} A` });
      await send(room, 'afterVoteSentCutoff', { sentAt: room.deadline! + 1, text: `!vote ${room.roundCode} A` });
      expect(store.votes(room)).toEqual(before);
    }
    clock = shows[0]!.deadline!;
    for (const [channel, room] of shows.entries()) await send(room, 'exactVoteCutoff', { authorId: 'synthetic-boundary-voter', text: `!vote ${room.roundCode} ${'ABC'[channel]}` });
    clock++;
    for (const room of shows) {
      const before = store.votes(room);
      await send(room, 'expiredVoteArrival', { sentAt: room.deadline!, text: `!vote ${room.roundCode} C` });
      expect(store.votes(room)).toEqual(before); expect(before).toHaveLength(201);
    }
    const winners = shows.map((room, index) => room.candidates[index]!.profileId);
    await engine.tick();
    for (const [index, room] of shows.entries()) {
      const selected = engine.get(room.roomId); expect(selected.phase).toBe('setup'); expect(selected.roundCode).toBe(null);
      expect(selected.selectedModules[0]?.profileId).toBe(winners[index]);
      await send(room, 'closedVoteCode', { text: `!vote ${room.roundCode} C` });
      expect(engine.get(room.roomId)).toEqual(selected);
    }
    expect(engine.queues.size).toBe(0);
    expect(store.db.prepare('SELECT count(*) AS count FROM model_usage').get()).toEqual({ count: 0 });
    completionMs.sort((a, b) => a - b);
    const totalMessages = Object.values(counts).reduce((sum, count) => sum + count, 0); expect(totalMessages).toBe(1887);
    receipt.load = { evidence: 'synthetic in-process Engine/SQLite; no Twitch, network, browser or human acceptance',
      channels: 3, counts, totalMessages,
      retainedProposalsPerChannel: shows.map(room => store.proposals(room).length), peakStoredProposals, sampledPerChannel: batchSizes,
      effectiveVotesPerChannel: shows.map(room => store.votes(room).length), proposalWindowMs: 25000, voteWindowMs: 20000,
      durationMs: Math.round(performance.now() - started), messageCompletionP95Ms: Math.round(completionMs[Math.floor(completionMs.length * 0.95)]!),
      messageCompletionMaxMs: Math.round(completionMs.at(-1)!), failures: 0,
      invariants: ['128 stored proposals/channel', '12 eligible unique authors/sample', 'timestamp/message-id replacement', 'four proposal commands/author',
        'delivery dedupe', 'channel isolation', 'latest vote/account', 'exact cutoff accepted; late receipt rejected', 'no provider calls', 'queues drained'] };
    console.info('SYNTHETIC_AUDIENCE_LOAD_RECEIPT', JSON.stringify(receipt.load));
  });

  it('keeps other channels and the event loop responsive while one compiler is pending', async () => {
    const shows = await Promise.all(rooms().map(room => action(room, { type: 'start-proposals' })));
    await engine.tick(); let release!: (value: ReturnType<typeof houseCandidates>) => void;
    const blocked = new Promise<ReturnType<typeof houseCandidates>>(resolve => { release = resolve; });
    const batches: Proposal[][] = [];
    vi.spyOn(compiler, 'compile').mockImplementation(async proposals => { batches.push(proposals); return batches.length === 1 ? blocked : houseCandidates(); });
    clock += 25000; const tick = engine.tick();
    let measurement: Record<string, unknown> | undefined;
    try {
      // Bounded event-loop roundtrip: no polling, sleeping, provider or timing SLA claim.
      const started = performance.now(); await new Promise<void>(resolve => setImmediate(resolve));
      expect(engine.get(shows[0]!.roomId).phase).toBe('compiling');
      expect(shows.slice(1).map(room => engine.get(room.roomId).phase)).toEqual(['review', 'review']);
      const other = await action(shows[1]!, { type: 'settings', settings: { broadcastDelayMs: 0, hideAuthors: true, chatHelp: false } });
      expect(other.settings.hideAuthors).toBe(true);
      for (let index = 0; index < 3; index++) await engine.tick();
      expect(batches).toHaveLength(3); expect(engine.queues.size).toBe(1);
      measurement = { evidence: 'synthetic local pending compiler', channels: 3,
        otherChannelsReachedReview: 2, hostActionCompleted: true, extraTicks: 3, duplicateCompilations: 0,
        eventLoopAndHostActionMs: Math.round(performance.now() - started), failures: 0 };
    } finally { release(houseCandidates()); await tick; }
    expect(shows.map(room => engine.get(room.roomId).phase)).toEqual(['review', 'review', 'review']); expect(engine.queues.size).toBe(0);
    receipt.responsiveness = measurement;
    console.info('SYNTHETIC_AUDIENCE_RESPONSIVENESS', JSON.stringify(receipt.responsiveness));
  });
});
