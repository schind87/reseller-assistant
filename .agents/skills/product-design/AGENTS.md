> Provenance: Load-order and governance responsibilities follow Vercel’s public
> product-design architecture
> ([Teaching agents product design at Vercel](https://vercel.com/blog/teaching-agents-product-design-at-vercel),
> June 25, 2026). Contents are Reseller Assistant–specific.

# product-design — load order, validation, governance

Root `AGENTS.md` is the trigger. This file is the skill-local contract. `SKILL.md` owns the runtime workflow. Reference files hold detail. Do not dump this whole tree into every prompt.

## Load order

1. Resolve **request mode** and **scope** from `SKILL.md`. Stop if the work has no user-visible effect.
2. Read [references/product-judgment.md](references/product-judgment.md) for Shape, Implement, Harden, full Review, or any material product change.
3. Read [references/surfaces.md](references/surfaces.md) and only the matching `surfaces-*.md` files.
4. Read [references/interface-quality.md](references/interface-quality.md) when visuals, layout, or hierarchy change.
5. Read [references/copy.md](references/copy.md) and [references/glossary.md](references/glossary.md) when language or accessible names change.
6. Read [references/resilience.md](references/resilience.md) when states, errors, empty, or responsive behavior matter.
7. Load [../project-design-system/SKILL.md](../project-design-system/SKILL.md) before introducing or restyling a component.
8. Load [../web-design-guidelines/SKILL.md](../web-design-guidelines/SKILL.md) for implementation audits (a11y, focus, forms, motion, images, URL state).
9. Load [../vercel-react-best-practices/SKILL.md](../vercel-react-best-practices/SKILL.md) for React/Next performance that does not change product behavior.
10. Check [references/coverage-gaps.md](references/coverage-gaps.md) before inventing a standard.
11. Use [exemplars/](exemplars/README.md) only as evidence of successful decisions, including listed flaws.

## Validation

After UI work, `SKILL.md` verification is required: functionality, then rendered UI when pixels changed, then the Web Interface Guidelines audit. Source inspection is not visual verification.

Report:

- request mode
- surfaces and references loaded
- material product decisions (or that none were material)
- verification method (rendered vs source-only) and viewports checked

## Governance

- Existing repository truth outranks generic UI advice.
- New rules need verified evidence, explicit scope, exceptions, and human acceptance. Template: [references/rules.md](references/rules.md).
- Unsettled questions belong in [references/coverage-gaps.md](references/coverage-gaps.md), not as invented rules.
- Do not duplicate `web-design-guidelines` or `vercel-react-best-practices` inside this skill.
- Do not encode subjective judgment as a Cursor rule. Mechanical invariants live in `.cursor/rules/frontend-invariants.mdc`.
