import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;
export const MECHANIC_LIBRARY_VERSION = '1.0.0';
export const ART_KIT_VERSION = 'local-kit-v1';
export const SUPPORTED_ART_KIT_VERSIONS = ['greybox-1', ART_KIT_VERSION] as const;
export const FAMILY_IDS = ['charge', 'steam', 'echo'] as const;
export const PROFILE_IDS = ['charge-deliberate', 'charge-snappy', 'steam-narrow', 'steam-wide', 'echo-short', 'echo-long'] as const;
export type FamilyId = typeof FAMILY_IDS[number];
export type ProfileId = typeof PROFILE_IDS[number];
export type SlotId = 'left' | 'right';
export type Vec2 = { x: number; z: number };
export const MODULE_SOCKET_OFFSETS: Readonly<Record<SlotId, Vec2>> = {
  left: { x: -1.05, z: 0.2 }, right: { x: 1.05, z: 0.2 },
};
/** Match the authored socket under the boss's Y rotation on the XZ plane. */
export function moduleWorldPosition(position: Vec2, facing: Vec2, slot: SlotId): Vec2 {
  const offset = MODULE_SOCKET_OFFSETS[slot];
  return { x: position.x + offset.x * facing.z + offset.z * facing.x,
    z: position.z - offset.x * facing.x + offset.z * facing.z };
}
export interface MechanicDefinition {
  id: ProfileId; family: FamilyId; title: string; power: string; flaw: string; tradeoff: string;
  tellId: string; exposureRuleId: string; breakRuleId: string; socket: string; threat: number;
  parameters: Readonly<Record<string, number>>;
}
export const MECHANICS: Readonly<Record<ProfileId, MechanicDefinition>> = {
  'charge-deliberate': { id: 'charge-deliberate', family: 'charge', title: 'The grand charge',
    power: 'A fast, straight charge', flaw: 'Cannot turn; a stage block jams its axle',
    tradeoff: 'Faster roll · longer warning', tellId: 'striped-lane', exposureRuleId: 'block-collision', breakRuleId: 'strike-exposed-axle', socket: 'axle', threat: 40,
    parameters: { windup: 1.5, speed: 7, duration: 1.7, recovery: 0.8, exposure: 2.8 } },
  'charge-snappy': { id: 'charge-snappy', family: 'charge', title: 'The hurried charge',
    power: 'A quick-start straight charge', flaw: 'Cannot turn; a stage block jams its axle',
    tradeoff: 'Slower roll · shorter warning', tellId: 'striped-lane', exposureRuleId: 'block-collision', breakRuleId: 'strike-exposed-axle', socket: 'axle', threat: 40,
    parameters: { windup: 1, speed: 5, duration: 2, recovery: 0.9, exposure: 2.8 } },
  'steam-narrow': { id: 'steam-narrow', family: 'steam', title: 'The stubborn kettle',
    power: 'Three long, narrow steam bursts', flaw: 'Overheats after three bursts; the valve lifts',
    tradeoff: 'Narrow cone · three longer bursts', tellId: 'striped-cone', exposureRuleId: 'burst-overheat', breakRuleId: 'strike-exposed-valve', socket: 'valve', threat: 35,
    parameters: { windup: 1.2, range: 4.2, angle: 0.65, bursts: 3, burstDuration: 0.65, burstGap: 0.55, recovery: 0.8, exposure: 3 } },
  'steam-wide': { id: 'steam-wide', family: 'steam', title: 'The flustered kettle',
    power: 'Two short, wide steam bursts', flaw: 'Overheats after two bursts; the valve lifts',
    tradeoff: 'Wide cone · two shorter bursts', tellId: 'striped-cone', exposureRuleId: 'burst-overheat', breakRuleId: 'strike-exposed-valve', socket: 'valve', threat: 35,
    parameters: { windup: 1.4, range: 3.5, angle: 1.05, bursts: 2, burstDuration: 0.45, burstGap: 0.65, recovery: 0.9, exposure: 3 } },
  'echo-short': { id: 'echo-short', family: 'echo', title: 'The impatient imitator',
    power: 'Copies your last second of movement', flaw: 'Must follow the marked copy; blocks expose its mirror',
    tradeoff: 'Short recording · shorter warning', tellId: 'dotted-trail', exposureRuleId: 'echo-block-collision', breakRuleId: 'strike-exposed-mirror', socket: 'mirror', threat: 40,
    parameters: { recordDuration: 1, windup: 1.1, playbackSpeed: 1, recovery: 0.9, exposure: 3 } },
  'echo-long': { id: 'echo-long', family: 'echo', title: 'The elaborate imitator',
    power: 'Copies your last two seconds of movement', flaw: 'Must follow the marked copy; blocks expose its mirror',
    tradeoff: 'Long recording · longer warning', tellId: 'dotted-trail', exposureRuleId: 'echo-block-collision', breakRuleId: 'strike-exposed-mirror', socket: 'mirror', threat: 40,
    parameters: { recordDuration: 2, windup: 1.6, playbackSpeed: 1, recovery: 1, exposure: 3 } },
};
export const ARENA = {
  halfWidth: 7, halfDepth: 4.25, heroRadius: 0.32, bossRadius: 0.68,
  heroSpawn: { x: 0, z: 2.8 }, bossSpawn: { x: 0, z: -1.9 },
  blocks: [{ id: 'block-west', x: -3.1, z: -0.2, halfWidth: 0.65, halfDepth: 0.65 },
    { id: 'block-east', x: 3.1, z: 0.9, halfWidth: 0.65, halfDepth: 0.65 }],
} as const;

export const CreditSchema = z.object({ authorId: z.string().max(128).nullable(), displayName: z.string().min(1).max(40), source: z.enum(['viewer', 'house']), hidden: z.boolean() }).strict();
export type Credit = z.infer<typeof CreditSchema>;
export const ModuleSchema = z.object({
  slotId: z.enum(['left', 'right']), mechanicId: z.enum(FAMILY_IDS), profileId: z.enum(PROFILE_IDS),
  tellId: z.string(), exposureRuleId: z.string(), breakRuleId: z.string(),
  approvedParameters: z.record(z.string(), z.number().finite()),
  sourceProposalId: z.string().max(128).nullable(), credit: CreditSchema,
}).strict().superRefine((m, ctx) => {
  const def = MECHANICS[m.profileId];
  if (def.family !== m.mechanicId || def.tellId !== m.tellId || def.exposureRuleId !== m.exposureRuleId || def.breakRuleId !== m.breakRuleId || canonicalJson(def.parameters) !== canonicalJson(m.approvedParameters))
    ctx.addIssue({ code: 'custom', message: 'Module does not match the shipped mechanic profile' });
  if ((m.credit.source === 'house' && (m.sourceProposalId !== null || m.credit.authorId !== null)) || (m.credit.source === 'viewer' && (!m.sourceProposalId || !m.credit.authorId)))
    ctx.addIssue({ code: 'custom', message: 'Credit must refer to its genuine proposal or be labelled House' });
});
export type RecipeModule = z.infer<typeof ModuleSchema>;
export const BossRecipeSchema = z.object({
  id: z.string().min(1), schemaVersion: z.literal(SCHEMA_VERSION), mechanicLibraryVersion: z.literal(MECHANIC_LIBRARY_VERSION),
  artKitVersion: z.enum(SUPPORTED_ART_KIT_VERSIONS), roomId: z.string().min(1), actId: z.string().min(1), seed: z.number().int().min(0).max(0xffffffff),
  approvedName: z.enum(['Teapot Tyrant', 'Mirror Braggart']), bodyId: z.enum(['teapot', 'mirror']), materialVariant: z.enum(['vermilion', 'cobalt']),
  modules: z.tuple([ModuleSchema, ModuleSchema]), threatBudget: z.literal(100), difficultyPreset: z.enum(['rehearsal', 'standard']),
  validatedAt: z.string().datetime(), status: z.literal('committed'), hash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().superRefine((r, ctx) => {
  if (r.modules[0].slotId !== 'left' || r.modules[1].slotId !== 'right' || r.modules[0].mechanicId === r.modules[1].mechanicId)
    ctx.addIssue({ code: 'custom', message: 'An encounter needs two distinct families in left/right slots' });
  if (r.modules.reduce((n, m) => n + MECHANICS[m.profileId].threat, 0) > r.threatBudget)
    ctx.addIssue({ code: 'custom', message: 'Threat budget exceeded' });
  if(r.approvedName!==(r.bodyId==='teapot'?'Teapot Tyrant':'Mirror Braggart')||r.materialVariant!==(r.bodyId==='teapot'?'vermilion':'cobalt'))
    ctx.addIssue({code:'custom',message:'Shell identity does not match the shipped body'});
});
export type BossRecipe = z.infer<typeof BossRecipeSchema>;
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value); if (encoded === undefined) throw new Error('Unsupported canonical JSON value'); return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}
export async function recipeHash(recipe: Omit<BossRecipe, 'hash'> | BossRecipe): Promise<string> {
  const { hash: _ignored, ...body } = recipe as BossRecipe;
  const bytes = new TextEncoder().encode(canonicalJson(body));
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
}
export async function validateRecipe(input: unknown): Promise<BossRecipe> {
  const recipe = BossRecipeSchema.parse(input);
  if (await recipeHash(recipe) !== recipe.hash) throw new Error('Recipe hash mismatch');
  return recipe;
}
export function makeModule(profileId: ProfileId, slotId: SlotId, sourceProposalId: string | null = null, credit: Credit = { authorId: null, displayName: 'House Suggestion', source: 'house', hidden: false }): RecipeModule {
  const p = MECHANICS[profileId];
  return ModuleSchema.parse({ slotId, mechanicId: p.family, profileId, tellId: p.tellId, exposureRuleId: p.exposureRuleId, breakRuleId: p.breakRuleId, approvedParameters: { ...p.parameters }, sourceProposalId, credit });
}
export async function makeRecipe(input: {
  roomId: string; actId: string; seed: number; modules: [RecipeModule, RecipeModule];
  bodyId?: 'teapot' | 'mirror'; difficultyPreset?: 'rehearsal' | 'standard'; id?: string; now?: string;
}): Promise<BossRecipe> {
  const bodyId = input.bodyId ?? 'teapot';
  const payload: Omit<BossRecipe, 'hash'> = {
    id: input.id ?? globalThis.crypto.randomUUID(), schemaVersion: SCHEMA_VERSION, mechanicLibraryVersion: MECHANIC_LIBRARY_VERSION,
    artKitVersion: ART_KIT_VERSION, roomId: input.roomId, actId: input.actId, seed: input.seed,
    approvedName: bodyId === 'teapot' ? 'Teapot Tyrant' : 'Mirror Braggart', bodyId,
    materialVariant: bodyId === 'teapot' ? 'vermilion' : 'cobalt', modules: input.modules,
    threatBudget: 100, difficultyPreset: input.difficultyPreset ?? 'standard', validatedAt: input.now ?? new Date().toISOString(), status: 'committed',
  };
  return BossRecipeSchema.parse({ ...payload, hash: await recipeHash(payload) });
}
export function ruleCaption(module: RecipeModule): string {
  const p = MECHANICS[module.profileId]; return `${p.power} — BUT ${p.flaw.toLowerCase()}.`;
}
export function creditLabel(credit: Credit): string { return credit.source === 'house' ? 'House Suggestion' : credit.hidden ? 'Audience author' : credit.displayName; }
export function sanitizeText(text: string, limit = 280): string {
  return text.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export const CandidateSchema = z.object({
  id: z.string(), profileId: z.enum(PROFILE_IDS), sourceProposalId: z.string().nullable(), credit: CreditSchema,
  adaptation: z.string().max(240).nullable(), approved: z.boolean(),
}).strict();
export type Candidate = z.infer<typeof CandidateSchema>;
export interface Proposal {
  id: string; roomId: string; actId: string; ballotGeneration: number; authorId: string; displayName: string;
  raw: string; receivedAt: number; sentAt: number; messageId: string; rejected: boolean; rejectionReason: string | null;
}
export const PHASES = ['setup', 'proposal-delay', 'proposals', 'compiling', 'review', 'vote-delay', 'voting', 'assembling', 'ready', 'combat', 'paused', 'result', 'showbill', 'interrupted', 'ended'] as const;
export type RoomPhase = typeof PHASES[number];
export const OUTCOMES = ['won', 'lost', 'skipped', 'abandoned'] as const;
export type Outcome = typeof OUTCOMES[number];
export interface AttemptState { id: string; ownerClientId: string | null; status: 'ready' | 'running' | 'paused' | Outcome; lastSequence: number; }
export interface ShowSettings { broadcastDelayMs: number; hideAuthors: boolean; chatHelp: boolean; }
export interface RoomState {
  schemaVersion: typeof SCHEMA_VERSION;
  roomId: string; showId: string; channel: { id: string; login: string; displayName: string };
  actId: string; actIndex: number; ballotSlot: 0 | 1; ballotGeneration: number; roundCode: string | null;
  phase: RoomPhase; phaseBeforePause: RoomPhase | null; opensAt: number | null; deadline: number | null;
  revision: number; connected: boolean; candidates: Candidate[]; selectedModules: RecipeModule[];
  recipe: BossRecipe | null; attempt: AttemptState | null; settings: ShowSettings;
  votes: [number, number, number]; notice: string | null; results: EncounterResult[];
}
export const EncounterEventSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  attemptId: z.string(), sequence: z.number().int().positive(), simTick: z.number().int().min(0), recipeHash: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(['module-activated', 'attack-started', 'attack-ended', 'flaw-exposed', 'module-broken', 'hero-damaged', 'outcome']),
  moduleSlot: z.enum(['left', 'right']).nullable(), value: z.number().finite().min(0).max(100000).nullable(), outcome: z.enum(OUTCOMES).nullable(),
}).strict();
export type EncounterEvent = z.infer<typeof EncounterEventSchema>;
export interface EncounterResult {
  attemptId: string; recipeId: string; recipeHash: string; actIndex: number; outcome: Outcome;
  durationTicks: number; brokenSlots: SlotId[]; exploits: number; finishedAt: string;
}
export const EncounterResultSchema: z.ZodType<EncounterResult> = z.object({
  attemptId:z.string().min(1),recipeId:z.string().min(1),recipeHash:z.string().regex(/^[a-f0-9]{64}$/),actIndex:z.number().int().min(1).max(3),outcome:z.enum(OUTCOMES),
  durationTicks:z.number().int().min(0),brokenSlots:z.array(z.enum(['left','right'])).max(2),exploits:z.number().int().min(0),finishedAt:z.string().datetime(),
}).strict();
export const RoomStateSchema = z.object({
  schemaVersion:z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),roomId:z.string().min(1),showId:z.string().min(1),channel:z.object({id:z.string().min(1),login:z.string().min(1),displayName:z.string().min(1).max(40)}).strict(),
  actId:z.string().min(1),actIndex:z.number().int().min(1).max(3),ballotSlot:z.union([z.literal(0),z.literal(1)]),ballotGeneration:z.number().int().min(0),roundCode:z.string().regex(/^[A-Z0-9]{2,8}$/).nullable(),
  phase:z.enum(PHASES),phaseBeforePause:z.enum(PHASES).nullable(),opensAt:z.number().int().min(0).nullable(),deadline:z.number().int().min(0).nullable(),revision:z.number().int().min(0),connected:z.boolean(),
  candidates:z.array(CandidateSchema).max(3),selectedModules:z.array(ModuleSchema).max(2),recipe:BossRecipeSchema.nullable(),attempt:z.object({id:z.string().min(1),ownerClientId:z.string().min(1).max(100).nullable(),status:z.enum(['ready','running','paused',...OUTCOMES]),lastSequence:z.number().int().min(0)}).strict().nullable(),
  settings:z.object({broadcastDelayMs:z.number().int().min(0).max(30000),hideAuthors:z.boolean(),chatHelp:z.boolean()}).strict(),votes:z.tuple([z.number().int().min(0),z.number().int().min(0),z.number().int().min(0)]),notice:z.string().nullable(),results:z.array(EncounterResultSchema),
}).strict() satisfies z.ZodType<RoomState>;
export const PrivateRoomStateSchema = z.object({room:RoomStateSchema,proposals:z.array(z.object({id:z.string(),roomId:z.string(),actId:z.string(),ballotGeneration:z.number().int().min(0),authorId:z.string(),displayName:z.string().max(40),raw:z.string().max(280),receivedAt:z.number().int().min(0),sentAt:z.number().int().min(0),messageId:z.string(),rejected:z.boolean(),rejectionReason:z.string().nullable()}).strict())}).strict();
export const ShowbillSchema=z.object({room:RoomStateSchema,recipes:BossRecipeSchema.array()}).strict();
export const ShowActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start-proposals') }), z.object({ type: z.literal('close-proposals') }),
  z.object({ type: z.literal('approve-candidates'), candidateIds: z.array(z.string()).length(3) }),
  z.object({ type: z.literal('reject-candidate'), candidateId: z.string() }),
  z.object({ type: z.literal('use-house') }), z.object({ type: z.literal('open-vote') }),
  z.object({ type: z.literal('close-vote') }), z.object({ type: z.literal('restart-ballot') }),
  z.object({ type: z.literal('claim-control'), clientId: z.string().min(1).max(100), takeover: z.boolean() }),
  z.object({ type: z.literal('start-combat'), clientId: z.string().min(1).max(100) }),
  z.object({ type: z.literal('pause') }), z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('retry') }), z.object({ type: z.literal('advance-act') }),
  z.object({ type: z.literal('encore') }), z.object({ type: z.literal('remix'), slotId: z.enum(['left', 'right']) }),
  z.object({ type: z.literal('skip-act') }), z.object({ type: z.literal('end-show') }),
  z.object({ type: z.literal('settings'), settings: z.object({ broadcastDelayMs: z.number().int().min(0).max(30000), hideAuthors: z.boolean(), chatHelp: z.boolean() }).strict() }),
]);
export type ShowAction = z.infer<typeof ShowActionSchema>;
export const ActionRequestSchema = z.object({ expectedRevision: z.number().int().min(0), action: ShowActionSchema }).strict();
export const EventsRequestSchema = z.object({ expectedRevision: z.number().int().min(0), clientId: z.string().min(1).max(100), events: z.array(EncounterEventSchema).min(1).max(128) }).strict();
export interface SessionInfo { authenticated: boolean; csrfToken: string; channel: RoomState['channel'] | null; invited: boolean; hostingConfigured: boolean; modelEnabled: boolean; }
export interface PrivateRoomState { room: RoomState; proposals: Proposal[]; }
export type ServerMessage = { type: 'snapshot'; room: RoomState } | { type: 'error'; message: string };
export const ServerMessageSchema=z.discriminatedUnion('type',[z.object({schemaVersion:z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),type:z.literal('snapshot'),room:RoomStateSchema}).strict(),z.object({schemaVersion:z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),type:z.literal('error'),message:z.string()}).strict()]);

export const AssetManifestSchema = z.object({
  schemaVersion:z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  id: z.string(), revision: z.string(), source: z.string(), rights: z.string(), approvedConcept: z.string().nullable(),
  glbPath: z.string().nullable(), materials: z.array(z.string()), dimensions: z.tuple([z.number(), z.number(), z.number()]),
  sockets: z.array(z.string()), animations: z.array(z.string()), collider: z.string(), triangles: z.number().int().min(0), textureBytes: z.number().int().min(0),
  engineEvidence: z.string().nullable(), acceptance: z.enum(['greybox', 'pending-approval', 'approved', 'fallback']),
}).strict();
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
