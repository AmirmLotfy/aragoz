# ARAGOZ M1 capture measurements

These are actual local OBS recordings with AI-led keyboard play, not broadcaster or viewer acceptance. No footage was uploaded. All paid services remain off.

## Device and method

Apple M1, macOS26.6.2, Chrome155.0.8059.85, OBS33.0.0. Dedicated sandboxed Chrome profile; one uniquely titled game window; hardware Apple VideoToolbox H.264 recording. Microphone device disabled; capture audio muted. The complete encoded audio tracks measured silence at the analyzer floor(-91dB max/mean).

Each30minute run uses ordinary movement/strike/dodge keys, switches between all3encounter pairs at10minute intervals and uses actual Encore after outcomes. No health, tick or combat-state mutation. Menus and asset preparation are included in wall-clock duration. Game presentation telemetry excludes intervals touching pause; browser rAF timing and OBS counters remain separate measurements.

The logical window is1280×720, viewport1280×688 atDPR2. Actual game canvas780.445×432CSS pixels; low quality buffer780×432, standard buffer1170×648. OBS output resolution does not mean the inner game canvas fills the recording.

## Clean post-fix measurements

Game build source: `57f86bd638d6c971ec8ba9df42d3c7708cf275ea`. Documentation/evidence changes during capture do not change the game build.

| Measurement |720p low resolution /60fps target |1080p standard /30fps fallback |
|---|---:|---:|
| Completed gameplay duration |1800001.097ms(30minutes) |Pending final capture |
| Actual recording |1280×720,60fps,H.264;1835.300s |Pending finalized file |
| Active presentation samples |100,176 |Pending |
| Weighted mean active frame |17.700ms(~56.50fps) |Pending |
| Worst individual attempt's p95 |34ms(not globalp95) |Pending |
| OBS render lag |613/110,136frames;0.6%reported |Pending |
| OBS encoder lag |51/110,135frames;0.0463%calculated |Pending |
| Actual attempts |79:73wins,3defeats,3unfinished |Pending |
| Peak observed scene |46,475triangles /71drawcalls |Pending |
| Browser/driver errors |0/0 |Pending |
| Crop/download guards |391samples;0crop,0downloads |Pending |
| Encoded-frame inspection |5/15/25minute frames: whole stage, no popover |Pending |

The720p run passes duration, stability and sampled capture-framing checks. It is **not accepted as a steady60fps presentation profile**. The unchanged simulation remains fixed at60Hz. A30fps presentation fallback is available; device acceptance of that profile has not yet been established. Spectator comprehension and missed-tell assessments still require genuine human sessions.

Measured geometry is below120,000visible triangles and approximately80drawcalls. Original shipped GLB art remains1,345,615gzipbytes, below25MB.

## Preserved diagnostics

- Earlier1080p run(sourceeedfd1e) completed30minutes with95attempts/88wins/4defeats/3unfinished,100112active samples/17.402ms mean,46751triangles/71drawcalls and OBS1.9%render lag/0.3%encoder lag. Actual frame review found download-panel obstruction and page scrollcrop. Capture readability was rejected; evidence and frames remain unmodified. `evidence/obs-1080p-session.json` is this diagnostic, not the clean repeat.
- A subsequent clean-framing720p diagnostic(source655d2d9) ran522.635seconds with0downloads/cropped samples and OBS0.8%render lag/0.1%encoder lag. It was deliberately stopped for the pacing correction; it is not30minute acceptance.
- Source review confirmed deadline drift: the old60fps gate anchored to a late18ms callback and skipped a healthy33.333ms callback. PresentationClock now retains phase, skips missed slots without catch-up draws and handles15/30/60fps changes; the1/60simulation accumulator is unchanged.122unit/14browser tests pass. Measurements across different source versions/conditions are not a controlled performance comparison; no improvement is inferred from the code fix alone.

## Evidence and remaining gates

`evidence/obs-720p-session.json` contains sanitized actual receipt hashes, exact media metadata, per-attempt telemetry and OBS counters. `evidence/browser/obs-720p-paced-*.png` are actual encoded frames. Raw footage/profiles stay ignored in `.runtime/`; they were not uploaded. The first clean1080p60repeat was stopped at542.885seconds for a final-strike aim-assist gap: both modules were broken but the old pointer direction could survive module-only assistance. The corrected helper and129unit tests pass; all15browser cases are covered across13initial passes and2focused synchronization fixes. evidence/obs-1080p-aim-diagnostic.json retains the actual8attempts/7wins/1unfinished and OBS7.9%render lag/0.3%encoder lag. It is not duration acceptance. Final1080p30game/30OBS capture is next;60Hzsimulation is unchanged.

Real Twitch integration, accepted presentation profile and genuine3host/viewer acceptance remain open. Do not describe the entire release as release-ready.
