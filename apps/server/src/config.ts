import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Config {
  origin: string; port: number; host: string; databasePath: string; secureCookies: boolean;
  twitchClientId: string; twitchClientSecret: string; twitchRedirectUri: string;
  tokenEncryptionKey: string; invitedChannels: string[];
  openaiApiKey: string; modelDailyRequestLimit: number; maxActiveShows: number; staticRoot: string;
}
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): Config {
  const origin = env.PUBLIC_ORIGIN ?? 'http://localhost:3000';
  const limit = Number(env.MODEL_DAILY_REQUEST_LIMIT ?? 0);
  const maxShows = Number(env.MAX_ACTIVE_SHOWS ?? 3);
  return {
    origin: new URL(origin).origin, port: Number(env.PORT ?? 3000), host: env.HOST ?? '127.0.0.1',
    databasePath: env.DATABASE_PATH ?? resolve('data/aragoz.sqlite'), secureCookies: origin.startsWith('https:'),
    twitchClientId: env.TWITCH_CLIENT_ID ?? '', twitchClientSecret: env.TWITCH_CLIENT_SECRET ?? '',
    twitchRedirectUri: env.TWITCH_REDIRECT_URI ?? `${origin}/api/auth/twitch/callback`,
    tokenEncryptionKey: env.CREDENTIAL_ENCRYPTION_KEY ?? env.TOKEN_ENCRYPTION_KEY ?? '',
    invitedChannels: (env.INVITED_BROADCASTER_IDS ?? env.INVITED_TWITCH_CHANNELS ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean),
    openaiApiKey: env.OPENAI_API_KEY ?? '', modelDailyRequestLimit: Number.isSafeInteger(limit) && limit > 0 ? limit : 0,
    maxActiveShows: Number.isSafeInteger(maxShows) ? Math.max(0, Math.min(3, maxShows)) : 3,
    staticRoot: env.WEB_DIST_PATH ?? fileURLToPath(new URL('../../web/dist/', import.meta.url)),
  };
}
export function hostingConfigured(c: Config): boolean {
  return Boolean(c.twitchClientId && c.twitchClientSecret && c.twitchRedirectUri && Buffer.from(c.tokenEncryptionKey, 'base64').length === 32 && c.invitedChannels.length);
}
export function isInvited(c: Config, channel: { id: string; login: string }): boolean {
  return c.invitedChannels.includes(channel.id) || c.invitedChannels.includes(channel.login.toLowerCase());
}
