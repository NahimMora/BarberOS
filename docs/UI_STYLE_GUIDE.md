# BarberOS UI/UX Style Guide

## Direction

BarberOS uses a **Soft Studio** visual language: warm, quiet, and confident,
closer to a well-kept studio workspace than to a generic SaaS dashboard or a
printed workshop ledger. The interface exists to make four jobs fast and
trustworthy:

1. Schedule
2. Charge
3. Close cash
4. Calculate commissions

Decoration must never compete with those jobs. Soft Studio replaces the
earlier "workshop editorial" direction (dual-font, paper texture, background
grid) with a single warm typeface, flat surfaces by default, and a single
signature accent — the barber-pole stripe — confined to one place.

> This document describes the direction as implemented today. If a screen
> disagrees with this guide, treat the guide as the target and the screen as
> a bug to fix, unless noted otherwise below.

### Family resemblance with Escuela SaaS

BarberOS and Escuela SaaS (a separate academy-management app, same author) are
sibling products and are meant to read as a family — BarberOS in its own warm
green, Escuela SaaS in blue. This is a deliberate, scoped alignment of a few
concrete conventions, not a shared codebase or component library — BarberOS
keeps its shadcn/`@base-ui/react` architecture throughout. What was aligned:

- **Table headers** are uppercase, tracked, small, and muted (`TableHead` in
  `src/components/ui/table.tsx`), matching Escuela SaaS's `th` treatment.
- **Page titles** are heavy (`font-black`) with tight tracking
  (`src/components/page-header.tsx`), echoing Escuela SaaS's confident
  headline weight — the eyebrow and stripe-accent above the title stay
  BarberOS's own signature, unchanged.
- **Status badges** use real semantic tone (`success`/`warning`/`info`/
  `destructive` variants in `src/components/ui/badge.tsx`, soft-tinted
  backgrounds against BarberOS's own `--success`/`--warning`/`--info`
  tokens) instead of borrowing neutral `outline`/`secondary` variants to
  fake status color — see the Status section below.
- **A role-info popover** in the header (`RoleInfoPopover` in
  `src/components/app-header.tsx`, built on a new `src/components/ui/
  popover.tsx` wrapping `@base-ui/react/popover`) shows what the signed-in
  role can and can't do, mirroring Escuela SaaS's own role-capabilities
  popover — genuinely useful here too, given BarberOS's own role model.
- **Form-control corners** (`Button`, `Input`, `Textarea`, `SelectTrigger`
  default size, `ComboboxInputGroup`) are clamped tighter via the same
  `rounded-[min(var(--radius-md),Npx)]` pattern the smaller button sizes
  already used, closer to Escuela SaaS's crisper button/field proportions.
  Cards, dialogs, sheets, and popup surfaces keep their larger, generous
  radius — that scale already matched Escuela SaaS's own card/modal
  proportions, and Soft Studio's flat-card-no-shadow rule (Shape and Depth,
  below) is intentionally unchanged.

## Experience Principles

- **Operational clarity:** the next action and current status must be obvious.
- **Calm density:** show enough information to work quickly without visual noise.
- **Touch ready:** interactive targets remain comfortable on tablets and phones.
- **Backend truth:** disabled or hidden controls never replace server authorization.
- **Progressive disclosure:** advanced details belong in dialogs, tabs, or secondary panels.
- **Spanish first:** labels are short, direct, and use the vocabulary of the shop.
- **Evidence over ambiguity:** money and sensitive actions always receive explicit feedback.

## Visual Language

### Color

> **Fase 1 update:** the palette below was lightened and neutralized —
> canvas and cards moved from a warm cream/gold "artisan workshop" tone to a
> near-white, neutral-green-gray one, closer to holasalta.com's lightness.
> This pass only touched color tokens; it does not resolve dashboard
> density, hierarchy, or spacing — that is a separate, later pass.

- **Background (canvas):** near-white, cool-neutral, `#F7F8F6`.
- **Card/surface:** pure white, `#FFFFFF` — reads as a clear lift off the
  canvas, not a hard panel.
- **Ink (foreground):** `#2A2318`, a warm charcoal — legible and softer than
  pure black.
- **Primary:** deep warm green (`oklch(0.335 0.055 157)`), used for primary
  actions and trusted state — unchanged, the brand invariant.
- **Accent:** soft neutral (`#EDF2EE`), used sparingly for hover/focus/
  selected states in menus and selects. No longer a gold decorative accent.
- **Destructive:** brick red, reserved for cancellation, voiding, and other
  irreversible actions.
- **Success / warning / info:** semantic tokens only — never arbitrary
  hardcoded utility colors in feature components.
- **Sidebar (desktop):** its own dark, desaturated palette — a muted
  near-black green (`oklch(0.24 0.02 155)` in light mode), not the app's
  light canvas. It reads as a distinct, calmer surface, not an inverted card.
  Unchanged by the Fase 1 lightening pass.

All of the above are CSS custom properties in `src/app/globals.css`
(`--background`, `--card`, `--primary`, `--sidebar*`, etc.), re-exposed as
Tailwind tokens via `@theme inline`. Feature components consume the semantic
Tailwind classes (`bg-card`, `text-primary`, `border-border`, ...), never
hardcoded hex/oklch values.

### Typography

- **Single typeface:** Geist for everything — body copy and headings alike
  (`font-sans` and `font-heading` both resolve to it, loaded via
  `next/font/google` as `Geist` in `src/app/layout.tsx`). There is no
  separate display face; Newsreader, Manrope, and Plus Jakarta Sans, used in
  earlier directions, are gone from the codebase.
- **Monospace:** Geist Mono, reserved for money, timestamps, and other
  aligned numeric/identifier data. Geist Sans + Geist Mono is a matched
  family, not two unrelated typefaces pulling in different directions.
- **Why Geist over the alternatives considered:** Inter reads as generic
  SaaS-dashboard default — the thing Soft Studio is trying not to be.
  Nunito Sans risks tipping warm-and-rounded into childish at this weight
  and size. Satoshi isn't self-hosted or vetted in this codebase, so
  reaching for it would add an external font dependency for an unconfirmed
  gain. Geist is warmer and less mechanical than Plus Jakarta Sans at body
  sizes, ships through the same `next/font/google` pipeline already used
  for Geist Mono (zero new dependencies), and gives the app a sans/mono
  pair from the same family instead of two unrelated typefaces.

### Shape and Depth

- Base radius is generous: `--radius: 1rem` (16px), with larger tokens
  (`radius-xl` through `radius-4xl`) scaling up from there for bigger
  surfaces (dialogs, hero panels). This is up from the tighter 12px radius
  of the previous direction.
- **Cards are flat by default:** a hairline border (`border-border`), no
  shadow. Use `<Card>` as-is for informational, read-only, or list surfaces.
- **`<Card elevated>`** is reserved for surfaces the user is meant to act on
  right now — e.g. the "open the cash drawer" hero panel, a highlighted
  actionable summary. `elevated` swaps the border for a soft two-layer
  shadow (`border-transparent` + `shadow-[...]`); don't combine both border
  and shadow, and don't reach for `elevated` just to make a card "pop"
  decoratively.
- **No page-level textures or background grids.** The previous paper-texture
  and grid-pattern treatments are removed from page/card backgrounds. The
  `BrandMark` icon badge's faint grid micro-texture (`.brand-mark-grid`) was
  removed in the Fase 1 lightening pass — it added no legibility or
  recognition value at the badge's ~40px size.

## Layout

- Desktop sidebar: persistent, dark/muted per the palette above, with a
  current-section indicator (`AppSidebar` in `src/components/app-sidebar.tsx`).
- Mobile navigation: a fixed bottom bar, icon-only by default. A text label
  only appears next to the **active** destination — inactive items are icons
  alone, keeping the bar compact on small screens (`MobileNavigation` in the
  same file).
- Header: sticky, preserves orientation while scrolling.
- Content width: fluid, with a practical maximum for operational tables.
- Page padding: 16px mobile, 24px tablet, 32px desktop.
- Bottom padding on mobile clears the fixed navigation.

Every feature page starts with `<PageHeader>`: eyebrow, title, one-sentence
description, and an optional primary action aligned right on larger screens.
`PageHeader` is also the **only** place the barber-pole stripe
(`.stripe-accent` — a small `h-1.5 w-12` rounded bar above the eyebrow) is
allowed to appear. It is not used in `BrandMark`, the sidebar, or as a status
indicator anywhere else — it is the page's signature mark, not a decoration
to reuse.

## Components

### Buttons

- One primary action per surface.
- `outline` for secondary workflow actions.
- `ghost` for low-emphasis row actions.
- `destructive` for voids, cancellations, and closing cash.
- Icon-only buttons require an accessible name and tooltip/title.
- Loading buttons remain disabled and state what is happening (e.g.
  "Anulando...", "Cerrando...").

### Forms

- Use `Field`, `FieldGroup`, and `FieldLabel`.
- Helper text explains format or consequence, not the label again.
- Validation is inline and also announced through a toast when the operation
  fails — parse the backend's `{ error: string }` response and surface that
  message directly (see `getError` helpers across `caja`, `control`, etc.),
  never a generic/technical fallback when the backend already returned a
  readable one.
- Destructive confirmation asks for a reason when the domain requires it
  (e.g. voiding a sale, cash adjustments on a closed session).

### Tables and Mobile Lists

- Desktop uses tables for scanning and comparison.
- Mobile uses stacked record cards; never force a wide table into a narrow viewport.
- Keep the primary identity in the first line and status/actions in predictable places.
- Empty states use the shared `Empty` component, or an equivalent short
  centered message for compact table bodies.
- Loading states use skeletons matching the final content shape.

### Status

- Status is always text plus a semantic badge; color alone is insufficient.
  Use the `Badge` component's real semantic variants (`success`, `warning`,
  `info`, `destructive`) for genuine severity/lifecycle states — never
  `outline`/`secondary` as a stand-in for status color. Reserve `outline`/
  `secondary` for neutral or binary states (active/inactive toggles, period
  labels) that aren't a severity at all.
- Appointment transitions use consistent verbs:
  `Confirmar`, `Iniciar`, `Completar`, `Reprogramar`, `Cancelar`.
- Cash and payment statuses display method and amount independently.

### Money

- Every monetary value renders with `font-mono tabular-nums` so figures
  align in columns and don't jitter as digits change.
- Always two decimal places, Argentine formatting (`formatArs` in
  `src/lib/money/display.ts`).
- Physical cash is visually separated from digital/manual payment methods
  wherever both appear together (cash console stat tiles, close-cash dialog).
- Every editable money field uses `MoneyInput`
  (`src/components/ui/money-input.tsx`) — never a raw `<Input>` for an
  amount. It masks thousands as you type (`1000` → `1.000`) and always
  emits a canonical decimal string, so it's a drop-in replacement wherever
  a plain `Input` was taking a money value.
- Status is always text plus a semantic badge or icon — when two states
  legitimately share the same badge variant (e.g. `confirmed` and
  `completed` are both a genuine `success` tone, just at different stages
  of the same appointment), add a small icon rather than reusing an
  unlabeled color to tell them apart (see `StatusBadge` in
  `src/app/(app)/agenda/page.tsx`).

## Motion

- Page content enters once with a short fade/translate animation (`.page-enter`).
- Hover and pressed states are subtle and immediate.
- Respect `prefers-reduced-motion`.
- No looping decorative motion in operational screens.

## Accessibility

- Minimum target size: 40px on mobile navigation and primary form actions.
- Visible focus ring on every interactive element.
- Dialogs always include a title.
- Icon-only actions include `aria-label`.
- Contrast meets WCAG AA.
- Do not communicate status using color only.
- Keyboard order follows visual order.

## Content Style

- Prefer direct actions: `Crear turno`, `Registrar cobro`, `Cerrar caja`, `Anular venta`.
- Avoid technical language in user-facing errors — surface the backend's
  message when it's already written for a human.
- Use Argentine formatting for date, time, and currency.
- Use sentence case, not title case, for UI labels.
- Empty states explain what is missing and the next useful action.

## Feature Rules

### Agenda

- Date context remains visible near the title.
- A daily summary may show counts already loaded on the page.
- Desktop table and mobile cards expose the same actions.

### Sales and Cash

- Monetary totals use tabular numerals and two decimal places.
- Physical cash is visually separated from digital/manual payment methods.
- Closing cash presents expected, counted, and difference as separate values.
- Admin-only actions (cash adjustments on a closed session, voiding a paid
  sale) are visually marked as such (e.g. a "Solo admin" badge) and always
  re-validated server-side — the badge is a hint, not the authorization.
- Voiding a sale requires a reason and always surfaces whether the
  originating cash session is already closed, since that closed snapshot is
  never recalculated.

### Commissions

- Always show base amount, rate snapshot, and resulting commission.
- A missing configured rate produces an explicit warning, even when the rate is zero.
- Settling a commission requires an explicit confirmation step before it's final.

## Definition of UI Done

A screen is not complete until it:

- works at 375px, 768px, and desktop widths,
- has loading, empty, success, and failure states,
- has no browser console errors,
- can be operated with keyboard,
- preserves role and branch authorization,
- uses the shared tokens and patterns in this guide.
