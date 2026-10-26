# Account-free House show — reference lock

27 October 2026. Owner direction: continue without Twitch while retaining the optional Twitch app/integration task. This adds a complete three-act solo path; it does not remove or simulate Twitch.

Design a desktop-browser House show for a player who wants the full choose/build/exploit/break/results loop without signing in. Keep the approved tactile theatre, real stage geometry, readable power-and-flaw contracts and accessible menus. Primary risk: a rehearsal that never concludes or loses its results on refresh.

## References and synthesis

The existing approved ARAGOZ stage, palette, Noto typography, placards and showbill are the primary visual source. Live Refero research reviewed A24 style `dcd6c9d5-0fed-4506-abe1-cc2c45dd2831` and Playdate style `c91209ef-f7f3-4d2b-bf69-41b58e4e2cc2`, plus Lovable plan-review flow12337.

- A24: use typographic billing hierarchy and clear rectangular divisions for the cumulative showbill. Do not adopt its branding, proprietary fonts or monochrome palette.
- Playdate: retain one-family hierarchy and clear, tactile choices. Do not import its yellow/violet, pill CTA or product imagery.
- Review flow12337: retain the chosen rule while reviewing the next choice; finish with explicit commitment and clear completion feedback. No chat/editor imitation.

## Decision ledger

| Decision | Source | Role and reason |
|---|---|---|
| Existing parchment, ink, vermilion and cobalt roles | Approved brief and current CSS | Extend the shipped theatre rather than inventing a new visual identity |
| Three contract placards, no vote counts | Existing Placards; owner's Twitch-free direction | Pick shipped House contracts without pretending viewers participated |
| Retain first selected rule during the second choice | Existing live authoring; review flow12337 | Make incompatibility rules understandable before committing |
| Act I/II/III progress and finite closing showbill | Accepted three-act plan; A24 billing hierarchy | The show ends after act3 and retains every attempt/contract |
| Same stage/physical assembly/comfort settings | Approved stage and GameCanvas assembly | One 3D simulation, exact socket seating before combat |
| Explicit resume/takeover and paused restart after refresh | Accepted recovery requirements | Preserve recipes/history without restoring an uncontrolled fight |
| Visible browser-save warning and memory fallback | Local-only ownership constraint | Storage failure must not block play or promise recovery |

## Fixed scope

Separate `/house-show` route, linked from the front door and setup. Keep `/rehearse` and its existing tests unchanged. Each act has two local contract choices from the shipped six-profile catalogue, then assembly, combat and results. Exactly two different mechanic families per encounter. Encore preserves the committed recipe; Remix replaces exactly one selected socket and retains its opposite. All authorship remains House Suggestion; there are no fake proposals, viewer counts or votes.

Client-only versioned storage and history. No new unauthenticated server mutation route, private-room bypass, Twitch/model connection or paid call. A second window requires explicit local takeover; a refreshed unfinished fight becomes an abandoned attempt plus a fresh paused attempt. Keyboard focus, reduced motion, mute/pause, viewport fit and existing art budgets remain part of browser validation.
