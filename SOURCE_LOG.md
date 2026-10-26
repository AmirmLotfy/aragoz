# Source log — 25 October 2026

The original brief preserves its full S01–S22 research bibliography. This log records implementation-relevant reads, not independent hands-on competitor validation.

| Source | Applied constraint | Evidence limit |
|---|---|---|
| https://dev.twitch.tv/docs/chat/authenticating/ | Broadcaster-owned read scope; optional write scope | Documentation verified, actual OAuth/chat pending |
| https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/ | Server authorization-code flow and single-use state | Actual app registration/consent pending |
| https://dev.twitch.tv/docs/eventsub/handling-websocket-events/ | Welcome, keepalive, reconnect, revocation; gaps are not replayed | Source and mock tests written; provider test pending |
| https://dev.twitch.tv/docs/eventsub/websocket-reference/ | Metadata-ID delivery dedupe | Runtime checks pending |
| https://developers.openai.com/api/docs/guides/structured-outputs | Strict text.format schema plus semantic checks | Documentation fetched; no paid API call |
| https://developers.openai.com/api/docs/models/gpt-6-luna | Requested efficient model supports structured outputs and reasoning none | Account access/latency/cost not tested |
| https://developers.openai.com/api/docs/guides/moderation | Moderation endpoint precedes public presentation | Mock tests written, actual provider pending |
| https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF | Local GLB kit/loader; no runtime asset generation | Engine import not validated yet |
| https://github.com/BabylonJS/Babylon.js/blob/9.32.0/packages/dev/core/src/Culling/ray.core.ts | Pointer coordinates must avoid double hardware scaling | Exact-version source reviewed by integration specialist; browser checks pending |
| https://nodejs.org/en/about/previous-releases | Node24 LTS target | Bundled Node24.19.0 available; Docker tag not built |
| https://render.com/docs/disks and https://render.com/docs/websocket | Persistent SQLite volume and long-lived process; interrupted deployments | Prepared config only |
| https://render.com/pricing | About$7.25/month base compute+1GBdisk before extras | Account-specific quote/provisioning pending |
| https://twitchcon-codex.devpost.com/rules | Optional competition closes2026-11-03 00:00 Cairo | Build schedule is flexible; no submission authorized here |

Dependency versions were read from npm registry metadata before pinning package manifests. This does not establish a resolved lockfile, successful install, compatible types or a passing runtime.

Refero reference decisions are recorded in ART_BIBLE.md. Built-in image generation produced assets/concepts/target-sheet-v1.png with its exact prompt retained; the sheet is concept evidence only and approval remains pending.

Update26October2026: the user approved that sheet's visual direction. Final assets and paid generation remain unapproved/unproduced. Meshy's current official pricing and Image-to-3D documentation were read at https://docs.meshy.ai/en/api/pricing and https://docs.meshy.ai/en/api/image-to-3d. A draft first-shell request pins Meshy6 geometry-only at20credits; it has no spend authorization and no provider task. Official documentation currently identifies latest as7.1, so the connector's older latest/model5 descriptions are not relied on.

## Active risks

Storage admission is currently unmet. All substantive typecheck/unit/build/browser checks and final art production remain withheld. Actual Twitch and model credentials/caps, visual approval, exact Meshy quote, hosting cost review, OBS measurement and real-user tests remain external gates. The main product risks remain an unreadable/boring fight or a weak causal link from proposal to visible break; source existence does not resolve those risks.
