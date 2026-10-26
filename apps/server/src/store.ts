import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { RoomStateSchema } from '../../../packages/contracts/src/index.ts';
import type { BossRecipe, EncounterEvent, EncounterResult, Proposal, RoomState } from '../../../packages/contracts/src/index.ts';

export interface Channel { id: string; login: string; displayName: string; }
export interface Credential { accessToken: string; refreshToken: string; expiresAt: number; scopes: string[]; chatHelp: boolean; validatedAt: number; }
export interface Session { id: string; csrf: string; channelId: string | null; expiresAt: number; }
export interface Vote { authorId: string; choice: number; sentAt: number; messageId: string; }
export class Store {
  db: DatabaseSync;
  encryptionKey: string;
  constructor(path: string, encryptionKey: string) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path); this.encryptionKey = encryptionKey;
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.migrate();
  }
  migrate() {
    const version = (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (version > 1) throw new Error('Database schema is newer than this server');
    if (version === 0) this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE channels(id TEXT PRIMARY KEY, data TEXT NOT NULL, credential TEXT);
      CREATE TABLE sessions(id TEXT PRIMARY KEY, csrf TEXT NOT NULL, channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE oauth_states(state TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, chat_help INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE shows(id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, state TEXT NOT NULL);
      CREATE TABLE proposals(id TEXT PRIMARY KEY, show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE, act_id TEXT NOT NULL, generation INTEGER NOT NULL, author_id TEXT NOT NULL, sent_at INTEGER NOT NULL, message_id TEXT NOT NULL, created_at INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(show_id,act_id,generation,author_id));
      CREATE TABLE votes(show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE, act_id TEXT NOT NULL, generation INTEGER NOT NULL, author_id TEXT NOT NULL, choice INTEGER NOT NULL, sent_at INTEGER NOT NULL, message_id TEXT NOT NULL, PRIMARY KEY(show_id,act_id,generation,author_id));
      CREATE TABLE recipes(id TEXT PRIMARY KEY, show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE encounter_events(show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE, attempt_id TEXT NOT NULL, sequence INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(attempt_id,sequence));
      CREATE TABLE results(attempt_id TEXT PRIMARY KEY, show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE deliveries(message_id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
      CREATE TABLE model_usage(day TEXT PRIMARY KEY, count INTEGER NOT NULL);
      PRAGMA user_version=1; COMMIT;`);
  }
  transaction<T>(fn: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const out = fn(); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  seal(input: Credential): string {
    const key = Buffer.from(this.encryptionKey, 'base64'); if (key.length !== 32) throw new Error('Token encryption is unavailable');
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    return [iv.toString('base64'), Buffer.concat([cipher.update(JSON.stringify(input), 'utf8'), cipher.final()]).toString('base64'), cipher.getAuthTag().toString('base64')].join('.');
  }
  unseal(input: string): Credential {
    const [iv, data, tag] = input.split('.'); const decipher = createDecipheriv('aes-256-gcm', Buffer.from(this.encryptionKey, 'base64'), Buffer.from(iv!, 'base64'));
    decipher.setAuthTag(Buffer.from(tag!, 'base64')); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data!, 'base64')), decipher.final()]).toString('utf8')) as Credential;
  }
  putChannel(channel: Channel, credential?: Credential) {
    this.db.prepare('INSERT INTO channels(id,data,credential) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,credential=COALESCE(excluded.credential,channels.credential)').run(channel.id, JSON.stringify(channel), credential ? this.seal(credential) : null);
  }
  channel(id: string): Channel | null { const row = this.db.prepare('SELECT data FROM channels WHERE id=?').get(id) as { data: string } | undefined; return row ? JSON.parse(row.data) : null; }
  credential(id: string): Credential | null { const row = this.db.prepare('SELECT credential FROM channels WHERE id=?').get(id) as { credential: string | null } | undefined; return row?.credential ? this.unseal(row.credential) : null; }
  credentials(): { channel: Channel; credential: Credential }[] { return (this.db.prepare('SELECT data,credential FROM channels WHERE credential IS NOT NULL').all() as { data: string; credential: string }[]).map(r => ({ channel: JSON.parse(r.data), credential: this.unseal(r.credential) })); }
  clearCredential(id: string) { this.db.prepare('UPDATE channels SET credential=NULL WHERE id=?').run(id); this.db.prepare('UPDATE sessions SET channel_id=NULL WHERE channel_id=?').run(id); }
  session(id: string, now: number): Session | null { const r = this.db.prepare('SELECT id,csrf,channel_id,expires_at FROM sessions WHERE id=? AND expires_at>?').get(id, now) as { id: string; csrf: string; channel_id: string | null; expires_at: number } | undefined; return r ? { id: r.id, csrf: r.csrf, channelId: r.channel_id, expiresAt: r.expires_at } : null; }
  putSession(s: Session) { this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET csrf=excluded.csrf,channel_id=excluded.channel_id,expires_at=excluded.expires_at').run(s.id, s.csrf, s.channelId, s.expiresAt); }
  oauth(state: string, sessionId: string, chatHelp: boolean, expiresAt: number) { this.db.prepare('INSERT INTO oauth_states VALUES(?,?,?,?)').run(state, sessionId, Number(chatHelp), expiresAt); }
  consumeOAuth(state: string, sessionId: string, now: number): boolean | null { return this.transaction(() => { const r = this.db.prepare('SELECT chat_help,expires_at FROM oauth_states WHERE state=? AND session_id=?').get(state, sessionId) as { chat_help: number; expires_at: number } | undefined; this.db.prepare('DELETE FROM oauth_states WHERE state=?').run(state); return r && r.expires_at > now ? Boolean(r.chat_help) : null; }); }
  shows(channelId?: string): RoomState[] { const rows = channelId ? this.db.prepare('SELECT state FROM shows WHERE channel_id=?').all(channelId) : this.db.prepare('SELECT state FROM shows').all(); return (rows as { state: string }[]).map(r => RoomStateSchema.parse(JSON.parse(r.state))); }
  room(id: string): RoomState | null { const r = this.db.prepare('SELECT state FROM shows WHERE id=?').get(id) as { state: string } | undefined; return r ? RoomStateSchema.parse(JSON.parse(r.state)) : null; }
  save(room: RoomState) { this.db.prepare('INSERT INTO shows VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(room.roomId, room.channel.id, JSON.stringify(RoomStateSchema.parse(room))); }
  deleteShow(id: string) { this.db.prepare('DELETE FROM shows WHERE id=?').run(id); }
  proposals(room: RoomState): Proposal[] { return (this.db.prepare('SELECT data FROM proposals WHERE show_id=? AND act_id=? AND generation=?').all(room.roomId, room.actId, room.ballotGeneration) as { data: string }[]).map(r => JSON.parse(r.data)); }
  putProposal(p: Proposal) { this.db.prepare('INSERT INTO proposals VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(show_id,act_id,generation,author_id) DO UPDATE SET id=excluded.id,sent_at=excluded.sent_at,message_id=excluded.message_id,created_at=excluded.created_at,data=excluded.data WHERE excluded.sent_at>proposals.sent_at OR (excluded.sent_at=proposals.sent_at AND excluded.message_id>proposals.message_id)').run(p.id, p.roomId, p.actId, p.ballotGeneration, p.authorId, p.sentAt, p.messageId, p.receivedAt, JSON.stringify(p)); }
  rejectProposal(id: string, reason: string) {
    const row = this.db.prepare('SELECT data FROM proposals WHERE id=?').get(id) as { data: string } | undefined;
    if (!row) return;
    const proposal = JSON.parse(row.data) as Proposal;
    proposal.rejected = true; proposal.rejectionReason = reason;
    // Review changes belong to the stored message; timestamp ordering applies only to chat edits.
    this.db.prepare('UPDATE proposals SET data=? WHERE id=?').run(JSON.stringify(proposal), id);
  }
  votes(r: RoomState): Vote[] { return this.db.prepare('SELECT author_id AS authorId,choice,sent_at AS sentAt,message_id AS messageId FROM votes WHERE show_id=? AND act_id=? AND generation=?').all(r.roomId, r.actId, r.ballotGeneration) as unknown as Vote[]; }
  putVote(r: RoomState, v: Vote) { this.db.prepare('INSERT INTO votes VALUES(?,?,?,?,?,?,?) ON CONFLICT(show_id,act_id,generation,author_id) DO UPDATE SET choice=excluded.choice,sent_at=excluded.sent_at,message_id=excluded.message_id WHERE excluded.sent_at>votes.sent_at OR (excluded.sent_at=votes.sent_at AND excluded.message_id>votes.message_id)').run(r.roomId, r.actId, r.ballotGeneration, v.authorId, v.choice, v.sentAt, v.messageId); }
  putRecipe(r: BossRecipe) { this.db.prepare('INSERT INTO recipes VALUES(?,?,?)').run(r.id, r.roomId, JSON.stringify(r)); }
  recipe(id: string): BossRecipe | null { const r = this.db.prepare('SELECT data FROM recipes WHERE id=?').get(id) as { data: string } | undefined; return r ? JSON.parse(r.data) : null; }
  recipes(id: string): BossRecipe[] { return (this.db.prepare('SELECT data FROM recipes WHERE show_id=?').all(id) as { data: string }[]).map(r => JSON.parse(r.data)); }
  putEvent(showId: string, e: EncounterEvent) { this.db.prepare('INSERT INTO encounter_events VALUES(?,?,?,?)').run(showId, e.attemptId, e.sequence, JSON.stringify(e)); }
  event(attemptId: string, sequence: number): EncounterEvent | null { const r = this.db.prepare('SELECT data FROM encounter_events WHERE attempt_id=? AND sequence=?').get(attemptId, sequence) as { data: string } | undefined; return r ? JSON.parse(r.data) : null; }
  events(attemptId: string): EncounterEvent[] { return (this.db.prepare('SELECT data FROM encounter_events WHERE attempt_id=? ORDER BY sequence').all(attemptId) as { data: string }[]).map(r => JSON.parse(r.data)); }
  putResult(showId: string, result: EncounterResult) { this.db.prepare('INSERT INTO results VALUES(?,?,?)').run(result.attemptId, showId, JSON.stringify(result)); }
  dedupe(messageId: string, now: number): boolean { return this.db.prepare('INSERT OR IGNORE INTO deliveries VALUES(?,?)').run(messageId, now).changes === 1; }
  modelRequest(now: number, limit: number): boolean { const day = new Date(now).toISOString().slice(0,10); return this.transaction(() => { const row = this.db.prepare('SELECT count FROM model_usage WHERE day=?').get(day) as { count: number } | undefined; if ((row?.count ?? 0) >= limit) return false; this.db.prepare('INSERT INTO model_usage VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1').run(day); return true; }); }
  prune(now: number) {
    // Accepted recipes already retain source identity, attribution and the normalized rule.
    // Selecting a proposal must not retain its original chat text indefinitely.
    this.db.prepare('DELETE FROM proposals WHERE created_at<=?').run(now - 86400000);
    this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now); this.db.prepare('DELETE FROM oauth_states WHERE expires_at<?').run(now);
    this.db.prepare('DELETE FROM deliveries WHERE received_at<?').run(now - 7 * 86400000);
  }
  async backup(path: string) { await backup(this.db, path); }
  close() { this.db.close(); }
}
