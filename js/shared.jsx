/* Shared top navigation, used by every page. Loaded as JSX via Babel standalone. */
(function(){

const NAV = [
  ['Dashboard', 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', null],
  ['Get Price', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 3', null],
  ['Check Price', 'M9 12l2 2 4-4M12 3l7 4v5a8 8 0 01-7 8 8 8 0 01-7-8V7z', 'index.html'],
  ['Orders', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', null],
  ['Credits', 'M2 7h20v10H2zM2 11h20', null],
  ['Reports', 'M4 20V10M10 20V4M16 20v-7M22 20H2', null],
  ['Settings', 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-4l-.3 2.9a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.9h4l.3-2.9a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z', 'margin-rules.html'],
];

function TopNav({ active }){
  return (
    <div className="topnav" style={{height:64,gap:0}}>
      <div className="logo" style={{marginRight:24}}><div className="logo-mark">✓</div>PARTS<span>CHECK</span></div>
      <div style={{display:'flex',gap:2,flex:1,justifyContent:'center'}}>
        {NAV.map(([label,d,href])=>{
          const on = label===active;
          const style = {display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'6px 13px',borderRadius:8,cursor:href?'pointer':'default',color:on?'var(--green-d)':'var(--text-3)',textDecoration:'none'};
          const content = (
            <>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
              <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase'}}>{label}</span>
            </>
          );
          return href
            ? <a key={label} href={href} style={style}>{content}</a>
            : <div key={label} style={style}>{content}</div>;
        })}
      </div>
      <div className="nav-right">
        <div className="nav-shop"><div className="nav-shop-name">Gold City Panels</div><div className="nav-shop-role">Neil · Admin</div></div>
        <div className="avatar">NG</div>
      </div>
    </div>
  );
}

window.MROShared = { TopNav };
})();
