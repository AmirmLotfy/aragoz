# Evidence and acceptance plan

Current local evidence is recorded below. Local, mocked provider and AI-led checks do not advance real-provider, hosted, OBS or human gates.

## Actual local evidence —26October2026

- `npm ci --ignore-scripts`:142packages installed from the lockfile. A subsequent explicit production-only workspace package installed86packages/32MB and served health, readiness, rehearsal, asset manifest and font license endpoints successfully.
- `npm run typecheck`:passed with TypeScript7 under Node24.19.0.
- `npm test`:112passed across7files after release completion fixes:36combat/contracts,65server and11web helper/render cases. Current log evidence/release-completion-tests.log; earlier receipts retained.
- `npm run test:assets`:62small GLB-format/local-serving fixtures previously passed; evidence/asset-format.tap. Static bounds are rest-pose evidence.
- `npm run test:browser`:11passed,1worker,3.3minutes on the current compression build after browser access became available. Actual log evidence/release-completion-browser.log. The stalled-manifest, late-container, covered-error and context-loss regressions now run and pass. Includes public offline rehearsal, real inputs/pause, settings, all pairs, actual missing-GLB fallback and fixture-only live authoring/vote/HTTP/WS/control recovery.
- `npm run build:release`:passed with all7runtime GLBs admitted. Original Blender sources,256px authored tiles, sockets and rigid clips retained;1,345,615compressed GLB bytes and44,796triangles across the full kit. Actual three-pair scenes were33–35kvisible triangles/59–62drawcalls at rest; active hazards peaked40,951triangles/70drawcalls in the short sample.
- Actual M1 Metal headless browser samples at1920x1080 and1280x720 viewports:8.5seconds each, mean17.69/17.16ms presentation intervals, p9518ms. Actual canvas buffers were1492x832 and1203x669 due to the page layout. These short samples are NOT full1080p/720p OBS tests. evidence/browser/performance-smoke.json records exact dimensions and a409.6ms initial high-resolution outlier.
- AI-led keyboard browser play baited the charge, exploited the block, broke the physical axle, observed six seconds without another charge, broke steam, won through the final strike and reset both modules with Encore. evidence/browser/causal-counter.json. No genuine viewer is claimed.
- An actual Linux ARM64 Docker build passed the full build-stage checks. Container smoke verified non-root startup, public/private routes, packaged compressed GLBs, persistent volume replacement, online backup and isolated restoration. evidence/linux-container-build.json and linux-container-smoke.json. Task-owned Colima VM/data were removed after checks; production code remains available to rebuild.

## Bounded automated checks

Run resource admission, then one check at a time: typecheck, Vitest (one worker), build, Playwright (one worker) and asset audit. Do not repeat a passing check without changed source or unresolved concern. Unit tests cover real state transitions instead of mirroring implementation.

- Combat: different charge/steam/echo behavior; reachable flaws on both shells; damage immunity; arena bounds; stationary/clipped echo; guaranteed full counter window; same-tick ability cancellation; chip progress; final strike; seeded fixed-step behavior.
- Audience: replacement ordering, duplicate deliveries, expired codes, late/out-of-order commands, changed/restarted ballot generations, correct House labels and source credit.
- Server: CSRF/origin/auth, channel isolation, room revisions, explicit control takeover, timer pause/resume, model refusal/timeout/semantic invalidity/budget-disabled fallbacks, offline/stale events and ended shows.
- Persistence/provider: versioned migrations, backup restoration, startup safe recovery; mocked OAuth/refresh/EventSub welcome/reconnect/revocation; real connections separately required.
- Browser: public rehearsal, controls/focus/settings, distinct configurations, backstage isolation, outcome/Encore/Remix, missing-asset/reconnect presentation and responsive capture layouts.

## Performance and human gates

Record actual M1 hardware/browser/OBS versions and captures. Thirty-minute OBS sessions at1080p and720p;60fps target and documented30fps presentation fallback with60Hz simulation. Measure frame times, crash count, draw calls, triangle count, compressed payload, silhouette and mobile stream readability. No performance claim before measurement.

After hosted technical preview: three first-time hosts with at least three genuine viewers/session. At least two hosts trigger an intended counter within two opportunities; at least two viewers/session correctly identify selected rule/effect. Record denominators, outcomes, confusion, boredom, genuine commands and consent; do not manufacture a pass. Synthetic load is separate. A failed/absent human gate leaves the pilot a technical preview.

## Gate status

| Gate | State | Evidence |
|---|---|---|
| Foundation | locally verified | Source brief, lockfile, contracts, tests, rights log and handoff exist |
| Real Twitch causal chain | pending | Genuine consent/chat not tested; fixture and AI-led chains are separate |
| Complete show/mechanics | locally verified |112unit tests;11browser flows and keyboard counter/final-strike/Encore; provider acceptance remains open |
| Finished art | admitted for technical preview | User direction approved;7original GLBs statically checked and rendered in Babylon; long OBS check remains open |
| Hosted technical preview | temporary HTTPS rehearsal running; provider checks pending | Free Mac/tunnel host, reload and local Linux persistence/backup verified; actual Twitch consent/chat/isolation remain open |
| Human acceptance | unperformed | ops/acceptance contains blank protocols/templates; must follow hosted preview |
