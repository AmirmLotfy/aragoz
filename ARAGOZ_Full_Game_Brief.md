# ARAGOZ - أراجوز
## Game direction, product brief, art bible, and Codex implementation plan

Prepared for Amir Lotfy | Research checked 25 October 2026
Status: proposed design, not an implemented or tested game.
Working title: not a trademark, domain, or store-name clearance.

> Chat makes the monster. You find the loophole.

## 1. Decision

Do not build the original BOSSFORGE pitch unchanged. Audience-driven combat, editable bosses, and prompt-generated playable games already have competitors. Build ARAGOZ: a browser-native, Egyptian puppet-theatre-inspired action game in which Twitch viewers author a boss's powers AND the weaknesses that make those powers beatable. The streamer wins by exploiting those weaknesses and visibly dismantling the corresponding body parts.

The differentiator is the complete causal chain:

Audience sentence -> understandable power-and-flaw contract -> physical boss module -> readable combat -> visible module failure -> credited audience contribution -> replayable encounter recipe.

Neither a language model nor Egyptian decoration is sufficient differentiation. The game must make the audience's authorship mechanically obvious.

No research can establish that nobody has ever conceived this combination. This document identifies documented overlaps and proposes a specific competitive position, not a world-first or winning guarantee. Competitor research below is based on public product pages and documentation, not hands-on testing.

## 2. Competitive audit

| Product | Documented overlap | Implication for ARAGOZ |
|---|---|---|
| Stream Avatars | Chat-controlled boss battles, custom bosses, editable player classes. [S01, S02] | Bosses and customization are not the novelty. Make live audience authorship, mandatory flaws, and physical dismantling central. |
| Crowd Control | Viewer-triggered effects that change games and streams. [S03] | Do not sell ordinary audience interference as a new genre. The audience should author the encounter, not just trigger an existing effect. |
| Choice Chamber | Chat influences a procedurally generated action game, including enemies, obstacles, and rules. [S04] | Chat changing gameplay already exists. ARAGOZ needs a distinct rule-and-counterplay loop. |
| Streamlabs Stream Boss | Stream interactions reduce a boss health bar; the final contributor becomes the next boss. [S05] | A reactive boss overlay is insufficient. ARAGOZ must be a real skill-based game. |
| Arcade Sandbox | Its first-party page promotes audience-prompted browser games and live revisions. [S06] | The vendor already markets the broad prompt-to-play proposition; its execution was not independently tested here. |
| Puppeteer: No Strings Attached | A theatrical puppet boss-rush game with a publicly available demo; the full game is listed as upcoming on the checked page. [S07] | Puppet theatre and large puppet bosses are also not standalone novelty. Avoid its dark fairytale presentation and freedom-from-strings premise. |

Bossforge is also already used by a game developer/publisher on Steam. Retire that working title. [S08]

### Positioning

Not: an AI boss generator, a donation widget, a Twitch chatbot, an open-ended game generator, or a puppet Soulslike.

Instead: a live, co-authored stage performance where every dangerous rule contains its own defeat condition.

The initial competitive advantage is craft: a coherent art direction, carefully tested rule combinations, exceptionally clear audience attribution, low-friction streamer setup, and reliable live operation. Longer-term defensibility could come from a distinctive mechanic library and community-authored encounters. There is no uncopyable feature in this brief.

## 3. Name and cultural foundation

ARAGOZ derives from Egyptian Al-Aragoz hand puppetry. UNESCO describes a tradition with hidden puppeteers, portable stages, comedy, improvisation, and dynamic audience interaction. It was inscribed in 2018 on the List of Intangible Cultural Heritage in Need of Urgent Safeguarding. [S09]

This is a stronger connection than attaching an ancient deity's name to an unrelated arena game. The audience-performer relationship belongs in the mechanics.

This is an original game inspired by a living performance tradition, not a historically exact simulation. Traditional Aragoz is hand puppetry; any mechanical hinges, rods, or visible control rigs introduced here are fictional design choices, not historical claims. Do not describe the concept as Pharaonic, ancient Egyptian mythology, or UNESCO-endorsed.

Before commercial launch, conduct proper name clearance. A near-spelling gaming developer, ARGOZ, is also publicly listed. [S10] The proposed spelling is ARAGOZ; no domain availability is asserted.

### Tone

Mischievous, theatrical, tactile, surprising, and occasionally ridiculous. Not horror, gore, a preschool game, or a generic fantasy epic. The world should be understandable without knowing Egyptian folklore. Cultural specificity should come through performance, craftsmanship, objects, and visual rhythm, not exposition.

## 4. Product definition

| Item | Specification |
|---|---|
| Genre | Audience-authored action boss theatre |
| Host | One streamer actively controls the hero |
| Audience | Viewers propose and vote through normal Twitch chat |
| Primary platform | Desktop browser; no native installation |
| Visual format | 3D assets on a flat gameplay plane; fixed orthographic theatrical camera |
| Round | Approximately 3-4 minutes, subject to playtesting |
| Complete session | Three acts, approximately 10-12 minutes |
| First audience action | One short chat command, no separate game registration |
| Solo support | Explicitly labelled rehearsal with preset opponents and simulated suggestions |
| Interaction business rule | Free participation; spending does not increase voting power |
| Submission language | English-first demo and instructions; Arabic identity treated accurately |

### Primary user needs

The streamer needs a reliable show segment, immediate control, visible audience involvement, and recovery when integrations fail. The viewer needs a useful contribution without leaving Twitch, a fair chance to influence the encounter, and proof that their contribution mattered. A spectator who never types must still understand the joke and the fight.

### Promise

The viewer can say, "That ridiculous thing happening is the rule I wrote."

The streamer can say, "You made it powerful, but you also gave me the way to beat it."

## 5. World and hero

A travelling puppet theatre has opened its doors to an unruly online crowd. The crowd writes the evening's villains; a small, stubborn stage performer must turn each villain's exaggerated boast against it.

There is no lengthy origin movie. The first show begins with a curtain opening and an audience instruction.

The hero is an original carved-and-clothed figure: readable red cap, chalk-coloured costume, cobalt sash, broad hands, a short wooden stage baton, and an expressive but restrained face. The design should draw from the performance tradition without tracing a particular photographed puppet. Build the hero with simple proportions and a small animation set, not a realistic humanoid with complex fingers, facial rigging, and cloth simulation.

Bosses are absurd constructions made from stage props: painted timber, kettles, fans, drums, slipper-shaped projectiles, mirrors, wheels, cloth panels, and brass fittings. Everyday objects are proposed creative motifs, not claims about particular historical Aragoz stories.

## 6. The core loop

### Phase A - The audience writes a boast

The prompt appears on stream: "Give tonight's villain a power... BUT give it a flaw."

Example command:

`!make charges at you but cannot turn once it starts`

Accept a maximum of one active suggestion per viewer per proposal window. Permit editing by replacing their previous suggestion. Normal conversation is ignored; only explicit game commands enter the authoring pipeline.

### Phase B - The game prepares stage-ready choices

Moderate and normalize a bounded batch of eligible proposals. Convert supported ideas into validated game recipes. Present three readable choices, each with a power, a drawback, a small module illustration, and an author credit.

Unsupported requests are not silently misrepresented. Show a short translation such as: "Teleporting is not in this show yet. We can make a fast, straight charge instead." The host can approve this adaptation or choose a different option.

The model does not invent unimplemented mechanics, execute code, or construct arbitrary meshes. It chooses supported mechanics, constraints, parameters, and parts.

### Phase C - The audience selects the contract

Viewers use `!vote A`, `!vote B`, or `!vote C`. Each Twitch account has one effective vote; the latest valid vote replaces the previous one. Closing and application rules are explicit. A vote arriving after its window cannot change the next round.

Aim for proposal/voting windows of roughly 20-30 seconds, with configurable additional allowance for measured broadcast delay. Exact timings require live tests. Where room-specific round tokens are used, the prompt and command parser must agree on them.

### Phase D - The boss assembles onstage

Preloaded body parts visibly snap into place. The selected power's physical component appears: wheels for charge, a bellows for steam, a mirror for echo. Show the accepted contract in plain language. The assembly animation is a reveal, not a loading screen for asset generation.

### Phase E - The streamer performs the fight

The host moves, strikes, dodges, and uses the arena to trigger flaws. Exploiting a flaw exposes the associated attachment. Striking the exposed attachment breaks the module and removes its ability.

If a fan breaks, wind genuinely stops. If the charge assembly breaks, charging stops. Visual change and gameplay change must occur together.

### Phase F - Encore

The showbill credits the accepted author, the successful loophole, the result, and the resulting boss recipe. A rerun keeps the recipe; a remix replaces one clause. Later releases can share these recipes between channels.

## 7. Signature features

### 7.1 Power-and-flaw contracts

Every offensive capability has a corresponding exploitable condition, a readable tell, and a bounded recovery window. A drawback is part of the executable recipe, not flavour text.

Examples:

| Power | Flaw | Player response | Physical consequence |
|---|---|---|---|
| Straight charge | Direction locks after wind-up; hitting scenery jams the axle | Bait it toward a stage block, then dodge | Axle exposed; breaking it removes the charge |
| Steam cone | Repeated use overheats the kettle | Evade the marked cone until the lid lifts | Strike the exposed valve to disable steam |
| Echo movement | Repeats a recent marked movement with a fixed delay | Lead the copied movement into a bad position | Mirror cracks and the echo ability ends |
| Slipper volley | Projectiles return along a visible route | Reposition so the return route intersects a weak attachment | Attachment staggered; a counter window opens |
| Protective fan | Wind stops when the fan changes direction | Approach during the clearly signalled reversal | Fan hinge can be broken |

The first build needs three fully polished mechanic families, not all five. Additional examples are expansion specifications. Valid pairings are curated. Not every power is allowed to combine with every flaw.

### 7.2 A boss's anatomy is its rulebook

Modules have visible sockets, distinctive shapes, unique tells, and consistent feedback. There are no mystery mechanics hidden behind decorative particle effects. Viewers should identify the dangerous module even with the sound off.

### 7.3 Counterplay changes the rest of the fight

Breaking a module changes the move set and silhouette. The remaining abilities can speed up slightly within the same threat budget, but the game cannot quietly replace a destroyed power with an equally dangerous invisible one.

### 7.4 Audience authorship is credited causally

Credit the author at selection, first activation, and the final showbill. Do not show hundreds of floating usernames. Sanitize display names and allow credits to be hidden. The contribution ledger links each selected proposal to its normalized rule, physical module, and activation/break events.

### 7.5 A reusable show, not disposable generation

A recipe includes the seed, mechanic versions, module choices, parameters, and art-kit version. Sharing recreates an encounter configuration. This is not a claim of frame-perfect cross-device replay. Save actual outcome summaries separately.

## 8. Combat specification

### Camera and stage

Use a fixed, orthographic three-quarter stage view with a shallow, clear gameplay plane. The camera does not rotate. Decorative foreground elements cannot obstruct hazards or the hero. The whole arena remains visible except during brief, non-interactive reveals.

### Controls

WASD or arrow keys move. Primary mouse button strikes. Space dodges. A secondary action is optional only after the base loop feels good; do not require inventory management, weapon swapping, camera control, and parrying in the first build. Controller support follows the same compact input model when tested.

### Hero feedback

Start with five visible health stitches as a tuning hypothesis. Show damage through pose, sound, and a short, bounded feedback effect. Damage invulnerability prevents a single overlapping hit from consuming all health. Remap controls, offer aim assistance where needed, and keep reduced motion separate from game difficulty.

### Boss resolution

The submission build uses two active modules per encounter, selected in two short ballots. The second ballot offers only compatible contracts. A third support/movement module is an expansion, not a release requirement. Each module has a break meter. Ordinary safe attacks provide limited progress; exploiting a flaw provides a much larger opening. This avoids hard-locking a player who misunderstands one clue, without making the flaw irrelevant. Breaking both required modules exposes a short final finishing action.

Keep the two-module fight readable and maintain the complete author-exploit-break loop. Do not add a third module until real playtests establish that it improves the show.

### Fairness rules

Use configurable threat points, not live model judgment. Bound projectile count, speed, wind-up, recovery, overlap, hazard coverage, and offensive frequency. Never schedule two attacks whose combined geometry leaves no accessible escape route in the supported arena states. Basic static rules and automated scenario checks catch obvious conflicts; playtesting is still required and the validator does not mathematically prove every fight fair.

No unavoidable spawn damage, invisible instant attacks, forced camera spins, chat-triggered damage with no tell, or last-second rule rewrites. The player must have a meaningful response to every allowed offensive event.

### Rhythm

Wind-up -> action -> aftermath -> exploitable condition -> counter -> visible break.

A fight must alternate anticipation and release. Constant attacks and constant particles are not excitement.

## 9. The first showcase encounter

### The Teapot Tyrant

A loud, self-important kettle-headed construction on a wheeled stage frame.

The audience selects: "It charges at you, BUT cannot turn after it commits."

A wheel-and-axle assembly attaches. The boss winds up; a crisp, striped route marks its intent. The streamer stands near a fixed wooden stage block, then dodges sideways. The boss hits the block, its axle jams, and its lid pops upward. A brief counter opens. The streamer strikes the exposed axle; a wheel spins away and the charging ability disappears.

The interface then connects the result to the author: "Straight charge - proposed by [viewer]. Axle broken."

The next module uses steam with a different flaw, not the same attack in another colour. A second configuration swaps steam for delayed echo, showing that the engine composes genuinely different encounters.

The marketing video should demonstrate this complete causal chain before explaining the technology.

## 10. Audience design and latency

Chat chooses strategic instructions; the streamer executes real-time movement. Never ask viewers to react to a sub-second dodge or parry window. Twitch's low-latency setting reduces broadcast delay but does not remove it, and viewers can have different playback conditions. [S11]

Allow participation without leaving Twitch. No separate viewer login, wallet, install, paid status, or mandatory channel-points access in the entry. `!help` gives one short instruction, with bot responses rate-limited so the game does not flood normal discussion.

Use per-user and per-round limits, bounded queues, duplicate filtering, and a documented selection policy. A random selection among eligible unique contributors, with recently featured authors deprioritized, is preferable to simply rewarding whoever spams first. Votes are not weighted by donations or subscriptions.

For a quiet channel, fill missing proposal slots with clearly identified House Suggestions. Never invent viewer names or display synthetic audience participation as real. The show must work with three genuine viewers; high-message-volume support is a separate engineering test.

Host controls include pause, close submissions, reject proposal, use preset, skip act, mute game audio, hide author names, and end show. They must be accessible during a live performance without entering a deep settings screen.

## 11. Visual direction

### Art thesis

A miniature Egyptian travelling theatre made from carved wood, painted metal, stitched fabric, and printed paper. Strong silhouettes, deliberate imperfections, stage lighting, and controlled colour. A physical show, not a futuristic dashboard.

Avoid copying the photographs used for cultural research. They are references, not game assets.

### Palette

| Token | Hex | Role |
|---|---|---|
| Canvas | #F2E6CA | Interface ground, cloth, paper |
| Soot | #24231F | Text, outlines, backstage darkness |
| Vermilion | #C74632 | Hero accent and selected emphasis |
| Cobalt ink | #244A9A | Secondary stage fabric and information |
| Ochre | #D5A43B | Brass accents and rewards |

These are proposed production choices, not colours proven to perform better. Limit any single screen to a clear hierarchy rather than making every object equally saturated. Danger is also identified by striped wedges, motion direction, outline, and sound, never colour alone. Do not put light ochre text on canvas.

### Materials and shapes

Use broad, slightly irregular painted surfaces, large readable stitch seams, and restrained wear at functional edges. Avoid high-frequency grunge, random dents, melted seams, photorealistic reflections, unnecessary microgeometry, and inconsistent roughness. The handcrafted effect should be authored rather than produced by adding noise everywhere.

Keep the hero compact, the bosses top-heavy and exaggerated, and attachments distinct. Test silhouettes in monochrome at a phone-sized stream preview. A fully detailed model that fails this test is not ready.

### Lighting

One dominant theatrical key, gentle fill, controlled contact shadows, and a dark proscenium around a readable stage. Gameplay objects must remain legible without bloom. No automatic dramatic depth of field during combat. Avoid expensive volumetrics and reflection effects in the entry.

### Animation

Use expressive anticipation, held poses, short overshoots, and comic recoveries. Puppet rigidity is an intentional language: many attachments can animate with pivots and separate rigid meshes. Continuous fluid simulation is unnecessary. Combat and camera stay smooth; do not confuse puppet timing with low frame rate.

### Typography and graphic language

Use one licensed, highly readable UI family and a separate hand-finished title mark. A condensed family can suit show headings, but never make critical rules condensed beyond readability. Arabic must be shaped and typeset accurately, not generated inside textures. Decorative folk motifs are reserved for curtains, framing, and transitions; the fighting surface remains quiet.

### Reject these directions

Purple/cyan gradients, floating glass cards, neon outlines everywhere, generic gold-and-black fantasy, hieroglyph wallpaper, pyramids as a shortcut for Egypt, tiny ornamental text, glossy plastic characters, emoji UI, random 3D styles, excessive bloom, dashboard bento layouts, and fabricated gameplay in marketing images.

No prompt can guarantee a non-generic result. Every asset must pass the same silhouette, material, palette, motion, and in-engine readability checks.

## 12. UI/UX screens

### 12.1 Front door

The landing screen shows the actual stage and a real playable rehearsal or honest gameplay capture. Two primary actions: Rehearse and Connect Twitch. A compact three-step explanation follows. No pricing grid, fake usage statistics, invented testimonials, or AI model picker.

### 12.2 Host setup

Connection -> visual/audio check -> test chat command -> launch show.

Show channel identity, permission status, input connection, and last received test command. Explain what is requested and allow disconnection. Do not ask for a Twitch password. Separate a broadcaster control session from any read-only display URL.

### 12.3 Backstage control room

One dominant stage preview, an act cue strip, the proposal queue when relevant, and a small persistent safety/control area. Advanced setup lives behind one Settings entry. There is no need for a SaaS analytics dashboard.

### 12.4 Audience proposal screen

Three physical-looking placards, each showing one sentence, a power pictogram, a flaw pictogram, a letter, and a restrained author credit. The timer and accepted command must be visible at ordinary stream size. Avoid paragraphs.

### 12.5 Combat HUD

Hero health upper left, a compact act status upper centre, two or three module symbols near the boss status, and at most one live rule caption. Keep a configurable corner free for the streamer's camera. Credits appear briefly and do not cover attack warnings.

### 12.6 Finale

A showbill assembled from the actual boss state and recorded result: boss name, rules, authors, outcome, and Remix/Encore. The artwork is not regenerated into a misleading cinematic image.

### Accessibility and localization

Readable type, contrast checks, non-colour danger encoding, independent music/SFX controls, subtitles for any speech, reduced flashes, camera-shake slider defaulting low, remappable inputs, and visible focus in menus. English is the first submission interface. Arabic is a genuine later localization with RTL layout and shaping, not a few reversed labels.

### Failure states

Connection interrupted: finish the current fight and pause new audience decisions. Model unavailable: offer a validated House Suggestion. No votes: announce the house selection. Asset error: use an approved fallback module. Invalid recipe: explain that it was not stage-ready and do not spawn it. Host refresh: recover saved show state where safe; never resume into an unexplained damage event.

## 13. Audio

Prioritize original or properly licensed wood knocks, cloth movement, kettle rattles, a short drum motif, and distinct mechanical tells. Music leaves room for the streamer's voice. A boss wind-up should be recognizable without reading a caption.

No continuous AI narrator, voice cloning of real performers, borrowed songs, or vague mystical soundtrack. Egyptian identity is not a generic exotic scale pasted underneath combat. The hackathon can work with one short music loop and excellent sound effects. Record simple prop Foley where practical and keep a rights log.

## 14. Asset production with the available tools

### Tool roles

| Tool | Assigned role | Boundary |
|---|---|---|
| Codex | Game systems, integrations, content validation, tests, asset scripts | No uncontrolled autonomous replacement of the art direction |
| Higgsfield | Concept exploration and coherent reference sheets | Generated video is not evidence of playable gameplay |
| Meshy or Tripo | Initial geometry for selected props and components | Raw output is not automatically a final game asset |
| Blender | Final cleanup, pivots, materials, modular assembly, animation, export | The authoritative source of the final asset kit |
| Higgsfield-Blender bridge | Assist repetitive scene operations available in the user's setup | Not a dependency that players need to install |

Higgsfield documents a Blender integration and an agent bridge. [S12] Treat the user's Codex connectors as development tools, not assumed public runtime services. Its public API has separate billing from website plans. [S13] This design therefore has no live image or 3D generation requirement.

### Pipeline

Approve a small visual target sheet first: hero, one boss, one stage, one interface frame. Generate isolated, neutral-background views of an approved component, not busy dramatic scenes. Compare Meshy and Tripo on the same small test asset, then prefer whichever produces the cleaner usable result for that asset category.

In Blender: normalize scale, orientation, origin, and naming; separate movable parts; repair geometry; reduce unnecessary polygons; set clean pivots; unify the material palette; prepare UVs; bake required textures; animate; export; inspect in the actual engine.

Meshy documents remeshing before subsequent texturing/rigging work. [S14] Its web rigging options and programmatic rigging support are not identical: do not assume a bizarre kettle boss is supported by an API intended for standard humanoid inputs. [S15] Use rigid parts and simple Blender-authored motion for the bosses.

Blender's glTF export supports meshes, materials, custom properties, and supported animation types; unsupported Blender-specific effects require appropriate conversion or baking. [S16] The in-engine import, not a beautiful Blender render, is the acceptance test.

### First-release asset kit

One hero and a compact animation set; one stage; two approved body shells; three mechanic families with their visible attachments; a small set of environmental blocks/props; reusable telegraphs; break effects; and the showbill interface. A third shell and extra moves are stretch content, not blockers.

Prefer roughly 15 well-integrated assets over 100 inconsistent generations.

### Proposed performance budgets

Initial art payload target under 25 MB compressed; approximately 120,000 visible triangles or less; under roughly 80 draw calls in the baseline scene; mostly 1K textures; limited materials; no live cloth simulation; and a quality setting that removes expensive shadows before changing the game rules. These are starting engineering budgets, not vendor limits or measured results.

Target 60 fps at a suitable resolution on the actual host machine while OBS is running. Measure 1080p and 720p. Have a 30 fps presentation fallback if necessary, while retaining consistent simulation timing. Do not advertise performance until measured.

### Asset manifest

Each asset records: id, revision, source/provider, usage-rights note, approved concept, GLB path, material set, dimensions, attach socket, animation names, collider metadata, triangle count, texture budget, and screenshot of the engine acceptance test. Store final assets locally rather than relying on expiring generator download URLs.

## 15. Technical architecture

### Recommended build

Vite + TypeScript, Babylon.js for the stage, and React or lightweight DOM UI for host menus. Keep React out of the per-frame combat update. Babylon supports glTF loading, which fits the Blender export pipeline. [S17]

One persistent Node.js service handles OAuth, Twitch events, rooms, moderation, recipe compilation, and state delivery to the host. A single-instance SQLite database with a persistent volume is adequate for the limited entry. Move to PostgreSQL when multi-instance operation or scale actually requires it.

Serve the static game and API from one deployable container for the simplest initial operational setup, or separate static hosting from the persistent service. A persistent socket listener belongs in a long-running process, not a request handler expected to terminate.

### Responsibility boundaries

The server is authoritative for audience input, vote counts, accepted recipes, phase transitions, and permissions. The host browser runs the local combat simulation for responsive controls. The server records approved results and encounter events, but the initial system is not presented as cheat-proof competitive infrastructure.

The main OBS setup captures the actual game window. Do not require the player to control the full game through an OBS browser-source interaction window. An optional read-only overlay can show audience instructions and results. Avoid running two independent full 3D simulations just to put the game on stream.

### Twitch integration

Use authorized EventSub chat messages rather than scraping. The minimal broadcaster-authorized read flow uses `user:read:chat`; request write access only when needed for bot messages. Confirm the exact authorization flow for the chosen deployment pattern. [S18]

A persistent EventSub WebSocket adapter must handle welcome, subscription creation, keepalives, reconnection, revocation, duplicate deliveries, and token expiration. Twitch documents at-least-once delivery, so message IDs must be deduplicated. [S19]

Do not depend on an approved Extension, subscriber status, paid events, or channel-points features for the core entry.

### Boss compilation

Command -> moderation -> proposal normalization -> supported-rule mapping -> schema validation -> compatibility/threat checks -> host-visible preview -> vote -> immutable encounter recipe.

A schema-constrained model can return structured data, but matching a schema does not establish that a fight is fair or that the interpretation is correct. Validate semantics in application code. [S20]

The model receives only explicit proposals, allowed mechanics, and the current bounded design context. Treat all submitted text as untrusted data. It gets no tools, secrets, executable code, arbitrary URLs, file access, or ability to modify server instructions.

### Conceptual recipe

```
BossRecipe
  id, schema_version, mechanic_library_version, art_kit_version
  room_id, act_id, seed, approved_name
  body_id, material_variant
  modules[]
    slot_id, mechanic_id, flaw_id, approved_parameters
    tell_id, exposure_rule_id, break_rule_id
    source_proposal_id, credited_author_id
  threat_budget, difficulty_preset
  validated_at, status
```

Allowed identifiers refer to shipped implementations. Unknown mechanics, contradictory states, unapproved assets, out-of-range parameters, and missing flaws are rejected. The text description is derived from the accepted recipe, not maintained as a separate account of what the boss supposedly does.

### Timing and resilience

Use a fixed-step simulation with analytic collision shapes on the gameplay plane. Prefer simple capsules, circles, and rectangles to full physical simulation for combat. Cache compiled proposals where appropriate. Limit model work to one bounded selection/compile batch per authoring step, with at most one repair attempt and a deterministic fallback.

If the network drops during combat, continue the accepted fight locally; stop new audience mutations. Do not interrupt a dodge because a cloud service is unavailable.

## 16. Data model and endpoints

### Main entities

Channel owns Shows. A Show contains Acts. An Act contains Proposals, Votes, a committed BossRecipe, and EncounterEvents. A BossRecipe references approved Assets and mechanic definitions. A Result produces a Showbill.

Suggested tables: channels, encrypted_credentials, shows, acts, proposals, votes, boss_recipes, encounter_events, results, assets, moderation_actions.

Use a unique constraint on the combination of act, voting phase, and voter identity. Make accepted recipes immutable once combat begins. Record rejected proposals separately from public credits. Keep raw chat retention minimal and document a deletion process.

### API surface

Authentication start/callback/disconnect; create/resume/end show; open/close authoring phase; moderate proposal; commit recipe; advance act; record encounter event/result; retrieve recipe/showbill; health status; and authenticated room state transport.

Authorize every room action server-side. Read-only display links must not confer host permissions. Rotate or revoke display tokens. Rate-limit authoring and model requests per channel as well as per user. Do not embed OAuth or model credentials in the client bundle, repository, screenshots, or Codex recordings.

## 17. Scope tiers

### Submission-critical

A real Twitch connection; three convincing mechanic families; complete proposal/vote/assembly/fight/break/result loop; one hero; one stage; two boss configurations; moderation; house fallback; recovery from a dropped event connection; readable UI; original/licensed assets; and a real demo capture.

### Valuable only after the core is stable

A third body shell, controller refinement, downloadable showbill, save/load encounter recipes, a second visual stage arrangement using the same kit, and limited per-channel cosmetic configuration.

### Post-hackathon

Cross-channel recipe exchanges, opt-in raid handoffs, a community encounter library, additional mechanics, an optional mobile companion, full Arabic localization, advanced creator tools, accessibility expansions, seasonal theatre kits, and more sophisticated analytics.

### Explicitly excluded

Live generation of arbitrary 3D bosses; an LLM running every combat frame; an MMO economy; online action co-op; open-world exploration; voice cloning; gambling or paid damage; Twitch Extension approval as a prerequisite; elaborate onboarding; subscriptions and billing; and a cinematic trailer that substitutes for functioning gameplay.

## 18. Codex work plan

The official competition window ends November 2, 2026, 2 PM Pacific. Plan submission on November 1 to avoid last-minute risk. The entry needs a functioning Twitch-connected project built with Codex, a repository, a video of at most three minutes, an English-accessible description, and the relevant Codex session ID. Recheck the official pages before submitting. [S21, S22]

All dates below are proposed milestones, not time estimates or promises of completion.

| Date | Gate | Acceptance condition |
|---|---|---|
| Oct 25 | Repository and decisions | Brief, art contract, source log, tool access, and risk list exist; project work recorded in a new Codex thread |
| Oct 26 | Complete greybox + real Twitch input | One proposal/vote changes a playable boss; one flaw is exploitable; no final-art dependency |
| Oct 27 | Rule compiler + distinct configurations | Two configurations behave differently; invalid recipes cannot start a fight |
| Oct 28 | First finished art integrated | One coherent hero/boss/stage combination passes engine and OBS readability tests |
| Oct 29 | Complete show loop | Author attribution, module break, result, encore, moderation, and fallbacks all work |
| Oct 30 | Real-user test | Genuine viewers complete multiple rounds; learnability and boredom problems are recorded |
| Oct 31 | Feature freeze | Fixes, performance, rights audit, reproducibility, and documentation; no major new systems |
| Nov 1 | Submission | Record real gameplay, document Codex use, submit, and verify links/permissions |

### Gate discipline

If the greybox is not enjoyable by Oct 27, improve or simplify it before buying more art generations. If runtime 3D remains unstable, render the approved Blender kit to consistent sprites and preserve the mechanics. If generation calls are unreliable, use the validated mechanical catalog with a disclosed fallback rather than ship a brittle promise of infinite content.

### Suggested work packages

Keep a single integration owner/thread. Separate scoped tasks for combat, Twitch/server, assets, and testing only when their contracts are already defined. Do not let multiple agents independently rewrite the renderer, shared schema, or art style.

Maintain GAME_BRIEF.md, ART_BIBLE.md, CONTENT_SCHEMA.md, TEST_PLAN.md, ASSET_LICENSES.md, and a build journal. Pin dependency versions in the lockfile. Ask Codex to demonstrate each acceptance condition, not merely report that a feature was implemented.

## 19. Testing and acceptance

### Gameplay

A new host understands basic movement and one exploit after a brief tutorial. A viewer can explain how their selected clause changed the boss. Breaking a module always changes both appearance and behaviour. Encounters avoid long untouchable periods and repetitive waiting. A rematch remains interesting without a new model call.

### Technical

Test duplicated, delayed, out-of-order, missing, and revoked Twitch events. Verify one-vote behaviour; wrong-round rejection; message sanitization; channel isolation; host-only actions; token refresh; model timeout; invalid output; asset failure; reconnect; and resume. Run synthetic message-load tests separately from real-user demos and label them accurately.

### Visual

Judge the full scene at actual capture resolution and at a mobile-sized stream preview. Confirm silhouette readability, text legibility, camera safe areas, effect density, and equivalent clarity with sound off. Compare in-engine renders to the approved art targets; do not approve assets from generator thumbnails alone.

### Quantitative targets, not achieved claims

Use these as starting go/no-go thresholds: first viewer participation within 30 seconds of a prompt; most test viewers can identify the selected rule; most first-time hosts can trigger one intended counter within two attempts; no crash across a 30-minute local streaming session; and consistent frame time at the chosen output resolution. Adjust thresholds from observed testing, not to manufacture a favourable report.

### High-priority risks

The greatest risk is not insufficient features. It is an unreadable or boring fight, a weak link between audience text and mechanics, inconsistent art, and an integration that fails during the demo.

## 20. Submission narrative and demo

The competition gives equal weight to innovation, impact, implementation, and design. [S21] Organize the evidence around those categories rather than claiming uniqueness.

A proposed 2:40 demo:

0:00-0:15: Hook and a real incoming viewer proposal.
0:15-0:40: Show the selected power-and-flaw contract and physical assembly.
0:40-1:20: Play the fight; deliberately exploit the flaw; visibly remove the module and ability.
1:20-1:45: Show a materially different valid configuration, not a cosmetic reskin.
1:45-2:05: Show author credit, result, and a fast encore.
2:05-2:25: Show Codex work, validation tests, and the asset pipeline.
2:25-2:40: Show real Twitch setup and a reliable fallback.

Use actual gameplay. A generated video may only be separately labelled concept material; it cannot demonstrate working features. Keep the primary Codex session ID, a reproducible repository, and the final production configuration. Keep credentials out of all recordings.

Suggested description:

"ARAGOZ turns Twitch chat into the writers of a live puppet boss fight. Viewers propose powers with built-in flaws; the game translates supported ideas into a validated, modular encounter. The streamer wins by exploiting those flaws and physically dismantling the audience's creation. Inspired by Egyptian audience-interactive hand puppetry, it makes chat's imagination visible, playable, and creditable."

## 21. Commercial direction after validation

Validate repeat use before building payments. Potential later revenue comes from host-facing theatre kits, private libraries, scheduling tools, or cosmetic customization. Keep audience influence equal and free. Avoid pay-to-win attacks or monetization that encourages spam and makes the performance less enjoyable.

An appropriate first business test is whether a streamer voluntarily schedules ARAGOZ again after trying it, not whether a landing page gets compliments.

## 22. Final instruction for the build

Build the smallest COMPLETE example of audience authorship becoming readable, surprising counterplay. Do not build a large shell around a weak mechanic.

The decisive scene is: a viewer writes a boast; the monster visibly gains that capability; the streamer discovers the attached weakness; a physical component breaks; everyone sees whose idea just backfired.

If that scene works and is entertaining three times in a row, expand. If it does not, more models, more colours, and more features will not fix the concept.

---

## Sources checked

Sources establish the external facts cited above. All game systems, art parameters, budgets, dates in the proposed work plan, and acceptance targets are design recommendations, not facts about an existing ARAGOZ product.

[S01] Stream Avatars - boss command: `https://docs.streamavatars.com/stream-avatars/commands/minigames-and-fun-commands/boss`

[S02] Stream Avatars - minigame settings and custom bosses: `https://docs.streamavatars.com/stream-avatars/application-settings/minigames`

[S03] Crowd Control - product: `https://crowdcontrol.live/`

[S04] Twitch - Choice Chamber description: `https://www.twitch.tv/directory/category/choice-chamber`

[S05] Streamlabs - Stream Boss: `https://streamlabs.com/stream-widgets/stream-boss`

[S06] Arcade Sandbox - games for Twitch/Discord: `https://arcadesandbox.com/blog/make-a-game-for-discord-or-twitch`

[S07] Steam - Puppeteer: No Strings Attached: `https://store.steampowered.com/app/3537960/Puppeteer_No_Strings_Attached/`

[S08] Steam - Bossforge developer: `https://store.steampowered.com/developer/Bossforge`

[S09] UNESCO - Traditional hand puppetry: `https://ich.unesco.org/en/USL/traditional-hand-puppetry-01376`

[S10] Google Play - ARGOZ developer: `https://play.google.com/store/apps/developer?id=ARGOZ`

[S11] Twitch - Low Latency Video: `https://help.twitch.tv/s/article/low-latency-video?language=en_US`

[S12] Higgsfield - Blender integration: `https://higgsfield.ai/plugins/blender`

[S13] Higgsfield - API and separate billing: `https://higgsfield.ai/blog/higgsfield-api`

[S14] Meshy - post-processing sequence: `https://docs.meshy.ai/en/webapp/guides/choosing/post-processing`

[S15] Meshy - web rigging and API rigging: `https://docs.meshy.ai/en/webapp/guides/3d-model/rigging` and `https://docs.meshy.ai/en/api/rigging`

[S16] Blender - glTF exporter: `https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html`

[S17] Babylon.js - glTF importer: `https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF`

[S18] Twitch - authenticating chat: `https://dev.twitch.tv/docs/chat/authenticating/`

[S19] Twitch - handling WebSocket events and duplicate delivery: `https://dev.twitch.tv/docs/eventsub/handling-websocket-events/` and `https://dev.twitch.tv/docs/eventsub/websocket-reference/`

[S20] OpenAI - Structured Outputs: `https://developers.openai.com/api/docs/guides/structured-outputs`

[S21] Devpost - official rules: `https://twitchcon-codex.devpost.com/rules`

[S22] Devpost - requirements: `https://twitchcon-codex.devpost.com/`
