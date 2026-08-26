# Insurer Baseline Cover Email — Draft (worked example: Suncorp)

Reusable cover email to pair with `Margin_Rule_Baseline_Template.xlsx`. Replace the bracketed
fields for each insurer. Suncorp is used below as the worked example since their baseline is
already confirmed (28 May 2026 meeting) — this is what "pre-filled, confirm or correct" looks
like in practice.

---

**Subject:** Suncorp Margin Rule Baseline — confirming the details

Hi Daniel,

Thanks again for your time — this follows up on what we covered in our two conversations
so far.

Quick recap: insurer rules sit on the parts selection grid repairers use when quoting jobs.
Once confirmed, your rule applies the right pricing method and margin to every part type
automatically, so repairers see compliant pricing without calculating it by hand.

Attached is the baseline template, already filled in with what we discussed — 100% of list
for OEM, 80% of list across Aftermarket, Reconditioned, Parallel and Recycled, applying
uniformly across Suncorp, Amy, ABO, GIO and Shannons. Could you confirm this is correct, or
mark up anything that needs to change? One thing we weren't sure on — Shannons was flagged as
having some additional complexity; if that needs its own line, let us know and we'll add it.

Separately — worth flagging early: we're exploring a further phase of this work that would let
rules respond to more than one condition at once (for example, a rule that changes based on
vehicle age, or whether a specific part is available), so your pricing can be applied even more
precisely than a single flat rule allows. That's still in discovery on our side, so nothing to
action yet — just wanted you across it before it comes up in a future conversation.

Could you get the attached back to us by **[insert return-by date]**? Happy to jump on a call
instead if that's easier.

Thanks,
Shereen

---

## Adapting this for other insurers

**Already have a confirmed or partially-confirmed baseline — send as "confirm this is right":**

| Insurer | Contact | Pre-fill from | Note to include |
|---|---|---|---|
| IAG / NRMA | Bruce Taylor | `Insurer Conversations/2026-04-29-IAG-Rules-Deep-Dive.md` | Aftermarket is "Not Acceptable" — flag this as a hard rule, not a soft default. Sub-brands: NRMA, RACV, CGU. |
| Allianz | Brent Fraser | `Insurer Conversations/2026-05-08-Allianz-Intro-Rules.md` | Recycled/Parallel just moved 75%→80% — note the rule may already be stale by the time this is confirmed. RAA (SA) rules still unknown — ask Brent for an update rather than leaving blank. |

**Not yet engaged — send as "here's what we're seeing in the market, please confirm or correct" (do not present as their stated rule):**

| Insurer | Pre-fill from (`DataSet/Baseline_Rule_Recommendations.md`) | Recommended default to pre-fill |
|---|---|---|
| Auto & General (A&G) | A&G — Standard | OEM 100%, AFT 75%, RECO 70%, PARA 80%, USED 75% |
| QBE | QBE — Standard 75/80 | OEM 100%, AFT 70%, RECO 75%, PARA 80%, USED 70% |
| Capital SMART | Capital SMART — Default | Flat 80% across all non-OEM (94% of shops already match this) |
| RACQ | RACQ — Standard (AFT 70) | OEM 100%, AFT 70%, RECO 70%, **PARA 90%** (RACQ's signature — don't default this to 80%), USED 70% |
| Youi | Youi — Standard (AFT Cost) | OEM 100%, AFT 30% of cost, RECO 70%, PARA 80%, USED 70% |

For these five, swap the recap paragraph's second sentence to something like: *"Based on how repairers are currently pricing [Insurer] jobs on PartsCheck, we've pre-filled a likely starting rule in the attached template — we'd like you to confirm whether this matches your actual policy, or correct it."* This keeps the ask honest: it's a data-derived starting point, not a claim about their rule.

Keep the Phase 2 teaser paragraph identical across all eight — it's intentionally generic and non-committal (OD #40 and OD #41 on the exact mechanics are still open internally, so nothing more specific should go out yet).
