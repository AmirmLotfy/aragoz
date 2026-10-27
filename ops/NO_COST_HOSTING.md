# Zero-cost technical preview

26 October 2026: the owner approved a private GitHub repository and prohibited all spending. The paid Render design is not authorized. Model requests and Meshy spending stay off. Publishing source does not authorize billable GitHub Actions runs; no automatic workflow is configured.

Run the full backend on the existing Mac, preserve SQLite and its encryption key locally, and expose only its loopback HTTP port through an account-free Cloudflare Quick Tunnel. This supports the game's WebSockets and genuine Twitch OAuth/chat when operator credentials are configured. It is a temporary technical preview: the Mac and process must stay running, the hostname changes on a new tunnel, and there is no uptime guarantee. It does not establish human or OBS acceptance.

Render Free cannot replace the persistent SQLite service: its local filesystem is erased on redeploy/restart/spin-down and persistent disks require paid compute. Do not silently deploy this release there with data loss.

## Start

Use Node 24 from .nvmrc. Install the official cloudflared release into `.runtime/bin/cloudflared` (or point `ARAGOZ_CLOUDFLARED_PATH` to an existing official installation). Pin and verify its release SHA256. Never download an unknown tunnel binary.

```sh
npm run build:release
npm run preview:public
```

The launcher prints the real HTTPS rehearsal URL and Twitch callback after its own server is healthy. It leaves the normal local rehearsal on port 3000 available and runs the public server on loopback port 3010. `ARAGOZ_PREVIEW_PORT` can select another unoccupied port. Ctrl-C closes only the two children it created. A stopped tunnel makes that URL unavailable; restarting does not reuse it.

Public-show data lives in `data/public-preview/aragoz.sqlite`; its default encryption key is `data/public-preview/credentials.key`, created mode 0600. Both are ignored by Git and must remain private. Preserve the key securely with backups. `.runtime/public-preview.json` records only process ownership, URL and data path. `.runtime/public-tunnel.log` contains tunnel diagnostics. Do not expose these directories through a static server.

## Genuine Twitch setup

The broadcaster needs a free Twitch account and a registered developer application. Account details, new passwords, verification codes and signup terms stay with the owner. Do not invent an account or a chat participant.

Set `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` and `INVITED_BROADCASTER_IDS` directly in the local ignored `.env` or the launch environment. Keep secrets out of chat, screenshots and Git. The launcher sets `PUBLIC_ORIGIN` and `TWITCH_REDIRECT_URI` from the actual tunnel URL; register that exact callback in Twitch before consent. A new tunnel URL requires updating the registered callback. The launcher forces model calls off even if an older environment enabled them.

Then open `/setup` at the public HTTPS origin, complete genuine consent and the chat challenge, and execute the real-provider checks in RELEASE_CHECKLIST.md. Backstage uses host-authenticated cookies; do not share session credentials or capture private proposal text. Public rehearsal requires no account, Twitch or model calls.

When registering the Twitch app during an existing tunnel session, put its credentials in the ignored `.env`, then send SIGHUP to the exact `supervisorPid` in `.runtime/public-preview.json`. This restarts only this game server and rereads private configuration while keeping the same public URL and encryption key. Do this between shows: normal restart recovery invalidates unfinished ballots and safely abandons an in-progress fight. Do not change the encryption key while reloading. Stopping the entire launcher still changes the URL on its next start.

## Backups and evidence

From the repository root, explicitly select the public preview database when taking an online backup while the server is running:

```sh
DATABASE_PATH="$PWD/data/public-preview/aragoz.sqlite" node --env-file-if-exists=.env apps/server/src/backup.ts /absolute/new-backup.sqlite
```

The destination must be new. Confirm the source matches the `database` path recorded in `.runtime/public-preview.json`. The generic server command inherits its own environment and can otherwise select the separate local rehearsal database. Preserve the matching private encryption key securely; the SQLite backup contains encrypted tokens but does not include that key. Do not put either file in Git, screenshots, or public evidence.

Verify restoration in a separate local data directory with the same encryption key; never overwrite the active database during a show. Record actual URL, revision, restart, backup and provider results. Keep synthetic fixtures separately labelled. Three first-time hosts with genuine viewers and actual OBS performance sessions remain required before release-ready claims.

Official references checked 26 October 2026: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) and [Render free-service limits](https://render.com/docs/free).


## Account-free three-act show

Open `/house-show` at the current preview origin to choose two House-authored contracts per act, play three acts, Encore or Remix, and keep the cumulative showbill. `/rehearse` remains the one-encounter practice route. Neither route requires Twitch or model calls. House saves live in that browser and origin, independently from the server database; another browser/device or a new temporary hostname has a separate save. Download the showbill before replacing a save or changing the tunnel origin. Local attempt history is not externally verified competition or human-acceptance evidence.

## Restricted proxy and current review

The Mac origin binds127.0.0.1. Set the nonsecret `TRUST_LOOPBACK_PROXY=true` only when that loopback peer is your trusted tunnel; the default is false. This uses Fastify's IP allowlist, not blanket trust or a hop count. Cloudflare appends its connecting client's address to forwarded chains; the nearest untrusted client remains the anonymous rate key, while authenticated channels retain their own limits. Never expose the origin directly with blanket proxy trust or log visitor IPs for these checks.

Readiness now returns503 when the built index or entry assets are missing. A fresh launcher also fails before spawning a tunnel if its build is absent and requests the real House frontend before reporting ready. Existing same-hostname supervisors need not be restarted just to exercise the new bootstrap. The27October audit observed a Cloudflare1033/reconnect and a browser load timeout despite a healthy game origin. Keep the local3000House route available; no uptime guarantee applies to the free public hostname. See AUTONOMOUS_RELEASE_REVIEW.md for the actual evidence and judgment.

## Current operation and verification — 27 October

The earlier packet used `https://hunter-pin-talk-transactions.trycloudflare.com`; `.runtime/public-preview.json` remains authoritative. The old paper-principles hostname actually expired (`Unauthorized: Tunnel not found`). The launcher now terminates its own children and fails visibly on that message, including split chunks. It never silently switches origin during a show. Start a new preview deliberately between shows and update Twitch's exact callback when configured.

Use the verified project-local runtime in this workspace:

```sh
export PATH="/Users/frameless/Desktop/Aragoz/.runtime/node24/node-v24.19.0-darwin-arm64/bin:$PATH"
npm run test:ops
node scripts/verify-public-preview.mjs
```

The public probe stores its anonymous cookie/CSRF only in ignored0600`.runtime/hosted-probe-session.json` and writes sanitized status/boolean receipts. It creates no host. After an authorized exact-supervisor SIGHUP, `node scripts/verify-public-preview.mjs --resume-session` verifies that session persisted at the same origin.

`node scripts/verify-preview-persistence.mjs` is a bounded check for the currently unconfigured preview only. It refuses configured credentials/shows, creates a new online backup and isolated copy under ignored `data/public-preview/checkpoint-20261027-b03`, starts a temporary localhost server with the existing key, verifies anonymous continuity, and closes it. Destinations must be new; never delete a backup simply to repeat it. Genuine token/recipe/result restore needs the genuine-account procedure above.

Current actual results:19public checks before/19after reload,7backup/restore checks,2process tests. These are anonymous infrastructure evidence. See [steps6–10report](STEPS_6_10_REPORT.md) for exact scope and final external dependencies. Public game/frontend remains source7fabb61; this packet changes only launcher/ops tooling and documentation.

## Real Twitch setup —27October (historical origin)

Current origin/callback: `https://klein-wake-circle-favor.trycloudflare.com` plus `/api/auth/twitch/callback`. The free ARAGOZ Theatre app is registered and the broadcaster granted only `user:read:chat`. Client credentials are in ignored0600`.env`; do not create a duplicate app or rotate the secret to change a tunnel URL. Genuine chat/operator play/refresh/encrypted backup/restart evidence is in [the provider report](TWITCH_LIVE_VALIDATION.md). Public setup is the hosting route; local3000remains account-free fallback. The anonymous-only persistence probe deliberately refuses configured shows and should not now be rerun unchanged. Models remainoff and human acceptance remainsopen.

## Restored preview —28October

The previous preview processes had stopped before the final packaging pass. Root
verified no listeners/owned processes remained, then restarted the same database/key
between shows. Current origin: https://star-dawn-phases-nevada.trycloudflare.com ;
callback appends `/api/auth/twitch/callback`. Check `.runtime/public-preview.json`
for authoritative status/PIDs. The account-free local3000House route was restored
separately with empty Twitch/model configuration. No paid hosting or model call.
The existing draft demo URL was saved to this origin; callback restoration is
recorded in the current handoff after the actual Twitch UI save.
