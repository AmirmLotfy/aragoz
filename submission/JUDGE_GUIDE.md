# ARAGOZ — judge testing guide

Technical preview. English interface. Desktop keyboard recommended. No payment, browser extension or viewer registration is needed for House play. Runtime model calls are disabled.

## Try the complete account-free show

Candidate public link: https://klein-wake-circle-favor.trycloudflare.com/house-show

This free temporary tunnel depends on the creator's Mac and network; verify the link when publishing. The repository route below remains the reproducible test path. It is not a claim of guaranteed judging-period uptime.

1. Start the House show. Choose two contracts for ActI and read each power/**BUT**flaw.
2. Use WASD/arrows to move, J/mouse to strike, Space to dodge. Pause/mute are immediately available. Sound and controls includes remapping, reduced motion, independent audio and presentation settings.
3. For charge, make it commit toward a striped stage block. Hit the exposed axle. For steam, evade the burst sequence and strike the overheated valve. For echo, draw a path that sends the translated copy into a block and strike the exposed mirror.
4. Break both attachments, then approach for the final strike. The showbill preserves the contracts and outcome. Encore retains the recipe; Remix replaces one contract. Continue through three acts to the cumulative showbill.

House Suggestions are authored content and are labelled accordingly. They are not synthetic viewers or live model output. The shorter `/rehearse` route offers the three curated pairings.

## Reproduce locally from the repository

Repository: https://github.com/AmirmLotfy/aragoz (private; judge access must be granted to the **verified official contact** before entry).

Use Node.js24LTS and the committed lockfile. From the checkout:

```sh
npm ci --ignore-scripts
npm run build:release
npm start
```

Open http://127.0.0.1:3000/house-show . Read README.md and `.env.example` for public configuration names; never use the creator's private `.env`, database, encryption key or OAuth credentials. A fresh local setup can play House without those credentials. For a container route, see Dockerfile and tests/container/smoke.mjs.

Source checks: `npm run typecheck`, `npm test`. Run browser checks one worker at a time per TEST_PLAN.md; all automated game play must stay muted. Historical receipts retain their precise source/date rather than certifying changed code.

## Genuine Twitch hosting

Public `/setup` uses server-side broadcaster OAuth with read-only `user:read:chat`. Hosting is invitation-based. A judge who wants to test another real broadcaster needs an explicit invite/configuration step; a display link is not host permission. Do not share the creator's account or credentials.

After setup verifies an incoming `!aragoz CODE` test, use the separate private backstage window for review/control and the public play window for capture. Only explicit `!make CODE … BUT …` and `!vote CODE A` commands enter the game. The current code is displayed for every window. Votes received after the server deadline cannot affect the next ballot.

## What the evidence proves

- Actual Twitch OAuth/EventSub/proposal/vote/credited encounter, real refresh, encrypted backup/restore and same-origin restart were tested with one genuine broadcaster account operated by the agent.
- Actual OBS motion is House rehearsal footage from an earlier documented source. The review edit labels it separately from later Twitch stills.
- Local unit/browser/synthetic tests, provider tests, OBS measurements and human acceptance are separate categories. Genuine first-time-host/viewer sessions remain0.

See ops/TWITCH_LIVE_VALIDATION.md, ops/PERFORMANCE_REPORT.md, CURRENT_HANDOFF.md and REMAINING_WORK.md for exact receipts and open gates. The project is a functioning technical preview; it does not claim release acceptance or arbitrary live AI-generated mechanics.
