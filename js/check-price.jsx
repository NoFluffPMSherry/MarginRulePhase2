(function(){
const { useState, useEffect, useRef } = React;
const { METHODS, CAP_TYPES, resolveRule, resolveConditional, clauseValue, fmt, PT_NAME,
        PART_TYPES_INIT, VEHICLE_BRANDS, vehicleAge, ageRuleActive, ageAllowsType, matchingAgeRules,
        getActiveTypes, getActiveAgeRules, getActiveCondRules, getActiveExceptions } = window.MRO;
const { TopNav } = window.MROShared;

/* ═══════════════ CHECK PRICE GRID (Phase-1 layout) ═══════════════
   Supplier names, dealer part numbers and list prices below are modelled on a real
   PartsCheck quote (generic catalog data, not customer-identifying) so the numbers
   read as authentic in front of repairers/insurers rather than obviously round demo figures. */
/* one column per part type — each supplier's own colour/label is derived from its typeId
   so it always matches the dot colour configured for that type on the Margin Rules screen */
const QSUP = [
  { key:'jfa', name:'James Frizelles Automotive', type:'OEM',       typeId:'oem', responded:true },
  { key:'acm', name:'ACM Parts (QLD)',            type:'AFTERMARKET', typeId:'aftermarket', responded:true },
  { key:'apg', name:'Auto Parts Group (QLD)',     type:'CERT AFTM', typeId:'parallel', responded:true },
  { key:'sap', name:'Statewide Recon Parts',      type:'RECON',     typeId:'recon', responded:true },
  { key:'wgr', name:'Willawong Auto Recyclers',   type:'USED',      typeId:'recycled', responded:true },
  { key:'ajp', name:'All Jap Auto Parts',         type:'USED',      typeId:'recycled', responded:false },
];
const QPARTS = [
  { id:1, name:'FRONT BUMPER COVER', dealer:'DR6150031EBB', list:652.15,
    s:{ jfa:{cost:255.00,etd:'2-3 Days',c:'Genuine OEM stock item, same-day pickup available.'}, acm:{cost:150.00,etd:'Same Day',match:true}, apg:{cost:190.00,etd:'1-2 Days'}, wgr:{cost:140.00,etd:'3-5 Days',etdWarn:true,donor:true} } },
  { id:2, name:'FRT BUMPER ABSORBER', dealer:'D03P50111', list:147.06,
    s:{ jfa:{cost:60.00,etd:'Same Day',c:'Boxed new, includes clips.'}, apg:{cost:48.00,etd:'1-2 Days'} } },
  { id:3, name:'L/F GUARD BRACKET', dealer:'D652500U1C', list:105.81,
    s:{ jfa:{cost:44.00,etd:'2-3 Days'}, acm:{cost:27.00,etd:'Same Day',match:true} } },
  { id:4, name:'FRT BUMPER SUPPORT', dealer:'DF7150070C', list:308.62,
    s:{ jfa:{cost:140.00,etd:'2-3 Days'}, acm:{cost:85.00,etd:'Same Day'}, apg:{cost:146.16,etd:'1-2 Days',c:'Certified aftermarket.',match:true}, wgr:{cost:90.91,etd:'3-5 Days',etdWarn:true} } },
  { id:5, name:'FRT BUMPER GRILLE', dealer:'DR61501T1C', list:225.55,
    s:{ jfa:{cost:85.00,etd:'2-3 Days'}, acm:{cost:52.00,etd:'Same Day',match:true} } },
  { id:6, name:'L/F HEADLAMP ASSY', dealer:'DF89510L0F', list:722.45,
    s:{ jfa:{cost:205.00,etd:'2-3 Days'}, acm:{cost:125.00,etd:'Same Day'}, apg:{cost:238.76,etd:'1-2 Days',img:true}, wgr:{cost:118.18,etd:'2-3 Days',match:true} } },
  { id:7, name:'R/F GUARD BRACKET', dealer:'D652500U1D', list:98.40,
    s:{ apg:{cost:68.00,etd:'1-2 Days',match:true}, sap:{cost:55.00,etd:'3-5 Days',etdWarn:true} } },
  { id:8, name:'FRT BUMPER MOULD RH', dealer:'DR61502T1C', list:189.30,
    s:{ jfa:{cost:78.00,etd:'2-3 Days'}, sap:{cost:62.00,etd:'1-2 Days',match:true} } },
  // ── Parts caught by Allianz exception rules ──
  { id:9, name:'DRIVER AIRBAG MODULE', dealer:'56900-YOUI', list:1420.00,
    exc:{ mode:'oem', category:'Airbag Systems' },
    s:{ jfa:{cost:1150.00,etd:'3-5 Days',c:'Ex-stock, ships same day.',etdWarn:true}, acm:{cost:680.00,etd:'2-3 Days'}, apg:{cost:610.00,etd:'1-2 Days',c:'Certified aftermarket replacement, TÜV tested.'}, wgr:{cost:395.00,etd:'Same Day',match:true} } },
  { id:10, name:'R/F ABS SPEED SENSOR', dealer:'95671-YOUI', list:205.00,
    exc:{ mode:'oem', category:'ABS / Braking Safety Systems' },
    s:{ jfa:{cost:165.00,etd:'Same Day',c:'In stock, same-day dispatch.'}, apg:{cost:74.00,etd:'1-2 Days'}, wgr:{cost:50.00,etd:'2-3 Days',match:true} } },
];

const ruleFor = (id, types) => (types||PART_TYPES_INIT).find(t=>t.id===id) || PART_TYPES_INIT.find(t=>t.id===id);
/* one representative {list,cost} offer per part type on this line — feeds the conditional overlay */
const lineOffers = part => {
  const offers = {};
  QSUP.forEach(s=>{ const o = part.s[s.key]; if(o && !offers[s.typeId]) offers[s.typeId] = { list:part.list, cost:o.cost }; });
  return offers;
};
/* which type ids a safety-exception part currently accepts, per the live Margin Rules config —
   null means the part isn't (or is no longer) covered by any exception category, so nothing is
   restricted. Matched by category name against whatever's saved, never the demo's own assumption. */
const excAllowedTypes = (part, exceptions) => {
  if(!part.exc) return null;
  const g = (exceptions||[]).find(g=>g.category===part.exc.category);
  return g ? (g.allowedTypes||[]) : null;
};
const excLabel = (part, exceptions, types) => {
  const allowed = excAllowedTypes(part, exceptions);
  if(allowed==null) return null;
  const names = (types||PART_TYPES_INIT).filter(t=>allowed.includes(t.id)).map(t=>t.name);
  return names.length===0 ? 'Not accepted' : names.join(' + ')+' only';
};
/* is this supplier offer acceptable given exceptions + vehicle-age gate + conditional rules? */
const cellAllowed = (part, sup, ageBlocked, overrides, exceptions) => {
  const allowed = excAllowedTypes(part, exceptions);
  if(allowed && !allowed.includes(sup.typeId)) return false;   // safety exception — type not on the category's allowed list
  if(ageBlocked(sup.typeId)) return false;                     // vehicle under age threshold, type not on the allowed list
  if(overrides && overrides[sup.typeId]===null) return false;  // a conditional rule blocks this type on this line
  return true;
};
/* why a cell is locked — safety exception takes precedence over age gate, then conditional rules */
const lockKind = (part, sup, ageBlocked, overrides, exceptions) => {
  const allowed = excAllowedTypes(part, exceptions);
  if(allowed && !allowed.includes(sup.typeId)) return 'safety';
  if(ageBlocked(sup.typeId)) return 'age';
  if(overrides && overrides[sup.typeId]===null) return 'conditional';
  return null;
};
const qcell = (part, sup, types, overrides, condTrace, lineOv) => {
  const o = part.s[sup.key];
  if(!o) return null;
  const base = resolveRule(ruleFor(sup.typeId, types), { list:part.list, cost:o.cost });
  const ov = overrides && overrides[sup.typeId];
  const tr = condTrace && condTrace[sup.typeId];
  let res = (ov!=null && ov!==base.sell)
    ? {...base, sell:ov, capped:false, overridden:true, preOverride:base.sell, condRef:tr && tr.ref, condCapped:tr && tr.capped}
    : base;
  // a repairer's per-line MODIFY override is the most specific price on the line — it wins over both
  // the type rule and any conditional cross-type overlay, and only ever affects this one supplier cell
  if(lineOv){
    const sell = clauseValue({ method:lineOv.method, value:lineOv.value }, { list:part.list, cost:o.cost });
    res = { ...res, sell, capped:false, lineOverridden:true, preLineOverride:res.sell, lineMethod:lineOv.method };
  }
  return { cost:o.cost, etd:o.etd, comment:o.c, match:o.match, etdWarn:o.etdWarn, img:o.img, donor:o.donor, res, sup, modPartNo: lineOv && lineOv.partNo };
};
/* compact "X% of list" form for the single-line rule banner legend — drops combo/cap detail,
   which stays available in the full pill on Margin Rules and in the cell popover */
const legendLabel = pt => {
  const cl = pt.clauses[0];
  return cl.method==='pctList' ? `${cl.value}% of list` : cl.method==='markupCost' ? `+${cl.value}% of cost` : METHODS[cl.method].label;
};

/* single source for the five cell signals — the Show-filter toolbar, the grid's corner
   chips and the cell popover all read from this instead of each hand-copying icon/colour. */
const SIGNAL_DEFS = [
  { id:'match',   cls:'match',   label:'Dealer Part Match', color:'var(--green)',  fill:false, strokeW:3,
    icon:<path d="M5 12l5 5L20 7"/>, popLabel:'Same part #', popDesc:(c,part)=>`matches dealer #${part.dealer}` },
  { id:'etdWarn', cls:'etd',     label:'ETD Alert',         color:'var(--amber)',  fill:false, strokeW:2.4,
    icon:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>, popLabel:'ETD', popDesc:c=>c.etd },
  { id:'comment', cls:'comment', label:'Comments',          color:'var(--text-3)', fill:true,
    icon:<path d="M21 6H3v12h4v3l3-3h11z"/>, popLabel:'Comment', popDesc:c=>`"${c.comment}"` },
  { id:'img',     cls:'img',     label:'Images',            color:'var(--blue)',   fill:false, strokeW:2.4,
    icon:<><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5-4 4-3-3-6 6"/></>, popLabel:'Image', popDesc:()=>'reference photo attached' },
  { id:'donor',   cls:'donor',   label:'Donor Part',        color:'var(--purple)', fill:true,
    icon:<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.8 7.1 18.2l.9-5.5-4-3.9 5.5-.8z"/>, popLabel:'Donor part', popDesc:()=>'sourced from a written-off donor vehicle' },
];
const signalIcon = (def, size) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={def.fill?'currentColor':'none'} stroke={def.fill?undefined:'currentColor'} strokeWidth={def.fill?undefined:def.strokeW}>{def.icon}</svg>
);

function QuoteGrid(){
  const [sel, setSel] = useState({ 1:'jfa', 2:'jfa', 6:'apg', 8:'sap' });
  // per-line MODIFY overrides — key is `${partId}:${supKey}`, keeps this deliberately out of
  // the persisted rule config: it's a one-off call on this quote, not a change to the margin rule itself
  const [lineOv, setLineOv] = useState({});
  const [editing, setEditing] = useState(null); // { partId, supKey } while the Edit Selected Item modal is open
  const [activeFilter, setActiveFilter] = useState(null); // Show-filter lens: dims every cell not carrying this signal
  const [toast, setToast] = useState(null);
  const toastToken = useRef(0);
  const showToast = msg => {
    const token = ++toastToken.current;
    setToast(msg);
    setTimeout(()=>{ if(toastToken.current===token) setToast(null); }, 2200);
  };
  // make/model year come from the quoting package the RFQ was raised in — read-only here, never editable in PartsCheck
  const modelYear = 2024;
  const vehicleBrand = 'hyundai';
  // pricing rules + vehicle age rules + conditional rules — loaded from whatever was last saved on the Margin Rules screen
  const [types] = useState(getActiveTypes());
  const ageRules = getActiveAgeRules();
  const condRules = getActiveCondRules();
  const exceptions = getActiveExceptions();
  const age = vehicleAge(modelYear);
  const brandObj = VEHICLE_BRANDS.find(b=>b.id===vehicleBrand) || VEHICLE_BRANDS[1];
  const matchedAgeRules = matchingAgeRules(modelYear, vehicleBrand, ageRules);
  const ageActive = ageRuleActive(modelYear, vehicleBrand, ageRules);
  const ageBlocked = typeId => !ageAllowsType(typeId, modelYear, vehicleBrand, ageRules);
  const ageAllowedNames = types.filter(t=>!ageBlocked(t.id)).map(t=>t.name).join(' / ') || 'nothing';
  // colour comes from whatever's configured for this type on the Margin Rules screen — never hardcoded per supplier
  const colorFor = typeId => (types.find(t=>t.id===typeId)||{}).color || '#9CA3AF';

  // conditional cross-type overlay, resolved per line — {partId: {typeId: overriddenSellPrice}}
  // condTraceByPart mirrors it but keeps the full trace entry (which ref/rule actually fired) for the popover
  const condByPart = {};
  const condTraceByPart = {};
  QPARTS.forEach(p=>{
    const overrides = {}, traceMap = {};
    resolveConditional(types, lineOffers(p), condRules).trace.forEach(t=>{ overrides[t.target] = t.after; traceMap[t.target] = t; });
    condByPart[p.id] = overrides;
    condTraceByPart[p.id] = traceMap;
  });
  const condHitCount = QPARTS.filter(p=>Object.keys(condByPart[p.id]).length>0).length;

  // drop selections that become invalid when the age gate switches on
  useEffect(()=>{
    setSel(prev=>{
      const next={...prev}; let changed=false;
      QPARTS.forEach(p=>{ const k=prev[p.id]; if(k){ const s=QSUP.find(x=>x.key===k); if(s && !cellAllowed(p,s,ageBlocked,condByPart[p.id],exceptions)){ next[p.id]=null; changed=true; } } });
      return changed?next:prev;
    });
  },[ageActive, modelYear, vehicleBrand]);

  const toggle = (id, key) => {
    const part = QPARTS.find(p=>p.id===id);
    const sup = QSUP.find(s=>s.key===key);
    if(part && sup && !cellAllowed(part, sup, ageBlocked, condByPart[id], exceptions)) return;   // locked cells aren't selectable
    setSel(prev => ({...prev, [id]: prev[id]===key ? null : key}));
  };

  /* Quick Select — picks the best allowed offer per line by profit or by cost, same eligibility rules as a manual click */
  const quickSelect = mode => {
    const next = {};
    QPARTS.forEach(p=>{
      let best = null;
      QSUP.forEach(s=>{
        const c = qcell(p, s, types, condByPart[p.id], condTraceByPart[p.id]);
        if(!c || !cellAllowed(p, s, ageBlocked, condByPart[p.id], exceptions)) return;
        const score = mode==='profit' ? (c.res.sell - c.cost) : -c.cost;
        if(!best || score>best.score) best = { key:s.key, score };
      });
      if(best) next[p.id] = best.key;
    });
    setSel(next);
  };

  const totals = {};
  QSUP.forEach(s=>{ totals[s.key] = QPARTS.reduce((a,p)=>{ const c=qcell(p,s,types,condByPart[p.id]); return a+((c && cellAllowed(p,s,ageBlocked,condByPart[p.id],exceptions))?c.cost:0); },0); });

  // one pass per selected, currently-eligible line — cost/sell/profit AND the saving figure all
  // derive from this same filtered set, so a selection a conditional rule later invalidates drops
  // out of every metric together instead of lingering in just the list-price side of the maths
  const selPairs = QPARTS.map(p=>{ const k=sel[p.id]; if(!k) return null; const s=QSUP.find(x=>x.key===k); if(!s || !cellAllowed(p,s,ageBlocked,condByPart[p.id],exceptions)) return null; return { part:p, cell:qcell(p,s,types,condByPart[p.id],condTraceByPart[p.id],lineOv[p.id+':'+k]) }; }).filter(Boolean);
  const selData = selPairs.map(x=>x.cell);
  const cost = selData.reduce((a,c)=>a+c.cost,0);
  const sell = selData.reduce((a,c)=>a+c.res.sell,0);
  const profit = sell - cost;
  const margin = sell>0 ? profit/sell*100 : 0;
  const selCount = selData.length;
  const listSelTotal = selPairs.reduce((a,x)=>a+x.part.list,0);
  const saving = listSelTotal - sell;

  // Show-filter chip counts — over every cell a repairer could actually see (allowed, has an offer)
  const allCells = [];
  QPARTS.forEach(p=>QSUP.forEach(s=>{
    const c = qcell(p, s, types, condByPart[p.id]);
    if(c && cellAllowed(p, s, ageBlocked, condByPart[p.id], exceptions)) allCells.push(c);
  }));
  const SHOW_FILTERS = SIGNAL_DEFS.map(d=>({ ...d, count: allCells.filter(c=>c[d.id]).length }));
  const cellMatchesFilter = c => !activeFilter || !!c[activeFilter];
  const activeFilterColor = activeFilter && (SHOW_FILTERS.find(f=>f.id===activeFilter)||{}).color;

  return (
    <>
      <TopNav active="Check Price"/>
      <div className="page" style={{maxWidth:1340}}>
        <div className="qptab">
          <div className="qptab-i on"><span className="ic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></span>CHECK PRICE</div>
          <div className="qptab-i"><span className="ic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg></span>INFO</div>
          <div className="qptab-i"><span className="ic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></span>DOCUMENTS</div>
        </div>

        {/* Quote header + actions */}
        <div className="q1-head">
          <div>
            <div className="q1-qno"><span>QUOTE:</span> 89734</div>
            <div className="q1-qsub">{brandObj.name} · ABC123 · Insurer: <b>Allianz</b></div>
            <div className="q1-vehctl">
              <span className="q1-vehctl-lbl">Model year</span>
              <span className="q1-vehctl-val" title="Set in the quoting package — not editable in PartsCheck">{modelYear}</span>
              <span className={"q1-agechip "+(ageActive?'on':'off')}>
                {ageActive && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>}
                {age} yr{age===1?'':'s'} old{ageActive?` · ${ageAllowedNames} only`:''}
              </span>
            </div>
          </div>
          <div className="q1-head-r">
            <div>
              <div className="q1-resp-lbl">Supplier Responses</div>
              <div className="q1-resp-dots">
                {QSUP.map(s=>(
                  <span key={s.key} className={"q1-chk "+(s.responded?'':'warn')} title={s.name+' — '+(s.responded?'Received':'Not responded')}>
                    {s.responded
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 8v5m0 3h.01"/><circle cx="12" cy="12" r="10"/></svg>}
                  </span>
                ))}
              </div>
            </div>
            <button className="btn btn-ghost btn-lg">Print ▾</button>
            <button className="btn btn-ghost btn-lg">Cancel Request</button>
            <button className="btn btn-green btn-lg">Save</button>
          </div>
        </div>

        {/* Sticky header — stays in view while scrolling the grid: cost/sell/profit/saving + active rule + toolbar */}
        <div className="q1-sticky">
          <div className="q1-mcards">
            <div className="q1-mcard"><div className="q1-mcard-k">Your Cost</div><div className="q1-mcard-v">{fmt(cost)}</div><div className="q1-mcard-s">{selCount} of {QPARTS.length} parts · paid to suppliers</div></div>
            <div className="q1-mcard"><div className="q1-mcard-k">Your Sell</div><div className="q1-mcard-v">{fmt(sell)}</div><div className="q1-mcard-s">filed to Allianz under this rule</div></div>
            <div className="q1-mcard profit"><div className="q1-mcard-k">Your Profit</div><div className="q1-mcard-v profit">{fmt(profit)} <span className="q1-mcard-pct">({margin.toFixed(0)}%)</span></div><div className="q1-mcard-s">margin on selection</div></div>
            <div className="q1-mcard"><div className="q1-mcard-k">Insurer Saving</div><div className="q1-mcard-v">{fmt(saving)}</div><div className="q1-mcard-s">vs dealer list price</div></div>
          </div>

          {/* Active margin rule — one line: applied confirmation + rule picker + per-type legend */}
          <div className="q1-rulebanner">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="q1-rulebanner-check"><path d="M5 12l5 5L20 7"/></svg>
            <span className="q1-rulebanner-lbl">Margin Rule Applied</span>
            <select className="q1-rulebanner-select"><option>Allianz Standard</option><option>Allianz — My Shop</option><option>Allianz Baseline</option></select>
            <div className="q1-legend">
              {types.map(pt=>(
                <span key={pt.id} className="q1-legend-item">
                  <span className="q1-legend-dot" style={{background:pt.color}}/>
                  <b>{pt.name}</b> {legendLabel(pt)}
                </span>
              ))}
            </div>
          </div>

          {/* Toolbar — quick select, signal filters, view toggle */}
          <div className="q1-toolbar">
            <div className="q1-toolbar-grp">
              <span className="q1-toolbar-lbl">Quick Select:</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>quickSelect('profit')}>Best Profit</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>quickSelect('cost')}>Lowest Cost</button>
              <button className="btn btn-ghost btn-sm" disabled={selCount===0} onClick={()=>setSel({})}>Clear Selections</button>
            </div>
            <div className="q1-toolbar-grp">
              <span className="q1-toolbar-lbl">Show:</span>
              {SHOW_FILTERS.map(f=>(
                <button key={f.id} className={"q1-showchip "+(activeFilter===f.id?'on':'')} style={{'--chip-c':f.color}} onClick={()=>setActiveFilter(activeFilter===f.id?null:f.id)}>
                  {signalIcon(f, 11)}
                  {f.label}<span className="ct">{f.count}</span>
                </button>
              ))}
            </div>
            <div className="q1-view">
              <span className="on"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></span>
              <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></span>
            </div>
          </div>
        </div>

        {ageActive && (
          <div className="q1-agebanner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
            <span><b>{brandObj.name} vehicle is {age} years old ({modelYear}) — {matchedAgeRules.length} vehicle age rule{matchedAgeRules.length===1?'':'s'} in effect.</b> Allianz <b>{ageAllowedNames}-only</b> rule applies: offers outside {ageAllowedNames} are locked on every part, not just safety categories.</span>
          </div>
        )}

        {condHitCount>0 && (
          <div className="q1-exc" style={{background:'#F7EEFB',border:'1px solid #DCC3EA',color:'#7B2E8E'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}><path d="M4 7h16M4 12h16M4 17h10"/></svg>
            <span><b style={{color:'#5B1F6E'}}>{condHitCount} part{condHitCount===1?'':'s'} affected by conditional cross-type rules</b> — set on the Margin Rules screen. Prices recalculated based on other part types quoted on the same line.</span>
          </div>
        )}

        {QPARTS.some(p=>p.exc) && (
          <div className="q1-exc">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
            <span><b>{QPARTS.filter(p=>p.exc).length} parts on this quote fall under Allianz exception rules.</b> Safety-critical categories restrict which part types are acceptable — offers outside the allowed type(s) are locked.</span>
          </div>
        )}

        {/* Grid */}
        <div className="qscroll">
          <table className="qg">
            <thead>
              <tr>
                <th className="qg-corner">
                  <div className="qg-corner-top"><span className="qg-selcount">{selCount}/{QPARTS.length}</span><span className="qg-selword">Selected</span></div>
                  <div className="qg-corner-sub"><span>Part Number &amp; Description</span></div>
                </th>
                {QSUP.map(s=>(
                  <th key={s.key} className="qg-suph">
                    <div className="qg-supbar" style={{background:colorFor(s.typeId)}}/>
                    <div className="qg-supinner">
                      <div className="qg-supav" style={{borderColor:colorFor(s.typeId),color:colorFor(s.typeId)}}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0z"/></svg></div>
                      <div className="qg-supname">{s.name}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QPARTS.map(p=>{
                return (
                <tr key={p.id} className={p.exc?'qg-excrow':''}>
                  <td className="qg-partcell">
                    <div className="qg-cb" style={sel[p.id]?{background:'#16A34A',borderColor:'#15803D'}:{}}>{sel[p.id] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" style={{margin:'1px'}}><path d="M5 12l5 5L20 7"/></svg>}</div>
                    <div>
                      <div className="qg-pn">{p.name}</div>
                      <div className="qg-ps">Dealer: #{p.dealer}<br/>List: {fmt(p.list)} ea</div>
                      {p.exc && (
                        <span className="pn-exc oem">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>{excLabel(p, exceptions, types)}
                        </span>
                      )}
                    </div>
                  </td>
                  {QSUP.map(s=>{
                    const overrides = condByPart[p.id];
                    const c = qcell(p, s, types, overrides, condTraceByPart[p.id], lineOv[p.id+':'+s.key]);
                    if(!c) return <td key={s.key} className="gcell empty"><div className="gcell-in"/></td>;
                    const kind = lockKind(p, s, ageBlocked, overrides, exceptions);
                    if(kind) return (
                      <td key={s.key} className="gcell gcell-locked" title={kind==='age' ? `Not acceptable — blocked by a vehicle age rule (${ageAllowedNames} only)` : kind==='conditional' ? 'Not acceptable — blocked by a conditional rule on this line' : `Not acceptable under Allianz safety rule (${excLabel(p, exceptions, types)})`}>
                        <div className="gcell-in">
                          <div className="gtype gl-strike">{s.type}</div>
                          <div className="gl-price">{fmt(c.cost)}</div>
                          <div className="gl-tag"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>{kind==='age' ? 'age rule' : kind==='conditional' ? 'rule blocked' : excLabel(p, exceptions, types)}</div>
                        </div>
                      </td>
                    );
                    const selected = sel[p.id]===s.key;
                    const excAllowed = excAllowedTypes(p, exceptions);
                    const reassure = (excAllowed && excAllowed.includes(s.typeId)) || (ageActive && !ageBlocked(s.typeId));
                    const dim = !cellMatchesFilter(c);
                    const hl = activeFilter && !dim && !selected;
                    return (
                      <td key={s.key} className={"gcell "+(selected?'gcell-sel':'')+(reassure?' gcell-okexc':'')+(dim?' dim':'')+(hl?' hl':'')} style={hl?{'--hl-c':activeFilterColor}:undefined} onClick={()=>toggle(p.id, s.key)}>
                        <div className="gcell-in">
                          <div className="gtype" style={{color:colorFor(s.typeId)}}>{s.type}</div>
                          <div className="gprice">{fmt(c.cost)}</div>
                          <div className={"gprofit"+(c.res.sell - c.cost < 0 ? ' neg' : '')}>{c.res.sell - c.cost >= 0 ? '+' : ''}{fmt(c.res.sell - c.cost)}</div>
                          {c.res.lineOverridden ? <div className="glinetag">✎ overridden</div> : c.res.capped ? <div className="gcapd">⛰ capped</div> : c.res.overridden && <div className="gcondtag">⇄ rule-matched</div>}
                          <div className="getd">ETD {c.etd}</div>
                        </div>
                        {SIGNAL_DEFS.some(d=>c[d.id]) && (
                          <div className="qg-chips">
                            {SIGNAL_DEFS.filter(d=>c[d.id]).map(d=>(
                              <span key={d.id} className={"qg-chip "+d.cls} title={d.label}>{signalIcon(d)}</span>
                            ))}
                          </div>
                        )}
                        {selected && <button className="gmodify" onClick={e=>{ e.stopPropagation(); setEditing({partId:p.id, supKey:s.key}); }}>✎ MODIFY</button>}
                        <CellPop part={p} c={c} types={types}/>
                      </td>
                    );
                  })}
                </tr>
              );})}
              <tr className="qg-totrow">
                <td className="qg-partcell">Supplier Total (ex GST)</td>
                {QSUP.map(s=><td key={s.key}>{totals[s.key]>0?fmt(totals[s.key]):'$ 0.00'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {editing && (()=>{
        const part = QPARTS.find(p=>p.id===editing.partId);
        const sup = QSUP.find(s=>s.key===editing.supKey);
        const key = editing.partId+':'+editing.supKey;
        return (
          <EditItemModal
            part={part} sup={sup} current={lineOv[key]}
            onSave={vals => { setLineOv(prev=>({...prev, [key]: vals})); showToast('Pricing updated'); }}
            onReset={() => { setLineOv(prev=>{ const next={...prev}; delete next[key]; return next; }); showToast('Override reset'); }}
            onClose={() => setEditing(null)}
          />
        );
      })()}

      {toast && (
        <div className="pc-toast"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>{toast}</div>
      )}
    </>
  );
}

/* fixed vocabulary of part-number types a repairer can tag a MODIFY override with —
   mirrors what suppliers themselves can choose when quoting, so the two stay in sync */
const PN_TYPES = ['OEM Part Number','OEM Number + Special','OEM Number + Parallel','OEM Number + NDS',
  'Supplier Provided Part Number','Used','Parallel','Reconditioned','Genuine','Exchange','Second Hand'];

/* ═══ Edit Selected Item — per-line MODIFY override (part number + pricing method) ═══ */
function EditItemModal({ part, sup, current, onSave, onReset, onClose }){
  const [method, setMethod] = useState(current ? current.method : 'pctList');
  const [value, setValue] = useState(current ? current.value : 100);
  const [partNoType, setPartNoType] = useState(current ? current.partNoType || '' : '');
  const [partNo, setPartNo] = useState(current ? current.partNo || '' : '');

  const ROWS = [
    { id:'pctList',    label:'Charge % of dealer list price', suf:'%' },
    { id:'markupCost', label:'Add % markup to cost',           suf:'%' },
    { id:'showMarkup', label:'Add % show markup to cost',      suf:'%' },
    { id:'listPrice',  label:'Use dealer list and part number' },
    { id:'manual',     label:'Manually enter sell price',      pre:'$' },
  ];

  return (
    <div className="qm-overlay" onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="qm-panel">
        <div className="qm-head">
          <div><div className="qm-title">Edit Selected Item</div><div className="qm-sub">{part.name} — {sup.name}</div></div>
          <button className="qm-x" onClick={onClose}>✕</button>
        </div>
        <div className="qm-body">
          <div className="qm-field">
            <label className="qm-lbl">Display Format</label>
            <select className="sel" value={partNoType} onChange={e=>setPartNoType(e.target.value)}>
              <option value="">Type or select...</option>
              {PN_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="qm-field">
            <label className="qm-lbl">Part Number</label>
            <input className="txt" type="text" placeholder="Enter or override part number" value={partNo} onChange={e=>setPartNo(e.target.value)}/>
          </div>
          <div className="qm-rows">
            {ROWS.map(r=>(
              <label key={r.id} className={"qm-row "+(method===r.id?'active':'')} onClick={()=>setMethod(r.id)}>
                <input type="radio" name="qm-pm" checked={method===r.id} onChange={()=>setMethod(r.id)}/>
                <span className="qm-row-lbl">{r.label}</span>
                {r.id!=='listPrice' && (
                  <div className="qm-valbox">
                    {r.suf==='%' && (
                      <div className="qm-stepper" onClick={e=>e.stopPropagation()}>
                        <button type="button" tabIndex={-1} onClick={()=>{ setMethod(r.id); setValue(v=>v+1); }}>▲</button>
                        <button type="button" tabIndex={-1} onClick={()=>{ setMethod(r.id); setValue(v=>Math.max(0,v-1)); }}>▼</button>
                      </div>
                    )}
                    {r.pre && <span className="qm-pre">{r.pre}</span>}
                    <input type="number" value={value} disabled={method!==r.id} onClick={e=>e.stopPropagation()} onChange={e=>setValue(parseFloat(e.target.value)||0)}/>
                    {r.suf && <span className="qm-suf">{r.suf}</span>}
                  </div>
                )}
              </label>
            ))}
          </div>
          <div className="qm-hint">This pricing method overrides this line item only.</div>
        </div>
        <div className="qm-foot">
          <button className="btn btn-ghost" onClick={()=>{ onReset(); onClose(); }}>Reset</button>
          <button className="btn btn-green" style={{marginLeft:'auto'}} onClick={()=>{ onSave({method, value, partNoType, partNo}); onClose(); }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* price-cell hover popover — rich, Phase 2 aware */
function CellPop({ part, c, types }){
  const { res, cost, sup } = c;
  const pt = ruleFor(sup.typeId, types);
  const higher = pt.resolver==='higher';
  const markup = cost>0 ? (res.sell-cost)/cost*100 : 0;
  const disc = part.list>0 ? (part.list-cost)/part.list*100 : 0;
  const applied = cl => cl.method==='pctList' ? `${cl.value}% list` : cl.method==='markupCost' ? `+${cl.value}% cost` : cl.method==='listPrice' ? 'dealer list' : `$${cl.value}`;
  const combo = res.steps.length>1;
  const marginSell = res.sell>0 ? (res.sell-cost)/res.sell*100 : 0;
  // signal chips explained, in the same order/colour/icon as the Show-filter row and the corner chips
  const signals = SIGNAL_DEFS.filter(d=>c[d.id]);
  return (
    <div className="gpop">
      <div className="gpop-title">{sup.name} · {sup.type}</div>
      {signals.length>0 && (
        <div className="gpop-signals">
          {signals.map(sig=>(
            <div className="gpop-signal" key={sig.id}>
              <span className="gpop-signal-ic" style={{background:sig.color}}>{signalIcon(sig)}</span>
              <span><b>{sig.popLabel}</b> · {sig.popDesc(c, part)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="gpop-r"><span className="gpop-k">Supplier Part No.</span><span className="gpop-v">{part.dealer}</span></div>
      <div className="gpop-r"><span className="gpop-k">Modified Part No.</span><span className="gpop-v">{c.modPartNo || '—'}</span></div>
      <div className="gpop-r"><span className="gpop-k">Cost</span><span className="gpop-v">{fmt(cost)}</span></div>
      <div className="gpop-r warn"><span className="gpop-k">Supplier Discount</span><span className="gpop-v">⚠ {disc.toFixed(1)}%</span></div>
      <div className="gpop-r"><span className="gpop-k">Rule Applied</span><span className="gpop-v">{res.lineOverridden ? `✎ ${METHODS[res.lineMethod].label}` : res.overridden ? '⇄ Conditional rule' : (combo ? `${higher?'higher':'lower'} of ↓` : applied(res.steps[0].cl))}</span></div>
      {res.lineOverridden ? (
        <div className="gpop-sub match"><span className="gpop-k">✎ Manually overridden for this line</span><span className="gpop-v">{fmt(res.sell)}</span></div>
      ) : res.overridden ? (
        <>
          <div className="gpop-sub match"><span className="gpop-k">⇄ Matched to {res.condRef ? PT_NAME(res.condRef) : 'other type'}'s rate{res.condCapped ? ' · capped' : ''}</span><span className="gpop-v">{fmt(res.sell)}</span></div>
          <div className="gpop-sub loser"><span className="gpop-k">{pt.name} type rule ({combo ? `${higher?'higher':'lower'} of ${res.steps.map(s=>applied(s.cl)).join(' / ')}` : applied(res.steps[0].cl)}) — superseded</span><span className="gpop-v">{fmt(res.preOverride)}</span></div>
        </>
      ) : (
        <>
          {combo && res.steps.map((s,idx)=>{
            const win = res.winnerIdx===s.i;
            return (
              <div key={idx} className={"gpop-sub "+(win?'win':'loser')}>
                <span className="gpop-k">{String.fromCharCode(65+idx)} · {applied(s.cl)}{win && <span className="gpop-tagm">{higher?'HIGHER':'LOWER'}</span>}</span>
                <span className="gpop-v">{fmt(s.v)}</span>
              </div>
            );
          })}
          {res.capped && <div className="gpop-sub cap"><span className="gpop-k">⛰ {CAP_TYPES[pt.cap.type].chip.replace('#',pt.cap.value)}</span><span className="gpop-v">{fmt(res.sell)}</span></div>}
        </>
      )}
      <div className="gpop-r"><span className="gpop-k">List Price</span><span className="gpop-v">{fmt(part.list)}</span></div>
      <div className="gpop-final"><span className="gpop-k">Sell Price</span><span className="gpop-v">{fmt(res.sell)}</span></div>
      <div className="gpop-r" style={{borderBottom:'none'}}><span className="gpop-k">Profit</span><span className="gpop-v" style={{color: res.sell-cost < 0 ? 'var(--red)' : 'var(--green-d)'}}>{fmt(res.sell-cost)}</span></div>
      <div className="gpop-foot">Margin on sell {marginSell.toFixed(1)}% · Markup on cost {markup.toFixed(1)}%</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<QuoteGrid/>);
})();
