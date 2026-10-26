import { randomBytes } from 'node:crypto';
import type { ChatMessage } from './engine.ts';
import type { Store } from './store.ts';
import type { Twitch } from './twitch.ts';

export interface ConnectionState {
  connected: boolean; chatHelpGranted: boolean; testCode: string | null; lastTestAt: number | null;
}
interface Challenge { code: string; mintedAt: number; expiresAt: number; lastTestAt: number | null; }
export class ConnectionTests {
  store: Store; twitch: Twitch; now: () => number;
  challenges = new Map<string, Challenge>();
  constructor(store: Store, twitch: Twitch, now: () => number) { this.store = store; this.twitch = twitch; this.now = now; }
  state(channelId: string): ConnectionState {
    const challenge = this.challenges.get(channelId), credential = this.store.credential(channelId);
    return {
      connected: this.twitch.connected.has(channelId),
      chatHelpGranted: Boolean(credential?.chatHelp && credential.scopes.includes('user:write:chat')),
      testCode: challenge && this.now() <= challenge.expiresAt ? challenge.code : null,
      lastTestAt: challenge?.lastTestAt ?? null,
    };
  }
  mint(channelId: string): ConnectionState {
    const mintedAt = this.now();
    let code: string; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (code === this.challenges.get(channelId)?.code);
    this.challenges.set(channelId, { code, mintedAt, expiresAt: mintedAt + 10 * 60000, lastTestAt: null });
    return this.state(channelId);
  }
  clear(channelId: string) { this.challenges.delete(channelId); }
  // Returns true only for an explicit test command. Other commands retain the ordinary authoring route.
  receive(message: ChatMessage): boolean {
    const match = /^!aragoz ([A-F0-9]{6})$/i.exec(message.text);
    if (!match) return false;
    if (!this.store.dedupe(message.deliveryId, this.now())) return true;
    const challenge = this.challenges.get(message.channelId);
    if (!challenge || challenge.lastTestAt !== null || !this.twitch.connected.has(message.channelId) || !this.store.credential(message.channelId)) return true;
    if (this.now() > challenge.expiresAt || message.sentAt < challenge.mintedAt || message.sentAt > challenge.expiresAt || match[1]!.toUpperCase() !== challenge.code) return true;
    challenge.lastTestAt = this.now();
    return true;
  }
}
