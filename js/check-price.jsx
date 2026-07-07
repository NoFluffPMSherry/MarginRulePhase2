(function(){
const { useState, useEffect } = React;
const { METHODS, CAP_TYPES, resolveRule, resolveConditional, fmt,
        PART_TYPES_INIT, vehicleAge, ageRuleActive, ageAllowsType,
        getActiveTypes, getActiveAgeRule, getActiveCondRules } = window.MRO;
const { TopNav } = window.MROShared;

/* ═══════════════ CHECK PRICE GRID (Phase-1 layout) ═══════════════ */
const QSUP = [
  { key:'oemd', name:'OEM Direct',    color:'#1D6FE0', type:'OEM',       cls:'oem',   typeId:'oem' },
  { key:'pn',   name:'Parts Network', color:'#9333EA', type:'CERT AFTM', cls:'cert',  typeId:'parallel' },
  { key:'ats',  name:'ATS Parts',     color:'#C026D3', type:'OEM',       cls:'oem',   typeId:'oem' },
  { key:'eco',  name:'Eco Parts',     color:'#12B76A', type:'USED',      cls:'used',  typeId:'recycled' },
  { key:'reco', name:'Reco Centre',   color:'#F79009', type:'RECON',     cls:'recon', typeId:'recon' },
];
const QPARTS = [
  { id:1, name:'FRONT BUMPER', dealer:'86510-G3700', list:659.80,
    s:{ oemd:{cost:527.84,etd:'2-3 Days',c:true}, pn:{cost:290.00,etd:'1-2 Days'}, ats:{cost:305.00,etd:'Same Day',flag:true}, reco:{cost:300.00,etd:'3-5 Days'} } },
  { id:2, name:'LOWER BUMPER COVER', dealer:'86512-G3700', list:261.26,
    s:{ oemd:{cost:209.01,etd:'Same Day',c:true}, pn:{cost:112.00,etd:'1-2 Days'}, ats:{cost:135.00,etd:'2-3 Days',c:true}, eco:{cost:82.00,etd:'3-5 Days'} } },
  { id:3, name:'R/F OUT BUMPER BRKT', dealer:'86514-G3000', list:41.16,
    s:{ eco:{cost:15.00,etd:'Same Day',flag:true} } },
  { id:4, name:'RIGHT HEADLAMP ASSY', dealer:'92102-G3115', list:2259.56,
    s:{ pn:{cost:980.00,etd:'Same Day',c:true,flag:true}, eco:{cost:1427.00,etd:'2-3 Days',c:true}, reco:{cost:1180.00,etd:'1-2 Days'} } },
  { id:5, name:'R/BADGE "N-LINE"', dealer:'86312-G4700', list:70.14,
    s:{ eco:{cost:22.00,etd:'Same Day',flag:true} } },
  { id:6, name:'R/H SILL PANEL MOULD', dealer:'9124106', list:965.50,
    s:{ oemd:{cost:640.00,etd:'2-3 Days'}, pn:{cost:470.00,etd:'1-2 Days',c:true,flag:true}, ats:{cost:490.00,etd:'Same Day'}, eco:{cost:300.00,etd:'2-3 Days'} } },
  { id:7, name:'GUARD L/H', dealer:'66311-G3000', list:512.40,
    s:{ oemd:{cost:410.00,etd:'2-3 Days'}, pn:{cost:300.00,etd:'1-2 Days'}, ats:{cost:395.00,etd:'Same Day'} } },
  { id:8, name:'BONNET', dealer:'66400-G3000', list:1120.00,
    s:{ oemd:{cost:720.00,etd:'3-5 Days',c:true}, ats:{cost:735.00,etd:'2-3 Days'}, reco:{cost:600.00,etd:'1-2 Days'} } },
  // ── Parts caught by Allianz exception rules ──
  { id:9, name:'DRIVER AIRBAG MODULE', dealer:'56900-G3000', list:1486.40,
    exc:{ mode:'oem', category:'Airbag Systems' },
    s:{ oemd:{cost:1189.12,etd:'3-5 Days',c:true}, ats:{cost:1205.00,etd:'2-3 Days'}, pn:{cost:640.00,etd:'1-2 Days',c:true}, eco:{cost:410.00,etd:'Same Day',flag:true} } },
  { id:10, name:'R/F ABS SPEED SENSOR', dealer:'95671-G3000', list:214.80,
    exc:{ mode:'oem', category:'ABS / Braking Safety Systems' },
    s:{ oemd:{cost:171.84,etd:'Same Day',c:true}, pn:{cost:78.00,etd:'1-2 Days'}, eco:{cost:52.00,etd:'2-3 Days',flag:true} } },
  { id:11, name:'A/C CONDENSER (FRONT)', dealer:'97606-G3000', list:512.00,
    exc:{ mode:'directbill', category:'Radiators & Condensers', supplier:'AAA' },
    s:{} },
];

const ruleFor = (id, types) => (types||PART_TYPES_INIT).find(t=>t.id===id) || PART_TYPES_INIT.find(t=>t.id===id);
/* one representative {list,cost} offer per part type on this line — feeds the conditional overlay */
const lineOffers = part => {
  const offers = {};
  QSUP.forEach(s=>{ const o = part.s[s.key]; if(o && !offers[s.typeId]) offers[s.typeId] = { list:part.list, cost:o.cost }; });
  return offers;
};
/* is this supplier offer acceptable given exceptions + vehicle-age gate + conditional rules? */
const cellAllowed = (part, sup, ageBlocked, overrides) => {
  if(part.exc && part.exc.mode==='directbill') return false;   // whole part is off-platform
  if(part.exc && part.exc.mode==='oem' && sup.type!=='OEM') return false;  // safety exception
  if(ageBlocked(sup.typeId)) return false;                     // vehicle under age threshold, type not on the allowed list
  if(overrides && overrides[sup.typeId]===null) return false;  // a conditional rule blocks this type on this line
  return true;
};
/* why a cell is locked — safety exception takes precedence over age gate, then conditional rules */
const lockKind = (part, sup, ageBlocked, overrides) => {
  if(part.exc && part.exc.mode==='oem' && sup.type!=='OEM') return 'safety';
  if(ageBlocked(sup.typeId)) return 'age';
  if(overrides && overrides[sup.typeId]===null) return 'conditional';
  return null;
};
const qcell = (part, sup, types, overrides) => {
  const o = part.s[sup.key];
  if(!o) return null;
  const base = resolveRule(ruleFor(sup.typeId, types), { list:part.list, cost:o.cost });
  const ov = overrides && overrides[sup.typeId];
  const res = (ov!=null && ov!==base.sell) ? {...base, sell:ov, capped:false, overridden:true} : base;
  return { cost:o.cost, etd:o.etd, comment:o.c, flag:o.flag, res, sup };
};
const pillLabel = pt => {
  const parts = pt.clauses.map(cl => cl.method==='pctList' ? `${cl.value}%` : cl.method==='markupCost' ? `+${cl.value}%` : METHODS[cl.method].short);
  let s = parts.join(' / ');
  if(pt.clauses.length>1) s += pt.resolver==='higher' ? ' ↑' : ' ↓';
  return s;
};

function QuoteGrid(){
  const [sel, setSel] = useState({ 1:'oemd', 2:'oemd', 6:'pn', 8:'reco' });
  const [applied, setApplied] = useState(true);
  const [modelYear, setModelYear] = useState(2024);
  // pricing rules + vehicle age rule + conditional rules — loaded from whatever was last saved on the Margin Rules screen
  const [types] = useState(getActiveTypes());
  const ageRule = getActiveAgeRule();
  const condRules = getActiveCondRules();
  const age = vehicleAge(modelYear);
  const ageActive = ageRuleActive(modelYear, ageRule);
  const ageBlocked = typeId => !ageAllowsType(typeId, modelYear, ageRule);
  const ageAllowedNames = types.filter(t=>(ageRule.allowedTypes||[]).includes(t.id)).map(t=>t.name).join(' / ') || 'nothing';

  // conditional cross-type overlay, resolved per line — {partId: {typeId: overriddenSellPrice}}
  const condByPart = {};
  QPARTS.forEach(p=>{
    const overrides = {};
    resolveConditional(types, lineOffers(p), condRules).trace.forEach(t=>{ overrides[t.target] = t.after; });
    condByPart[p.id] = overrides;
  });
  const condHitCount = QPARTS.filter(p=>Object.keys(condByPart[p.id]).length>0).length;

  // drop selections that become invalid when the age gate switches on
  useEffect(()=>{
    setSel(prev=>{
      const next={...prev}; let changed=false;
      QPARTS.forEach(p=>{ const k=prev[p.id]; if(k){ const s=QSUP.find(x=>x.key===k); if(s && !cellAllowed(p,s,ageBlocked,condByPart[p.id])){ next[p.id]=null; changed=true; } } });
      return changed?next:prev;
    });
  },[ageActive]);

  const toggle = (id, key) => {
    const part = QPARTS.find(p=>p.id===id);
    const sup = QSUP.find(s=>s.key===key);
    if(part && sup && !cellAllowed(part, sup, ageBlocked, condByPart[id])) return;   // locked cells aren't selectable
    setSel(prev => ({...prev, [id]: prev[id]===key ? null : key}));
  };

  const totals = {};
  QSUP.forEach(s=>{ totals[s.key] = QPARTS.reduce((a,p)=>{ const c=qcell(p,s,types,condByPart[p.id]); return a+((c && cellAllowed(p,s,ageBlocked,condByPart[p.id]))?c.res.sell:0); },0); });

  const selData = QPARTS.map(p=>{ const k=sel[p.id]; if(!k) return null; const s=QSUP.find(x=>x.key===k); return (s && cellAllowed(p,s,ageBlocked,condByPart[p.id])) ? qcell(p,s,types,condByPart[p.id]) : null; }).filter(Boolean);
  const cost = selData.reduce((a,c)=>a+c.cost,0);
  const sell = selData.reduce((a,c)=>a+c.res.sell,0);
  const profit = sell - cost;
  const margin = sell>0 ? profit/sell*100 : 0;
  const selCount = selData.length;

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
            <div className="q1-qsub">Hyundai Tucson · ABC123 · Insurer: <b>Allianz</b></div>
            <div className="q1-vehctl">
              <span className="q1-vehctl-lbl">Model year</span>
              <select className="sel sel-sm" value={modelYear} onChange={e=>setModelYear(+e.target.value)}>
                {[2026,2025,2024,2023,2022,2021,2020,2019,2018].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <span className={"q1-agechip "+(ageActive?'on':'off')}>
                {ageActive && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>}
                {age} yr{age===1?'':'s'} old{ageActive?` · ${ageAllowedNames} only`:''}
              </span>
            </div>
          </div>
          <div className="q1-head-r">
            <div>
              <div className="q1-resp-lbl">Supplier Responses</div>
              <div className="q1-resp-dots">{[1,2,3,4,5].map(i=><span key={i} className="q1-chk"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg></span>)}</div>
            </div>
            <button className="btn btn-ghost btn-lg" onClick={()=>setSel({})}>Clear Selection</button>
            <button className="btn btn-ghost btn-lg">Cancel Request</button>
            <button className="btn btn-green btn-lg">Save</button>
          </div>
        </div>

        {/* Metric cards */}
        <div className="q1-metrics">
          <div className="q1-metric"><div className="q1-metric-k">Your Cost</div><div className="q1-metric-v">{fmt(cost)}</div><div className="q1-metric-s">{selCount} of {QPARTS.length} parts · paid to suppliers</div></div>
          <div className="q1-metric"><div className="q1-metric-k">Your Sell</div><div className="q1-metric-v">{fmt(sell)}</div><div className="q1-metric-s">filed to Allianz under this rule</div></div>
          <div className="q1-metric"><div className="q1-metric-k">Your Profit</div><div className="q1-metric-v profit">{fmt(profit)}</div><div className="q1-metric-s">{margin.toFixed(1)}% margin on selection</div></div>
        </div>

        {applied && (
          <div className="q1-applied">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12l5 5L20 7"/></svg>
            <span><b>Allianz — My Shop</b> rule applied to this quote.</span>
            <span className="x" onClick={()=>setApplied(false)}>×</span>
          </div>
        )}

        {ageActive && (
          <div className="q1-agebanner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
            <span><b>Vehicle is {age} years old ({modelYear}) — under the {ageRule.maxYears}-year threshold.</b> Allianz <b>{ageAllowedNames}-only</b> rule is in effect: offers outside {ageAllowedNames} are locked on every part, not just safety categories.</span>
          </div>
        )}

        {condHitCount>0 && (
          <div className="q1-exc" style={{background:'#F4EEFF',border:'1px solid #E4D9FB',color:'#7A5AF8'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}><path d="M4 7h16M4 12h16M4 17h10"/></svg>
            <span><b style={{color:'#5A3FD1'}}>{condHitCount} part{condHitCount===1?'':'s'} affected by conditional cross-type rules</b> — set on the Margin Rules screen. Prices recalculated based on other part types quoted on the same line.</span>
          </div>
        )}

        {QPARTS.some(p=>p.exc) && (
          <div className="q1-exc">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
            <span><b>{QPARTS.filter(p=>p.exc).length} parts on this quote fall under Allianz exception rules.</b> Safety-critical categories are OEM-only — cheaper non-OEM offers are locked. Radiators &amp; condensers are billed direct off-platform.</span>
          </div>
        )}

        {/* Active margin rule bar */}
        <div className="q1-rulebar">
          <span className="q1-rulebar-lbl">Active Margin Rule:</span>
          <select className="sel sel-sm" style={{minWidth:130}}><option>Allianz — My Shop</option><option>Allianz Baseline</option><option>Standard</option></select>
          <div className="q1-pills">
            {types.map(pt=>(
              <span key={pt.id} className={"q1-pill "+pt.id}>
                {pt.name} {pillLabel(pt)}
                {pt.clauses.length>1 && <span className="combo">◇</span>}
                {pt.cap.enabled && <span>⛰</span>}
              </span>
            ))}
          </div>
          <div className="q1-rr">
            <span>Quick Select:</span>
            <select className="sel sel-sm"><option>— None —</option><option>Max Profit</option><option>Min Cost</option><option>OEM Dealer</option></select>
            <button className="qtool-btn"><span className="pdf">▤</span>Print</button>
            <div className="q1-view"><span className="on"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></span><span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></span></div>
          </div>
        </div>

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
                    <div className="qg-supbar" style={{background:s.color}}/>
                    <div className="qg-supinner">
                      <div className="qg-supav" style={{borderColor:s.color,color:s.color}}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0z"/></svg></div>
                      <div className="qg-supname">{s.name}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QPARTS.map(p=>{
                const db = p.exc && p.exc.mode==='directbill';
                return (
                <tr key={p.id} className={p.exc?'qg-excrow':''}>
                  <td className="qg-partcell">
                    {db ? (
                      <div className="qg-cb qg-cb-lock" title="Off-platform — not selectable here"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg></div>
                    ) : (
                      <div className="qg-cb" style={sel[p.id]?{background:'#1D6FE0',borderColor:'#1D6FE0'}:{}}>{sel[p.id] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" style={{margin:'1px'}}><path d="M5 12l5 5L20 7"/></svg>}</div>
                    )}
                    <div>
                      <div className="qg-pn">{p.name}</div>
                      <div className="qg-ps">Dealer: #{p.dealer}<br/>List: {fmt(p.list)} ea</div>
                      {p.exc && (
                        <span className={"pn-exc "+(db?'db':'oem')}>
                          {db
                            ? <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M2 7h20v10H2zM2 11h20"/></svg>Direct bill</>
                            : <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>OEM only</>}
                        </span>
                      )}
                    </div>
                  </td>
                  {db ? (
                    <td className="gcell-directbill" colSpan={QSUP.length}>
                      <div className="db-inner">
                        <div className="db-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 7h20v10H2zM2 11h20"/></svg></div>
                        <div>
                          <div className="db-t">Managed off-platform — direct bill via {p.exc.supplier}</div>
                          <div className="db-s">{p.exc.category} · not orderable through PartsCheck suppliers. Requires prior assessor approval.</div>
                        </div>
                        <span className="db-badge">Assessor approval</span>
                      </div>
                    </td>
                  ) : QSUP.map(s=>{
                    const overrides = condByPart[p.id];
                    const c = qcell(p, s, types, overrides);
                    if(!c) return <td key={s.key} className="gcell empty"><div className="gcell-in"/></td>;
                    const kind = lockKind(p, s, ageBlocked, overrides);
                    if(kind) return (
                      <td key={s.key} className="gcell gcell-locked" title={kind==='age' ? `Not acceptable — vehicle under ${ageRule.maxYears} years (${ageAllowedNames} only)` : kind==='conditional' ? 'Not acceptable — blocked by a conditional rule on this line' : 'Not acceptable under Allianz OEM-only safety rule'}>
                        <div className="gcell-in">
                          <div className={"gtype gl-strike gtype-"+s.cls}>{s.type}</div>
                          <div className="gl-price">{fmt(c.res.sell)}</div>
                          <div className="gl-tag"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>{kind==='age' ? `< ${ageRule.maxYears} yrs` : kind==='conditional' ? 'rule blocked' : 'OEM only'}</div>
                        </div>
                      </td>
                    );
                    const selected = sel[p.id]===s.key;
                    const reassure = (p.exc && s.type==='OEM') || (ageActive && !ageBlocked(s.typeId));
                    return (
                      <td key={s.key} className={"gcell "+(selected?'gcell-sel':'')+(reassure?' gcell-okexc':'')} onClick={()=>toggle(p.id, s.key)}>
                        <div className="gcell-in">
                          <div className={"gtype gtype-"+s.cls}>{s.type}{c.comment && <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{opacity:.55}}><path d="M21 6H3v12h4v3l3-3h11z"/></svg>}</div>
                          <div className="gprice">{fmt(c.res.sell)}</div>
                          <div className="gprofit">+{fmt(c.res.sell - c.cost)}</div>
                          {c.res.capped && <div className="gcapd">⛰ capped</div>}
                          {c.res.overridden && !c.res.capped && <div className="gcondtag">⇄ rule-matched</div>}
                          <div className="getd">ETD {c.etd}</div>
                        </div>
                        {c.flag && !selected && <div className="gcorner"/>}
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
    </>
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
  return (
    <div className="gpop">
      <div className="gpop-title">{sup.name}</div>
      <div className="gpop-r"><span className="gpop-k">Supplier Part No.</span><span className="gpop-v">{part.dealer}</span></div>
      <div className="gpop-r"><span className="gpop-k">Modified Part No.</span><span className="gpop-v">—</span></div>
      <div className="gpop-r"><span className="gpop-k">Part Type</span><span className="gpop-v">{sup.type}</span></div>
      <div className="gpop-r"><span className="gpop-k">Cost</span><span className="gpop-v">{fmt(cost)}</span></div>
      <div className="gpop-r warn"><span className="gpop-k">Supplier Discount</span><span className="gpop-v">⚠ {disc.toFixed(1)}%</span></div>
      <div className="gpop-r"><span className="gpop-k">Rule Applied</span><span className="gpop-v">{combo ? `${higher?'higher':'lower'} of ↓` : applied(res.steps[0].cl)}</span></div>
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
      <div className="gpop-r"><span className="gpop-k">Mark Up</span><span className="gpop-v">{markup.toFixed(1)}%</span></div>
      <div className="gpop-r"><span className="gpop-k">List Price</span><span className="gpop-v">{fmt(part.list)}</span></div>
      <div className="gpop-final"><span className="gpop-k">Sell Price</span><span className="gpop-v">{fmt(res.sell)}</span></div>
      <div className="gpop-r" style={{borderBottom:'none'}}><span className="gpop-k">Profit</span><span className="gpop-v" style={{color:'var(--green-d)'}}>{fmt(res.sell-cost)}</span></div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<QuoteGrid/>);
})();
