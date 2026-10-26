# Autonomous release judgment — 27 October 2026

Decision: approve the complete solo House show for a **free desktop technical preview**. Keep the full invited-Twitch release unaccepted until genuine provider and human evidence exists. The owner delegated routine implementation and judgment while busy; no routine review or preference question is pending.

## Evidence behind this decision

- Current typecheck, 146 unit/server tests across11files, release build and one full25/25browser run pass. Browser coverage includes three-act closure, real ordinary defeat/Encore, immutable one-slot Remix fixtures, permission/isolation fixtures, asset failure, pause/focus, refresh/takeover and three new storage regressions. These are automated checks, not human acceptance.
- A fresh muted browser completed the actual public HTTPS House show using keyboard input: charge/steam, charge/echo and steam/echo;3wins in3attempts,6module breaks,5counter openings,0page errors. Combat durations615/1358/776ticks, about10.25/22.63/12.93simulationseconds. This automation uses public diagnostic snapshots and aim assistance; it does not establish first-time-player difficulty, fun, intended session duration or human comprehension. `evidence/browser/autonomous-house/receipt.json` retains every recipe/result and observations.
- The full-show sample did not observe an exposed echo, so a separate focused check verified it locally: a stationary first recording, then actual movement recorded/replayed into a stage block; mirror exposed at tick1040, real exposed-strike meters0→40→80, break at1136, then360fixed simulation ticks without echo reactivation. No combat or result state was injected. `evidence/browser/autonomous-echo/receipt.json` and actual exposed/broken screenshots record the chain.
- Reviewed actual720pstage/counter, result and complete showbill images, plus narrow layout evidence. The approved tactile theatre, distinct hazard geometry, rule captions, module meters, House attribution and cumulative history remain readable. This is an integration review, not an independent audience evaluation.

## Repairs made without owner intervention

1. All six standalone browser diagnostic/capture launchers now mute speaker output; legacy diagnostics also set game mute before page load. Existing Playwright launch mute remains. No unrelated system audio changed.
2. Save failures now warn that latest progress may be lost or an older save may return. Clearing storage in another window releases control and removes the scene; a missing-key write guard prevents resurrecting cleared history.
3. Readiness now requires SQLite and the built index/entry assets. The launcher rejects a missing build before starting any tunnel, and checks real frontend readiness before announcing a new preview. An actual missing-build invocation rejected as expected before resource creation. The existing supervisor was preserved to retain the hostname; its server loaded the new readiness behavior, while the new launcher's stronger bootstrap applies on its next full start.
4. Optional `TRUST_LOOPBACK_PROXY=true` restricts trusted forwarding to loopback peers. It is enabled only in this loopback-bound Mac/tunnel configuration; direct-server defaults remain untrusted. Tests distinguish clients behind loopback, ignore forged prefixes before the nearest untrusted client and reject forwarding from untrusted direct peers. No visitor-IP logging was added. This follows [Fastify's restricted proxy policy](https://fastify.dev/docs/latest/Reference/Server/#trustproxy) and Cloudflare's documented [forwarded-header behavior](https://developers.cloudflare.com/fundamentals/reference/http-headers/). Multi-IP tests are local fixtures, not real hosted multi-user acceptance.

## Failed diagnostics and hosting limit

No failed attempt is counted as acceptance. The first public echo diagnostic exposed/broke the mirror, then died to steam before its requested360tick observation window. A later local diagnostic got stuck against scenery because its navigation clearance was smaller than its input tolerance; correcting the diagnostic navigation produced the successful focused check. Those earlier receipts/screens remain in autonomous-echo-first and autonomous-echo-local-navigation.

Two fresh public-browser echo attempts could not start gameplay: one saw Cloudflare1033during a real tunnel disconnect, another timed out loading the page. Evidence remains in autonomous-echo-network and autonomous-echo-network-timeout. The existing cloudflared process reconnected on the same hostname; no paid provider, replacement hostname or new tunnel was created. The game server stayed ready and subsequent public HTTP returned200. This is an observed availability limitation, not a stable-hosting claim. Keep local `http://127.0.0.1:3000/house-show` available as the dependable on-Mac route; the public link is temporary and requires this computer/network/process to remain running.

## Limits retained

No new OBS duration test or Linux container build was needed for these repairs. Earlier versioned evidence retains its original source limits; the updated container smoke source includes /house-show but has not been rerun in Linux. Prior30fpsM1presentation profile remains the measured recommendation, with60Hzcombat unchanged.

Twitch SMS/2FA remains explicitly deferred by the owner: no registration retry, new secret, OAuth or real chat occurred. Genuine human sessions remain0. No outreach, paid resources/model/Meshy calls, recording publication or billableCI was performed. Full broadcaster release acceptance is still pending; this review does not replace it with AI activity.
