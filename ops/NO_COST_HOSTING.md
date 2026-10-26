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
