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

| Role | Hex |
| --- | --- |
| Primary text | `#292929` |
| Secondary text | `#5D5D5D` |
| Tertiary text / muted icons | `#9E9E9E` |
| Background | near-white (`#FAFAFA`–`#FDFDFC`) |
| Borders | soft black at low opacity (`rgba(0,0,0,0.08)`–`0.12`) |

Links inherit text color; use weight or underline on hover rather than loud accent colors. Accents sparingly, if at all.

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

**Do:** muted greys, SF Pro, small type scale, clear title → body → meta hierarchy.

**Don’t:** purple gradients, heavy card stacks, large display fonts, competing accents, decorative badges on media.
