/* ══════════════════ MRO PRICING ENGINE ══════════════════
   Data model + resolution logic for margin rules. No UI, no React —
   exposed on window.MRO for the page scripts to consume. */

const METHODS = {
  pctList:    { label:'Charge % of List',      short:'% of list', kind:'pct',    suf:'% list' },
  markupCost: { label:'Markup on Cost',        short:'markup',    kind:'pct',    suf:'% mkup' },
  showMarkup: { label:'Show Markup on Cost (WA)', short:'show mkup', kind:'pct', suf:'% show' },
  listPrice:  { label:'Use Dealer List',       short:'dealer list', kind:'flat' },
  manual:     { label:'Fixed Sell Price',      short:'fixed',     kind:'dollar' },
  notAccepted:{ label:'Not Accepted',          short:'not accepted', kind:'na' },
};

const CAP_TYPES = {
  priceCeiling:  { label:'Cap sell price at', pre:'$', kind:'dollar', chip:'$# cap' },
  pctListCeiling:{ label:'Cap sell at % of list', suf:'%', kind:'pct', chip:'#% list cap' },
  costCap:       { label:'Markup only on cost up to', pre:'$', kind:'dollar', chip:'markup ≤ $#' },
};

function isNA(rule){ return rule.clauses[0] && rule.clauses[0].method === 'notAccepted'; }

function clauseValue(cl, part, cap){
  const { list, cost } = part;
  if(cl.method === 'pctList')   return list * cl.value/100;
  if(cl.method === 'listPrice') return list;
  if(cl.method === 'manual')    return cl.value;
  if(cl.method === 'notAccepted') return 0;
  if(cap && cap.enabled && cap.type==='costCap' && cost > cap.value)
    return cap.value*(1+cl.value/100) + (cost - cap.value);
  return cost * (1 + cl.value/100);
}

function resolveRule(rule, part){
  if(isNA(rule)) return { na:true, sell:0, steps:[], capped:false };
  const cap = rule.cap;
  const steps = rule.clauses.map((cl,i) => ({ i, cl, v: clauseValue(cl, part, cap) }));
  let sell, winnerIdx = 0;
  if(steps.length === 1){ sell = steps[0].v; }
  else {
    const higher = rule.resolver === 'higher';
    let best = steps[0];
    steps.forEach(s => { if(higher ? s.v > best.v : s.v < best.v) best = s; });
    sell = best.v; winnerIdx = best.i;
  }
  let capped = false, preCapSell = sell;
  if(cap && cap.enabled){
    let ceil = null;
    if(cap.type==='priceCeiling')   ceil = cap.value;
    if(cap.type==='pctListCeiling') ceil = part.list * cap.value/100;
    if(ceil != null && sell > ceil){ sell = ceil; capped = true; }
  }
  return { na:false, sell, steps, winnerIdx, capped, preCapSell, cap };
}

const fmt = n => n==null ? '—' : (n<0?'-':'')+'$'+Math.abs(n).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt0 = n => '$'+Math.round(n).toLocaleString('en-AU');

/* ══════════════════ DATA — production part types ══════════════════ */
const PART_TYPES_INIT = [
  { id:'oem', name:'OEM', color:'#1D6FE0',
    clauses:[{method:'pctList',value:90},{method:'markupCost',value:20}],
    resolver:'higher', join:'OR',
    cap:{enabled:true, type:'costCap', value:300} },
  { id:'aftermarket', name:'Aftermarket', color:'#DB6D00',
    clauses:[{method:'pctList',value:75}], resolver:'higher', join:'OR',
    cap:{enabled:false, type:'priceCeiling', value:0} },
  { id:'recon', name:'Reconditioned', color:'#7A5AF8',
    clauses:[{method:'pctList',value:75}], resolver:'higher', join:'OR',
    cap:{enabled:false, type:'priceCeiling', value:0} },
  { id:'parallel', name:'Parallel', color:'#0BA5A5',
    clauses:[{method:'pctList',value:80}], resolver:'higher', join:'OR',
    cap:{enabled:false, type:'priceCeiling', value:0} },
  { id:'recycled', name:'Recycled', color:'#12B76A',
    clauses:[{method:'markupCost',value:20}], resolver:'higher', join:'OR',
    cap:{enabled:true, type:'pctListCeiling', value:70} },
];

const SAMPLE_PARTS = [
  { id:'guard',  name:'L/H Front Guard',    list:655.93, cost:437.30 },
  { id:'bumper', name:'Front Bumper Cover', list:431.45, cost:287.60 },
  { id:'lamp',   name:'L/H Headlamp Assy',  list:483.46, cost:322.30 },
  { id:'clip',   name:'Bumper Clip Kit',    list:35.38,  cost:8.60  },
];

const EXCEPTION_GROUPS = [
  { id:'airbag', category:'Airbag Systems', action:'oem-only',
    parts:['Driver Airbag','Passenger Airbag','Knee Airbags','Curtain Airbags','Airbag Electronic Control Unit','Airbag Sensors','Crash Sensor'] },
  { id:'abs', category:'ABS / Braking Safety Systems', action:'oem-only',
    parts:['ABS Speed Sensor','ABS Sensor Cable','ABS Control Unit','ABS Hydraulic Pump'] },
  { id:'restraints', category:'Restraints', action:'oem-only',
    parts:['Seat Belts','Seat Belt Stalk'] },
  { id:'interior', category:'Interior', action:'oem-only',
    parts:['Instrument Panel / Dash (airbag-integrated)','Front Seat Cover (airbag-integrated)'] },
  { id:'electronic', category:'Electronic Safety Systems', action:'oem-only',
    parts:['Electronic Control Modules'] },
  { id:'suspension', category:'Suspension', action:'oem-only',
    parts:['Ball Joint','Link Arm','Stabilizer Links'] },
  { id:'radiator', category:'Radiators & Condensers', action:'direct-bill',
    parts:['Radiator','Condenser (Front)','Condenser (Rear)'],
    note:'Managed exclusively through a direct-bill arrangement with the nominated supplier (AAA). Not acceptable through any other supplier or pricing method without prior assessor approval.' },
];
const NOT_ACCEPTABLE = ['Used','Parallel','Aftermarket','Recon / Exchange'];

/* vehicle-age gate: when the vehicle is younger than maxYears, only OEM is acceptable */
const CURRENT_YEAR = 2026;
const VEHICLE_AGE_RULE_INIT = { enabled:true, maxYears:3 };
const vehicleAge = year => CURRENT_YEAR - year;
const ageForcesOEM = (year, ageRule) => !!(ageRule && ageRule.enabled && vehicleAge(year) < ageRule.maxYears);

const PT_COLOR = id => (PART_TYPES_INIT.find(p=>p.id===id)||{}).color || '#98A2B3';
const PT_NAME  = id => (PART_TYPES_INIT.find(p=>p.id===id)||{}).name || id;

/* ══════════════════ CONDITIONAL (CROSS-TYPE) RULES ══════════════════ */
/* A rule reads: WHEN <conditions joined by AND/OR> THEN <target> should <outcome>.
   Conditions test another part type's state on the same line; outcomes can
   reference another part type's computed price. This is the overlay that lets
   rules read ACROSS part types — everything in resolveRule is per-type. */

/* Condition predicates. `needsRef` ones compare this type's base price to another type's. */
const COND_PREDICATES = {
  available:   { label:'is available',          needsRef:false },
  unavailable: { label:'is not available',      needsRef:false },
  cheaper:     { label:'is cheaper than',        needsRef:true  },
  dearer:      { label:'is more expensive than', needsRef:true  },
};

/* Outcome kinds. `method` sets an explicit pricing formula on the target;
   `matchRef`/`capRef` reference another type's computed price. Any non-block
   outcome may also carry an optional cap (price ceiling or % of list). */
const COND_OUTCOMES = {
  matchRef:    { label:"be priced at {ref}'s rate",  needsRef:true,    verb:'matched'  },
  capRef:      { label:"be capped at {ref}'s price", needsRef:true,    verb:'capped'   },
  method:      { label:"be priced at",               needsMethod:true, verb:'repriced' },
  notAccepted: { label:'not be accepted',            verb:'blocked'   },
};

/* caps available inside a conditional outcome (ceilings only) */
const COND_CAP_TYPES = {
  priceCeiling:   { label:'cap at', pre:'$',  chip:'≤ $#'      },
  pctListCeiling: { label:'cap at', suf:'%',  chip:'≤ #% list' },
};

/* availability = an offer exists for the type AND its own rule doesn't mark it Not Accepted */
function typeAvailable(pt, offers){ return !!offers[pt.id] && !isNA(pt); }

function applyCondCap(sell, cap, part){
  if(!cap || !cap.enabled || sell==null || !part) return { sell, capped:false };
  let ceil = null;
  if(cap.type==='priceCeiling')   ceil = cap.value;
  if(cap.type==='pctListCeiling') ceil = part.list * cap.value/100;
  if(ceil!=null && sell > ceil) return { sell:ceil, capped:true };
  return { sell, capped:false };
}

function evalCond(c, avail, base){
  if(c.predicate==='available')   return !!avail[c.partType];
  if(c.predicate==='unavailable') return !avail[c.partType];
  const a = base[c.partType], b = base[c.ref];
  if(a==null || b==null) return false;
  return c.predicate==='cheaper' ? a < b : a > b;
}
function condMatches(rule, avail, base){
  if(!rule.conditions.length) return false;
  const r = rule.conditions.map(c=>evalCond(c, avail, base));
  return rule.join==='AND' ? r.every(Boolean) : r.some(Boolean);
}

/* offers: { typeId: {list,cost} } — present only for types quoted on this line.
   Returns base (per-type sell before overlay), final (after overlay), and a trace. */
function resolveConditional(partTypes, offers, condRules){
  const avail = {}, base = {};
  partTypes.forEach(pt=>{
    avail[pt.id] = typeAvailable(pt, offers);
    if(offers[pt.id]) base[pt.id] = isNA(pt) ? null : resolveRule(pt, offers[pt.id]).sell;
  });
  const final = {...base};
  const trace = [];
  (condRules||[]).forEach(rule=>{
    if(rule.enabled===false) return;
    if(!condMatches(rule, avail, base)) return;
    const tgt = rule.target, oc = rule.outcome, tOffer = offers[tgt];
    const before = final[tgt];
    let after = before, refSell = null, capped = false;

    if(oc.type==='notAccepted'){
      after = null;
    } else if(oc.type==='method'){
      if(!tOffer) return;                                  // need target's own numbers
      after = clauseValue(oc.clause, tOffer, null);
    } else {
      refSell = base[oc.ref];
      if(refSell==null) return;                            // reference not on this line → no effect
      after = oc.type==='matchRef' ? refSell
            : (before==null ? refSell : Math.min(before, refSell));  // capRef
    }
    if(oc.type!=='notAccepted' && oc.cap && oc.cap.enabled && tOffer){
      const c = applyCondCap(after, oc.cap, tOffer); after = c.sell; capped = c.capped;
    }
    if(after===before) return;
    final[tgt] = after;
    trace.push({ rule, target:tgt, before, after, refSell, ref:oc.ref, capped });
  });
  return { avail, base, final, trace };
}

const COND_RULES_INIT = [
  { id:'cr1', enabled:true, join:'AND',
    conditions:[{partType:'oem',predicate:'available'},{partType:'parallel',predicate:'available'}],
    target:'oem', outcome:{ type:'matchRef', ref:'parallel', cap:{enabled:false,type:'priceCeiling',value:0} } },
];

/* worked-example line for the builder: OEM + Parallel + Aftermarket all quoted */
const COND_SAMPLE = {
  name:'L/H Front Guard', list:659.80,
  offers:{ oem:{list:659.80,cost:527.84}, parallel:{list:659.80,cost:290.00}, aftermarket:{list:659.80,cost:305.00} },
};

window.MRO = { METHODS, CAP_TYPES, resolveRule, clauseValue, isNA, fmt, fmt0, PART_TYPES_INIT, SAMPLE_PARTS, EXCEPTION_GROUPS, NOT_ACCEPTABLE, PT_COLOR, PT_NAME, CURRENT_YEAR, VEHICLE_AGE_RULE_INIT, vehicleAge, ageForcesOEM,
  COND_PREDICATES, COND_OUTCOMES, COND_CAP_TYPES, resolveConditional, condMatches, typeAvailable, COND_RULES_INIT, COND_SAMPLE };
