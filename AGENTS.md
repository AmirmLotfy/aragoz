# ARAGOZ working agreement

Read CURRENT_HANDOFF.md and ARAGOZ_Full_Game_Brief.md before work. The accepted implementation plan is recorded in IMPLEMENTATION_PLAN.md. Keep the complete first-release scope; a technical preview is an intermediate gate.

- One integration coordinator. Delegate only concrete disjoint packets. Keep root configuration and shared contracts coordinator-owned. Preserve the configured model.
- One heavy build/test/analyzer/asset job at a time. On26October the user explicitly superseded the fixed10GiB floor and requested full-team execution without storage/external-gate stalls. Use `node scripts/check-resources.mjs --job install|verify|build|browser|blender` for a bounded next-job estimate; split work and preserve a small working reserve rather than stopping all work at a blanket threshold. On actual ENOSPC preserve the exact failed action and continue independent work. Do not clean unrelated projects.
- Public rehearsal never requires Twitch, an account, or model calls. Never display synthetic contributions as viewers.
- No final asset kit production before visual approval. No Meshy spending before an exact quoted batch approval. Model calls require local credentials and an approved configured cap. Prepare deployment/cost review before paid provisioning.
- Never expose or copy local credentials. Keep ignored configuration out of logs, screenshots, recordings, and transfers.
- Use actual browser gameplay as gameplay evidence. Keep static, unit, local browser, mocked provider, real Twitch, hosted, OBS, and human evidence distinct.
- At milestone boundaries update the build journal and handoff with cwd, branch/HEAD, changed/untracked paths, commands/results, blockers, owners, owned processes, and smallest next step. Preserve all active work during transfer.

- 26October owner override: private AmirmLotfy/aragoz publication is approved; ALL spending is prohibited. Do not provision paid Render, enable model/Meshy calls or automatic billable CI. The historical paid blueprint is archived. Use ops/NO_COST_HOSTING.md for the existing Mac/temporary tunnel. OBS Screen Recording is approved for a game-only test; camera/microphone/input-monitoring permissions are not requested.
