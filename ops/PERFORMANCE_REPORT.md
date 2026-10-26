# ARAGOZ M1 capture measurements

Actual local OBS recordings with AI-led keyboard play. These do not establish genuine Twitch, broadcaster or viewer acceptance. No footage was uploaded; all spending remains off.

## Recommended measured profile

On the tested Apple M1, use **1080p OBS output at 30 fps**, Standard game quality, and **30 fps fallback** in game Settings. The simulation remains fixed at **60 Hz**. This profile completed the full 30-minute session, averaging **29.993 presented fps**, with 34 OBS rendering-lag frames and 3 encoding-lag frames. Occasional drops remain; this is not a claim that every frame meets its deadline.

The 720p/60 fps target completed its duration and framing checks but averaged 56.50 fps. It is not accepted as a steady 60 fps profile. Do not infer a measured 720p/30 fps result from the 1080p result.

## Device and method

Apple M1, macOS 26.6.2, Chrome 155.0.8059.85, OBS 33.0.0. Fresh sandboxed Chrome profile, hardware Metal, one uniquely titled public game window and Apple VideoToolbox hardware H.264. Microphone device disabled; capture audio muted. Actual encoded audio tracks measured silence at the analyzer floor (-91 dB).

Each 30-minute session switches through charge/steam, charge/echo and steam/echo at 10-minute intervals. Ordinary movement/strike/dodge inputs and actual Encore follow outcomes. No health, tick or combat-state mutation. Menus and asset preparation count toward wall time. Unpaused presentation samples include AI navigation stalls and idle final-strike waits: this is not 30 minutes of continuous peak offensive load. Unfinished attempts remain in the totals.

The logical window is 1280×720, viewport 1280×688 at DPR 2. The game canvas is 780.445×432 CSS pixels; low quality buffer 780×432, Standard buffer 1170×648. OBS resolution does not mean the inner canvas fills the recording.

## Completed clean captures

| Measurement | 720p / 60 fps target | 1080p / 30 fps fallback |
|---|---:|---:|
| Game source | `57f86bd` | `02f6b75` |
| Gameplay duration | 1,800,001.097 ms | 1,800,004.052 ms |
| Encoded recording | 1280×720, 60 fps, 1835.300 s | 1920×1080, 30 fps, 1859.900 s |
| Unpaused presentation samples | 100,176 | 53,008 |
| Weighted mean frame | 17.700 ms (~56.50 fps) | 33.341 ms (~29.993 fps) |
| Worst individual attempt p95 | 34 ms | 50 ms |
| Longest observed frame | 95 ms | 61 ms |
| OBS render lag | 613/110,136 (0.557%) | 34/55,808 (0.061%) |
| OBS encoder lag | 51/110,135 (0.0463%) | 3/55,808 (0.00538%) |
| Actual attempts | 79: 73 wins, 3 defeats, 3 unfinished | 75: 67 wins, 5 defeats, 3 unfinished |
| Peak observed geometry | 46,475 triangles / 71 draw calls | 46,751 triangles / 71 draw calls |
| Browser/driver errors | 0 / 0 | 0 / 0 |
| Bounds samples / crop / downloads | 391 / 0 / 0 | 379 / 0 / 0 |
| Encoded frames reviewed | 5, 15, 25 minutes: whole stage | 5, 15, 25 minutes: whole stage |

The p95 column is the maximum of individual-attempt p95 values, **not a global p95**. Render/encoder percentages above are calculated from exact counters; OBS rounds them in its UI. Sparse same-attempt simulation samples in the 1080p run had a median 59.87 ticks per wall second; the exact 1/60 step and independence from 30 fps rendering are established separately by unit/browser checks.

Both captures pass duration, stability and sampled framing checks. The documented 1080p/30 fps profile is accepted for this local M1 technical preview. Geometry remains under 120,000 visible triangles and approximately 80 draw calls; original GLB art is 1,345,615 gzip bytes, below 25 MB. Spectator comprehension, missed tells and genuine live broadcasting still need human/provider sessions.

## Audio correction

The recording track was silent, but the game remained audible through the Mac speakers. The owner requested silence after the final duration had completed. The test window was closed safely after OBS finalized. Future test Chrome processes launch with `--mute-audio`; the headed driver also checks the game's mute setting before declaring readiness. An actual fresh preflight verified both controls. `evidence/silent-test-policy.json` records this separately. No system-wide audio setting was changed.

## Preserved diagnostics and source limits

Earlier 1080p/60 fps footage completed 30 minutes but had download-panel obstruction and scrollcrop; framing was rejected. A 522.635-second 720p diagnostic was stopped for callback deadline drift. A later 542.885-second 1080p diagnostic exposed an aim-assist inconsistency after both module breaks. These remain unmodified and distinct from the clean captures.

PresentationClock now preserves deadline phase. Final-strike assistance targets the nearby body after both breaks while preserving manual aim and socket priority. Current app typecheck, 129 unit/server tests and release build pass. All 15 browser cases are covered across 13 initial passes and 2 focused passes after correcting software-renderer synchronization assumptions; this was not one 15-pass run. The 720p capture predates the final aim-assist fix. Later mute-policy/documentation changes do not alter measured game bytes. Different runs are not a controlled A/B performance comparison.

Sanitized receipts: `evidence/obs-720p-session.json` and `evidence/obs-1080p-30fps-session.json`; encoded frames: `evidence/browser/obs-720p-paced-*.png` and `obs-1080p-30fps-*.png`. Raw footage/profiles remain ignored and local. Real Twitch integration and genuine three-host/viewer acceptance remain open; the entire release is not yet release-ready.
