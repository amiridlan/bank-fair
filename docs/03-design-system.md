# 03 — Design System

## Direction

**Calm, data-dense operations tooling** with Swiss-style grid discipline.

- **Why it fits:** Staff use this tool all day. Scannability and density beat decoration.
- **What it signals:** Reliable, organised, professional — a tool, not a marketing site.
- **Pitfall:** Can feel sterile. Counter it with one energetic accent (amber) reserved for "Live / Today" moments, and confident typography.
- **Avoid the generic defaults:** no purple/blue gradients, no soft drop shadows everywhere, no 3-card hero. Flat surfaces separated by 1px borders.

## Colour tokens

Defined as CSS custom properties on `:root` in `src/styles/_tokens.scss`. Components use tokens only.

| Token | Hex | Role | Notes |
|---|---|---|---|
| `--fo-ink` | `#14213D` | Headings, nav background, primary text | 15.6:1 on white |
| `--fo-text` | `#1E293B` | Body text | |
| `--fo-text-muted` | `#475569` | Secondary text, captions | 7.6:1 on white |
| `--fo-primary` | `#0F766E` | Primary actions, links, active nav | 5.4:1 on white — OK for text |
| `--fo-primary-hover` | `#115E59` | Hover/pressed | |
| `--fo-primary-subtle` | `#CCFBF1` | Selected rows, subtle highlights | Text on it: `--fo-ink` |
| `--fo-accent` | `#F59E0B` | "Live / Today" badges only | **Never as text on white (2.1:1).** Use as background with `--fo-ink` text (7.1:1) |
| `--fo-surface` | `#F8FAFC` | Page background | |
| `--fo-surface-raised` | `#FFFFFF` | Cards, tables, drawers | |
| `--fo-border` | `#E2E8F0` | Dividers, card borders | |
| `--fo-border-strong` | `#64748B` | Input borders, booth outlines, open slot outlines | **Measured 4.76:1 on white, 4.55:1 on surface.** Was `#CBD5E1`, which measured 1.48:1 and failed WCAG 1.4.11 — it is the sole indicator of an empty booth or open slot |
| `--fo-success` | `#15803D` | Paid, Booked | |
| `--fo-warning` | `#B45309` | Proposal, pending | Text-safe amber |
| `--fo-error` | `#B91C1C` | Errors, Lost | |
| `--fo-info` | `#1D4ED8` | Lead, informational | |

### Tonal ramps (added T1)

Intermediate steps so components stop inventing tints. Defined in `src/styles/_tokens.scss`; every value was computed, and the contrast column is against white.

| Step | Teal | vs white | Slate | vs white |
|---|---|---|---|---|
| 50 | `#F3FCFB` | 1.04 | `#F8F9FC` | 1.05 |
| 100 | `#E3F7F5` | 1.11 | `#F1F3F8` | 1.11 |
| 200 | `#C3EAE7` | 1.29 | `#DEE2ED` | 1.30 |
| 300 | `#88D3CD` | 1.71 | `#C0C7D8` | 1.69 |
| 400 | `#3BB0A6` | 2.64 | `#8B96B1` | 2.96 |
| **500** | `#1F847C` | **4.52** | `#5B6B8F` | **5.32** |
| 600 | `#176E67` | 6.06 | `#445274` | 7.76 |
| 700 | `#115A54` | 8.03 | `#323F5D` | 10.48 |
| 800 | `#0F433F` | 11.08 | `#222C44` | 13.89 |
| 900 | `#0C2C2A` | 14.90 | `#172036` | 16.20 |

> **Rule (docs/07 T-D4): nothing below step 500 may carry text or act as a functional boundary.**
>
> Step 400 is the highest step that still fails — teal 400 is 2.64:1 and slate 400 is 2.96:1, both under the 3:1 that WCAG 1.4.11 requires of a UI boundary. Below 500 is for fills and decoration only.
>
> This is the `--fo-border-strong` bug written down. It shipped at 1.48:1 as the sole indicator of an empty booth because the rule was implicit. It is now explicit, and the ramp makes the safe step obvious.

The existing anchors sit inside these ramps and are unchanged: `--fo-primary` `#0F766E` (5.47:1) between teal 500 and 600; `--fo-border-strong` `#64748B` (4.76:1) at slate 500 — which the ramp independently validates; `--fo-ink` `#14213D` (15.97:1) at slate 900.

### Status mapping (always text + icon, never colour alone)

| Status | Colour token | Material icon |
|---|---|---|
| Fair `draft` | `--fo-text-muted` | `edit_note` |
| Fair `open` | `--fo-primary` | `event_available` |
| Fair `live` | `--fo-accent` bg + `--fo-ink` text | `sensors` |
| Fair `completed` | `--fo-text-muted` | `task_alt` |
| Employer `lead` | `--fo-info` | `person_search` |
| Employer `proposal` | `--fo-warning` | `description` |
| Employer `confirmed` | `--fo-primary` | `handshake` |
| Employer `paid` | `--fo-success` | `paid` |
| Employer `lost` | `--fo-error` | `block` |

## Angular Material 3 theme

1. Generate palettes from the brand hex values:
   ```bash
   ng generate @angular/material:theme-color
   # primary: #0F766E   tertiary: #F59E0B   (neutral: leave default or #14213D)
   ```
   This creates `src/styles/_theme-colors.scss` with `$primary-palette` and `$tertiary-palette`.

2. Apply in `src/styles.scss`:
   ```scss
   @use '@angular/material' as mat;
   @use './styles/theme-colors' as brand;

   html {
     color-scheme: light;
     @include mat.theme((
       color: (
         primary: brand.$primary-palette,
         tertiary: brand.$tertiary-palette,
         theme-type: light,
       ),
       typography: (
         brand-family: 'Plus Jakarta Sans, system-ui, sans-serif',
         plain-family: 'IBM Plex Sans, system-ui, sans-serif',
       ),
       density: -1, // denser tables and forms for ops users
     ));
   }
   ```
3. Use Material's component override mixins (e.g. `mat.button-overrides(...)`) for component tweaks. Do not target internal `.mdc-*` / `.mat-mdc-*` classes.
4. Light theme only for MVP. Tokens are structured so a dark theme can be added later.

## Typography

Load from Google Fonts in `index.html` with `display=swap` and `preconnect`.

| Level | Family | Weight | Size / line-height | Letter-spacing | Use |
|---|---|---|---|---|---|
| Display | Plus Jakarta Sans | 700 | 32 / 40px | -0.02em | Dashboard KPI numbers |
| H1 | Plus Jakarta Sans | 600 | 24 / 32px | -0.01em | Page title |
| H2 | Plus Jakarta Sans | 600 | 18 / 26px | 0 | Section / card title |
| Body | IBM Plex Sans | 400 | 14 / 22px | 0 | Default text, tables |
| Body strong | IBM Plex Sans | 500 | 14 / 22px | 0 | Labels, emphasis |
| Caption | IBM Plex Sans | 400 | 12 / 18px | 0.01em | Meta, timestamps |
| Mono | IBM Plex Mono | 500 | 13 / 20px | 0 | Booth codes (`A-04`), IDs |

Use `font-variant-numeric: tabular-nums` for all numbers in tables and KPIs so columns align.

## Spacing, radius, elevation

- **Spacing scale (4px base):** `--fo-space-1: 4px`, `-2: 8px`, `-3: 12px`, `-4: 16px`, `-5: 24px`, `-6: 32px`, `-7: 48px`.
- **Radius:** `--fo-radius-sm: 4px` (inputs, chips, booths), `--fo-radius-md: 6px` (cards, dialogs). Squarer corners fit the Swiss direction.
- **Elevation:** Flat. Cards use `1px solid var(--fo-border)`, no shadow. Only dialogs, menus, and drag previews get a shadow: `0 8px 24px rgb(20 33 61 / 0.12)`.

## Layout

- **Shell:** Fixed top bar 56px (`--fo-ink` background, white text) + side nav 240px (collapses to icon rail 72px < 1280px, to drawer < 768px).
- **Content:** max-width 1440px, padding `--fo-space-6` desktop / `--fo-space-4` mobile.
- **Grid:** 12 columns, 24px gutter. Dashboard KPIs: 4 across desktop, 2 tablet, 1 mobile.
- **Breakpoints:** use CDK `BreakpointObserver`: `< 768` mobile, `768–1279` tablet, `≥ 1280` desktop.
- **Page header pattern:** H1 left, primary action right, filters row beneath.

## Component patterns

| Component | Spec |
|---|---|
| KPI card | Caption label (muted) → Display number → Caption delta (success/error + arrow icon) |
| Data table | `mat-table`, density -1, sticky header, zebra off, row hover `--fo-surface`, selected row `--fo-primary-subtle` |
| Status chip | `--fo-radius-sm`, 12px text 500 weight, icon 16px + label, 1px border in status colour, tinted background at ~10% |
| Kanban column | 280px wide, `--fo-surface` bg, header with count badge; cards `--fo-surface-raised` + border |
| Booth tile | Square, min 64×64px, mono booth code; empty = dashed `--fo-border-strong`; assigned = solid primary border + employer name (truncate 2 lines); drop-target hover = `--fo-primary-subtle` |
| Drawer | Right side, 480px (full width on mobile), deep-linkable |
| Empty state | 48px outlined icon (muted), H2 message, one sentence, primary button. No illustrations |
| Skeleton | `--fo-border` blocks with a subtle shimmer; disabled under reduced motion |

## Motion

- Durations: `--fo-motion-fast: 150ms` (hover, chips), `--fo-motion-base: 250ms` (drawers, dialogs).
- Easing: `cubic-bezier(0.2, 0, 0, 1)` (Material emphasized standard).
- Drag-drop: rely on CDK defaults, set `cdkDragPreview` shadow as above.
- `@media (prefers-reduced-motion: reduce)`: set durations to `0ms`, disable shimmer.

## Icons

Material Symbols Outlined (weight 400, grade 0, optical size 24). Icon-only buttons need `aria-label`.
