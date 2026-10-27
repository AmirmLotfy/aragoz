# Steps 6–10 execution — 27 October 2026

Root resumed the owner's requested genuine-release sequence from clean `main` at `7fabb610545365751fc06613afc002c05913b2e8`. The complete first-release scope remains unchanged. This packet advances real hosting operations and fixes an observed operational failure; it does not substitute anonymous checks for broadcaster/viewer acceptance.

Current free preview: **https://hunter-pin-talk-transactions.trycloudflare.com/house-show**. Local fallback: **http://127.0.0.1:3000/house-show**. Both retain account-free House play. The final public frontend bytes match the packaged build; fresh browser gameplay was not run in this packet.

| Item | Work actually performed | Current status |
|---|---|---|
| 6. Genuine Twitch app/causal chain | Tried developer console; retried after owner said enabled; reset the browser connection and retried once. Every attempt was rejected before accessing Twitch. Private configuration inspected as presence booleans only: client ID absent, client secret absent, invitation list present. | Not executed against Twitch; last actual provider state remains the earlier 2FA registration rejection. |
| 7. Genuine provider lifecycle | No credentials/socket connection to Twitch could be established. | Pending; local/mock lifecycle evidence remains separate. |
| 8. Hosted persistence/restore/isolation | Replaced an actually expired free tunnel; verified public HTTPS/WSS access denials, packaged frontend, cookie/CSRF/origin policy, same-origin reload and current anonymous session persistence. Online backup and isolated server restoration passed. | Infrastructure portion verified; real host/channel/token/attempt isolation remains pending. |
| 9. Genuine hosts/viewers | Owner answered **“none”** when asked which real participants were available. | Zero sessions. No fake participants, unsolicited outreach or fabricated responses. |
| 10. Fix/freeze/judge | Fixed launcher behavior after actual tunnel expiration; two isolated process tests pass; actual hosting checks recorded. Technical-preview judgment retained and source/checkpoint updated. | Technical preview approved; complete invited-broadcaster release remains unaccepted. |

## Actual operations and checks

The old `paper-principles-detection-stephen` hostname failed DNS resolution; its live cloudflared log repeatedly reported `Unauthorized: Tunnel not found`. It was an expired provider-side tunnel, not merely a rendering problem. Root verified ownership/cwd and zero active shows before stopping only its supervisor/children. The local3000server stayed running. The active public database was backed up before replacement, its existing private key stayed in place, and no browser storage was read/cleared/migrated.

A replacement proved connectivity. Root then loaded the tested launcher expiry fix through one final deliberate start, producing the current `hunter-pin-talk-transactions` hostname. Earlier intermediate `wallace-printer-ace-beam` processes were stopped, with no hosts/shows to interrupt. Old browser-origin House records remain in their original storage; the new public origin has its own save area. The local save origin is unchanged.

The source fix recognizes the exact expiration message even when split across output chunks. It exits with failure and stops only its owned children rather than retrying indefinitely while the runtime file says ready. It does not silently change the hostname during a show. **`npm run test:ops` passes2/2**, including child termination/no falsely announced readiness. Test roots are disposable isolated directories containing no private `.env`; an initial incorrect fixture entry path was corrected and is recorded separately.

Actual public network checks pass **19 before and19 after reload**, independently recorded:

- Readiness200, real packaged index and decoded JS bytes match local build, gzip serving and security headers.
- Private file routes serve only the public HTML shell, not `.env`, key or runtime files. This is not represented as404 when the actual response is200/SPA fallback.
- Anonymous cookie has HttpOnly/Secure/SameSiteLax; anonymous sessions cannot access host APIs or create a show.
- Missing CSRF and foreign Origin mutations fail403. Valid anonymous CSRF still fails host authorization401.
- Foreign-origin WebSocket fails403; same-origin anonymous WebSocket fails401.
- Exact-supervisor SIGHUP changes only the backend PID and preserves hostname/tunnel/database/key. The same public anonymous session survives.

Online backup and isolated restoration pass **7 checks**: actual source selection, zero configured credential/show rows, SQLite integrity, schema/all row counts, actual restored-server startup, restored anonymous-session continuity, and zero provider requests. The real snapshot contains4anonymous sessions,0channels/shows/recipes/results/encounter events. The isolated server closes after checking; the active DB is never overwritten. The original key file's inode/size/mtime are unchanged. No token decryption/recovery claim is made with zero tokens.

Receipts: [before reload](../evidence/hosted-boundary-before-reload-20261027.json), [after reload](../evidence/hosted-boundary-after-reload-20261027.json), [continuity](../evidence/hosted-reload-continuity-20261027.json), [backup/restore](../evidence/hosted-backup-restore-20261027.json), [process tests](../evidence/public-preview-expiry-tests.tap), [configuration presence](../evidence/twitch-config-presence-20261027.json), [packet summary](../evidence/steps-6-10-validation.json).

No combat/menu/assets/dependencies changed. Existing171unit/28browser/fourfinalfocused/OBS/Linux/gameplay receipts keep their exact source limits. This operations-only packet uses two new Node process tests, three script syntax checks, actual public HTTP/WSS and actual SQLite/isolated server checks; it does not invent a fresh full gameplay suite. All spending is zero and game/model calls stay disabled. No game audio, browser-profile access, credentials in logs, contacts or recording publication.

## Current ownership and next action

Root owns integration; no specialist or heavy job remains. Verified project-local Node24.19.0 owns supervisor88572/exec59138, tunnel88573 and backend88784/loopback3010. Local55962/exec81395 remains intentionally available. `.runtime/public-preview.json` is authoritative; the newer public supervisor uses the valid project-local runtime and its same-URL SIGHUP was actually verified. The old deleted-executable reload limitation is resolved for this supervisor.

Private Git publication remains authorized; the final pushed checkpoint is recorded in ignored `.runtime/delivery-state.json`. Credentials/backups/probe cookies stay in ignored0600local files. To resume6, use the current callback `https://hunter-pin-talk-transactions.trycloudflare.com/api/auth/twitch/callback` after browser access/provider recovery. The genuine test checklist remains ops/RELEASE_CHECKLIST.md. No paid alternate hosting, automatic tunnel replacement or routine owner review is pending.

## Blockers — kept at the very end

1. The owner confirms browser access is enabled, but the tool connection still rejects it as disabled in Work, including after a connection reset. This is a tool/setting mismatch; it is not a claim that the owner failed to enable it. No Twitch page/account state was accessed and no bypass was attempted. Last known actual Twitch registration still rejected missing2FA/SMS; no client ID/secret is configured.
2. Genuine OAuth/chat/attributed causal chain, EventSub lifecycle, token restoration and simultaneous configured-channel isolation need that real setup. Anonymous public checks do not close those gates.
3. The owner confirms there are no participants. Step9requires three genuine first-time hosts and at least three genuine viewers/session with consent and actual responses. Human acceptance remains0; full step10release judgment stays pending.
4. The current free hostname is temporary and depends on this Mac/network. Expiry now fails visibly and safely; it does not establish uptime. All spending remains prohibited.
