# Deployment decision — no paid services

Updated 27 October 2026. On 26 October the owner approved private [AmirmLotfy/aragoz](https://github.com/AmirmLotfy/aragoz) publication and prohibited all spending. The approved route uses the existing Mac, local durable SQLite and an account-free Cloudflare Quick Tunnel. Follow [the no-cost runbook](ops/NO_COST_HOSTING.md).

The public `/house-show` offers a complete account-free three-act show; `/rehearse` offers one-encounter practice. Actual AI-led HTTPS House gameplay completed three wins, six physical module breaks and a cumulative showbill. [Gameplay receipt](evidence/browser/autonomous-house/receipt.json). House authorship is explicit; no audience/provider activity is inferred. House saves belong to the browser and origin, independently of server-owned Twitch shows. Download the showbill before replacing a save or changing tunnel origin.

## Latest genuine account status

ARAGOZ Theatre is registered and connected to @amirmolotfy with exactly user:read:chat at `https://klein-wake-circle-favor.trycloudflare.com`. A real Twitch operator proposal/vote led to an actual accepted browser win with correct author credit. Real refresh and matching-key token/result backup/restart recovery also passed. [Current provider report](ops/TWITCH_LIVE_VALIDATION.md). Credentials remain private, models off and spending0; human sessions remain0.

## Current hosted operations

The old paper-principles Quick Tunnel actually expired. The earlier packet used `https://hunter-pin-talk-transactions.trycloudflare.com`, verified over real HTTPS/WSS before/after a same-origin backend reload. Existing local fallback/data/key are preserved. Two launcher-expiry process tests pass;19public checks before/19after reload and7actual anonymous backup/restore checks pass. [Steps6–10report](ops/STEPS_6_10_REPORT.md). These contain0channels/tokens/shows; genuine-account and human acceptance remain separate. Current supervisor uses project-local Node24and its reload was verified.

## Runtime configuration and readiness

The server binds loopback by default. Forwarded IP identity is untrusted unless the operator explicitly sets the nonsecret `TRUST_LOOPBACK_PROXY=true` for the trusted loopback tunnel. That option trusts only `127.0.0.1`/`::1` through Fastify's IP allowlist. Authenticated API quotas use verified channel identity; anonymous quotas use the resolved client IP. Do not enable blanket proxy trust or expose the origin directly with that assumption.

`GET /api/readiness` checks SQLite plus the built frontend index and referenced entry assets. Missing frontend assets return 503 with `ready:false`/`frontendReady:false`; `hostingConfigured` separately describes Twitch host configuration and `modelEnabled` describes compiler availability. Thus an account-free playable frontend can be ready while Twitch hosting is unconfigured. The launcher checks the build before spawning a tunnel and requests the real House frontend before reporting readiness. Model calls remain forced off by that launcher.

A whole-launcher restart changes the public hostname and browser save origin. An exact supervisor SIGHUP rereads ignored private settings and restarts only the game server while preserving the tunnel URL and encryption key; do this between shows because restart recovery invalidates unfinished ballots and abandons active combat safely. Process ownership and the actual current URL are recorded privately in `.runtime/public-preview.json`; verify that state before operating processes.

For backup, explicitly select the public preview database using the runbook. An online backup does not contain its matching encryption key. Preserve that key securely and restore only into a separate verification directory first. [Public backup integrity recheck](evidence/public-preview-backup-recheck.json) establishes the recorded database's integrity/schema, not recovery of genuine Twitch tokens.

## Current local and historical deployment evidence

The current A01–A04 sources passed typecheck, release build and **171 unit tests across 14 files**. [Unit log](evidence/steps-1-4-unit.txt). The final complete browser suite passes 28/28; scoped readability results are recorded in [TEST_PLAN.md](TEST_PLAN.md); fixture-live runs do not establish real hosted account behavior.

A measured synthetic scenario processed 1,887 messages over three local channels, retaining 128 proposals/channel, sampling 12 unique authors/channel and retaining 201 effective votes/channel with zero failures. [Synthetic receipt](evidence/synthetic-audience-load-20261027.json). Compiler deadline/refusal tests use local mocks, with no model calls.

The earlier Linux ARM64 image/non-root runtime passed its local build and 12 smoke checks for startup, compressed static serving, private-route denial, persistent volume replacement, online backup and isolated restore. [Build receipt](evidence/linux-container-build.json), [smoke receipt](evidence/linux-container-smoke.json). The task-owned Colima VM/image were removed after evidence collection; unrelated projects were preserved. These historical results do not certify newer source, Linux amd64, paid Render or genuine hosted credentials.

Completed 30-minute M1 OBS measurements recommend Standard quality with 1080p/30 fps output and the game's 30 fps presentation fallback, retaining 60 Hz simulation. Source `02f6b75` averaged 29.993 presented fps; the earlier 720p/60 target averaged 56.50 fps. [Performance report](ops/PERFORMANCE_REPORT.md). These source-bound captures predate the current House/audio/readability changes. No new OBS session occurred in this documentation packet.

The historical paid design remains archived at `ops/archive/render.paid-unapproved.yaml`; its old approximately $7.25/month quote is historical and unapproved. The recorded 26 October infrastructure review found Render Free unsuitable for durable local SQLite because its filesystem is ephemeral and disks require paid compute. Historical official references: [Render free-service limits](https://render.com/docs/free), [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/). No pricing or provider policy was freshly checked by this source-only reconciliation.

## Blockers and constraints — kept at the very end

1. The earlier missing2FA registration rejection is retained historically; the owner completed verification and the free app/OAuth/chat connection now works. Specific provider handover/revocation/gap scenarios remain unverified; see the current provider report.
2. Real read-only OAuth/chat/operator causal credit and matching-key token/result restore now have evidence. Specific EventSub handover/revocation/gap and genuine multichannel/control cases remain. Human acceptance is still0sessions; evidence categories stay separate.
3. All spending remains prohibited: no paid provisioning, model/Meshy usage or automatic billable CI. Keep secrets in ignored private settings, outside chat, Git, screenshots and transfers. Publication approval does not authorize spending.
4. The Mac, launcher and network must remain running. The temporary tunnel has actually returned 1033/reconnected and had a browser load timeout; a later HTTP 200 is a point check, not uptime acceptance. Preserve the local fallback. This is a technical preview, not permanent managed hosting or full-release acceptance.
