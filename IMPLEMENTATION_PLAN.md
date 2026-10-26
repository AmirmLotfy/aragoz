# Accepted implementation plan — 25 October 2026

26October operational override: owner approved private AmirmLotfy/aragoz publication and prohibited all spending. The paid Render proposal is archived and unapproved. Use the existing Mac with durable SQLite and a free temporary HTTPS tunnel for technical preview; no model/Meshy calls or automatic billable CI. Full gameplay and human acceptance scope is retained.

Steering26October2026: user explicitly superseded blanket storage/external-gate stalls. The historical10GiB threshold below is replaced with bounded per-job estimates and a small working reserve. Execute the full first release across frontend/backend/gameplay/assets/QA, with one heavyjob at a time. Preserve unrelated files and never fabricate provider/hosted/human evidence. Paid actions retain concrete cost/access reviews while independent implementation proceeds.

The user authorized the complete first release and prioritized quality over the competition date. ARAGOZ_Full_Game_Brief.md remains the product/art source. This record captures the implementation choices accepted in chat.

## Fixed release

One hero, one stage, two shells (Teapot Tyrant and Mirror Braggart), three families (charge, steam, delayed echo), two different modules per encounter, three acts, two ballots per act, physical breaks, causal author credit, tutorial, rehearsal, outcomes, Encore and one-slot Remix. Invited broadcasters; public local rehearsal. Moderation, accessibility, House fallbacks, recovery, and a reproducible single-container build are required. Hosted technical preview precedes human acceptance. Post-hackathon features and competition submission are separate.

## Architecture

Vite/TypeScript/Babylon.js with React menus; pure fixed-60Hz combat package. Node24/Fastify/WebSockets and single-instance SQLite. Server owns identity, proposals/votes/phase timing and immutable recipes; local browser owns responsive combat. One active show/channel, explicit controlling-client takeover, maximum three active pilot shows. Shared versioned schemas and shipped six-profile catalogue are coordinator-owned.

OAuth authorization-code flow, broadcaster-owned EventSub WebSocket chat, read scope by default, opt-in write scope for throttled help; Shared Chat unsupported. Validate/refresh credentials, encrypt tokens, check origins and CSRF, isolate channels and deduplicate deliveries. Lost chat is not replayed: invalidate interrupted authoring; finish committed fights locally. Refresh produces a safely paused new attempt. Offline events are idempotent and cannot advance ended/stale attempts.

OpenAI Responses gpt-6-luna strict structured mapping; explicit proposals only, no names/unrelated chat/tools. Maximum12 sampled proposals, one repair inside12seconds. Moderation before public presentation, deterministic semantic checks, visible host-approved adaptations and labelled House fallback. No generated arbitrary mechanics or parameters. Daily request allowance defaults0.

25second proposal and20second vote windows, configurable pre-window delay allowance, server cutoff. Round-coded commands `!make K7 … but …`/`!vote K7 A`; fresh code each ballot/restart. Latest valid message wins by timestamp/message-ID. Eligible-contributor sampling with recently featured authors deprioritized. Three mechanically distinct family/profile candidates; ballot2 excludes chosen family.

## Presentation and asset gates

Follow ART_BIBLE.md. Built-in image generation creates one concept target sheet for approval. Meshy selectively supplies approved shells; Blender supplies authoritative final geometry, pivots, sockets, materials and animation. Preview concepts are not gameplay or approved final assets. Capture only the public play window. Private backstage has proposal moderation and a low-rate bitmap preview, no second3D simulation. Arabic is typeset correctly; English UI is first.

## Acceptance and operations

Gate1 foundation; gate2 real Twitch causal chain; gate3 complete show/mechanics; gate4 finished approved presentation; gate5 hosted technical preview; gate6 human acceptance. Keep pending gates pending if external evidence is absent. Three first-time hosts, at least three real viewers/session; count actual counter attempts and comprehension. Thirty-minute OBS check on actual M1 host at1080p/720p;60fps target,30fps presentation fallback with60Hzsimulation. Art targets25MB compressed/120ktriangles/about80drawcalls.

Use bounded per-job estimates under the26October user override. No unrelated cleanup. Render single paid Node service plus1GB persistent SQLite disk; prepare exact cost review before provisioning. Review quoted Meshy batches before spending. Record costs and configuration without secrets. Keep this chat integration owner and maintain durable handoffs.


## 27 October owner-directed account-free continuation

The owner explicitly deferred Twitch while SMS fails, asked to continue the complete game without it, and retained the Twitch app task as pending. Add `/house-show` beside `/rehearse`: a finite three-act solo show with two curated House contract choices per act, physical assembly/combat, distinct outcomes, immutable Encore, one-slot Remix and a cumulative downloadable showbill. House authorship is explicit; no simulated ballots, viewers or provider success.

Versioned browser storage retains recipes/results. Refreshing an unfinished fight records abandonment and prepares the same recipe with a new paused attempt. Another window requires explicit takeover. Invalid saves require explicit replacement; unavailable storage permits memory-only play with a visible warning. These local records never advance a server-owned Twitch show. The original real Twitch causal-chain and genuine human acceptance gates remain pending, and all spending stays prohibited.
