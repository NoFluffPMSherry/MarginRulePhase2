# Margin Rule Overlay (MRO)

PartsCheck margin-rule authoring and the Check Price grid it drives, including
the cross-type conditional rules overlay (When → Then), the vehicle-age gate,
and safety-critical part exceptions.

Static site — no build step. Uses React + in-browser Babel via CDN, same as
the original design prototype.

## Run locally
Serve the folder (opening `index.html` directly also works, but `<a>` links
between the two pages need `http(s)://`, not `file://`, in some browsers):
```
npx serve .
```

## Pages
- `index.html` — **Check Price**, the quote grid with the margin rule resolved
  per line (hover a priced cell for the full working).
- `margin-rules.html` — **Settings → Margin Rules**, the rule builder for the
  Allianz custom rule (pricing methods, combination clauses, caps, vehicle-age
  gate, conditional cross-type rules, and safety-exception categories).

Both pages share the top navigation (`js/shared.jsx`); the **Check Price** and
**Settings** tabs link between them.

## Files
- `css/base.css` — reset, design tokens, top nav / sub nav / page shell, buttons, shared form controls
- `css/rules.css` — Margin Rules page styles (pricing table, rule rail, conditional rules, exceptions)
- `css/quote.css` — Check Price page styles (grid, hover popover, metrics)
- `js/engine.js` — pricing engine, data model, resolution logic (`window.MRO`), no UI dependency
- `js/shared.jsx` — shared top navigation (`window.MROShared`)
- `js/margin-rules.jsx` — Margin Rules page (Rule Builder)
- `js/check-price.jsx` — Check Price page (quote grid)

## Data
All rule and quote data is in-memory/mock, matching the design prototype —
there is no backend yet.
