import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function careerImportSQL(data){
 if(data.source!=='API-FOOTBALL'||data.season!==2026||!data.players?.length)throw Error('Invalid import dataset');
 const ids=data.players.map(p=>p.apiId);if(ids.some(id=>!Number.isInteger(id)||id<=0)||new Set(ids).size!==ids.length)throw Error('Invalid or duplicated provider IDs');
 const body=JSON.stringify(data);if(body.includes('$qdqcareer$'))throw Error('Unsafe dataset delimiter');
 return `-- One-off acquisition staging. Final relational redesign is a separate task.
CREATE TABLE IF NOT EXISTS fanta.player_career_imports(player_api_id integer NOT NULL,season integer NOT NULL,payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),source text NOT NULL,acquired_at timestamptz NOT NULL,PRIMARY KEY(player_api_id,season));
DO $import$
DECLARE doc jsonb := $qdqcareer$${body}$qdqcareer$::jsonb; expected integer; actual integer;
BEGIN
 expected:=jsonb_array_length(doc->'players');
 INSERT INTO fanta.player_career_imports(player_api_id,season,payload,source,acquired_at)
 SELECT (p->>'apiId')::int,(doc->>'season')::int,p,doc->>'source',(doc->>'acquiredAt')::timestamptz FROM jsonb_array_elements(doc->'players') p
 ON CONFLICT(player_api_id,season) DO UPDATE SET payload=EXCLUDED.payload,source=EXCLUDED.source,acquired_at=EXCLUDED.acquired_at WHERE fanta.player_career_imports.payload IS DISTINCT FROM EXCLUDED.payload;
 -- Only clubs represented in the imported Serie A season/current squads.
 INSERT INTO fanta.clubs(id,api_id,name)
 SELECT DISTINCT ON(t->>'id') 'af:'||(t->>'id'),(t->>'id')::int,t->>'name' FROM (
 SELECT p->'currentTeam' AS t FROM jsonb_array_elements(doc->'players') p WHERE p->'currentTeam' IS NOT NULL
 UNION ALL SELECT st->'team' FROM jsonb_array_elements(doc->'players') p CROSS JOIN LATERAL jsonb_array_elements(p->'seasonStatistics') st WHERE st#>>'{league,id}'='135'
 ) clubs WHERE t->>'id' IS NOT NULL ON CONFLICT DO NOTHING;
 INSERT INTO fanta.players(id,api_id,club_id,name,role,data)
 SELECT 'af:'||(p->>'apiId'),(p->>'apiId')::int,CASE WHEN p#>>'{currentTeam,id}' IS NOT NULL THEN 'af:'||(p#>>'{currentTeam,id}') ELSE NULL END,p#>>'{profile,name}',CASE coalesce(p#>>'{profile,position}',p#>>'{seasonStatistics,0,games,position}') WHEN 'Goalkeeper' THEN 'P' WHEN 'G' THEN 'P' WHEN 'Defender' THEN 'D' WHEN 'D' THEN 'D' WHEN 'Midfielder' THEN 'C' WHEN 'M' THEN 'C' WHEN 'Attacker' THEN 'A' WHEN 'F' THEN 'A' END,
 jsonb_build_object('careerContext',p->'careerContext','importedPlayerProfile',p->'profile','careerImportSeason',(doc->>'season')::int)
 FROM jsonb_array_elements(doc->'players') p WHERE coalesce(p#>>'{profile,position}',p#>>'{seasonStatistics,0,games,position}') IN('Goalkeeper','G','Defender','D','Midfielder','M','Attacker','F')
 ON CONFLICT(api_id) DO UPDATE SET data=fanta.players.data||EXCLUDED.data WHERE (fanta.players.data->'careerContext',fanta.players.data->'importedPlayerProfile') IS DISTINCT FROM(EXCLUDED.data->'careerContext',EXCLUDED.data->'importedPlayerProfile');
 -- Existing catalog players with no recognized import role still receive metadata.
 UPDATE fanta.players t SET data=t.data||jsonb_build_object('careerContext',p->'careerContext','importedPlayerProfile',p->'profile','careerImportSeason',(doc->>'season')::int)
 FROM jsonb_array_elements(doc->'players') p WHERE t.api_id=(p->>'apiId')::int AND (t.data->'careerContext',t.data->'importedPlayerProfile') IS DISTINCT FROM(p->'careerContext',p->'profile');
 SELECT count(*) INTO actual FROM fanta.player_career_imports WHERE season=(doc->>'season')::int AND player_api_id IN(SELECT (p->>'apiId')::int FROM jsonb_array_elements(doc->'players') p);
 IF actual<>expected THEN RAISE EXCEPTION 'Career import incomplete: %/%',actual,expected; END IF;
 INSERT INTO fanta.jobs(id,data) VALUES('career-import:2026:v1',jsonb_build_object('players',expected,'source',doc->>'source','acquiredAt',doc->>'acquiredAt','verifiedCareers',(SELECT count(*) FROM jsonb_array_elements(doc->'players') p WHERE p#>>'{careerContext,verified}'='true'))) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data WHERE fanta.jobs.data IS DISTINCT FROM EXCLUDED.data;
 UPDATE fanta_state SET payload=jsonb_set(payload,'{careerImportReceipt}',(SELECT data FROM fanta.jobs WHERE id='career-import:2026:v1')) WHERE id=1 AND payload->'careerImportReceipt' IS DISTINCT FROM(SELECT data FROM fanta.jobs WHERE id='career-import:2026:v1');
END $import$;
`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const data=JSON.parse(await fs.readFile('data/player-career-import-2026.json','utf8'));await fs.writeFile('netlify/database/migrations/014_player_career_import.sql',careerImportSQL(data));console.log('Prepared career import migration:',data.players.length);}
