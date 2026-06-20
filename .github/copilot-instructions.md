# Copilot instructions

This project styles **only** with its design-system tokens. Before writing any UI code, read:

- `AGENTS.md` — the design-system contract + the failure→fix recovery table.
- `design-system.md` — the current token reference + the one-step extension procedure (`npm run tokens`).

Never hardcode a color, size, font, or duration; off-token classes produce no styles and fail `npm run check`.
To add a value the system lacks, follow the extension procedure in `design-system.md` — don't hardcode.
