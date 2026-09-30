# Margin Rule Overlay (MRO)

PartsCheck margin-rule authoring and the Check Price grid it drives — General
Settings, Account Settings, Margin Rules, and Data Settings, plus the Get
Price and Check Price screens, all in one prototype.

This is the Phase 1 prototype (`MatJamesPartsCheck/Margin-Rules-phz-1`) as the
foundation, with the Phase 2 margin-rule work layered on top: combination
pricing clauses, caps, the vehicle-age gate, conditional cross-type "When →
Then" rules, enforced safety-critical part exceptions, and a Check Price grid
that resolves sell price live from whichever margin rule is active (hover a
priced cell for the full rule trace).

Static site — no build step. Uses React + in-browser Babel via CDN, same as
the original design prototype. Open `index.html` directly (double-click,
`file://` works fine — everything is in one file, so there's no cross-page
linking that needs `http(s)://`).

## Pages (all in `index.html`)
- **Get Price** — the quote-request wizard (untouched from Phase 1).
- **Check Price** — the quote grid; sell price per line is computed from the
  active margin rule (matched by insurer/debtor), with a hover popover
  showing the full resolution trace.
- **Settings → General / Account / Margin Rules / Data** — the Margin Rules
  tab is the rule list (create/edit/copy/view/pin/delete); opening a rule
  opens the rule editor (pricing methods + combination clauses, caps,
  vehicle-age gate, conditional rules, exceptions, debtor/insurer mapping,
  Donor Parts, live worked example, auto-generated summary).

## Phase 2 design sprint — Edit / Create Rule screen options
Exploratory variants of the rule editor (see the Notion "Phase 2 Design Sprint" page). Each is a
layout over the same rule state, so a rule saved in one option reads identically in the others and in
Check Price. Open one directly with `?edit=` (e.g. `index.html?edit=V2`) or switch with the
"Design options" bar at the top of the Add/Edit Rule screen. Shared across V1–V5: suggested
work-provider mapping chips, the plain-English "Your rule summary", and a confirm step when saving
changes to advanced rules on an existing rule.

| Option | Idea |
|---|---|
| V0 Current | Today's single long page (control) |
| V1 Index | One page, sticky jump-index, Basic / Advanced toggle |
| V2 Cards | Preview cards expand to edit, "higher of list or markup" up front, add only the advanced rules you need |
| V3 Master-detail | Rule list on the left, one editor on the right, exceptions first |
| V4 Baseline & publish | Start from a baseline (use as-is or customise), tabs by rule, preview then publish |
| V5 Dense + pinned | Everything collapsed, reorder to suit you, rule summary pinned to the bottom |

## Design proposals (not live)
- `design/export-filtered-design.html` — filtered-export design concept for
  PAR-1334 (Supplier Management + Margin Rules bulk export). Not wired into
  the app; a proposal doc only, in a different placeholder palette.

## Data
All rule and quote data is in-memory/mock plus `localStorage` for the active
margin-rule configuration (scoped per rule ID, so editing one named rule
doesn't affect another's pricing config) — there is no backend.

## Supporting docs
`Insurer_Baseline_CoverEmail_Draft.md`, `Margin_Rule_Adoption_Workbook.xlsx`,
`Margin_Rule_Baseline_Template*.xlsx` — insurer baseline rule references, not
part of the app itself.
