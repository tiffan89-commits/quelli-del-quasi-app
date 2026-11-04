import {round2} from './rules.mjs';
export {MODEL} from './statistical-votes/config.mjs';
export {ROLE} from './statistical-votes/roles.mjs';
export {digest as hashInput,fixtureFingerprint,withoutRatings} from './statistical-votes/math.mjs';
export {normalizeFixture} from './statistical-votes/normalize.mjs';
export {calculateStatisticalVote as calculateVote} from './statistical-votes/model.mjs';
export {calibrateBaselines} from './statistical-votes/individual.mjs';
// Compatibility entry points: language models never alter the deterministic statistical vote.
export const validateAi=()=>null;
export const aiAdjustment=async()=>null;
export function priceList(players,{budget=500,teams=10}={}){const shares={P:.1,D:.18,C:.28,A:.44},slots={P:3,D:8,C:8,A:6},out=[];for(const role of Object.keys(slots)){const rows=players.filter(p=>p.role===role).map(p=>({...p,expectation:(p.avgFanta??6)*Math.min(1,(p.starts??p.played??0)/Math.max(5,p.matches??10))})).sort((a,b)=>b.expectation-a.expectation),replacement=rows[Math.min(rows.length-1,slots[role]*teams)]?.expectation||0,total=rows.reduce((n,p)=>n+Math.max(.1,p.expectation-replacement),0);for(const p of rows)out.push({...p,value:Math.max(1,Math.round((budget*teams*shares[role])*Math.max(.1,p.expectation-replacement)/Math.max(1,total))),valueWhy:`Disponibilità stimata e fantapunti attesi ${round2(p.expectation)}, confronto con un sostituto del ruolo ${role}`,valueModel:'quasi-value-v1'});}return out;}
