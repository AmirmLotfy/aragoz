# ARAGOZ M1 capture measurements

These are actual local OBS recordings with AI-led keyboard play, not broadcaster
or viewer acceptance. No footage was uploaded. All paid services remain off.

## Device and method

Apple M1, macOS26.6.2, Chrome155.0.8059.85, OBS33.0.0. Dedicated sandboxed
Chrome profile; one uniquely titled game window; hardware Apple VideoToolbox
H.264 recording. Microphone device disabled; capture audio muted. The complete
1080p audio track measured silence at the analyzer floor (-91dB max/mean).

Each30minute driver run uses ordinary movement/strike/dodge keys, switches
between all3encounter pairs at10minute intervals and uses actual Encore after
outcomes. It never changes health, ticks or combat state. Menus and asset
preparation are part of the wall-clock session. Presentation telemetry excludes
paused frames; browser rAF timing and OBS counters are separate measurements.

## Results

| Profile |1080p Standard /60fps target |720p low resolution /60fps target |
|---|---:|---:|
| Completed session |30minutes |Pending |
| Actual recording |1920×1080,60fps,H.264 |Pending |
| Active presentation samples |100,112 |Pending |
| Weighted mean active frame |17.402ms (~57.46fps) |Pending |
| Worst individual attempt's p95 |34ms (not a global p95) |Pending |
| OBS render lag |2,018frames /1.9% |Pending |
| OBS encoder lag |296/108,805frames /0.3% |Pending |
| Actual attempts |95:88wins,4defeats,3unfinished |Pending |
| Peak observed scene |46,751triangles /71drawcalls |Pending |
| Browser/driver errors |0/0 |Pending |

The1080p run completed its stability duration, but it is **not a clean sustained
60fps profile**. The next measurement uses the existing low-resolution control
at720p to reduce rendering load. Simulation remains fixed at60Hz in both
profiles. A30fps fallback is available but has not been accepted from these
measurements.

Recorded-frame review also found an instrumentation defect: automatic
per-attempt downloads sometimes opened Chrome's download panel over the game,
and preset-button focus could leave part of the stage above the viewport. This
run is retained as diagnostic evidence and does not pass capture readability.
The corrected driver reads telemetry through a synchronous report event,
requests no downloads, scrolls the entire stage into view and rejects any
out-of-viewport sample or unexpected download. A clean1080p capture remains
required after the720p run.

A clean-framing720p diagnostic then ran522.635seconds with zero unexpected
downloads/cropped samples,0.8%OBSrender lag and0.1%encoder lag. It was stopped
deliberately after source review confirmed avoidable deadline drift: a callback
at18ms shifted the old60fps gate enough to skip the healthy33.333ms callback.
The corrected clock retains deadline phase, handles15/30/60fps transitions and
leaves the60Hzsimulation accumulator unchanged. Six new regression cases and
all122unit/14browser tests pass. Final post-fix device measurements are pending;
do not infer their result from the local checks. Updated telemetry excludes
intervals touching paused frames, so comparisons must retain their source version.

The1080p browser's logical window was1280×720, viewport1280×688 atDPR2; actual
game canvas780.445×432CSS pixels and1170×648drawing-buffer pixels. Recording
resolution does not mean the inner game canvas occupied the full frame.

Geometry stays below120,000visible triangles and approximately80drawcalls.
The original shipped art remains1,345,615gzip GLB bytes, below25MB.

## Evidence and remaining gates

- `evidence/obs-1080p-session.json`: sanitized actual receipt, samples,
  per-attempt telemetry, media metadata/hash and OBS counters.
- `evidence/browser/obs-1080p-*.png`: frames extracted from the actual recording.
- Raw recording remains in ignored `.runtime/obs-recordings/`; profiles and
  credentials are excluded from Git.
- First measurement source: `eedfd1e97d37bc18e3c6b67dbcb90b15dfcfd420`.
  Later changes add only the test driver's quality selector and settings help
  text; record the second run's exact checkpoint separately.
- Full720p measurement, real Twitch integration and genuine3host/viewer
  acceptance remain open. Do not describe the entire release as release-ready.
