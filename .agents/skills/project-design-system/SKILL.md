---
name: project-design-system
description: >-
  Reseller Assistant local UI primitives, CSS tokens, typography, and layout
  conventions verified from source. Use when building or restyling user-facing
  UI in src/components, src/app, or the Chrome extension — imports, variants,
  tokens, and anti-patterns. Not Geist. Not a third-party component library.
  All APIs listed here were read from source.
---

# Reseller Assistant design system

This repository does **not** ship a packaged design system (no Geist, shadcn, or Radix). What exists is a small set of local components plus CSS variables in [src/app/globals.css](../../../src/app/globals.css).

Do not hallucinate props, tokens, or icon names. If it is not listed here, open the source file.

Product judgment (what to build) lives in [product-design](../product-design/SKILL.md). This skill is **verified implementation facts**.

## Routing

| Task | Load |
| --- | --- |
| Color, type, radius, touch | [references/tokens.md](references/tokens.md) |
| Import path / named exports | [references/imports.md](references/imports.md) |
| Component APIs and when to use | [references/components.md](references/components.md) |
| Layout widths and page scaffolding | [references/layout.md](references/layout.md) |
| Icons | [references/icons.md](references/icons.md) |
| Anti-patterns | [references/anti-patterns.md](references/anti-patterns.md) |

Accessibility and HTML mechanics: [web-design-guidelines](../web-design-guidelines/SKILL.md). React performance: [vercel-react-best-practices](../vercel-react-best-practices/SKILL.md).
