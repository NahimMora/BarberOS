# BarberOS UI/UX Style Guide

## Direction

BarberOS uses a **workshop editorial** visual language: precise, warm, durable, and
operational. It should feel closer to a well-run service counter and a printed
appointment book than to a generic SaaS dashboard.

The interface exists to make four jobs fast and trustworthy:

1. Schedule
2. Charge
3. Close cash
4. Calculate commissions

Decoration must never compete with those jobs.

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

- **Canvas:** warm paper, not pure white.
- **Ink:** charcoal with a slight warm cast.
- **Primary:** deep workshop green for trusted primary actions.
- **Accent:** muted brass for focus, highlights, and selected context.
- **Destructive:** brick red, reserved for cancellation and irreversible actions.
- **Success/warning/info:** semantic tokens, never arbitrary utility colors.

Product UI uses semantic CSS variables (`background`, `primary`, `muted`,
`destructive`, `success`, `warning`, `info`). Avoid hardcoded palette utilities in
feature components.

### Typography

- **Display:** Newsreader for page titles and editorial emphasis.
- **Body:** Manrope for controls, data, and long-form readability.
- **Monospace:** Geist Mono only for time, identifiers, and aligned numeric data.

### Shape and Depth

- Default radius: 12px.
- Cards use a subtle border/ring and restrained shadow.
- Primary surfaces may use a paper texture made with CSS gradients.
- Avoid floating glass panels, purple gradients, excessive pills, and decorative shadows.

## Layout

- Desktop sidebar: 248px, persistent, with current-section indicator.
- Mobile navigation: fixed bottom bar with only role-available destinations.
- Header: sticky and translucent; it preserves orientation while scrolling.
- Content width: fluid, with 1536px maximum for operational tables.
- Page padding: 16px mobile, 24px tablet, 32px desktop.
- Bottom padding on mobile clears the fixed navigation.

Every feature page starts with `PageHeader`: eyebrow, clear title, one-sentence
description, and a primary action aligned right on larger screens.

## Components

### Buttons

- One primary action per surface.
- `outline` for secondary workflow actions.
- `ghost` for low-emphasis row actions.
- Icon-only buttons require an accessible name and tooltip/title.
- Loading buttons remain disabled and state what is happening.

### Forms

- Use `Field`, `FieldGroup`, and `FieldLabel`.
- Helper text explains format or consequence, not the label again.
- Validation is inline and also announced through toast when the operation fails.
- Destructive confirmation asks for a reason when the domain requires it.

### Tables and Mobile Lists

- Desktop uses tables for scanning and comparison.
- Mobile uses stacked record cards; never force a wide table into a narrow viewport.
- Keep the primary identity in the first line and status/actions in predictable places.
- Empty states use the shared `Empty` component.
- Loading states use skeletons matching the final content shape.

### Status

- Status is always text plus a semantic badge; color alone is insufficient.
- Appointment transitions use consistent verbs:
  `Confirmar`, `Iniciar`, `Completar`, `Reprogramar`, `Cancelar`.
- Cash and payment statuses display method and amount independently.

## Motion

- Page content enters once with a short fade/translate animation.
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

- Prefer direct actions: `Crear turno`, `Registrar cobro`, `Cerrar caja`.
- Avoid technical language in user-facing errors.
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

### Commissions

- Always show base amount, rate snapshot, and resulting commission.
- A missing configured rate produces an explicit warning, even when the rate is zero.

## Definition of UI Done

A screen is not complete until it:

- works at 375px, 768px, and desktop widths,
- has loading, empty, success, and failure states,
- has no browser console errors,
- can be operated with keyboard,
- preserves role and branch authorization,
- uses the shared tokens and patterns in this guide.
