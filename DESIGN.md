# Design Guidance

Simple, quiet UI. Prefer whitespace and hierarchy over decoration.

## Principles

- **Text-first.** Content and type do most of the work. Avoid chrome unless it helps a task.
- **One hierarchy.** Primary / secondary / tertiary — nothing else.
- **Restrained surfaces.** Light backgrounds, soft borders, no heavy shadows or glow.
- **Small type, clear structure.** Dense but calm — like a well-set personal site, not a dashboard.

## Type

| Token | Value |
| --- | --- |
| Family | SF Pro (system fallback: `-apple-system, BlinkMacSystemFont, system-ui`) |
| Weights | Regular (400), Medium (500) |
| Letter spacing | `-0.15px` |
| Sizes | `12px`, `13px`, `14px`, `24px` only |

**Usage**

- `24px` — page titles / hero names
- `14px` — body, primary labels, nav
- `13px` — secondary body / list meta when 14 feels heavy
- `12px` — timestamps, captions, tertiary labels

## Color

Warm paper palette aligned with [dylanfdl.com](https://www.dylanfdl.com) — cream surfaces, cool grey ink, muted blue primary. No teal/sea-glass.

| Role | Hex |
| --- | --- |
| Primary text | `#030303` |
| Secondary text | `#374151` |
| Tertiary text / muted icons | `#6B7280` |
| Background | paper `#FFFEF8` (soft warm wash OK) |
| Surface / elevated | `#FAF8F0` |
| Surface / hover | `#F5F2E8` |
| Primary action | muted blue `#5F5FAF` |
| Borders | paper edge `#F0EDE0`, or ink at low opacity |

Links inherit text color; use weight or underline on hover. Keep accent color sparse — primary buttons and subtle page atmosphere only.

**Implementation:** these roles are CSS variables in `app/globals.css` and Tailwind colors `ink`, `ink-secondary`, `ink-tertiary`, `page`, `page-elevated`, `surface-hover`, plus shadcn `primary`. Prefer those utilities over hardcoded hex.

## Icons

| Context | Size |
| --- | --- |
| Navigation | `14px` |
| Cards | `20px` |

Stroke weight should match surrounding type. Prefer monochrome at the tertiary/secondary colors above.

## Radius & spacing

| Element | Radius |
| --- | --- |
| Navigation controls | `8px` |
| Cards | `16px` |
| Primary CTAs | pill (`9999px`) |

Keep padding tight and consistent. Favor `8 / 12 / 16 / 24` spacing steps. Cards can sit in a simple grid; don’t nest cards inside cards.

## Layout

- Prose width: `640px`
- Grid / page max-width: `900px`
- Generous top padding; calm vertical rhythm
- Filters/tabs: compact segmented control, not oversized pills

## Motion

Short and quiet when used (`200–300ms`, ease-out). Prefer opacity/transform over bouncing or springy UI.

## Do / Don’t

**Do:** warm paper cream, SF Pro, small type scale, clear title → body → meta hierarchy.

**Don’t:** teal/sea-glass washes, purple gradients, heavy card stacks, large display fonts, competing accents, decorative badges on media.
