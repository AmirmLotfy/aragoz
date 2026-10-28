# 28 October hosted recovery and offline feedback

The real hosted operator test found stale “Failed to fetch” feedback after a second window took control. LivePlay now resets attempt-scoped errors on replacement, ignores late failures from previous attempts, and distinguishes queued current progress from retained historical progress. Historical events are retained, not silently deleted or applied to the new fight.

## Verification

- Typecheck and admitted release build passed for the UI change.
- Complete muted browser suite: **31/31 passed in 3.6 minutes**, exec98801. Fresh artifacts and source scope: [receipt](../evidence/browser/release-audit-final-20261028/receipt.json).
- The new fixture regression aborts actual browser event uploads, transfers control through the authenticated HTTP handler and checks rendered historical progress, cleared stale error, paused replacement and zero replacement sequence. It does not claim two simultaneous headless WebGL contexts passed; that initial variant stalled on second-context admission and was narrowed to the actual feedback regression.
- Separate genuine hosted two-window test: one actual broadcaster account, ordinary controls, tab-scoped network failure (five observed disconnected Fetch errors), explicit second-window takeover, network restored, one old event retained, zero current pending statuses and zero stale errors after reload. [Receipt](../evidence/twitch-goal-client-network-20261028.json).
- Two real backend restarts retired the owned attempt exactly once, retained the unplayed replacement on the next restart and reused that same replacement on first claim. Recipe and other accepted results were unchanged. [Receipt](../evidence/twitch-goal-repeated-recovery-20261028.json).
- Real authoring restart invalidated its ballot; a fresh D47A90 proposal and one actual vote selected the broadcaster’s charge. Second attachment was explicitly House steam. Operator show8d412f68-63ce-4830-87b9-76f203b568f3 ended with abandoned attempts, not a fabricated victory.

These are single-account agent-operated provider/hosted checks. Human acceptance, genuine simultaneous channels, Twitch-issued reconnect handover and revocation remain unproven. Earlier accepted-win, OBS and container receipts retain their original source bounds.

## Container refresh attempt

An isolated task-owned Colima profile failed during vendor-image preparation under observed disk pressure (117MiB remaining). No current-source Docker build or smoke test ran. The stopped failed profile was removed after checking ownership and open handles; unrelated running infrastructure was untouched. Compressed image332MB expands to approximately3.5GiB, so the previous estimate was insufficient. Retry only with corrected batch headroom. Historical Linux receipts are not current-source acceptance.

Final post-restart continuity: fresh actual `!aragoz D6EDC7` appeared in Twitch chat and setup confirmed received at03:10:58Cairo. [Rendered proof](../evidence/twitch-goal-final-chat-20261028.jpg). No new scope or show was needed.
