// A local timer only decides whether to read our shared server cache. No provider calls.
export function sportsWindowActive(rounds,now=Date.now()){
 return (rounds||[]).some(r=>(r.matches||[]).some(m=>{const start=Date.parse(m.officialKickoff||m.kickoff);return Number.isFinite(start)&&!['FT','PST','CANC','ABD','AWD','WO','TIMED_OUT'].includes(m.status)&&now>=start-120000&&now<=start+210*60000;}));
}
