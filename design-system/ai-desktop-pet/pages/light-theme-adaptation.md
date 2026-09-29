# Page Override: Light Theme Implementation Adaptation

> Overrides `MASTER.md` for the light-theme implementation. Generated during the
> UI/UX Pro Max-guided refactor of AI-Pets-Hub (white background / black text).

## Color Role Mapping (framework semantics)

The palette from MASTER.md is kept as the reference, but role names are adapted
to the shadcn/Tailwind semantic model already used by 800+ components:

| MASTER role | Implemented as | Value | Reason |
|---|---|---|---|
| Secondary `#2563EB` | `--info` token | `#2563EB` | `bg-secondary` is used 204× as a *neutral surface* (card/input fill); a blue would tint every card. `--secondary` therefore maps to a neutral surface `#E2E8F0`. |
| Accent `#059669` | `--accent` / `--success` | `#059669` | Kept green as the CTA/success accent. |
| Primary `#1E3A5F` | `--primary` / `--ring` | `#1E3A5F` | Navy works as text/button primary on white (contrast > 7:1). |
| Background / Card / Border / Muted | unchanged | `#F8FAFC / #FFFFFF / #E4E7EB / #F1F3F5` | |

## Typography Adaptation

- **Google Fonts (Outfit / Work Sans) NOT imported**: the app is a Chinese
  desktop app; CJK glyphs fall back to system fonts anyway and the app must
  work offline. System stack kept: `Segoe UI / Microsoft YaHei UI / PingFang SC`.
- **Micro-font floor**: legacy `text-[9/10/11px]` labels were tokenized to
  `text-3xs` (10px) / `text-2xs` (11px) via `@utility` definitions; body text
  uses `text-xs` (12px) minimum, `text-sm` (14px) in the workbench.
- **Contrast**: all functional colors (voice status, model test states, neural
  persona panels) were corrected from dark-theme 200/300 tints to 600/700
  tints to keep ≥ 4.5:1 on white.

## Radius & Spacing

- `--radius: 0.5rem` (8px) base so existing `rounded-sm/md/lg` scale up to a
  modern desktop-app look without touching 200+ files.
- Spacing keeps the density-5 standard scale (4/8/16/24/32/48/64).

## Window Sizing (normal application panel)

- Settings window: 960×680 (min 720×520) — was 544×640.
- Chat window: 420×560 (min 360×480) — was 320×416.
- Docked settings panel default: 860×620 (min 560×480) — was 544×640.

## Z-Index Scale

Single authority tokens (`z-pet` 10 / `z-panel` 30 / `z-overlay` 50 /
`z-popover` 70 / `z-modal` 90) added as `@utility` classes; raw `z-[...]`
usage in rewritten surfaces replaced. (Full migration across pet layers is a
follow-up.)
