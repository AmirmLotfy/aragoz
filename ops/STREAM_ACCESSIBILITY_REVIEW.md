# Scoped stream and accessibility engineering review

27 October 2026. Scope: desktop public performance at 1280×720, native Chromium captures scaled to 844 and 390 pixels wide, plus keyboard/settings checks. The layout stays at 1280×720; these are captured streams, not mobile combat layouts. Root reviewed the actual images with audio muted. All audience authors are visibly labelled local fixtures. A historical actual House record was restored only to inspect the showbill; this creates no new gameplay win.

**Verdict:** the approved theatre direction remains distinctive: original tactile stage/GLBs, paper, soot plates, family glyphs and self-hosted Noto. Three physical contract cards serve the ballot. No generic dashboard, gradient lettering or glass-panel treatment was added. Engineering signoff for the free desktop technical preview; this is not a WCAG certificate or an audience-comprehension result.

| Dimension | Score /4 | Finding |
|---|---:|---|
| Accessibility | 3 | Sampled solid-backed text passes contrast; keyboard/settings and sound-off cues verified. Dynamic full-scene and human evaluation remain separately scoped. |
| Performance | 3 | Arena size/60Hz simulation preserved, no new assets/dependencies. Existing measured 30fps profile is retained; no fresh OBS/performance claim. |
| Responsive composition | 3 | Commands/rules fit 720p; large public text survives downscaling. Dense secondary credits/metadata remain smaller. |
| Theming | 4 | Approved palette, typography, theatre composition and original materials retained. |
| Visual anti-patterns | 4 | Intentional stage/cards/showbill hierarchy; no new generic design treatment. |
| Total | **17/20** | Good within this declared review scope. |

## Measured evidence

[Baseline](../evidence/browser/readability-baseline/receipt.json), [final candidate](../evidence/browser/readability-candidate/receipt.json), [capture tool](../scripts/inspect-stream-readability.mjs), [browser regressions](../tests/browser/readability.spec.ts).

- Eight final views: proposal, first ballot, second ballot, combat, grayscale combat, settings, showbill summary and scrolled contract history. Each has actual 1280/844/390 native Chromium captures. Zero page errors and zero fixture-provider requests. No generated image retouching.
- All sampled critical proposal/ballot/combat/showbill text bounds fit the720p capture. Settings intentionally scroll inside a native dialog; fields below its fold remain keyboard reachable.
- Vote command40px becomes12.19px at390; card power32px becomes9.75px, flaw30px becomes9.14px. The40-character fixture author is actually voted into the first slot and remains visible in the second ballot. The server still owns the cutoff; UI placement changes no deadline.
- Combat rule32/30px becomes9.75/9.14px at390. Its strip is below the arena, clear of both bottom webcam corners. Tests also verify top-right relocation and the none setting. Health, family and act labels have opaque soot backing. Arena dimensions retain the existing formula.
- Showbill totals32px become9.75px at390. Contract headings32px and full rules30px remain readable in the scrolled history; credits24px become7.31px. Full immutable rules and author records remain intact. Detailed history naturally requires scrolling.
- Minimum sampled solid-background contrast is **5.33:1** across the inspected text; sampled combat plates are **12.69:1**. This supports WCAG1.4.3 for those measured pairs. Text over images/transparency is not silently treated as a solid-background pass. No whole-app conformance claim.
- Eighteen successive Tab presses remain inside the settings dialog with doubled root text, no horizontal dialog overflow, and Escape closes it. Existing narrow-page keyboard/overflow tests also pass.
- Muted play retains words, family glyphs, health stitches, exposure labels, break meters and physical module removal. The sampled grayscale windup preserves silhouettes and block geometry. Prior actual charge/steam/echo/physical-break engine and OBS images retain their original source limits; this one grayscale sample does not pretend to cover every hazard state.

## Findings fixed in this packet

No outstanding P0/P1 finding was observed in this scope. Three initial presentation findings were treated as P1 for broadcast usability, without inventing a WCAG minimum-font rule for downscaled video:

1. **Vote command/timer below720p.** `apps/web/src/Live.tsx` AudienceCue and desktop capture CSS. Viewers could see choices but miss how/when to vote. Command/timer now precede the cards; actual first/second ballots and long-author tests fit. `/arrange` and `/clarify` fixes completed.
2. **Combat rule text too small/over the arena.** `apps/web/src/components.tsx` CombatHud and `styles.css` capture block. The baseline included2.34px scaled text. A short authored rule strip below the arena now uses32/30px with opaque backing. `/typeset` and `/adapt` fixes completed.
3. **Showbill outcome/full contract text too small in the stream.** `styles.css` public showbill scope. Outcome totals were16px and detailed rules11.52px at1280. Totals/rules are now32/30px; actual scrolled history inspected. `/typeset` and `/polish` fixes completed.

Two P2 limitations are retained transparently: long ballot credits/tradeoffs at20px scale to6.09px at390; small host controls/attempt metadata also benefit from expanded viewing. The primary command/rule gets priority in the three-choice scene. Genuine viewer testing must judge actual attribution/comprehension rather than treating these engineering thresholds as comprehension scores. This is not a new permission gate or a reason to repeat unrelated checks.

Positive patterns to retain: native keyboard controls/dialog focus, independently available mute/pause, explicit House/fixture lineage, large power/BUT/flaw hierarchy, non-colour labels/glyphs, immutable full contracts and preserved simulation timing. Final polish was performed; no additional design-command queue or routine owner review is pending.

## Acceptance dependencies — kept at the very end

Genuine viewers/hosts have not evaluated this packet: zero sessions. Provider/account and participant gates remain in REMAINING_WORK B01–B04. No mobile touch-combat, full screen-reader combat, all-state contrast certification or new continuous GPU/OBS measurement is claimed. Those evidence limits must remain visible in the final invited-broadcaster judgment.
