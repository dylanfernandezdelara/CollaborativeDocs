# Design Guidance

Simple, quiet UI. Prefer whitespace and hierarchy over decoration.
Influence: [benji.org](https://benji.org) — text does the work, actions are
words, chrome only when it helps a task.

Decided Aug 2026 via canvas exploration (see `canvases/design-composites.canvas.tsx`
for the reference composite: "Quiet Index · dated" × "Bone · Olive").

## Principles

- **Text-first.** Content and type do most of the work. No buttons, no pills,
  no badges — actions are underlined text phrases.
- **One hierarchy.** Primary / secondary / tertiary — nothing else.
- **Neutral text, one accent.** All text is neutral ink/gray. The olive accent
  appears in exactly one place per view: the primary action's underline
  (and the active nav item's underline).
- **Small type, clear structure.** Dense but calm — like a well-set personal
  site, not a dashboard.
- **No terminal aesthetics.** No monospace, no letter-spaced all-caps labels.
  Dates are written as words ("Aug 1", "yesterday", "3d").

## Type

| Token | Value |
| --- | --- |
| Family | SF Pro (system fallback: `-apple-system, BlinkMacSystemFont, system-ui`) — everywhere, including dates and metadata |
| Weights | Regular (400), Medium (500) |
| Letter spacing | `-0.15px` |
| Rem base | `16px` (browser default — don't shrink it; shadcn/rem UI depends on it) |

**Semantic sizes** — defined once in `app/globals.css` (`@theme`) and used as
Tailwind classes (`text-body`, `text-caption`, …). Never hard-code `text-[13px]`.
Desktop keeps the dense scale; phones step up to platform-normal sizes
(breakpoint: `sm` / 640px).

| Class | Role | Desktop (≥sm) | Mobile |
| --- | --- | --- | --- |
| `text-title` | page titles (medium weight) | `24px` | `26px` |
| `text-heading` | section headers, nav, panel titles | `16px` | `18px` |
| `text-body` | body, memo titles, actions | `14px` | `16px` |
| `text-label` | secondary labels, metadata | `13px` | `14px` |
| `text-caption` | dates, owner names, typing lines, captions | `12px` | `13px` |

Editor prose (`.ProseMirror`) is set separately: body `16px` desktop / `17px`
mobile (≥16px also avoids iOS input auto-zoom), `h1` `28px`, `h2` `22px`.

## Color — Bone · Olive

Warm bone paper, near-black ink, dry olive accent. No purple, no teal,
no status-LED green.

| Role | Hex |
| --- | --- |
| Background | `#FBFAF4` |
| Surface / hover | `#F1EFE4` |
| Primary text (ink) | `#1C1B17` |
| Secondary text | `#57544A` |
| Tertiary text / metadata | `#948F7D` |
| Borders / hairlines | `#E9E6D8` |
| Accent (olive) | `#6B7233` |

Accent dosage is deliberately sparse: primary-action underline and active-nav
underline only. Never colored phrases, never colored icons, never row fills.

## Memos index — "Quiet Index · dated"

- Centered column (~640px prose width).
- Header wordmark-as-h1: "Memos" (`text-heading`/500), auth actions right-aligned.
  Below it, a **1.5px ink rule** carrying only the right-aligned memo count in
  tertiary.
- Rows: date in a fixed 5.5rem (88px) tertiary column · title (`text-body`; medium when live)
  · owner's name right-aligned in tertiary.
- Footer actions as text: primary ("New memo") underlined 1.5px in olive;
  secondary ("Shared with me") underlined 1px in tertiary gray.

## Authorship & presence

Structural fact: **only humans create memos.** A name in the owner
position is always a person and never needs a qualifier.

- **Owner** — always visible, right edge of every row, tertiary gray. Never
  displaced by live activity.
- **Live editing** — live rows add one line beneath the title, indented to
  the text column: an animated spinner + gray italic sentence, e.g.
  `⠋ Scout (agent) is typing · 2 others in the memo`.
- **Index signal sources** — typing comes from denormalized last-edit
  (`lastEditedAt` / editor name derived server-side). “Others in the memo”
  on the index counts live agents only (client-filtered `lastSeenAt` from
  `agentHeartbeats`). The index does **not** subscribe to human presence
  rooms (avoids list-query churn on every heartbeat). Legacy ownerless docs
  omit last-edit and agent heartbeats on the list entirely so they do not
  broadcast who is editing to every visitor. Full human presence stays on
  the memo page avatar stack. List order matches the date column
  (`lastEditedAt ?? createdAt`).
- **Spinner** — the `dots` spinner from
  [cli-spinners](https://github.com/sindresorhus/cli-spinners)
  (frames `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, 80ms), rendered at `text-caption` in secondary gray.
  Motion is the live signal; it carries no color.
- **Agents** — always named with the literal word "agent" in plain gray text:
  `Scout (agent)`. Agents never get avatars, faces, colored labels, or
  invented symbols.
- **No legends.** If a presence treatment needs explaining, it's wrong.
- Past agent edits are not surfaced on the index.

## Icons

Avoid icons where a word works. When needed: monochrome, stroke matching
surrounding type, `14px` in nav contexts.

## Radius & spacing

| Element | Radius |
| --- | --- |
| Cards / dialogs | `8–10px` |
| Small controls | `6px` |
| Pills | **never** |

Favor `8 / 12 / 16 / 24` spacing steps. Hairline separators (`#E9E6D8`)
between rows; a heavier ink rule only under page/section headers.

## Layout

- Prose width: `640px`
- Page max-width: `900px`
- Generous top padding; calm vertical rhythm

## Motion

- The dots typing spinner (80ms frames) is the primary motion in the app.
- Everything else: short and quiet (`200–300ms`, ease-out), opacity/transform
  only. No bounce, no glow, no shimmer washes.

## Do / Don't

**Do:** bone paper, SF Pro, small type scale, underlined text actions, the
typing line with the dots spinner, owner always visible.

**Don't:** buttons and pills, colored text phrases, status-LED green dots,
monospace or all-caps labels, avatars for agents, legends, purple anything.
