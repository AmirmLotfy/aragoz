# Live pause and upload ordering — 28 October 2026

While recording genuine Twitch play, repeated ordinary Pause/Back onstage actions
exposed a revision race. The play tab sent a periodic encounter upload and a host
Pause independently. Both could use the same revision. If the upload won, Pause
failed while the local simulation stayed paused. If Pause won, the upload showed
“Show changed. Reload before uploading events.” Events remained in the outbox.

Commit `1f4231ee060c285b7e74eb28656542ad28a2b130` routes actions and uploads
through one per-room browser queue. Each operation reads the latest accepted
snapshot when dequeued. Attempt, recipe, controller and terminal-phase fences
remain in place; a completed result cannot receive an obsolete queued Pause.
Local pause still freezes combat immediately while HTTP is pending. A failed
operation does not block later operations or discard queued encounter events.

Root reviewed the bounded specialist changes, then ran these sequentially with
the pinned Node 24.19.0 runtime:

- `npm run typecheck` — passed.
- `npm test -- apps/web/src/room-mutations.test.ts` — 1/1 passed.
- `npm run build:release` — passed; seven admitted assets retained.
- `npm run test:browser -- tests/browser/live.spec.ts` — 3/3 passed in 55.8s.

The new regression holds the first real browser HTTP event upload, presses Pause,
checks that simulation ticks freeze before a server Pause request is sent,
releases the upload, then requires the next-revision Pause and same-attempt
resume with successful ledger advancement. It uses the explicitly labelled
local fixture harness, muted game settings and `--mute-audio`. The other two
live-flow tests also passed against the rebuilt frontend.

These are current source/build and actual local browser/HTTP fixture results,
not fresh genuine multi-channel or human acceptance. The newly restored public
origin serves the build, but no post-fix genuine combat acceptance is claimed.
The real motion captures precede this fix and retain their original outcomes.
No backend authority, simulation rules, credentials, dependencies or paid
services changed.
