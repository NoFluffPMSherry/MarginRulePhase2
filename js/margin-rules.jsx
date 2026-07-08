(function(){
const { useState, useMemo } = React;
const { METHODS, CAP_TYPES, resolveRule, isNA, fmt,
        SAMPLE_PARTS, EXCEPTION_GROUPS, NOT_ACCEPTABLE,
        COND_PREDICATES, COND_OUTCOMES, COND_CAP_TYPES, resolveConditional, condMatches,
        COND_SAMPLE,
        saveRuleConfig, getActiveTypes, getActiveAgeRule, getActiveCondRules } = window.MRO;
const { TopNav } = window.MROShared;

/* ─── value input ─── */
function ValInput({ method, value, onChange }){
  const m = METHODS[method];
  if(m.kind==='flat' || m.kind==='na') return <div style={{fontSize:12,color:'var(--text-3)',fontWeight:600,paddingLeft:4}}>{m.kind==='na'?'—':'list price'}</div>;
  const dollar = m.kind==='dollar';
  return (
    <div className={"valbox"+(dollar?' dollar':'')}>
      <input type="number" value={value} onChange={e=>onChange(parseFloat(e.target.value)||0)}/>
      <span className="unit">{dollar?'$':'%'}</span>
    </div>
  );
}

/* ─── pricing table row ─── */
function PricingRow({ pt, onChange, focus, onFocus }){
  const na = isNA(pt);
  const setClause = (i, patch) => onChange({...pt, clauses: pt.clauses.map((c,idx)=> idx===i?{...c,...patch}:c)});
  const addClause = () => onChange({...pt, clauses:[...pt.clauses, {method:'markupCost', value:70}]});
  const removeClause = (i) => onChange({...pt, clauses: pt.clauses.filter((_,idx)=>idx!==i)});
  const setCap = patch => onChange({...pt, cap:{...pt.cap, ...patch}});
  const capType = CAP_TYPES[pt.cap.type] || CAP_TYPES.priceCeiling;

  return (
    <div className="pt-row" onClick={onFocus}>
      <div className={"pt-main focusable "+(focus?'pt-focus-ring':'')}>
        <div className="pt-name"><span className="pt-dot" style={{background:pt.color}}/>{pt.name}</div>
        <select className="sel" value={pt.clauses[0].method} onChange={e=>setClause(0,{method:e.target.value})}>
          {Object.entries(METHODS).map(([k,m])=><option key={k} value={k}>{m.label}</option>)}
        </select>
        <div><ValInput method={pt.clauses[0].method} value={pt.clauses[0].value} onChange={v=>setClause(0,{value:v})}/></div>
        <input className="txt" placeholder="Type or select…" defaultValue=""/>
      </div>

      {/* combination sub-line */}
      {!na && pt.clauses.length>1 && (
        <>
          <div className="subline reveal">
            <div className="sub-label"><span>then</span></div>
            <div className="sub-join">
              <div className="seg">
                <button className={"seg-btn "+(pt.join==='OR'?'on':'')} onClick={()=>onChange({...pt, join:'OR'})}>OR</button>
                <button className={"seg-btn "+(pt.join==='AND'?'on':'')} onClick={()=>onChange({...pt, join:'AND', resolver:'lower'})}>AND</button>
              </div>
              <span style={{fontSize:12,color:'var(--text-2)',fontWeight:600}}>use the</span>
              <div className="seg">
                <button className={"seg-btn "+(pt.resolver==='higher'?'on':'')} onClick={()=>onChange({...pt, resolver:'higher'})}>↑ higher</button>
                <button className={"seg-btn "+(pt.resolver==='lower'?'on':'')} onClick={()=>onChange({...pt, resolver:'lower'})}>↓ lower</button>
              </div>
            </div>
            <div/><div/>
          </div>
          <div className="subline reveal" style={{paddingTop:0}}>
            <div/>
            <select className="sel" value={pt.clauses[1].method} onChange={e=>setClause(1,{method:e.target.value})}>
              {Object.entries(METHODS).filter(([k])=>k!=='notAccepted').map(([k,m])=><option key={k} value={k}>{m.label}</option>)}
            </select>
            <ValInput method={pt.clauses[1].method} value={pt.clauses[1].value} onChange={v=>setClause(1,{value:v})}/>
            <div style={{display:'flex',justifyContent:'flex-start'}}><button className="sub-x" onClick={()=>removeClause(1)}>×</button></div>
          </div>
        </>
      )}

      {/* cap sub-line */}
      {!na && pt.cap.enabled && (
        <div className="capline reveal">
          <div className="cap-ico"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 20h18L14 4l-4 8-3-3-4 11z"/></svg></div>
          <span className="cap-lbl">Cap</span>
          <select className="sel sel-sm" value={pt.cap.type} onChange={e=>setCap({type:e.target.value})}>
            {Object.entries(CAP_TYPES).map(([k,c])=><option key={k} value={k}>{c.label}</option>)}
          </select>
          {capType.kind==='flat' ? (
            <div className="valbox-flat" style={{width:110}}>list price</div>
          ) : (
            <div className={"valbox"+(capType.pre?' dollar':'')} style={{width:110}}>
              <input type="number" value={pt.cap.value} onChange={e=>setCap({value:parseFloat(e.target.value)||0})}/>
              <span className="unit">{capType.pre||capType.suf}</span>
            </div>
          )}
          <button className="sub-x" onClick={()=>setCap({enabled:false})}>×</button>
        </div>
      )}

      {/* add affordances */}
      {!na && (
        <div className="pt-adds">
          {pt.clauses.length<2 && <button className="add-link" onClick={addClause}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 5v14M5 12h14"/></svg>
            Add OR / AND condition
          </button>}
          {!pt.cap.enabled && <button className="add-link muted" onClick={()=>setCap({enabled:true})}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M3 20h18L14 4l-4 8-3-3-4 11z"/></svg>
            Add cost / price cap
          </button>}
        </div>
      )}
    </div>
  );
}

/* ─── worked example ─── */
function ExamplePanel({ pt, samplePart, setSamplePart }){
  const res = useMemo(()=>resolveRule(pt, samplePart), [pt, samplePart]);
  const margin = res.sell>0 ? (res.sell - samplePart.cost)/res.sell*100 : 0;
  const higher = pt.resolver==='higher';
  return (
    <div className="ex">
      <div className="ex-head">
        <div className="ex-eyebrow"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v4l3 2"/></svg>Live worked example</div>
        <select className="ex-part-dd" value={samplePart.id} onChange={e=>setSamplePart(SAMPLE_PARTS.find(p=>p.id===e.target.value))}>
          {SAMPLE_PARTS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="ex-inputs">
          <div className="ex-inp"><div className="ex-inp-k">Dealer list</div><input type="number" value={samplePart.list} onChange={e=>setSamplePart({...samplePart, list:parseFloat(e.target.value)||0})}/></div>
          <div className="ex-inp"><div className="ex-inp-k">Your cost</div><input type="number" value={samplePart.cost} onChange={e=>setSamplePart({...samplePart, cost:parseFloat(e.target.value)||0})}/></div>
        </div>
      </div>
      <div className="ex-body">
        <div className="ex-focus"><span className="dot" style={{background:pt.color}}/>Resolving <b style={{color:'var(--ink)'}}>{pt.name}</b></div>
        {isNA(pt) ? (
          <div className="ex-step"><div className="ex-step-b">✕</div><div className="ex-step-txt"><b>Not accepted</b> under this rule.</div></div>
        ) : <>
          {res.steps.map((s,idx)=>{
            const m = METHODS[s.cl.method];
            const isWinner = res.steps.length>1 && res.winnerIdx===s.i;
            const isLoser = res.steps.length>1 && !isWinner;
            const desc = m.kind==='flat' ? 'dealer list' : m.kind==='dollar' ? `fixed $${s.cl.value}`
              : s.cl.method==='pctList' ? `${s.cl.value}% × list` : `cost × ${(1+s.cl.value/100).toFixed(2)}`;
            return (
              <div key={idx} className={"ex-step "+(idx>0?'c2 ':'')+(isWinner?'winner ':'')+(isLoser?'muted':'')}>
                <div className="ex-step-b">{String.fromCharCode(65+idx)}</div>
                <div className="ex-step-txt"><b>{m.short}</b> · {desc}</div>
                {isWinner && <span className="ex-step-tag tag-win">{higher?'HIGHER':'LOWER'}</span>}
                <div className="ex-step-v">{fmt(s.v)}</div>
              </div>
            );
          })}
          {res.capped && (
            <div className="ex-step winner">
              <div className="ex-step-b">⛰</div>
              <div className="ex-step-txt"><b>Cap applied</b></div>
              <span className="ex-step-tag tag-cap">CAPPED</span>
              <div className="ex-step-v">{fmt(res.sell)}</div>
            </div>
          )}
          <div className="ex-final">
            <div className="ex-final-row"><div className="ex-final-k">Sell price</div><div className="ex-final-v">{fmt(res.sell)}</div></div>
            <div className="ex-final-sub"><span>cost {fmt(samplePart.cost)} · profit <b>{fmt(res.sell-samplePart.cost)}</b></span><span><b>{margin.toFixed(0)}%</b> margin</span></div>
          </div>
        </>}
      </div>
    </div>
  );
}

/* ─── summary card (auto bullets) ─── */
function SummaryCard({ types, ageRule, condRules }){
  const line = pt => {
    if(isNA(pt)) return 'Not accepted';
    const parts = pt.clauses.map(cl=>{
      const m = METHODS[cl.method];
      if(m.kind==='flat') return 'dealer list';
      if(m.kind==='dollar') return `$${cl.value} fixed`;
      return cl.method==='pctList' ? `${cl.value}% of list` : `+${cl.value}% markup`;
    });
    let s = parts.join(pt.clauses.length>1 ? ` ${pt.join} ` : '');
    if(pt.clauses.length>1) s += `, ${pt.resolver}`;
    if(pt.cap.enabled) s += ` · cap ${CAP_TYPES[pt.cap.type].chip.replace('#',pt.cap.value)}`;
    return s;
  };
  return (
    <div className="sum">
      <div className="sum-t">Allianz — My Shop</div>
      {types.map(pt=>(
        <div className="sum-li" key={pt.id}><span className="bullet">•</span><span><b>{pt.name}:</b> {line(pt)}</span></div>
      ))}
      {ageRule && ageRule.enabled && (
        <div className="sum-li"><span className="bullet">•</span><span><b>Vehicle age:</b> {types.filter(t=>(ageRule.allowedTypes||[]).includes(t.id)).map(t=>t.name).join(' / ') || 'nothing'} only if under {ageRule.maxYears} years old</span></div>
      )}
      {(condRules||[]).filter(r=>r.enabled).map(r=>{
        const nm = id => (types.find(t=>t.id===id)||{}).name || id;
        const oc = COND_OUTCOMES[r.outcome.type];
        const cond = r.conditions.map(c=>{
          const p = COND_PREDICATES[c.predicate];
          return `${nm(c.partType)} ${p.label}${p.needsRef?' '+nm(c.ref):''}`;
        }).join(` ${r.join} `);
        let then;
        if(r.outcome.type==='method'){
          const cl=r.outcome.clause, m=METHODS[cl.method];
          then = m.kind==='flat' ? 'be priced at dealer list'
               : m.kind==='dollar' ? `be a fixed $${cl.value}`
               : cl.method==='pctList' ? `be priced at ${cl.value}% of list` : `be cost + ${cl.value}%`;
        } else {
          then = oc.label.replace('{ref}', nm(r.outcome.ref));
        }
        if(r.outcome.cap && r.outcome.cap.enabled){
          const c=COND_CAP_TYPES[r.outcome.cap.type];
          then += ` (${c.chip.replace('#', r.outcome.cap.value)})`;
        }
        return <div className="sum-li" key={r.id}><span className="bullet">•</span><span><b>When</b> {cond}, <b>{nm(r.target)}</b> should {then}</span></div>;
      })}
      <div className="sum-debtors">
        <div className="sum-dk">Mapped debtors (5)</div>
        <div className="sum-chips">
          {['Allianz','Club Marine','Hunter Premium','Territory Ins.','+1 more'].map(d=><span className="sum-chip" key={d}>{d}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ conditional (cross-type) rules ═══════════════ */
const OUT_METHODS = ['pctList','markupCost','listPrice','manual'];

function PtSelect({ value, onChange, types, cls, exclude }){
  const cur = types.find(t=>t.id===value) || types[0];
  const opts = exclude ? types.filter(t=>t.id!==exclude) : types;
  return (
    <>
      <span className="cr-dot" style={{background:cur.color}}/>
      <select className={cls} value={value} onChange={e=>onChange(e.target.value)}>
        {opts.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </>
  );
}

/* compact % / $ value input for method + cap operands */
function CrNum({ kind, value, onChange }){
  const dollar = kind==='dollar';
  return (
    <span className={"cr-num"+(dollar?' dollar':'')}>
      <input type="number" value={value} onChange={e=>onChange(parseFloat(e.target.value)||0)}/>
      <span className="u">{dollar?'$':'%'}</span>
    </span>
  );
}

function CondCard({ rule, onChange, onDelete, types }){
  const set = patch => onChange({...rule, ...patch});
  const setCond = (i, patch) => set({ conditions: rule.conditions.map((c,idx)=> idx===i?{...c,...patch}:c) });
  const setOut = patch => set({ outcome:{...rule.outcome, ...patch} });
  const oc = COND_OUTCOMES[rule.outcome.type];

  const addCond = () => {
    const used = new Set(rule.conditions.map(c=>c.partType));
    const next = types.find(t=>!used.has(t.id)) || types[0];
    set({ conditions:[...rule.conditions, {partType:next.id, predicate:'available'}] });
  };
  const rmCond = i => set({ conditions: rule.conditions.filter((_,idx)=>idx!==i) });

  // switching outcome type — seed the fields that outcome needs
  const changeOutType = t => {
    const cap = rule.outcome.cap || {enabled:false,type:'priceCeiling',value:0};
    if(t==='notAccepted') return set({outcome:{type:t}});
    if(t==='method')     return set({outcome:{type:t, clause:rule.outcome.clause||{method:'pctList',value:70}, cap}});
    const ref = rule.outcome.ref || (types.find(x=>x.id!==rule.target)||{}).id;
    return set({outcome:{type:t, ref, cap}});
  };
  const capType = COND_CAP_TYPES[(rule.outcome.cap||{}).type] || COND_CAP_TYPES.priceCeiling;

  // live effect on the sample line
  const res = resolveConditional(types, COND_SAMPLE.offers, [{...rule, enabled:true}]);
  const hit = res.trace.find(t=>t.target===rule.target);
  const matched = condMatches(rule, res.avail, res.base);
  const nm = id => (types.find(t=>t.id===id)||{}).name || id;

  return (
    <div className={"cr-card"+(rule.enabled?'':' off')}>
      {/* WHEN */}
      <div className="cr-row when">
        <div className="cr-kw w">When</div>
        <div className="cr-chunks">
          {rule.conditions.map((c,i)=>{
            const pred = COND_PREDICATES[c.predicate];
            return (
            <React.Fragment key={i}>
              {i>0 && (
                <div className="cr-join">
                  <button className={rule.join==='AND'?'on':''} onClick={()=>set({join:'AND'})}>AND</button>
                  <button className={rule.join==='OR'?'on':''} onClick={()=>set({join:'OR'})}>OR</button>
                </div>
              )}
              <span className="cr-cond">
                <PtSelect value={c.partType} onChange={v=>setCond(i,{partType:v})} types={types} cls="cr-ptsel"/>
                <select className="cr-predsel" value={c.predicate} onChange={e=>{
                  const p=e.target.value; const needsRef=COND_PREDICATES[p].needsRef;
                  setCond(i,{predicate:p, ref: needsRef ? (c.ref || (types.find(t=>t.id!==c.partType)||{}).id) : undefined});
                }}>
                  {Object.entries(COND_PREDICATES).map(([k,p])=><option key={k} value={k}>{p.label}</option>)}
                </select>
                {pred.needsRef && (
                  <span className="cr-refcond">
                    <PtSelect value={c.ref} onChange={v=>setCond(i,{ref:v})} types={types} cls="cr-ptsel" exclude={c.partType}/>
                  </span>
                )}
                {rule.conditions.length>1 && <button className="cr-condx" onClick={()=>rmCond(i)}>×</button>}
              </span>
            </React.Fragment>
          );})}
          {rule.conditions.length<types.length && (
            <button className="cr-addcond" onClick={addCond}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 5v14M5 12h14"/></svg>condition
            </button>
          )}
        </div>
        <div className="cr-lead">
          <label className="switch cr-sw"><input type="checkbox" checked={rule.enabled} onChange={e=>set({enabled:e.target.checked})}/><span className="switch-slider"/></label>
        </div>
      </div>
      {/* THEN */}
      <div className="cr-row">
        <div className="cr-kw t">Then</div>
        <div className="cr-chunks">
          <span className="cr-cond">
            <PtSelect value={rule.target} onChange={v=>set({target:v})} types={types} cls="cr-ptsel"/>
          </span>
          <span className="cr-word">should</span>
          <select className="cr-outsel" value={rule.outcome.type} onChange={e=>changeOutType(e.target.value)}>
            {Object.entries(COND_OUTCOMES).map(([k,o])=><option key={k} value={k}>{o.label.replace(" {ref}'s","").replace('{ref}','')}</option>)}
          </select>

          {oc.needsRef && (
            <select className="cr-refsel" value={rule.outcome.ref} onChange={e=>setOut({ref:e.target.value})}>
              {types.filter(t=>t.id!==rule.target).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}

          {oc.needsMethod && (()=>{
            const cl = rule.outcome.clause; const m = METHODS[cl.method];
            return (<>
              <select className="cr-methsel" value={cl.method} onChange={e=>{
                const mm=e.target.value; setOut({clause:{method:mm, value: METHODS[mm].kind==='dollar'?300:(mm==='pctList'?70:20)}});
              }}>
                {OUT_METHODS.map(k=><option key={k} value={k}>{METHODS[k].label}</option>)}
              </select>
              {(m.kind==='pct'||m.kind==='dollar') && (
                <CrNum kind={m.kind} value={cl.value} onChange={v=>setOut({clause:{...cl, value:v}})}/>
              )}
            </>);
          })()}

          {/* cap affordance (all outcomes except Not Accepted) */}
          {rule.outcome.type!=='notAccepted' && (
            (rule.outcome.cap && rule.outcome.cap.enabled) ? (
              <span className="cr-capchip">
                <span className="cr-cap-ico"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 20h18L14 4l-4 8-3-3-4 11z"/></svg></span>
                <select className="cr-capsel" value={rule.outcome.cap.type} onChange={e=>setOut({cap:{...rule.outcome.cap, type:e.target.value}})}>
                  {Object.entries(COND_CAP_TYPES).map(([k,c])=><option key={k} value={k}>{c.label}</option>)}
                </select>
                <CrNum kind={capType.pre?'dollar':'pct'} value={rule.outcome.cap.value} onChange={v=>setOut({cap:{...rule.outcome.cap, value:v}})}/>
                <button className="cr-capx" onClick={()=>setOut({cap:{...rule.outcome.cap, enabled:false}})}>×</button>
              </span>
            ) : (
              <button className="cr-capadd" onClick={()=>setOut({cap:{enabled:true, type:'priceCeiling', value:400}})}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M3 20h18L14 4l-4 8-3-3-4 11z"/></svg>add cap
              </button>
            )
          )}
        </div>
        <button className="cr-del" onClick={onDelete} title="Delete rule">×</button>
      </div>
      {/* live effect */}
      <div className="cr-eff">
        <span className="cr-eff-lbl">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v4l3 2"/></svg>
          On {COND_SAMPLE.name}
        </span>
        {matched && hit ? (
          <span className="cr-eff-part">
            <b>{nm(rule.target)}</b>{' '}
            {hit.before!=null && <><span className="cr-eff-before">{fmt(hit.before)}</span> <span className="cr-eff-arrow">→</span> </>}
            {hit.after==null ? <b style={{color:'var(--red)'}}>not accepted</b> : <span className="cr-eff-after">{fmt(hit.after)}</span>}
            {' '}<span className="cr-eff-tag">{oc.verb}{hit.ref?` · ${nm(hit.ref)}`:''}</span>
            {hit.capped && <span className="cr-eff-tag" style={{background:'var(--amber-lt)',color:'var(--amber)'}}>⛰ capped</span>}
          </span>
        ) : (
          <span className="cr-eff-idle">Conditions not met on this sample — no change</span>
        )}
      </div>
    </div>
  );
}

function ConditionalRules({ rules, setRules, types }){
  const update = r => setRules(rules.map(x=>x.id===r.id?r:x));
  const del = id => setRules(rules.filter(x=>x.id!==id));
  const add = () => {
    const a = types[0], b = types.find(t=>t.id!==a.id) || a;
    setRules([...rules, { id:'cr'+rules.length+1+'-'+a.id+b.id, enabled:true, join:'AND',
      conditions:[{partType:a.id,predicate:'available'},{partType:b.id,predicate:'available'}],
      target:a.id, outcome:{type:'matchRef', ref:b.id, cap:{enabled:false,type:'priceCeiling',value:0}} }]);
  };
  const active = rules.filter(r=>r.enabled).length;
  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-title">Conditional Rules · Cross-type</div>
        <span className="count">{active} active</span>
      </div>
      <div className="sec-body">
        <div className="cr-intro">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}><path d="M4 7h16M4 12h16M4 17h10"/></svg>
          <span>These fire <b>after</b> per-type pricing and can read across part types on the same line — e.g. <b>when OEM and Parallel are both quoted, price OEM at Parallel's rate.</b> Rules apply top-to-bottom.</span>
        </div>
        {rules.length===0 ? (
          <div className="cr-empty"><b>No conditional rules yet</b>Add one to price a part type by reference to another.</div>
        ) : (
          <div className="cr-wrap">
            {rules.map(r=><CondCard key={r.id} rule={r} onChange={update} onDelete={()=>del(r.id)} types={types}/>)}
          </div>
        )}
        <button className="cr-add" onClick={add}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 5v14M5 12h14"/></svg>
          Add conditional rule
        </button>
      </div>
    </div>
  );
}

/* ─── vehicle age rule (rule-level acceptable-part-types gate) ─── */
function VehicleAgeRule({ rule, setRule, types }){
  const allowed = rule.allowedTypes || [];
  const allowedNames = types.filter(t=>allowed.includes(t.id)).map(t=>t.name).join(' / ') || 'nothing';
  const toggle = id => {
    if(!rule.enabled) return;
    const next = allowed.includes(id) ? allowed.filter(x=>x!==id) : [...allowed, id];
    setRule({...rule, allowedTypes:next});
  };
  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-title">Vehicle Age Rule</div>
        <span className="count">{rule.enabled ? `${allowedNames} only under ${rule.maxYears} yrs` : 'Off'}</span>
      </div>
      <div className="sec-body">
        <div className={"vage"+(rule.enabled?'':' off')}>
          <div className="vage-lead">
            <label className="switch"><input type="checkbox" checked={rule.enabled} onChange={e=>setRule({...rule, enabled:e.target.checked})}/><span className="switch-slider"/></label>
            <div className="vage-sent">
              If the vehicle is less than
              <span className="vage-num"><input type="number" min="1" max="15" value={rule.maxYears} disabled={!rule.enabled} onChange={e=>setRule({...rule, maxYears:Math.max(1,parseInt(e.target.value)||1)})}/><span className="unit">yrs</span></span>
              old, only <b>{allowedNames}</b> parts are acceptable.
            </div>
          </div>
          <div className="vage-eff">
            <span className="vage-eff-lbl">Effect · click to toggle</span>
            {types.map(t=>{
              const on = allowed.includes(t.id);
              return (
                <button key={t.id} type="button" className={"vage-tog "+(on?'vage-ok':'vage-no')} disabled={!rule.enabled} onClick={()=>toggle(t.id)}>
                  {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>}
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── exceptions (safety-critical category groups, A&G style) ─── */
function ExcCard({ g, onChange, onDelete }){
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const oem = g.action==='oem-only';
  const addPart = () => { if(!draft.trim())return; onChange({...g, parts:[...g.parts, draft.trim()]}); setDraft(''); setAdding(false); };
  return (
    <div className="xg-card">
      <div className="xg-head">
        <div className="xg-ico" style={oem?{background:'var(--blue-lt)',color:'var(--blue)'}:{background:'#F4EEFF',color:'#7A5AF8'}}>
          {oem
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 7h20v10H2zM2 11h20"/></svg>}
        </div>
        <div className="xg-name">{g.category}</div>
        <span className={"xg-badge "+(oem?'oem':'bill')}>
          {oem
            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>OEM only</>
            : <>Direct bill · off-platform</>}
        </span>
        <button className="xg-del" onClick={onDelete} title="Remove category">×</button>
      </div>
      <div className="xg-body">
        {oem && (
          <div className="xg-na">
            <span className="lbl">Not acceptable:</span>
            {NOT_ACCEPTABLE.map(t=><span className="na-chip" key={t}>✕ {t}</span>)}
          </div>
        )}
        <div className="xg-parts">
          {g.parts.map((p,i)=>(
            <span className="part-chip" key={i}>{p}<span className="rm" onClick={()=>onChange({...g, parts:g.parts.filter((_,idx)=>idx!==i)})}>×</span></span>
          ))}
        </div>
        {g.note && <div className="xg-cnote"><b>Direct-bill arrangement.</b> {g.note}</div>}
        <div className="xg-addpart">
          {adding ? (
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input className="txt" style={{maxWidth:280}} autoFocus placeholder="Part name…" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPart()}/>
              <button className="btn btn-green btn-sm" onClick={addPart}>Add</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setAdding(false);setDraft('');}}>Cancel</button>
            </div>
          ) : (
            <button className="xg-addbtn" onClick={()=>setAdding(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 5v14M5 12h14"/></svg>Add part to this category
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Exceptions({ groups, setGroups }){
  const [cat, setCat] = useState('');
  const [action, setAction] = useState('oem-only');
  const partCount = groups.reduce((a,g)=>a+g.parts.length,0);
  const update = g => setGroups(groups.map(x=>x.id===g.id?g:x));
  const del = id => setGroups(groups.filter(x=>x.id!==id));
  const addCat = () => {
    if(!cat.trim())return;
    setGroups([...groups, {id:'c'+groups.length+1, category:cat.trim(), action, parts:[], note: action==='direct-bill'?'Managed off-platform via nominated supplier. Requires prior assessor approval.':undefined}]);
    setCat('');
  };
  return (
    <div className="sec">
      <div className="sec-head"><div className="sec-title">Exceptions · Parts flagged as not acceptable</div><span className="count">{groups.length} categories · {partCount} parts</span></div>
      <div className="sec-body">
        <div className="xg-note0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4m0 4h.01"/></svg>
          <span><b>OEM only for these safety-critical categories.</b> Used, Parallel, Aftermarket and Recon/Exchange are not acceptable. Any exception is managed case-by-case with prior assessor approval.</span>
        </div>
        <div className="xg">
          {groups.map(g=><ExcCard key={g.id} g={g} onChange={update} onDelete={()=>del(g.id)}/>)}
        </div>
        <div className="exc-add">
          <span className="lbl">New category</span>
          <input className="txt" style={{flex:1,minWidth:200}} placeholder="Category name — e.g. Steering Safety…" value={cat} onChange={e=>setCat(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCat()}/>
          <select className="sel sel-sm" value={action} onChange={e=>setAction(e.target.value)}>
            <option value="oem-only">OEM only</option>
            <option value="direct-bill">Direct bill · off-platform</option>
          </select>
          <button className="btn btn-green btn-sm" onClick={addCat}>Add category</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ RULE BUILDER PAGE ═══════════════ */
function RuleBuilder(){
  const [types, setTypes] = useState(getActiveTypes());
  const [focusId, setFocusId] = useState('oem');
  const [samplePart, setSamplePart] = useState(SAMPLE_PARTS[0]);
  const [exceptions, setExceptions] = useState(EXCEPTION_GROUPS);
  const [ageRule, setAgeRule] = useState(getActiveAgeRule());
  const [condRules, setCondRules] = useState(getActiveCondRules());
  const [saved, setSaved] = useState(false);
  const focusPt = types.find(t=>t.id===focusId) || types[0];
  const updateType = pt => setTypes(types.map(t=>t.id===pt.id?pt:t));
  const handleSave = () => {
    saveRuleConfig({ types, ageRule, condRules });
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };
  const handleCancel = () => {
    setTypes(getActiveTypes());
    setAgeRule(getActiveAgeRule());
    setCondRules(getActiveCondRules());
  };

  return (
    <>
      <TopNav active="Settings"/>
      <div className="subnav"><div className="subnav-inner">
        {['Client Info','General Settings','Margin Rules','Insurer Baselines','Users','Data Settings'].map(t=>
          <div key={t} className={"subnav-tab "+(t==='Margin Rules'?'on':'')}>{t}</div>)}
      </div></div>

      <div className="page">
        <div className="ph">
          <div>
            <div className="ph-eyebrow">Margin Rules</div>
            <div className="ph-title">Edit rule — Allianz</div>
            <div className="ph-sub">Set the pricing method per part type, then layer <b>conditional cross-type rules</b> on top — e.g. <b>when OEM and Parallel are both quoted, price OEM at Parallel's rate</b>. Reads as plain When → Then sentences.</div>
          </div>
        </div>

        <div className="rid">
          <div className="rid-av">AL</div>
          <div>
            <div className="rid-name">Allianz — My Shop <span className="tag tag-custom">Custom</span> <span className="tag tag-combo">Combination</span></div>
            <div className="rid-meta">Overrides the Allianz baseline · applies to Allianz &amp; sub-brands</div>
          </div>
          <div className="rid-status">
            <label className="switch"><input type="checkbox" defaultChecked/><span className="switch-slider"/></label>Active
          </div>
        </div>

        <div className="bl" style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:18,alignItems:'start'}}>
          <div>
            <div className="sec">
              <div className="sec-head"><div className="sec-title">Pricing Rules</div></div>
              <div className="sec-body">
                <div className="pt-tablehead"><div>Part Type</div><div>Pricing Method</div><div>Value</div><div>Default Part Number</div></div>
                {types.map(pt=>(
                  <PricingRow key={pt.id} pt={pt} onChange={updateType} focus={focusId===pt.id} onFocus={()=>setFocusId(pt.id)}/>
                ))}
                <div className="donor">
                  <div style={{flex:1}}>
                    <div className="donor-t">★ Donor Parts</div>
                    <div className="donor-s">Highlight recycled parts from participating suppliers on the Check Price screen when insurer, supplier and part type match.</div>
                  </div>
                  <select className="sel" style={{width:180}}><option>— Not mapped —</option><option>Capricorn</option></select>
                </div>
              </div>
            </div>

            <VehicleAgeRule rule={ageRule} setRule={setAgeRule} types={types}/>
            <ConditionalRules rules={condRules} setRules={setCondRules} types={types}/>
            <Exceptions groups={exceptions} setGroups={setExceptions}/>
          </div>

          <div className="rail">
            <ExamplePanel pt={focusPt} samplePart={samplePart} setSamplePart={setSamplePart}/>
            <SummaryCard types={types} ageRule={ageRule} condRules={condRules}/>
            <div className="rail-actions" style={{flexDirection:'column',gap:8}}>
              <div style={{display:'flex',gap:8,width:'100%'}}>
                <button className="btn btn-ghost btn-lg" style={{justifyContent:'center',flex:1}} onClick={handleCancel}>Cancel</button>
                <button className="btn btn-green btn-lg" style={{justifyContent:'center',flex:1}} onClick={handleSave}>{saved ? 'Saved ✓' : 'Save Changes'}</button>
              </div>
              <div style={{fontSize:11.5,color:'var(--text-3)',textAlign:'center'}}>Saved rules apply immediately on Check Price.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<RuleBuilder/>);
})();
