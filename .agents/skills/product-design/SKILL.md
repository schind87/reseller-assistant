---
name: product-design
description: >-
  Single entry point for product design and user-facing product implementation
  in Reseller Assistant. Use whenever work changes what a user sees, understands,
  chooses, or does: shaping requirements and flows; building or redesigning
  pages and components; reviewing URLs, screenshots, diffs, or audit findings;
  improving product copy, information architecture, component choice,
  hierarchy, layout, interaction, accessibility, responsive behavior, and
  loading, empty, error, permission, or destructive states. Trigger on design,
  UX, UI, usability, flow, onboarding, settings, listing hub, Phone Companion,
  build, improve, fix, audit, review, polish, simplify, or production-ready
  requests. Also use when backend behavior changes a user-visible outcome.
  Not for backend-only work with no user-visible effect, tests with no shipped
  UI impact, telemetry-only work, or unrelated documentation.
---

> Provenance: Architecture adapted from Vercel’s public article
> [Teaching agents product design at Vercel](https://vercel.com/blog/teaching-agents-product-design-at-vercel)
> (June 25, 2026). This file is a Reseller Assistant adaptation, not an official
> unpublished Vercel document. Vercel-internal paths (Geist, `apps/vercel-site`,
> Vercel Agent) are replaced with this repository’s actual surfaces and skills.

# Reseller Assistant Product Design

Make the interface correct for the seller, the product, and this repository. Working code is not enough: choose the right interaction, make scope and consequences clear, cover reality beyond the happy path, and verify the rendered result.

This app is a **guided clothing-listing coach** for Mercari and Poshmark: one piece at a time, photos on the phone, draft and post from the listing hub. It is an operational tool, not a marketing site and not a generic admin dashboard.

## Operating Contract

- **Start with the job, not the pixels.** Identify who is acting (usually a clothing reseller, sometimes a phone-join session, sometimes an admin), what they are trying to accomplish, the product object involved, and what the system will change.
- **Define the outcome before the output.** Establish the current user problem, desired behavior, success signal, and non-goals before choosing a surface or component.
- **Use evidence, not taste.** Trace decisions to product behavior, canonical repository guidance, an accepted design decision, or a verified adjacent pattern.
- **Separate facts from decisions.** Mark assumptions and unresolved product choices explicitly; do not hide them inside implementation details.
- **Treat shipped code as evidence, not automatic precedent.** It proves what exists, not why it is correct. Check it against current components, product behavior, and explicit guidance.
- **Choose the smallest coherent intervention.** Consider better defaults, behavior, or reuse before adding UI. Do not solve one job by creating unrelated settings or abstractions.
- **Reuse before inventing a visual pattern.** Before creating a materially new visual pattern, inspect at least two relevant existing product surfaces and the applicable exemplars. If a new pattern is still justified, state why existing patterns are insufficient.
- **Do not introduce a new visual convention solely as part of unrelated feature work.** A feature change is not a license to redesign buttons, radii, modals, typography, or other chrome that the feature does not require.
- **Decide before decorating.** Resolve information architecture, component semantics, interaction, and state behavior before styling or rewriting copy.
- **Design every reachable state.** Include only states the product can actually enter, but do not stop at the populated success case.
- **Verify the real surface.** Source inspection establishes behavior; a rendered interface establishes visual and interaction quality. Never claim visual verification from code alone.
- **Keep one user-facing entry point.** Invoke `product-design`; route internally to the canonical sources below.

## Request Modes

Resolve the mode from the user's verb and artifact before acting.

| Mode | Typical request | Required behavior |
| --- | --- | --- |
| Shape | "Design this flow", "How should this work?", feature brief without settled UI | Frame the problem and evidence, compare material alternatives, then define the flow, states, acceptance criteria, risks, and open decisions. Do not edit unless asked. |
| Implement | "Build", "fix", "improve", "make compliant", or "run product-design on everything" | Resolve material product decisions, then implement the smallest coherent end-to-end change within scope. Do not absorb unrelated review findings. |
| Review | "Audit", "critique", "what's wrong?", code review | Inspect source and rendered evidence, then report prioritized findings. Do not edit unless asked. |
| Copy | "Fix the copy", "rewrite these errors" | Edit user-facing language, accessible names, and directly required JSX only. Report structural blockers without silently broadening scope. |
| Harden | "Polish", "production-ready", "handle edge cases" | Preserve the settled product direction while fixing state, resilience, responsive, accessibility, and finish defects. |

When intent is ambiguous, use the narrowest mode supported by the verb. A URL, screenshot, route, or component identifies scope; it does not by itself authorize edits.

A material decision changes the user's task, default, scope, consequence, navigation, interaction surface, or reachable states. Copy mechanics, token replacement, and established component substitutions usually are not material.

An audit must not silently become an implementation. A copy edit must not silently become a redesign. A hardening pass must not reopen a settled product direction.

Skip this skill for backend-only work, telemetry, console errors, generated files (`extension-live/`, `.next/`), and tests with no shipped UI impact.

## Decision Authority

Resolve conflicts in this order:

1. The user's explicit goal and constraints.
2. Verified application behavior and product truth (routes, mutations, permissions, listing/photo/auth flows).
3. Repository-canonical guidance: root `AGENTS.md`, this skill, [project-design-system](../project-design-system/SKILL.md), and routed skills.
4. Accepted product/design decisions and exemplars with stable evidence.
5. Verified adjacent shipped patterns in the same product area.
6. General interface heuristics (including Vercel Web Interface Guidelines).

Do not let generic design advice override explicit local conventions without a recorded reason.

## Workflow

### 1. Set scope and mode

Name the target surface and request mode in the work plan or review notes. Report which references you loaded.

### 2. Load product context

Before proposing UI, read the applicable `AGENTS.md` chain, supplied briefs, and the product logic that determines mutations, permissions, validation, errors, and side effects. For this app that usually means listing/photo/auth code under `src/app/` and `src/lib/`, not a separate design-system package.

### 3. Model the product decision

For Shape, Implement, Harden, full Review, or any material product/flow change, read [product-judgment.md](references/product-judgment.md) and write a compact internal brief covering user, job, current behavior, desired outcome, success signal, non-goals, object, scope, action, consequence, reversibility, permissions, and open decisions.

### 4. Map the surface and states

Inventory entry points, visible regions, overlays, transitions, exits, and return paths. Map only reachable states. Read [resilience.md](references/resilience.md) and [surfaces.md](references/surfaces.md).

### 5. Load the routed references

Load only what the current surface and mode need.

| Need | Load |
| --- | --- |
| Product/flow/component decision | [product-judgment.md](references/product-judgment.md) + [project-design-system](../project-design-system/SKILL.md) |
| Implementation, material visual change, or full review | [interface-quality.md](references/interface-quality.md) |
| Copy or accessible names | [copy.md](references/copy.md) + [glossary.md](references/glossary.md) + [surfaces.md](references/surfaces.md) |
| Tokens, typography, layout, existing components | [project-design-system](../project-design-system/SKILL.md) |
| Keyboard, focus, forms, touch, animation, URL state, images, reduced motion | [web-design-guidelines](../web-design-guidelines/SKILL.md) |
| Overflow, extreme data, network/error resilience | [resilience.md](references/resilience.md) |
| React/Next performance that does not change product behavior | [vercel-react-best-practices](../vercel-react-best-practices/SKILL.md) |
| Missing or unsettled standard | [coverage-gaps.md](references/coverage-gaps.md) — do not invent a fake rule |
| Repeating a known-good decision | [exemplars/README.md](exemplars/README.md) |

Surface-specific files are listed in [surfaces.md](references/surfaces.md).

### 6. Decide, then implement

For each non-mechanical change, be able to answer: what user problem does this solve, why is this component appropriate, what consequence must the interface communicate, which evidence supports the decision, and what is the smallest coherent change?

Before creating a **materially new visual pattern** (new button treatment, radius, modal chrome, type scale, card language, icon system, or equivalent), inspect at least two relevant existing product surfaces and the applicable [exemplars](exemplars/README.md). If a new pattern is still justified, state why those existing patterns are insufficient. Matching an established local pattern does not require that write-up.

Do not introduce a new visual convention solely as part of unrelated feature work. Adding a new listing workflow should not become an opportunity to redesign `BigButton`, introduce a new dialog treatment, change the paper/forest palette, alter typography, or create a new card style unless the feature actually requires a new product pattern.

Implement only when the request mode authorizes edits.

### 7. Verify functionality

Confirm the primary job and acceptance criteria. Preserve user input through validation. Check permissions (signed-in seller vs phone-join vs admin).

### 8. Verify rendered UI (when UI changed)

Do not claim visual verification from source inspection alone.

1. Inspect the existing implementation.
2. Make the product/design decision.
3. Implement when authorized.
4. Run the app (`npm run dev`, port 3000) when a running surface is needed.
5. Inspect the rendered interface.
6. Test a representative wide viewport (listing hub ~1280px) and a representative narrow viewport (phone companion ~390px).
7. Inspect relevant reachable states, including long/realistic titles and photo-empty sections when those states exist.
8. Inspect keyboard/focus behavior when the change involves forms, dialogs, or custom controls.
9. Run the Web Interface Guidelines audit via [web-design-guidelines](../web-design-guidelines/SKILL.md).
10. Correct material findings.

When Cursor's browser and Design Mode are available, use them for rendered verification. Design Mode lives in the Agents Window browser (`Ctrl+Shift+D` / `Cmd+Shift+D`).

### 9. Audit against relevant guidelines

Route accessibility, semantic HTML, focus, keyboard, forms, touch targets, animation, reduced motion, typography mechanics, images, browser behavior, URL state, and performance-related interface concerns to `web-design-guidelines`. Do not copy those rules into this skill.

## Product Design Standards

- Make the user's primary task and primary action unmistakable.
- Preserve the user's mental model and current context unless changing it solves a verified problem.
- Name the exact object, scope, and consequence of important actions.
- Use navigation for navigation and action controls for actions.
- Choose surface persistence to match importance. Prefer inline disclosure before adding a modal.
- Expose advanced controls when needed without making the default path carry their complexity.
- Prefer strong defaults and direct behavior over adding configuration the user must learn and maintain.
- Use existing semantic components and CSS tokens before custom HTML or one-off styling. This app does **not** use Geist.
- Do not piggyback a visual redesign onto unrelated feature work. New chrome needs a product reason, two inspected surfaces, and a stated gap in existing patterns.
- Use hierarchy, spacing, and alignment before adding containers.
- Preserve user input through validation and recoverable errors.
- Keep loading control labels stable; do not change the meaning of the control while busy.
- Make destructive actions proportional to impact and provide undo only when the system can honestly support it.
- Do not add decorative novelty, motion, or copy unless it clarifies structure, state, or brand intent.

## Review Output

Lead with findings, ordered by user impact:

- **P0:** blocks the primary task, creates severe accessibility failure, or can cause unrecoverable user harm.
- **P1:** likely task failure, misleading consequence, missing critical state, or major responsive/accessibility defect.
- **P2:** meaningful friction, inconsistency, weak hierarchy, or recoverability issue.
- **P3:** minor craft or consistency improvement.

For each finding include: file/line or rendered location, verification status, canonical source, user consequence, and smallest concrete fix.

## Skill Integrity

- Add or change a rule only after current-source verification and human acceptance.
- Record scope, rationale, evidence, exceptions, and a bad/good example. See [rules.md](references/rules.md).
- Prefer the narrowest destination: canonical source, routed reference, exemplar, lint/rule check, or coverage gap.
- Keep deterministic checks mechanical. Keep judgment in prose with its evidence and degree of freedom.
- Never promote one screenshot, one shipped file, or one reviewer comment into a universal rule by itself.
