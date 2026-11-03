---
name: ui-ux-pro-max
description: AI-powered design intelligence with UI styles, 192 color palettes, 74 font pairings, 119 UX guidelines, accessibility standards, and component patterns across tech stacks. Use when designing new pages, choosing palettes/fonts, reviewing UX accessibility, or building polished frontend interfaces.
---

# UI/UX Pro Max Skill

AI-powered design intelligence for building professional UI/UX, responsive layouts, accessible typography, cohesive color systems, and modern component design.

## When to Apply
Use this skill when tasks involve **UI structure, visual design decisions, interaction patterns, or UX quality control**:
- Designing new pages (Landing Page, Dashboard, Admin, SaaS, Mobile Web)
- Creating or refactoring UI components (buttons, modals, forms, tables, data cards)
- Choosing color palettes, typography pairings, spacing tokens, or layout hierarchies
- Auditing UI code for UX compliance, WCAG 2.2 accessibility (contrast, focus rings, touch targets), or visual consistency
- Implementing navigation structures, micro-interactions, responsive states, or dark mode
- Elevating perceived interface quality, clarity, and usability

---

## Priority & Quality Rules

### 1. Accessibility (CRITICAL)
- **Contrast**: Minimum 4.5:1 ratio for normal text, 3:1 for large text.
- **Focus States**: Visible focus rings on all interactive elements (2–4px outline or ring with contrast).
- **Alt Text**: Descriptive alt text on meaningful imagery; empty `alt=""` or `aria-hidden="true"` on purely decorative icons.
- **Aria Labels**: Mandatory `aria-label` or accessible text on icon-only buttons.
- **Keyboard Navigation**: Logical tab order matching visual layout; full escape support for modals/drawers.
- **Touch Targets**: Minimum 44×44px touch targets on mobile (min 24×24 CSS px with padding for web).
- **Reduced Motion**: Always respect `prefers-reduced-motion` media queries.

### 2. Typography & Hierarchy
- **Base Size**: 16px body font with 1.5 line height for optimal readability.
- **Font Pairing**: Maximum 2 font families (one distinct display face + one readable sans-serif/serif body).
- **Line Length**: Limit body copy lines to 45–75 characters (max-w-prose or ~600px width).
- **Type Scale**: Distinct weight and size hierarchy (h1 > h2 > h3 > body > caption).

### 3. Color Systems & Visual Tokens
- **Semantic Tokens**: Use purpose-driven tokens (`primary`, `secondary`, `surface`, `border`, `success`, `danger`, `warning`, `info`) rather than random hardcoded hex values.
- **Color Independence**: Never rely on color alone to convey state or error — pair color with icons, badges, or descriptive text.
- **Dark Mode Discipline**: Avoid pure `#000000` backgrounds; use slate/zinc/neutral layers (`#0f172a`, `#18181b`) with appropriate luminance contrast.

### 4. Layout & Responsive Execution
- **Mobile First**: Design fluid layouts that degrade gracefully from desktop (grid) to tablet to mobile (single column stacked).
- **No Horizontal Scroll**: Prevent overflow clipping or horizontal layout breaking on small screens.
- **Spatial Consistency**: Use consistent spacing tokens (4px, 8px, 12px, 16px, 24px, 32px, 48px).

### 5. Interaction & Feedback
- **Immediate State Feedback**: Hover, active, focus, disabled, and loading states for every button/action.
- **Skeleton & Optimistic Loading**: Avoid jarring layout shifts during data fetching (CLS < 0.1).
- **Clear Empty States**: Every empty list or table must include a helpful message and a primary call-to-action.
