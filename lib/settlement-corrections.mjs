import {createHash} from 'node:crypto';
import {hit,creditAccount,hasActivePick} from './game.mjs';
import {slipPointTerms} from './scoring.mjs';
const money=n=>Math.round(n*100)/100;
export const settlementBasis=r=>createHash('sha256').update(JSON.stringify(r.matches.map(m=>[m.id,m.score,!!m.void]))).digest('hex');
// Official corrections use accepted odds/stakes and frozen point terms, never today's prices.
export function compensateSettlement(s,l,r,{at=new Date().toISOString(),source='API-FOOTBALL morning verification'}={}){
 if(!r.settled||r.matches.some(m=>!m.void&&(!m.officialConfirmed||m.status!=='FT'||!m.score)))return false;
 const basis=settlementBasis(r);if(r.settlementBasis===basis)return false;let changed=false,awaitingPoints=false;
 for(const slip of r.slips||[]){
  if(!slip.settled)continue;let points=0,perfect=true;
  let missing=false;
  for(const m of r.matches){if(!hasActivePick(m,slip))continue;const good=!!hit(slip.picks[m.id],m.score),terms=slipPointTerms(r,m,slip);perfect&&=good;if(good&&terms.correct===null){missing=true;break;}points+=good?terms.correct:terms.wrong;}
  if(missing){awaitingPoints=true;continue;}
  points=money(points);
  const allVoid=r.matches.every(m=>!hasActivePick(m,slip));if(perfect&&!allVoid&&slip.odds===null&&!r.pointsOnly)continue;
  const prize=r.pointsOnly?0:allVoid?slip.stake:perfect?money(slip.stake*slip.odds):0;
  const deltaPoints=money(points-(slip.points||0)),deltaCredits=money(prize-(slip.prize||0));
  if(!deltaPoints&&!deltaCredits)continue;
  const member=l.members.find(m=>m.uid===slip.uid)||l.removedMembers?.find(m=>m.uid===slip.uid);if(!member)throw Error('Settlement member unavailable');
  if(r.pointsOnly||r.source==='fantacalcio'){member.competitionPoints??={};member.competitionPoints[r.competitionKey]=money((member.competitionPoints[r.competitionKey]||0)+deltaPoints);}else member.points=money((member.points||0)+deltaPoints);
  const wallet=creditAccount(l,r,slip.uid);wallet.credits=money(wallet.credits+deltaCredits);
  const revision=(slip.correctionRevision||0)+1;
  s.ledger.push({id:`correction:${r.id}:${slip.uid}:${revision}`,league:l.id,uid:slip.uid,round:r.id,amount:deltaCredits,points:deltaPoints,reason:'Rettifica risultato ufficiale',source,created:at,basis,revision,previous:{points:slip.points,prize:slip.prize},next:{points,prize}});
  Object.assign(slip,{points,prize,correctionRevision:revision});changed=true;
 }
 if(!awaitingPoints)r.settlementBasis=basis;return changed;
}
