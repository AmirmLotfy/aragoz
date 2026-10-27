# Submission research — Codex x TwitchCon

Checked 27 October 2026 (Africa/Cairo). Public web research only; no account, sharing, upload, submission or payment action was taken. Read `AGENTS.md`, `CURRENT_HANDOFF.md` and `ARAGOZ_Full_Game_Brief.md`. This report separates published requirements, inconsistencies and our recommendations. It does not certify entrant eligibility or contest acceptance.

## Official requirements

| Item | Verified requirement and practical consequence |
| --- | --- |
| Deliverables | Repository URL, project description explaining functionality and Codex use, demonstration video, and primary build-thread Codex session ID. |
| Repository | GitHub/GitLab/Bitbucket; include source, assets and runnable instructions. Private repositories must use GitHub/GitLab and be shared with the listed judging contact. |
| Video | YouTube; show functioning Twitch integration and how Codex built the project. Overview says maximum three minutes; target **2:40–2:50**. |
| Twitch relationship | An interactive project connected to Twitch and built using Codex. |
| Criteria | Innovation, streamer/community impact, technological implementation including Codex use, and design including usability/watchability. |

Source: [official overview](https://twitchcon-codex.devpost.com/), accessed 2026-10-27.

Rules require **under three minutes**, English/translation, functionality matching the demo, and new work from **23 October–2 November 2026**. Libraries/templates/AI assistants are allowed; third-party rights must be respected. [Official rules §4](https://twitchcon-codex.devpost.com/rules), accessed 2026-10-27.

Eligible individuals/teams must meet the higher of 18/local majority; organizations are excluded. Residency, sanctions, sponsor relationships and conflicts restrict eligibility; see the complete list. Egypt is not explicitly named, which alone does not establish eligibility. [Official rules §3](https://twitchcon-codex.devpost.com/rules), accessed 2026-10-27.

Working-project testing must remain free and unrestricted through judging; repository access is the specified route. Permanent hosting is not explicitly mandated. Judges may use media alone. Four equal criteria follow a viability/theme/tools pass. Post-deadline alterations have narrow exceptions. [Official rules §§4–6](https://twitchcon-codex.devpost.com/rules), accessed 2026-10-27.

## Dates and conflicting official text

- **Submission deadline:** overview and schedule explicitly show **2 November 2026, 14:00 PST**. The rules say 14:00 Pacific. Conversion using `America/Los_Angeles` and `Africa/Cairo`: **22:00 UTC, 2 November = 00:00 Cairo, 3 November**. [Overview](https://twitchcon-codex.devpost.com/), [schedule](https://twitchcon-codex.devpost.com/details/dates), accessed 2026-10-27.
- **Conflict:** the FAQ says 21:00 UTC, one hour earlier. Do not silently copy that conversion; treat **1 November Cairo** as the internal delivery target and verify the live countdown before the final action. [FAQ, deadline question](https://twitchcon-codex.devpost.com/resources), accessed 2026-10-27.
- **Judging conflict:** rules §1 and FAQ say **5 November 09:00 Pacific–15 November 17:00 Pacific**; schedule displays **3 November 09:00 PST–6 November 17:00 PST**. Preserve access until the later rules endpoint: **16 November 03:00 Cairo**. This is a conservative recommendation, not an organizer clarification. [Rules](https://twitchcon-codex.devpost.com/rules), [FAQ](https://twitchcon-codex.devpost.com/resources), [schedule](https://twitchcon-codex.devpost.com/details/dates), accessed 2026-10-27.

## FAQ clarifications and remaining form unknowns

The FAQ explicitly allows **unlisted YouTube**, rejects private videos, says TwitchCon attendance is unnecessary, and directs entrants with several Codex threads to submit the session ID where most work happened. It says never commit API keys and warns that a saved draft is not submitted: the project must display **Submitted**. It also asks entrants to leave repositories/videos/linked materials unchanged until winners are announced. [Official FAQ](https://twitchcon-codex.devpost.com/resources), accessed 2026-10-27.

**Thumbnail:** generic Devpost guidance specifies JPG/PNG/GIF, maximum 5 MB, recommended **3:2**. That page also lists name, tagline, story, technology tags and optional/supporting gallery images; hackathon-specific additional fields vary. Use an actual gameplay frame with a legible power/flaw and visible broken module. The image recommendation is ours; exact event form fields were not inspected. [Devpost submission help](https://help.devpost.com/article/126-know-your-submission-steps), accessed 2026-10-27.

**AI disclosure:** no separate generated-media/model-disclosure field or runtime-model requirement was found in the public rules/overview/FAQ. They do require explaining and demonstrating Codex use. This is a bounded observation, not proof that the authenticated form has no additional questions. Our disclosure should say: **Codex assisted development; live proposals use a supported authored grammar/catalogue; combat is deterministic; runtime model calls are disabled.** Any generated asset provenance belongs in the rights/asset record. Do not imply arbitrary text-to-mechanics or live generative AI.

**Judge contact:** public text extraction substitutes `[email protected]` for the private-repository contact; its link resolved to a broken Cloudflare email-protection path. Direct unauthenticated HTML retrieval returned HTTP403. Do not invent an address or claim judge access. Read the actual address from the ordinary official page and verify repository access before submitting.

**Access plan inference:** a documented local run path plus clear account-free House rehearsal can complement the actual Twitch demo. Label House content explicitly. The temporary tunnel depends on this Mac/network and cannot establish continuous judging availability. If offered, describe its limitations and retain the runnable repository path. Never put credentials, OAuth tokens, private database backups or keys in the submission.

## Genuine winning-entry precedents

These are **2024 Twitch Streamer Tools Hackathon winners**, independently identified in the organizer's [winner announcement](https://twitchstreamertools.devpost.com/updates/33853-streamer-tools-hackathon-2024-winners-and-runner-ups) and their project pages, all accessed 2026-10-27. Their awards do not establish why judges selected them or predict ARAGOZ's result. The projects were reviewed through published pages; their videos were not watched and their current products were not tested.

| Verified winner | Published project evidence | Concrete ARAGOZ demo lesson — our inference |
| --- | --- | --- |
| **PixelWars — Interactive Community Experiences** | Viewers send named animated characters into audience battles; the submission explains free and Bits-powered participation, setup and architecture. [Project](https://devpost.com/software/bitwars) | Put real authorship on screen: incoming command → credited choice → corresponding boss module → visible consequence. Keep one continuous causal sequence. Preserve ARAGOZ's free, equal voting; winning precedent does not justify adding paid influence. |
| **Stream Together Timeline — Streamer-to-Streamer Collaboration** | Automatically preserves collaboration participants/clips in a timeline accessible through a Twitch panel or hosted page. The story begins with a concrete streamer/community memory problem. [Project](https://devpost.com/software/stream-together-timeline) | Open with one community need and show the result people keep: ARAGOZ's credited showbill/recipe after the fight. Explain setup in a few seconds, then show the benefit. |
| **tcghud by Tangia — Enhancing Stream Appearance** | Describes card detection → information drawer → synchronized OBS/browser-source overlay, and candidly documents lighting/language/mobile constraints. [Project](https://devpost.com/software/tcghud-by-tangia) | Show an observable input/output chain and a short architecture view tied to that chain. State the supported catalogue and runtime-model limitation plainly; evidence and a bounded limitation are stronger than broad AI claims. |

## Proposed evidence-led demo decisions

These are editorial recommendations derived from the current criteria and precedents, not official requirements or observed winning-video patterns.

1. Start with **“Chat makes the monster. You find the loophole.”** Within 15 seconds, show an actual received Twitch command alongside its supported power-and-flaw contract.
2. Spend the largest segment on a real fight: assembly, readable tell, player exploiting the flaw, physical module break, and the ability staying disabled. Keep author credit legible throughout the payoff.
3. Show a brief second configuration only if it demonstrates a different counterplay decision. Avoid a feature tour that hides the main interaction.
4. Reserve 20–30 seconds for actual Codex-build evidence: relevant thread/session, generated or edited source, and concise validation receipts with their source/date. Mask private settings and unrelated chat.
5. End on the credited result and reproducible testing route. Clearly label AI-operated provider tests and House-authored contributions; do not present them as genuine viewer sessions or human acceptance.
6. Use captions and a strong still frame because judges may evaluate media without testing. Final check: under 180 seconds, English accessible, Twitch + Codex visible, rights cleared, links work, private judge access verified, primary session ID copied accurately, submission status confirmed.

## Bounded stop state

Research complete. This packet changed only `submission/RESEARCH.md`. No runtime, game source, browser session, repository access control or external account was changed. Open items for the coordinator: inspect authenticated form, resolve judge-contact address, verify personal eligibility and build-window evidence, finalize rights and primary session ID, supply accessible video/repository, and verify actual submitted status. Do not describe preparation artifacts as an uploaded or accepted entry.
