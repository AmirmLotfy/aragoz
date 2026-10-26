# Deployment decision — no paid services

26October2026: owner explicitly approved creation/publication of private AmirmLotfy/aragoz and said “I don't want to pay for anything.” This supersedes the earlier Render proposal. No paid provisioning, model usage, Meshy credits or automatic billable CI is authorized.

Current repository: https://github.com/AmirmLotfy/aragoz (verified private). Current zero-cost route is the existing Mac with local durable SQLite plus an account-free Cloudflare Quick Tunnel. Follow ops/NO_COST_HOSTING.md. Temporary HTTPS rehearsal has been served and exercised with actual browser keyboard input. The Mac/process must remain running; a new whole-tunnel session changes the hostname. Game-server configuration reload preserves the current tunnel URL and key. Do not call this permanent managed hosting or human acceptance.

The real broadcaster account @amirmolotfy was created by the owner and observed signed in. Twitch developer console currently requires fresh login before app registration; no client credentials or game OAuth/chat evidence exists yet. Keep secrets in local ignored settings, never chat or source. Model calls are forced off by the public-preview launcher.

An actual Linux ARM64 image and non-root runtime passed local startup, static encoding, private API denial, persistence after container replacement, online backup and isolated restoration. The task-owned Colima profile/data were removed after retaining receipts; unrelated profiles were preserved. No paid cloud service was created.

The earlier paid design is preserved at ops/archive/render.paid-unapproved.yaml for reference only. Render Free erases local SQLite on restart/spin-down and does not support persistent disks; it is unsuitable for this architecture's durable release without changing the storage design. Official sources: https://render.com/docs/free and https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/.

The historical quote was about$7.25/month before usage/taxes, but it is NOT approved. Do not apply that blueprint or enable spending from this document.
