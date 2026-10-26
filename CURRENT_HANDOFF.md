# ARAGOZ current handoff — full implementation / public technical preview

Updated26October2026. Full first-release scope is preserved. Root integration chat owns all source. Technical preview is an intermediate gate: genuine Twitch, OBS and human acceptance are still required before release-ready claims.

## Authority and checkout

- cwd /Users/frameless/Desktop/Aragoz. Git main. Baseline source commit e256d088443b62873e3e851ef1566cf2812e4974 is pushed to the verified private repository. The bounded720p layout correction and its current test/evidence/status files are being checkpointed in this turn; final on-disk handoff will record that tip.
- Owner explicitly approved private https://github.com/AmirmLotfy/aragoz; repository exists and is verified private. All spending is prohibited. No paid hosting/model/Meshy usage or automatic billable CI is authorized. The old paid Render design is archived in ops/archive/render.paid-unapproved.yaml and must not be applied.
- Root owns every file. Backend/frontend specialist packets are collected. A later specialist container-helper turn hit capacity; root implemented and verified that helper. No active delegated assignment/heavy check remains.
- ARAGOZ_Full_Game_Brief.md is preserved unchanged. evidence/source-manifest.json is the non-ignored path/size/SHA256 inventory, excluding itself. Git ignores secrets/data/dependencies, Python cache and Blender backup copies; primary Blender sources remain included. Never log/copy secret values or user session data.
- No blanket10GiB storage floor. Use the bounded next-job estimate, one heavy job at a time, preserve unrelated projects. Task-only Colima cleanup is documented; unrelated egytric profile was preserved.

## Complete implemented scope

Vite/TypeScript/Babylon/React; pure fixed60Hz combat; strict versioned contracts and immutable hash; all3families/6profiles/3pairs;2shells; five stitches/movement/strike/dodge; readable flaws/counters; physical module break and immediate ability cancellation; final strike; tutorial/rehearsal; three acts/two ballots per act; proposals/private moderation/review/voting/assembly; actual-author attribution; distinct outcomes; Encore and one-slot Remix; invitations/OAuth/EventSub; encrypted SQLite/migrations/backup; authority/revisions/takeover/restart/offline events; private backstage bitmap; remapping/keyboard menus/audio/comfort/webcam controls; original art/audio and licensed fonts/notices; reproducible container and free hosting launcher.

Supported explicit English proposals retain their real source lineage through the labelled deterministic catalogue compiler when model calls are off. Unknown/unsafe text receives labelled House content. Model interpretation is disabled under the current no-spend instruction; no paid call is required for rehearsal or supported catalogue authoring.

Recent closures: all raw proposals expire after24hours (hourly/startup prune); accepted sanitized contracts retain author/source identity. OAuth renewal invalidates interrupted ballots. Per-channel API quotas use only verified stored sessions; forged cookies/forwarded IPs do not bypass limits; static files do not consume API quota. Menus retain native keyboard behavior, game keys require a focused active canvas, remaps reject conflicts and update instructions. Final showbill now presents every historical contract/author/result with exact recipeID+hash matching and hidden-author settings.

Stage recovery: one8second asset batch deadline; approved fallback on unavailable/stalled assets; late containers disposed without geometry swap; permanent stopped/paused cleanup on init/render/context failure; visible reload screen above opening cards; preset changes unmount old recipes. Static assets now negotiate precomputed Brotli/gzip, preserving decoded bytes and Vary: Accept-Encoding.

## Actual current evidence

- Node24.19.0, TypeScript7; pinned lockfile. Current typecheck passed.
-112unit/server tests across7files passed (36combat/contracts,65server,11web helper/render). evidence/release-completion-tests.log. No real providers in fixture tests.
-62asset-format/local-serving fixtures passed in the actual Linux build stage; earlier TAP retained. Static evidence is distinct from engine validation.
-12actual Playwright tests passed on current source,1worker,1.9minutes. evidence/release-completion-browser.log. Includes fixture-only HTTP/WS/live UI plus stalled manifest, late GLB, error-screen clickability and context-loss recovery. Browser access was initially disabled, then rechecked and became available; old unrun status is historical.
- Current release build passed;7admitted original Blender GLBs.44,796whole-kit triangles,1,345,615gzip GLB bytes; authored256px tiles/sockets/clips. Prior actual pair scenes33–35k/59–62drawcalls, short active peak40,951/70. New actual public stage:5approved assets,35,387triangles,61drawcalls; evidence/browser/public-release-stage.png.
-18public files precompressed:9,418,149raw bytes →3,497,359Brotli /3,987,764gzip bytes. Native negotiation regression and actual packaged/public GLB decode checks pass. An earlier transient first public load used approved fallbacks; final reload admitted all5encounter assets.
- Actual Linux ARM64 Docker image built with pinned Node digest, clean install/full checks and non-root node runtime.12smoke checks pass: public endpoints/private401, packaged compressed GLB, writable volume, replacement persistence, online backup and isolated restore. evidence/linux-container-build.json and linux-container-smoke.json contain actual metadata/source hashes. Docker client lacked buildx, so classic builder was used. Task-owned VM/container data were removed after checks; no image remains locally. Do not claim Linuxamd64/Render deployment from this ARM64 check.
- Actual HTTPS rehearsal through account-free tunnel; native browser Space start/movement/Escape pause, HTTP readiness and supervisor reload verified. This is actual self-hosted public/AI-led evidence, not genuine Twitch or human acceptance. evidence/public-preview.json, public-preview-reload.json and browser/public-preview-input.json.
- Earlier AI-led keyboard test demonstrated charge counter→physical break→six seconds without charge→steam break→final strike win→Encore reset. Short M1 Metal samples remain8.5seconds each and do not replace OBS measurement.
- No real game Twitch OAuth/chat, model calls, actual OBS recordings, genuine viewer sessions, competition submission or outreach occurred. User personally created Twitch account @amirmolotfy and browser observed it signed in.

## Current processes and private local state

- Local built preview: PID84702, exec session44035, node apps/server/src/index.ts, cwd exact workspace, loopback127.0.0.1:3000, DB.runtime/preview.sqlite. Healthy; models/hosting config off.
- Public launcher: PID84937, exec session51248. Tunnel PID84938. Current server PID92463 after tested SIGHUP reload. All are exact-workspace children owned by root. .runtime/public-preview.json is authoritative if reloaded later.
- Current public origin https://rid-structures-pursuant-owners.trycloudflare.com; rehearsal /rehearse; Twitch callback /api/auth/twitch/callback. Keep the Mac and launcher running. The previous reproduce-instruction-valley-caught hostname is retired and appears only in historical evidence.
- Durable public data: data/public-preview/aragoz.sqlite. Private default encryption key data/public-preview/credentials.key, mode0600. Its value has never been printed or committed. Preserve it securely with backups. No Twitch app credentials have been configured. Public launcher forces OPENAI_API_KEY empty and MODEL_DAILY_REQUEST_LIMIT=0.
- SIGHUP to the exact supervisorPID safely restarts only its game server and rereads ignored.env while preserving hostname/key/tunnel. Use between shows. Stopping the whole tunnel creates a new hostname next launch. Do not change encryption key during reload.
- Official cloudflared2026.10.3 is installed in.runtime/bin; official release SHA256 verified. No account/payment required.
- OBS33.0.0 official Apple build installed at.runtime/OBS.app; SHA256 and Apple signature verified. Screen Recording is now verified enabled after the owner approved it. Native control briefly disconnected, then reconnected through a cua_repl reset. OBS is idle with no capture source and Mic/Aux mute visibly checked. Auto-Configuration Wizard was set through native keyboard selection to recording-only, then applied estimated Apple H.264 hardware/1920x1080 output/60fps settings. No capture has started. Coordinates in this Qt app returned noWindowsAvailable; prefer AX controls/native keyboard and verify every state transition. The OS later showed camera/microphone Access Granted and Input Monitoring on; root did not request/grant those. Never capture microphone/camera/private desktop; verify mute/disabled inputs before any recording. Existing OBS configuration was absent before this task; any newly created config is task setup.
- Browser tabs: original local rehearsal; Twitch user tab2; developer fresh-login tab3; current public rehearsal tab4 marked deliverable. User keeps passwords/verification/account terms. Developer login password is not available to the agent; no saved autofill appeared. Do not read/expose credentials, automate CAPTCHAs or accept new developer terms without the required user action/confirmation.

## Smallest next work

1. Complete the narrow720p presentation checkpoint, then finish the active OBS setup: isolated game-only browser window/source and output path, no microphone/camera/private desktop.
2. Owner finishes fresh Twitch developer login in the prepared tab. Prepare app registration with the actual current callback; hand over new-credential/terms/verification steps as required. Put client ID/secret directly into ignored local config, invite amirmolotfy, SIGHUP supervisor, then complete genuine OAuth/chat challenge and provider lifecycle/isolation checks. Never call AI-authored Twitch messages genuine viewers.
3. OBS Screen Recording is verified enabled. Finish configuring the task profile/scene to capture only a dedicated ARAGOZ browser window, no backstage/other desktop content. Record actual30minute1080p and720p sessions and frame/encoder/device evidence. No result exists yet; do not substitute short headless measurements.
4. After technical preview/provider checks:3first-time genuine hosts with≥3genuine viewers/session, actual counter and comprehension denominators. ops/acceptance contains blank protocols, zero invented participants. No authorization to contact people or publish recordings has been given.

Keep full first-release scope and accurate evidence boundaries. These owner/provider/human steps remain real work; do not mark the entire release ready from a passing local suite.

## Current presentation correction

The actual720p public screenshot exposed vertical cropping. Desktop stage width is now bounded by available viewport height. All12browser tests pass, including real canvas bounds inside1280x720. Actual public DOM measured canvas x221.34/y191.69/837.33×463.99, bottom655.68 within720; evidence/browser/stage-fit-720p.json and public-release-stage-720p.png. Linux container proof predates this CSS-only framing change; server/contracts/dependencies are unchanged. Current typecheck/build/browser validate the framing change.
