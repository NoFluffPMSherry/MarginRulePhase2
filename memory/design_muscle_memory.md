---
name: design-muscle-memory
description: Design briefs/mockups must match PartsCheck/FlexiQuote's existing production visual language — never modernise styling incidentally while adding a feature
metadata:
  type: feedback
---

When producing or reviewing design mockups, briefs, or UI concepts for PartsCheck or FlexiQuote, always match the existing production visual system (fonts, colours, corner radii, spacing, component patterns, badge/label conventions) rather than introducing new or "modernised" styling — even when the task is only to add one new feature.

**Why:** Repairers and suppliers have used these products for 10–15 years and have deep, literal muscle memory. Every visual change must be intentional and tied to a stated efficiency/speed-of-quoting goal — never made "because we can" or because it looks more polished. Caught concretely on 20 Jul 2026 (Image and Documents from Supplier/Repairer initiative): a mockup meant only to add a photo-upload affordance had drifted into re-skinning the entire Check Price grid screen — new font (Inter), rounded corners, shadows, pill-shaped badges — none of which exist in production, including on components (margin-rule pills, cost/sell/profit bar) that were recently shipped and untouched by the actual feature ask.

**How to apply:**
- Before finalising any mockup, compare it directly against real production screenshots/screen chrome — don't rely on memory of "roughly how it looks."
- Reuse existing established UI patterns for the same concept (e.g. the Info tab's thumbnail-with-numbered-badge convention) instead of inventing a new visual treatment.
- If a mockup happens to reproduce an already-shipped component (margin-rule pills, cost/sell/profit bar, nav, tab bar), leave its styling exactly as-is — don't let it drift, or reviewers may mistake the mockup for a broader redesign of that surface.
- Apply the most scrutiny to the Check Price grid screen specifically — it's the highest-stakes, highest-frequency screen in the product (fast per-line supplier selection), so flag any visual-noise or muscle-memory risk there first.
- New UI is acceptable only where there's genuinely no existing pattern to reuse (e.g. a full-screen lightbox) — and even then, keep it visually restrained/flat rather than reaching for shadows, gradients, or animation by default.

Ties to CLAUDE.md's Product Thinking Lens (Repairer friction / Adoption reality checks) and the CPO stakeholder's "platform coherence" / "what does this force us to maintain" watch-outs.
