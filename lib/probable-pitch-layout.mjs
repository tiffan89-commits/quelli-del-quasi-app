import {normalizePitchLayout} from '../public/src/pitch-layout.mjs';

const editorialSources=new Set(['Confronto probabili','Sky Sport','SOS Fanta','La Gazzetta dello Sport','Corriere dello Sport']);
// Older cached forecasts have no direction marker. Resolve it while their
// private source metadata is still present, before creating the public DTO.
export function normalizeProbablePitches(lineups){
 if(lineups?.kind!=='probable')return lineups;
 return {...lineups,teams:lineups.teams.map(t=>{
  const defaultOrder=editorialSources.has(lineups.source)?'right-to-left':'left-to-right';
  const positioned=normalizePitchLayout(t,{defaultOrder});
  if(!t.forecastBase)return positioned;
  return {...positioned,forecastBase:normalizePitchLayout({...t,players:t.forecastBase},{defaultOrder}).players};
 })};
}
