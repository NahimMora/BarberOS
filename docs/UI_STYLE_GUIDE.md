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

- **Background (canvas):** warm off-white, `#F6F1E8`. Never pure white.
- **Card/surface:** `#FFFCF5` — barely lighter than the canvas, so cards read
  as a subtle lift, not a hard panel.
- **Ink (foreground):** `#2A2318`, a warm charcoal — legible and softer than
  pure black.
- **Primary:** deep warm green (`oklch(0.335 0.055 157)`), used for primary
  actions and trusted state.
- **Accent:** muted warm gold, used sparingly for focus and highlighted context.
- **Destructive:** brick red, reserved for cancellation, voiding, and other
  irreversible actions.
- **Success / warning / info:** semantic tokens only — never arbitrary
  hardcoded utility colors in feature components.
- **Sidebar (desktop):** its own dark, desaturated palette — a muted
  near-black green (`oklch(0.24 0.02 155)` in light mode), not the app's
  light canvas. It reads as a distinct, calmer surface, not an inverted card.

All of the above are CSS custom properties in `src/app/globals.css`
(`--background`, `--card`, `--primary`, `--sidebar*`, etc.), re-exposed as
Tailwind tokens via `@theme inline`. Feature components consume the semantic
Tailwind classes (`bg-card`, `text-primary`, `border-border`, ...), never
hardcoded hex/oklch values.

### Typography

- **Single typeface:** Plus Jakarta Sans for everything — body copy and
  headings alike (`font-sans` and `font-heading` both resolve to it). There
  is no separate display face; Newsreader and Manrope, used in the previous
  direction, are gone from the codebase.
- **Monospace:** Geist Mono, reserved for money, timestamps, and other
  aligned numeric/identifier data.

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
  and grid-pattern treatments are removed from page/card backgrounds.
  *Known exception:* `BrandMark`'s icon badge still applies a faint grid
  micro-texture via the `.brand-mark-grid` utility class in `globals.css`.
  This wasn't caught in the Soft Studio pass — flagged here as a minor,
  non-blocking cleanup rather than documented as intentional.

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
