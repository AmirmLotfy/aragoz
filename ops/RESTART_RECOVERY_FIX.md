# Restart recovery: preserve the unused replacement attempt

28 October 2026. Parent source checkpoint623f4bc. A bounded source audit found
that one server interruption could create two abandoned results. Recovery retired
the actual running fight and prepared a new unowned paused attempt. The public
recovery button then requested explicit takeover, which retired that unused
replacement too. Another server restart before claiming it had the same effect.

The server now recognizes an unowned, paused combat replacement with sequence0.
Repeated recovery preserves it; the first controller claims that same ID. A real
owned/running attempt still requires explicit takeover, which records abandonment
and creates a fresh paused sequence. Recipe hashes and old-controller/event fences
remain unchanged. No persisted historical result was rewritten or removed.

## Verification

- A new server regression failed before the fix: repeated recovery changed the
  replacement ID. It now verifies one abandoned result across two recoveries and
  first claim, then resumes/uploads the new sequence and rejects the old client.
- Server file35/35; complete unit/server suite173/173 across15files; typecheck and
  admitted release build passed. Seven asset payloads retain their admitted hashes.
- Full browser run:29 existing cases passed; the new case initially failed its
  default5-second control wait while asset loading/seating was incomplete. It now
  waits for actual presentation readiness and explicitly pauses after resuming.
  All4affected live browser cases passed in about65seconds. The fixture harness
  permits zero provider requests; all browser audio is muted. This is not a claim
  of one fresh30/30full-suite run or real provider/browser acceptance.
- Isolated restore of genuine persisted channel/session/recipe/results passed
  43actual localhost HTTP checks, including repeated recovery, first claim,
  old-client rejection and the new sequence. Provider calls/sockets, live HTTP
  mutations and newly minted authenticated sessions were0. Original live data
  fingerprints stayed unchanged. Historical27October receipt is preserved;
  verifier now refuses an existing receipt destination.

Receipts: evidence/restored-controller-recovery-20261028.json and
 evidence/goal-browser-output-20261028.json. Dated browser snapshots preserve new
outputs while historical paths retain their parent-commit bytes. Human acceptance,
real server-issued EventSub handover/revocation and genuine multichannel cases
remain separate. Current live preview deployment is verified in subsequent
checkpoint evidence, not assumed from these local checks.
