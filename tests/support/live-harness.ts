import { existsSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createApp } from '../../apps/server/src/app.ts';
import type { SocketLike } from '../../apps/server/src/twitch.ts';
import type { RoomState } from '../../packages/contracts/src/index.ts';

/** Local test fixtures only. This harness never adds authentication or test routes. */
export const LIVE_FIXTURE_LABEL = 'FIXTURE · mocked Twitch input · local browser evidence';
export const LIVE_FIXTURE_CHANNEL = {
  id: 'fixture-broadcaster', login: 'fixture_broadcaster', displayName: 'FIXTURE Mock Broadcaster',
};

class FixtureSocket implements SocketLike {
  readyState = 3;
  addEventListener() { /* This harness injects chat internally and never connects EventSub. */ }
  close() {}
}

export interface FixtureChat {
  authorId: string;
  displayName: string;
  text: string;
  sentAt?: number;
  messageId?: string;
  deliveryId?: string;
}
export interface LiveHarness {
  label: typeof LIVE_FIXTURE_LABEL;
  origin: string;
  roomId: string;
  sessionCookie: { name: string; value: string; url: string; httpOnly: boolean; secure: boolean; sameSite: 'Lax' };
  state(): RoomState;
  advance(milliseconds: number): Promise<RoomState>;
  chat(message: FixtureChat): Promise<RoomState>;
  connection(connected: boolean): Promise<RoomState>;
  providerRequests(): number;
  close(): Promise<void>;
}

export async function createLiveHarness(): Promise<LiveHarness> {
  const staticRoot = resolve('apps/web/dist');
  if (!existsSync(resolve(staticRoot, 'index.html'))) throw new Error('The live FIXTURE browser suite requires the built web app. Run npm run build before this suite.');
  let clock = Date.now(), sequence = 0, providerRequests = 0;
  const app = await createApp({
    origin: 'http://127.0.0.1:1', host: '127.0.0.1', port: 0, databasePath: ':memory:', staticRoot, secureCookies: false,
    tokenEncryptionKey: randomBytes(32).toString('base64'), invitedChannels: [LIVE_FIXTURE_CHANNEL.id],
    twitchClientId: '', twitchClientSecret: '', twitchRedirectUri: '', openaiApiKey: '', modelDailyRequestLimit: 0, maxActiveShows: 3,
  }, {
    now: () => clock, background: false, socketFactory: () => new FixtureSocket(),
    fetch: async () => { providerRequests++; throw new Error('Provider networking is disabled in the local live FIXTURE harness'); },
  });
  try {
    // Internal records are synthetic fixtures, never externally verified OAuth/provider evidence.
    app.services.store.putChannel(LIVE_FIXTURE_CHANNEL, {
      accessToken: 'fixture-only-access-token', refreshToken: 'fixture-only-refresh-token', expiresAt: clock + 86400000,
      scopes: ['user:read:chat'], chatHelp: false, validatedAt: clock,
    });
    const sessionId = randomUUID();
    app.services.store.putSession({ id: sessionId, csrf: randomBytes(32).toString('hex'), channelId: LIVE_FIXTURE_CHANNEL.id, expiresAt: clock + 86400000 });
    app.services.twitch.connected.add(LIVE_FIXTURE_CHANNEL.id);
    const initial = app.services.engine.create(LIVE_FIXTURE_CHANNEL, true);
    const origin = await app.listen({ host: '127.0.0.1', port: 0 });
    // createApp's guards and services share this same configuration object.
    app.services.config.origin = new URL(origin).origin;
    const state = () => app.services.engine.get(initial.roomId);
    return {
      label: LIVE_FIXTURE_LABEL, origin, roomId: initial.roomId,
      sessionCookie: { name: 'aragoz_session', value: sessionId, url: origin, httpOnly: true, secure: false, sameSite: 'Lax' },
      state,
      async advance(milliseconds) {
        if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Fixture time must move forward');
        clock += milliseconds; await app.services.engine.tick(); return state();
      },
      async chat(message) {
        const id = String(++sequence);
        await app.services.engine.chat({
          channelId: LIVE_FIXTURE_CHANNEL.id, authorId: message.authorId, displayName: message.displayName, text: message.text,
          sentAt: message.sentAt ?? clock, messageId: message.messageId ?? `fixture-message-${id}`, deliveryId: message.deliveryId ?? `fixture-delivery-${id}`,
        });
        return state();
      },
      async connection(connected) {
        if (connected) app.services.twitch.connected.add(LIVE_FIXTURE_CHANNEL.id);
        else app.services.twitch.connected.delete(LIVE_FIXTURE_CHANNEL.id);
        await app.services.engine.connection(LIVE_FIXTURE_CHANNEL.id, connected, 'FIXTURE mock input disconnected. Restart this discarded ballot.');
        return state();
      },
      providerRequests: () => providerRequests,
      close: () => app.close(),
    };
  } catch (error) { await app.close(); throw error; }
}
