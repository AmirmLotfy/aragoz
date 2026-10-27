# ARAGOZ — أراجوز

Chat makes the monster. You find the loophole.

ARAGOZ is a browser action game where Twitch viewers propose powers with built-in flaws. The selected contract attaches a physical module; exploiting the flaw opens a counter and breaking the module removes its ability.

**Status:** functioning technical preview: complete three-act House show, rehearsal, three mechanic families, two shells, physical breaks, outcomes, Encore/Remix and recovery. Source7fabb61 passed typecheck/release build,171unit/server tests and one28/28browser run; four final affected typography cases passed separately. Seven original Blender GLBs are admitted. Actual M1/OBS measurements recommend1080p30presentation with unchanged60Hzsimulation; those recordings retain their source limits. On27October, one genuine Twitch account operated by the agent completed OAuth/chat/proposal/vote, a credited accepted win, real token refresh, encrypted backup/restore and authenticated restart. See [real Twitch evidence](ops/TWITCH_LIVE_VALIDATION.md), [performance](ops/PERFORMANCE_REPORT.md) and [remaining work](REMAINING_WORK.md). Genuine host/viewer acceptance and specific remaining provider/isolation cases remain open; the full release is not yet accepted.

**Hackathon preparation:** [submission packet](submission/README.md) includes the Devpost story,3:2promotional cover, five actual screenshots,160-second captioned review video and owner voiceover script. The supplied voice is integrated into the final narrated movie; see [voice integration](submission/VOICE_INTEGRATION.md). The existing Devpost draft now contains the saved story, confirmed form answers, approved cover/gallery and links. New local narrated masters include actual Twitch assembly and charge-break motion, with original narration preserved. The build chapter shows actual GitHub source/commit review of a Codex-built fix, explicitly not Codex app footage. Public judge source access is verified; the [captioned movie is public](https://youtu.be/ej-SDyRD6tE) and saved in the draft. Eligibility/final entry remain pending; see [draft status](submission/DEVPOST_DRAFT_STATUS.md). The entry remains Draft3/5; the owner will complete eligibility manually.

On28October, [a pause/upload revision race](ops/LIVE_PAUSE_QUEUE_FIX.md) was fixed and pushed as1f4231e. Typecheck, release build, the new queue unit check and all3live browser fixture cases passed. This updates the affected frontend evidence; it is not a new full-suite/provider/human acceptance claim.

**No spending:** the owner prohibited payments on26October2026 and explicitly approved public visibility for this repository on28October. The repository is public; anonymous README access was verified. Model/Meshy calls remain off. Use the existing Mac plus the temporary HTTPS tunnel in [the no-cost hosting runbook](ops/NO_COST_HOSTING.md). The paid Render design is archived and unapproved; no automatic billable CI is configured.

## Local setup

Use Node24 LTS and npm. The user superseded the initial fixed10GiB floor on26October2026. Run `node scripts/check-resources.mjs --job install` (or verify/build/browser/blender) for a bounded next-job estimate and working reserve. Split work when resources are tight; preserve unrelated projects and report any actual ENOSPC action precisely.

Use the pinned Node24.19.0 version in .nvmrc. Run `npm ci --ignore-scripts` with the checked-in lockfile, then `npm run typecheck`, `npm test`, `npm run build:release`, and `npm start`, one at a time. Production serves frontend and API together at http://localhost:3000. The Docker base image is pinned to a verified registry digest; production-only dependencies also passed a separate local packaging/startup check.

The complete solo House show at `/house-show` and the one-encounter rehearsal at `/rehearse` require no environment file, Twitch account, model key or audience. In House show, choose two different attachments per act, play three acts, then keep the cumulative showbill. Encore reuses the recipe; Remix replaces one attachment. Saves in the same browser and web origin retain the show, and refresh or explicit window takeover restarts unfinished combat safely. Download the showbill before replacing a local save. Storage failure is visibly labelled and permits memory-only play.

Public rehearsal requires no environment file, Twitch account, model key or audience. Controls: WASD/arrows move, mouse/J strike, Space dodge, Escape pause. Remap controls and adjust audio/comfort/quality from Settings. The three House presets exercise charge/steam, charge/echo and steam/echo. Every simulated/preset contribution is labelled House.

For frontend development, run `npm run dev` and `npm run dev:web` in separate terminals. Set PUBLIC_ORIGIN=http://localhost:5173 and TWITCH_REDIRECT_URI=http://localhost:5173/api/auth/twitch/callback in your ignored.env so Vite's API/WebSocket proxy and origin checks agree. The single-origin production path uses port3000 instead.

## Invited Twitch hosting

Copy.env.example to.env locally and configure the registered Twitch app, its exact callback, an encryption key and invited broadcaster IDs. The no-cost launcher creates a private encryption key automatically in data/public-preview/credentials.key. Preserve it securely with backups. Never paste real keys into chat or commit the.env.

The browser uses OAuth; it never asks for a Twitch password. Read scope is user:read:chat. Optional help replies request user:write:chat only when selected. Shared Chat is outside the pilot. Setup confirms the actual stage/audio and an incoming `!aragoz CODE` test before launch.

Open private backstage separately and capture only the play window in OBS. Backstage reviews proposals/adaptations and advances cues without a second3D simulation. Commands display the current round code: `!make ABC123 charges but cannot turn`, then `!vote ABC123 A` (or B/C). Codes change per ballot/restart. One effective suggestion/vote per viewer; edits replace prior valid entries. House fallback is always explicitly credited.

OpenAI calls stay off until OPENAI_API_KEY and a nonzero approved MODEL_DAILY_REQUEST_LIMIT are configured. The requested model is gpt-6-luna. This is an operator limit across moderation/compile requests, not a promise of a particular bill. The current owner instruction prohibits all spending; do not enable model calls, paid assets or paid hosting.

## Verification and operations

- `npm run typecheck` / `npm test` / `npm run build`: source, state and bundle checks.
- Start the built server, then `npm run test:browser`: actual rehearsal and authenticated HTTP/WebSocket/UI checks, one worker. The local Google Chrome executable is reused when present; set PLAYWRIGHT_CHROMIUM_PATH elsewhere. Live browser tests use an explicitly labelled fixture harness with no production authentication bypass and no provider networking.
- `npm run check:assets`: provenance/payload audit. `node scripts/check-assets.mjs --require-final` also requires every final asset's admission evidence.
- `npm run test:assets`: small dependency-free GLB-format and local candidate-serving fixture tests using Node24. These establish static/tooling behavior, not gameplay or engine acceptance.
- `npm run build:release`: requires every final runtime asset's recorded admission before running the normal checked build. The normal build can still produce an honestly labelled development preview.
- `npm run test:container`: actual Linux image startup, static compression, private API denial, durable volume replacement, online backup and isolated restoration. Requires a Docker context/image; defaults are documented in tests/container/smoke.mjs.
- `npm run preview:public`: zero-cost public HTTPS preview on this computer; see ops/NO_COST_HOSTING.md.
- `npm run check:resources`: the bounded local next-job estimate.
- `node --env-file-if-exists=.env apps/server/src/backup.ts /absolute/new-backup.sqlite`: online backup of this command's configured database to a fresh path. For the public launcher, explicitly select its database using [the public backup instructions](ops/NO_COST_HOSTING.md#backups-and-evidence). Follow apps/server/README.md for safe restoration.

Short M1 Metal browser samples and a keyboard-driven counter/break/final-strike/Encore playthrough are in evidence/browser. They are labelled local/AI-led and establish no hosted/OBS/human acceptance. A paused stage renders at15fps to reduce idle GPU work; active combat retains fixed60Hz simulation and the selected60/30fps presentation setting.

Public rendering loads only locally admitted runtime assets. Concepts are not included in the deployment image. The accepted brief, plan, art bible, content schema, rights log, test plan and build journal live at the repository root. The public technical preview uses an account-free tunnel with local durable SQLite. DEPLOYMENT_REVIEW.md records current ownership/no-spend rules; ops/archive/render.paid-unapproved.yaml preserves only the historical paid design. Compressed static assets negotiate Brotli/gzip with byte-identical fallback.
