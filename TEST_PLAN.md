# Evidence and acceptance plan

Updated 27 October 2026. Keep the complete first-release scope from the brief and IMPLEMENTATION_PLAN.md. The latest local checks and the historical receipts below have different source revisions and evidence scopes.

## Latest real Twitch validation

Free confidential ARAGOZ Theatre registration, read-only OAuth/EventSub input, actual operator proposal/vote/causal win, real serialized token refresh and genuine encrypted-token/result backup/restart recovery are now verified. [Provider report](ops/TWITCH_LIVE_VALIDATION.md). One actual broadcaster account was operated by the AI agent; human sessions remain0. No application source changed or full game suite was repeated. Runtime model calls remainoff/0usage. Specific handover/revocation/gap and multichannel/control cases remain open.

## New operations-only verification

Steps6–10packet: `npm run test:ops` passes2isolated process tests for expired/split-message tunnel shutdown. Three changed scripts pass Node24syntax checks. Actual public HTTP/WSS probes pass19before and19after same-origin backend reload. Seven actual online-backup/isolated-restored-server checks pass, including current anonymous session continuity. These use0channels/tokens/shows and4anonymous sessions; genuine token/channel acceptance remains separate. No combat/frontend/dependency source changed and the current171/28/fourfocused gameplay receipts below were not rerun or relabelled. [Operations report](ops/STEPS_6_10_REPORT.md), [receipt](evidence/steps-6-10-validation.json).

## Current local verification

- `npm run typecheck`: passed for the A01–A04 sources.
- `npm test`: **171 tests across 14 files passed**, one worker, 3.51 seconds. [Full unit log](evidence/steps-1-4-unit.txt).
- `npm run build:release`: passed with all seven final runtime GLBs admitted. The existing Babylon chunk-size advisory remains informational.
- The final complete browser run passes **28/28 cases in 3.1 minutes**, all muted. [Final run](evidence/steps-1-5-browser-final.txt). The earlier 27-pass/one-failure run is retained; restoring a separate author credit span fixed its exact-name privacy assertion before this full rerun. After final showbill typography and stronger corner/long-credit assertions, the four affected cases passed separately in26.0seconds. No partial runs were combined.
- A01 adds distinct advance charge/steam windup and echo recording/warning cues. Thirteen silent tests cover all six profiles before their real attack transitions, pause/break cancellation, deduplication, gesture unlock, mute and independent music/SFX controls. Web Audio stand-ins cannot reach speakers. [Audio tests](apps/web/src/audio-cues.test.ts).
- A03/A04 add 12 server tests: two synthetic audience-load cases and ten compiler deadline/refusal cases. The earlier focused 23-test log predates two additional audio lifecycle regressions; the 171-test full run includes all 25 new cases. [Focused log](evidence/steps-1-4-targeted.txt), [load tests](apps/server/test/audience-load.test.ts), [compiler tests](apps/server/test/compiler-deadline.test.ts).
- Actual local synthetic load delivered **1,887 messages across three channels**, retaining at most **128 proposals/channel**, sampling **12 unique authors/channel**, and retaining **201 effective votes/channel**, with zero recorded failures and drained queues. Measured local completion p95/max were 500/619 ms; total load duration was 851 ms. A separate pending-compiler case kept the other two channels and a host action responsive. These are in-process Engine/SQLite measurements. [Synthetic receipt](evidence/synthetic-audience-load-20261027.json).
- Mock compiler regressions cover the shared 12-second moderation/mapping/repair deadline, pending transport and response-body cancellation, late-response suppression, at most one repair, refusal fallback, request caps and identity privacy. No model request was made.
- A02 moves the public command above ballot cards, uses concise curated public copy, places the HUD caption below the arena and adds high-contrast plates. Actual muted Chromium baseline/candidate captures retain the 1280×720 layout at 1280, 844 and 390 pixel output widths. [Baseline receipt](evidence/browser/readability-baseline/receipt.json), [candidate receipt](evidence/browser/readability-candidate/receipt.json). Root completed the scoped [engineering review](ops/STREAM_ACCESSIBILITY_REVIEW.md); capture completion does not establish human comprehension.

## Actual gameplay and historical receipts

The account-free `/house-show` has actual AI-led public HTTPS gameplay evidence: three acts won in three attempts, six module breaks, five openings and zero page errors. A separate local echo run struck the block, exposed and broke the mirror, then observed 360 fixed ticks with echo disabled. [House receipt](evidence/browser/autonomous-house/receipt.json), [echo receipt](evidence/browser/autonomous-echo/receipt.json). These runs use diagnostic snapshots and aim assist; they are not first-time-human sessions.

The preceding [autonomous validation](evidence/autonomous-release-validation.json) records 146 tests and one complete 25-case browser run at application revision `0f12477`. Earlier [release readiness](evidence/release-readiness.json) and [validation](evidence/validation.json) retain their original 112-test/12-browser results. The separate compression browser log records 11 cases. Keep those receipts unchanged; none certifies later source changes.

The original asset kit remains seven admitted original GLBs, 44,796 whole-kit triangles and 1,345,615 gzip bytes, with Blender sources, authored tiles, sockets, rigid clips and rights/font notices. Earlier 62 asset-format/serving fixtures are recorded in `evidence/asset-format.tap`; static bounds describe rest poses. Short Metal browser samples and the earlier keyboard charge/steam counter proof remain in `evidence/browser/performance-smoke.json` and `evidence/browser/causal-counter.json`, with their original dimensions and duration limits.

Actual Linux ARM64 container build and 12 smoke checks verified non-root startup, static serving/private-route denial, persistent volume replacement, online backup and isolated restore for their recorded revision. [Build receipt](evidence/linux-container-build.json), [smoke receipt](evidence/linux-container-smoke.json). The task-owned VM/image were removed after evidence collection. These are local container checks, separate from hosted genuine-token recovery.

## Completed OBS measurement

Actual 30-minute M1 OBS captures are complete for their recorded source revisions. The recommended measured profile is **Standard quality, 1080p OBS output at 30 fps, with the game set to its 30 fps presentation fallback and simulation fixed at 60 Hz**. Source `02f6b75` averaged 29.993 presented fps, with 0.061% rendering lag and 0.00538% encoding lag. The 720p/60 target at `57f86bd` averaged 56.50 fps and was not accepted as steady 60 fps. [Performance report](ops/PERFORMANCE_REPORT.md).

These captures passed duration, stability and sampled framing; they predate the House UI and current audio/readability changes. They include menus and AI navigation/idle time, so they do not establish continuous peak combat load. Preserve rejected/short diagnostic captures separately. The recordings were silent but speakers were audible; subsequent test policy now mutes Chrome with `--mute-audio` and checks game mute before readiness. No new timed capture is implied by this documentation update.

## Bounded automated checks

Run `node scripts/check-resources.mjs --job verify|build|browser` for the next bounded job, then one heavy check at a time. Reuse installed pinned dependencies. Repeat a passing check only after relevant changes or an unresolved concern. Launch automated browsers with `--mute-audio` and set game mute before play; keep unrelated application audio unchanged.

- Combat: all families/profiles/pairs and both shells; reachable counters, damage immunity, arena bounds, echo behavior, full counter window, same-tick cancellation, chip progress, final strike and fixed-step determinism.
- Audience: replacement ordering, duplicates, wrong/expired codes, cutoff boundaries, ballot generations, channel isolation, bounded storage/sampling, queue responsiveness and honest source credit.
- Server/compiler: CSRF/origin/auth, revisions, control takeover, pause/resume, total compiler deadline/refusal/repair/caps/privacy and ended/stale events.
- Persistence/provider mocks: migration/version rejection, startup recovery, backup restoration, OAuth/refresh/EventSub welcome/reconnect/revocation.
- Browser: account-free rehearsal and three-act House show, actual combat input, save/takeover/storage recovery, settings/focus, outcomes/Encore/Remix, missing assets/context loss, fixture-live isolation and stream capture layouts.
- Deployment source/fixtures: missing frontend entry assets yield readiness 503; a present frontend can be ready with Twitch unconfigured. Forwarded identity is untrusted by default; the explicit loopback-proxy option is fixture-tested separately.

## Gate status

| Gate | State | Evidence scope |
|---|---|---|
| Foundation | Locally verified | Current typecheck/build and 171 tests; contracts, lockfile, rights and handoff |
| Real Twitch causal chain | Open | Actual AI-led House chain and fixture-live checks are separately recorded |
| Complete show/mechanics | Locally verified | Three families/all pairs, both shells, three acts, physical breaks, outcomes, Encore/Remix and recovery; current browser result above |
| Finished presentation | Admitted for technical preview; A02 engineering review complete | Seven original GLBs, actual Babylon captures, advance-audio tests, completed historical OBS and current readability captures |
| Hosted technical preview | Free public/local route exercised | Actual public House gameplay, source-bound local Linux restore and public backup integrity; point checks do not establish uptime |
| Human acceptance | 0 genuine sessions | Existing blank protocols/templates in ops/acceptance |

## Blockers and constraints — kept at the very end

1. The earlier 2FA rejection is historical; the free app and actual read-only connection are now verified. Specific remaining provider scenarios are listed in ops/TWITCH_LIVE_VALIDATION.md.
2. Actual read-only OAuth/chat/operator causal win/refresh and genuine token/result recovery are now verified. Specific remaining handover/revocation/gap and genuine multichannel/control/offline cases still need real evidence; mocked coverage stays separate.
3. Human acceptance requires three first-time hosts with at least three genuine viewers/session. At least two hosts must perform an intended counter within their first two unassisted opportunities, and at least two viewers in each session must identify the selected rule/effect. Record real denominators, assistance, confusion, accessibility and consent. No sessions were added; contacting people or publishing recordings needs authorization.
4. Phone-sized stream captures establish engineering layout evidence only; mobile combat support and genuine viewer comprehension are not inferred.
5. All spending remains prohibited, including paid hosting, model/Meshy calls and automatic billable CI. Keep credentials/configuration private. The temporary tunnel has had actual 1033/reconnect and page-load failures; the Mac/process/network must remain available, with local fallback preserved. The full release remains a technical preview until genuine provider and human acceptance pass.
