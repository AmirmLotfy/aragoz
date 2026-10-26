# Content and transport contracts

Executable source of truth: packages/contracts/src/index.ts. Schema version1, mechanic library1.0.0, admitted artkitlocal-kit-v1; legacygreybox-1 recipes retain their shipped fallback. No browser frame requires a model/server response.

RoomStateSchema validates persisted snapshots and HTTP/browser state; ServerMessageSchema validates WebSocket envelopes; PrivateRoomStateSchema and ShowbillSchema validate their private API responses. Room, encounter-event and asset contracts carry schemaVersion1. Missing versions in the initial preview format upgrade to1; an explicit future version is rejected. An authored regression verifies legacy room upgrade and future/corrupt snapshot rejection. The SQL migration version remains a separate database concern.

AssetManifestSchema validates runtime metadata before any GLB import. The build independently checks contract version, original rights/source records, dimensions, sockets/clips, actual embedded geometry/images, compressed budget and recorded engine evidence. A missing or malformed asset uses the separately inspected shipped fallback. An unknown art version or mismatched shell identity cannot start combat.

Recipes are canonical-JSON SHA256 hashed, immutable once committed, and contain exactly two distinct shipped families in left/right slots. Profiles are fixed catalogue identities with exact parameter dictionaries; unknown identifiers, altered parameters, false credit source, duplicate families and invalid hashes are rejected. Models choose profiles; code derives the displayed rule from them.

The six profiles trade warning against speed/coverage/recording length. Each has a required flaw, physical socket, exposure/break rule and bounded recovery. The threat budget is100; all shipped pairs remain within it. Timing/balance values are hypotheses until playtested, and future changes require a mechanic-library revision.

Room revisions gate HTTP mutations. Round codes identify a particular ballot generation and rotate on restart. EventSub metadata IDs deduplicate transport; chat event IDs order equal-timestamp edits. Per-voter replacement is scoped to act/ballot generation. Hard cutoffs reject late delivery even if the viewer saw an older prompt.

Attempt IDs isolate simulation runs. Events have monotonic sequence and simulation tick plus recipe hash. Retransmission is idempotent. Historical stale events cannot change the current attempt. Server checks admission and state consistency; this is not cheat-proof competitive infrastructure.

Host HTTP/WS transport requires authenticated room ownership, CSRF on mutations and origin checks. Public rehearsal is local and isolated. Accepted credits use actual source proposal identity or explicit House identity. A hide-author setting changes presentation, not ownership evidence.
