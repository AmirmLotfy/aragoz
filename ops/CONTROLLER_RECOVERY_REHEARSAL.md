# Controller and offline-upload recovery rehearsal

Checked27October2026 against unchanged application source; packet base84c387656c734e39b166e32b3d36ae775c973397. This is **isolated localhost HTTP verification with genuine persisted ARAGOZ data**. It is not new Twitch transport, public two-window gameplay or human acceptance.

The verifier made an online private backup of the current public SQLite database, opened a separate localhost application with background work disabled, and reused an existing unexpired OAuth-linked ARAGOZ session only inside that restore. It did not mint an authenticated identity, extract browser credentials, or act on the live HTTP service. Matching encryption configuration stayed private. Provider fetch/socket factories reject any attempted call.

## Result

**36/36 checks pass.** Source: scripts/verify-restored-controller.mjs. Sanitized receipt: evidence/restored-controller-recovery-20261027.json. Private restored data stays under ignored data/public-preview/controller-recovery-* with private permissions. Keep these intentionally test-mutated copies separate from production restore inputs.

- The real persisted channel/session, immutable recipe, accepted win and ledger remain usable after restore.
- Ended-show events and control claims are rejected. Stale room revisions cannot restart the encounter.
- Encore retains the exact recipe and genuine result. A second client needs explicit takeover; a non-controller cannot start combat.
- A valid controller's simulation event is accepted through actual localhost HTTP. Exact retries remain idempotent even with the previous revision; conflicting retries cannot rewrite the ledger.
- Explicit takeover records abandonment of the previous attempt and creates a fresh paused attempt owned by the new client.
- Old exact duplicates acknowledge without changing the new attempt. New queued events from the old controller/attempt are rejected, including an old attempt presented with the new controller ID.
- A fresh event sequence is accepted only from its controlling client with the current revision. Paused attempts reject queued events; after resume the owner can continue the exact sequence.
- Ended attempts reject subsequent offline uploads. Anonymous uploads are denied. The original real win remains byte-identical in the restored result history.
- Original live show/recipe/result/event rows retain their complete pre-test fingerprint:1show,1recipe,1result,17events. Live HTTP mutations0; provider requests0; provider sockets0; newly minted authenticated sessions0.

Event probes came from the pure TypeScript simulation using the restored recipe and new isolated attempt IDs. They are deliberately separate from actual browser gameplay. No synthetic win or viewer was added to the real show.

## What this closes and what remains

The server's controller/revision/attempt fences now have actual HTTP evidence on a restore of the genuine configured account data, in addition to earlier fixtures. This reduces the restored-data recovery uncertainty within B03. It does not close public-hosted two-window takeover, genuine simultaneous channels, real EventSub handover/revocation/gap cases or human acceptance. No application defect was found and no app/backend/contracts/dependency source changed.

The browser-control tool still reports disabled despite the owner's confirmation; treat that as a tool/settings mismatch. The Devpost connector still requires reauthentication. Neither access restriction was bypassed to run this own-server isolation test. No paid call, upload, account grant, provider revocation or live database replacement occurred.
