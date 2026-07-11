# BlakCert Design System

## Scene

A security engineer reviews certificate risk on a 27-inch monitor in a bright operations room, moving between dense inventory, approvals, and audit evidence. The interface is light-first for sustained legibility with a dark-mode-ready token model.

## Direction

Use a restrained, high-density enterprise product register. Tinted graphite neutrals provide structure; a muted copper accent marks selection and primary action without resembling common blue security dashboards. Risk colours are reserved for meaning.

## Colour

All application colours are CSS variables expressed in OKLCH. The neutral ramp carries a slight warm hue. Copper is used for focus, current navigation, and primary actions. Critical, warning, success, and information states always pair colour with text or iconography.

## Typography

Use the system sans stack for UI and the system monospace stack for fingerprints, serials, identifiers, and code. Use a compact fixed type scale from 0.75rem to 1.75rem. Body copy is capped at 72ch; operational tables may span the available viewport.

## Layout

The authenticated shell uses a 248px collapsible sidebar, a compact 56px context bar, and full-width work surfaces. Pages use 24px outer spacing on desktop and 16px on small screens. Tables, filters, and timelines are structural surfaces rather than nested cards.

## Components

Controls use 8px radii, 36px standard height, explicit focus rings, and consistent disabled/loading states. Status badges use icon, label, and subtle tinted background. Destructive actions require consequence copy and step-up state. Empty states teach the next authorised action.

## Motion

Motion only communicates state, using 150-220ms ease-out transitions. Respect `prefers-reduced-motion`; never orchestrate page-load animation.
