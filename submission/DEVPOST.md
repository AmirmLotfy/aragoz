# ARAGOZ — field-ready project story

Local draft,27October2026. Nothing has been sent to Devpost. Public rules/web research is in RESEARCH.md; authenticated form fields remain unverified because the connector requires reauthentication. The labels below follow common Devpost story sections, not an assertion about this event's live form.

**Project name:** ARAGOZ

**Tagline:** Chat makes the monster. You find the loophole.

**Short description:** A Twitch audience authors a boss's power AND its flaw. The streamer turns that flaw against it, breaks the physical module, and removes the ability—with the author credited onstage.

**Built with:** OpenAI Codex, TypeScript, Babylon.js, React, Vite, Node.js24, Fastify, WebSockets, SQLite, Twitch API, EventSub, Blender, glTF/GLB, Vitest, Playwright, FFmpeg.

## Inspiration

Live chat can be a wonderful writer's room. We wanted its contribution to survive longer than a poll result or a momentary distraction.

ARAGOZ takes inspiration from Egyptian Al-Aragoz hand puppetry and its relationship between audience and performer. Our original miniature theatre turns that relationship into a rule: every boast needs a **BUT**. The crowd gives a ridiculous villain its power and the weakness the performer can use to defeat it.

## What it does

A viewer submits a round-coded command such as `!make CODE charges at you BUT cannot turn once it starts`. The host reviews supported contracts, chat votes, and the selected rule becomes a visible attachment on the boss.

The charge has wheels—and a commitment problem. Once it locks direction, the performer can bait it into a striped stage block. The impact exposes its axle. Strike the opening, break the assembly, and charging stops. The same author is credited when the rule is chosen, when it activates, when it breaks, and in the showbill.

Steam and delayed echo create different puzzles. Steam overheats after its burst sequence and exposes its valve. Echo records the performer's movement, previews a translated route, then follows it; a stage-block collision exposes the mirror. Each encounter combines two different modules across two original boss shells.

A show has three acts. Encore keeps the immutable recipe; Remix replaces one module. Clearly labelled House Suggestions keep quiet channels playable, while account-free rehearsal and a complete solo House show let people learn the counterplay immediately.

## How we built it with Codex

Codex helped turn the creative brief into the shared contracts, fixed-step combat, Twitch/server integration, original asset scripts, browser interface and validation. The work included concrete debugging: making a module break cancel damage in the same simulation step, protecting counter windows, preventing stale attempts from advancing a show, bounding proposal-compiler timeouts, and recovering an authenticated Twitch connection after a server restart.

Babylon.js renders locally packaged Blender GLBs. A pure TypeScript simulation advances at60Hz independently of React, rendering speed or network requests. Fastify, WebSockets and SQLite own broadcaster permissions, proposals, voting, deadlines and immutable recipes. The browser owns responsive movement and combat, with queued encounter events during a connection gap.

This preview's live proposal path matches a strict supported grammar to six authored profiles. **Runtime generative-model calls are disabled.** An optional structured mapping/moderation path exists in source and has mocked tests, but has not been verified with real model calls. Codex-assisted development is separate from the game's runtime behaviour.

## Challenges

The difficult part was making authorship visible and executable. A drawback cannot be decorative text: it has to create a reachable opening, and a broken part has to remove both its geometry and its damage. Multiple modules also need time to finish their tells, hazards and promised counter windows without competing for the stage.

Live operation adds another kind of timing problem. Commands need fresh round codes, hard deadlines, replacement votes and duplicate protection. Interrupted authoring must restart honestly; a committed fight should remain responsive. We built separate recovery rules for those two moments.

## Accomplishments

One genuine Twitch broadcaster account submitted a proposal and a vote, produced a credited charge module, and completed an accepted encounter with both modules broken. The same author appeared through selection, activation, break and result. The account and gameplay were agent-operated for this technical test; they are not a claim of genuine viewer acceptance.

The implementation also has171unit/server checks, a28-case full browser pass, original Blender sources and rights records, and measured30-minute M1/OBS capture evidence. The measured1080p30presentation profile keeps the60Hzsimulation unchanged. Exact sources, dates and limitations accompany those receipts in the repository.

## What we learned

A useful creative constraint can make participation more interesting: asking for the weakness gives the streamer a response and the audience a payoff. We also learned to keep presentation and evidence separate. A clear House label, a named author and a visible missing wheel communicate more than a claim of unlimited generation.

## What's next

The next release gate is genuine broadcaster/viewer testing: whether first-time hosts discover the counters and viewers understand what their rule changed. Remaining real-provider lifecycle and multichannel cases are tracked separately. Full Arabic localization and additional mechanics come after that validation.

## Links and form values — confirm before pasting

- Repository: https://github.com/AmirmLotfy/aragoz — **private; judge access not yet established**.
- Demo candidate: https://klein-wake-circle-favor.trycloudflare.com/house-show — temporary Mac-hosted preview; recheck at publication. House play needs no account; invited Twitch hosting is separate.
- Video: **owner VO integrated locally; pending final capture checks, upload and accessible YouTube URL**. Local review cut: video/aragoz-review-160s.mp4.
- Thumbnail: artwork/aragoz-devpost-3x2.png. Generated original promotional key art, not gameplay.
- Gallery: screenshots/01–05, unchanged actual screenshots; captions in MEDIA_MANIFEST.json.
- Candidate primary Codex session: `01a1746e-5b94-7b10-87dc-0f66a72f2e0f` (project build context25–27October2026). **Owner confirmation still pending; do not silently attest it is the required primary session.**
- Entrant eligibility, rule agreement and any authenticated custom questions: owner/account step pending. Do not register, grant access or make a legal attestation from this document alone.
