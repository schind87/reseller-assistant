> Provenance: Rule and decision-record structure is taken from Vercel’s
> public article
> [Teaching agents product design at Vercel](https://vercel.com/blog/teaching-agents-product-design-at-vercel)
> (June 25, 2026). Not an official unpublished Vercel file.

# Stable-rule format

Use this format for product-judgment rules. Mechanical checks belong in
`.cursor/rules/frontend-invariants.mdc` or a linter — only when code can
identify the failure reliably, false positives are unlikely, and a concrete
fix exists.

## Decision record (new standard)

```markdown
# Decision: {name}
Status: proposed | accepted | rejected
Scope:
Decision:
Rationale:
Evidence:
Exceptions:
Bad example:
Good example:
Assumptions:
Open decisions:
```

Fill fields for the surface before expanding to others. Avoid adjectives like
`clear` or `polished`. Prefer observable rules: `Destructive actions use Verb + Noun`.

## Surface rule (in `surfaces-*.md`)

```markdown
### rule/{stable-id}
- **Status:** accepted | proposed
- **Scope:**
- **Rule:**
- **Rationale:** (Why)
- **Evidence:** (Canonical source: file, exemplar, or accepted decision)
- **Exceptions:**
- **Bad example:**
- **Good example:**
- **Assumptions:**
- **Open decisions:**
```

Traceability example:

```text
rule/destructive-names-object
Source: copy.md; surfaces-destructive.md
Rule:   Destructive CTAs name Verb + object. Never Confirm, OK, or a bare verb.
```

## Promotion test (Vercel)

Can code identify the failure without rendering?

- **No** → agent guidance (this skill).
- **Yes** → can the rule avoid likely false positives?
  - **No** → agent guidance.
  - **Yes** → does the violation have a concrete fix?
    - **Yes** → Cursor rule or linter.
    - **No** → warning or agent guidance.

Needs product or codebase context → agent guidance.
Establishes a new standard or product policy → human decision.
Never promote one screenshot, one shipped file, or one comment into a universal rule by itself.

## Where rules live

| Kind | Destination |
| --- | --- |
| Product judgment | `references/product-judgment.md` or a surface file |
| Visual quality | `interface-quality.md` |
| Copy | `copy.md` / `glossary.md` |
| Tokens/components | `project-design-system` |
| A11y/HTML/focus | `web-design-guidelines` (do not duplicate) |
| Unsettled | `coverage-gaps.md` |
| Worth repeating | `exemplars/` |
