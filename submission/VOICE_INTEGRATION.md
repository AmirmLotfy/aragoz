# Supplied narration integrated — 27 October 2026

Received `speech.wav` from the owner and preserved the Desktop original. A byte-identical working copy stays in ignored `.runtime/submission-work/voice/`. The speaker's identity or recording method is not inferred. No voice clone, synthesized replacement, paid speech API or audio-device playback was used.

**27October watchable file (historical local review):** `submission/local-review/aragoz-narrated-review.mp4`. Matching captions: `submission/local-review/aragoz-narrated-en.srt`. The folder is deliberately ignored until publication review; the voice-bearing export is not in the private repository or any external service. The earlier `video/aragoz-review-160s.mp4` remains the reproducible voice-free prototype.

## Integration and checks

- Supplied audio:130.960272seconds,22,050Hz mono/16-bitPCM. Its original bytes remain unchanged. Nine near-full-scale samples were found in the source, with no run longer than2samples; no claim is made to recover already clipped information.
- Final picture:160seconds,1920×1080/30fps; original-speed gameplay. Narration split at nine detected silent boundaries, with ten sections and no speech time-stretch. Two initial ASR-boundary estimates were moved into actual silence before final export. A3.972second silent beat lets the steam action finish before echo narration starts on its scene.
- Captions:33retimed cues, retaining the supplied script's spelling. Timing used local Whisper.cpp/tiny.en estimates;93.93%of normalized tokens matched exactly, with mostly proper-name/spelling/phonetic substitutions. A separate local base.en check confirmed **“60 fixed steps a second”** after tiny.en misread it. These are bounded machine-assisted checks, not human word-level certification.
- Sound: gentle70Hz high-pass/10kHz low-pass, measured loudness normalization, quiet original editorial bed ducked under narration, peak limiter. Final encoded measurement **−16.11LUFS integrated / −3.82dBTP /6.2LU loudness range**. Resampled to48kHz stereoAAC for the video; this does not claim additional source detail.
- Full final media decode passed without errors.4800video frames, source-copy hashes, caption order/ranges, timeline duration and sampled encoded picture are recorded in the ignored voice-mix/QA receipts. No source game/server/dependency behaviour changed and no gameplay/provider/human test was fabricated by editing.

Local tooling: official Homebrew Whisper.cpp1.9.5 and dependencies were installed without auto-update/cleanup; recognition ran on CPU. Audio was never sent to an API. Task-downloaded tiny/base model weights were retired after recognition and no-open-handle checks, preserving hashes/download URLs, original audio and transcripts. This recovered215.21MiB when available storage tightened; no unrelated project cleanup or actualENOSPC occurred. These offline speech models are separate from ARAGOZ's runtime, whose model calls remain off.

Editable source: source/build_voice_cut.py and source/build_video.py. Voice inputs, timing transcript, source WAV, normalized WAV and voice-bearing movies remain local/ignored. Rights/source categories from MEDIA_MANIFEST.json still apply: actual Twitch stills, separate original OBS House motion, and clearly labelled editorial build notes.

## Remaining final-publication actions

The supplied narration is integrated; do not request another recording by default. Continuous actual Twitch motion and actual Codex-workflow footage still need to replace provisional still/editorial sections when capture control works. Devpost authentication/live fields/eligibility/session confirmation, verified private-repository judge access, final video-upload approval and final entry approval remain. No project has been entered and no voice-bearing recording has been externally uploaded. Genuine host/viewer acceptance remains a separate release gate.

##28October publication update

Actual Twitch motion and actual GitHub source/commit review now replace the
provisional picture segments in the160-second final master pair. Their AAC packet
hashes match the reviewed narration above unchanged. Identities and full decode
evidence are in evidence/submission-media-20261028.json. The owner explicitly
approved public upload, including the supplied narration, and YouTube's uploader
terms acknowledgement. Captioned movie: https://youtu.be/ej-SDyRD6tE ; English
SRT saved. The clean master, original WAV, transcripts and raw recordings remain
ignored/local. Devpost video URL is saved(Draft3/5); owner will complete eligibility
manually, and final entry remains untouched. Earlier status paragraphs retain
their27October context. No new voice recording or paid audio/model API was used.
