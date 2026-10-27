import { describe, expect, it } from 'vitest';
import { RoomMutationQueue } from './room-mutations';

describe('room mutation ordering', () => {
  it('reads the accepted revision when dequeued and continues after a rejected request', async () => {
    const queue = new RoomMutationQueue(), sent: number[] = [];
    let revision = 4, release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const upload = queue.run(async () => { sent.push(revision); await held; revision++; });
    const rejected = queue.run(async () => { sent.push(revision); throw new Error('connection interrupted'); });
    const rejectedCheck = expect(rejected).rejects.toThrow('connection interrupted');
    const pause = queue.run(async () => { sent.push(revision); revision++; });
    await Promise.resolve();
    expect(sent).toEqual([4]);
    release();
    await Promise.all([upload, rejectedCheck, pause]);
    expect(sent).toEqual([4, 5, 5]);
    expect(revision).toBe(6);
  });
});
